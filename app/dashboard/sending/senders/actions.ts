"use server";import { revalidatePath } from "next/cache";import { requireSubscriberWorkspaceAccess } from "@/lib/saas/access";import { prisma } from "@/lib/db/prisma";import { enforceAllowance } from "@/lib/sending-infrastructure/readiness";import { getWorkspaceEffectiveEntitlements } from "@/lib/sending-infrastructure/operational";
export async function createSenderIdentityAction(form:FormData){const {workspace}=await requireSubscriberWorkspaceAccess();const mailboxId=String(form.get('mailboxId')||'');const mailbox=await prisma.managedMailbox.findFirst({where:{id:mailboxId,workspaceId:workspace.id}});if(!mailbox)throw new Error('Mailbox not found.');const {effective}=await getWorkspaceEffectiveEntitlements(workspace.id);const used=await prisma.infrastructureSenderIdentity.count({where:{workspaceId:workspace.id}});const allowance=enforceAllowance('sender',effective,used);if(!allowance.allowed)throw new Error(allowance.reason);await prisma.infrastructureSenderIdentity.create({data:{workspaceId:workspace.id,managedMailboxId:mailbox.id,managedDomainId:mailbox.managedDomainId,fromAddress:mailbox.emailAddress,displayName:String(form.get('displayName')||mailbox.displayName||''),sendingEnabled:false,campaignEligible:false}});revalidatePath('/dashboard/sending/senders');}

export async function sendWorkspaceTestEmailAction(form: FormData) {
  const { workspace, user } = await requireSubscriberWorkspaceAccess();
  const { sendWorkspaceTestEmail } = await import("@/lib/sending-infrastructure/outbound");
  const result = await sendWorkspaceTestEmail({
    workspaceId: workspace.id,
    actorUserId: user.id,
    senderId: String(form.get("senderId") ?? ""),
    to: String(form.get("to") ?? ""),
  });
  if (!result.sent) throw new Error(result.reason);
  revalidatePath("/dashboard/sending/senders");
}
