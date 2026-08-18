"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";
import { prisma } from "@/lib/db/prisma";
import { parseString } from "@/lib/sending-infrastructure/operational";
import { createWorkspaceMailbox } from "@/lib/sending-infrastructure/workspace-mailbox";

function fail(message: string): never {
  redirect(`/dashboard/sending/mailboxes?error=${encodeURIComponent(message)}`);
}

export async function createMailboxAction(formData: FormData) {
  const { workspace } = await requireSubscriberWorkspaceAccess();
  try {
    await createWorkspaceMailbox({
      workspaceId: workspace.id,
      domainId: parseString(formData, "domainId")!,
      localPart: parseString(formData, "localPart")!,
      displayName: parseString(formData, "displayName", false),
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    fail(error instanceof Error ? error.message : "Could not create that mailbox.");
  }
  revalidatePath("/dashboard/sending/mailboxes");
  revalidatePath("/dashboard/onboarding");
  redirect("/dashboard/sending/mailboxes?created=1");
}
export async function requestWarmupAction(formData:FormData){const{workspace,user}=await requireSubscriberWorkspaceAccess();const profileId=parseString(formData,"profileId")!,action=parseString(formData,"action")!;if(!["PAUSE","OPERATOR_REVIEW","MAILBOX_REPLACEMENT"].includes(action))throw new Error("Unsupported subscriber action.");const profile=await prisma.mailboxWarmupProfile.findFirst({where:{id:profileId,workspaceId:workspace.id}});if(!profile)throw new Error("Warm-up profile not found.");if(action==="PAUSE")await prisma.mailboxWarmupProfile.update({where:{id:profile.id},data:{lifecycleState:"PAUSED",currentDailyLimit:0,lastDecision:"SUBSCRIBER_PAUSE"}});await prisma.$transaction([prisma.auditLog.create({data:{workspaceId:workspace.id,actorId:user.id,action:`WARMUP_${action}_REQUESTED`,entityType:"MailboxWarmupProfile",entityId:profile.id}}),prisma.customerNotificationIntent.create({data:{userId:user.id,recipient:user.email,templateKey:`WARMUP_${action}_REQUESTED`,metadata:{profileId:profile.id}}})]);revalidatePath("/dashboard/sending/mailboxes");}
