/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import { createToken, isSuppressed, queueOrSendEmail } from "./email";
export async function evaluateCampaignCompliance(workspaceId: string, campaignId: string) {
  const campaign = await (prisma as any).emailCampaign.findFirst({ where: { id: campaignId, workspaceId }, include: { senderIdentity: { include: { domain: true } }, recipients: true, steps: true } });
  if (!campaign) throw new Error("Campaign not found.");
  const failures: string[] = [];
  if (!campaign.senderIdentityId) failures.push("sender_identity_required");
  if (!campaign.physicalMailingAddress) failures.push("physical_mailing_address_required");
  if (!campaign.steps.length) failures.push("sequence_step_required");
  if (campaign.steps.some((s: any) => !s.body.includes("{{unsubscribe_url}}"))) failures.push("unsubscribe_token_required");
  if (campaign.senderIdentity?.domain?.status !== "VERIFIED" && process.env.EMAIL_SANDBOX_MODE === "false") failures.push("verified_domain_required");
  for (const r of campaign.recipients) if (await isSuppressed(workspaceId, r.email)) failures.push("suppressed_recipient_present");
  return { approved: failures.length === 0, failures };
}
export async function launchCampaign(workspaceId: string, campaignId: string) {
  const check = await evaluateCampaignCompliance(workspaceId, campaignId);
  if (!check.approved) return (prisma as any).emailCampaign.update({ where: { id: campaignId }, data: { complianceStatus: "REJECTED", complianceChecklist: { failures: check.failures } } });
  return (prisma as any).emailCampaign.update({ where: { id: campaignId }, data: { complianceStatus: "APPROVED", status: "READY", complianceChecklist: { approvedAt: new Date().toISOString() } } });
}
export function renderEmail(body: string, contact: any, unsubscribeToken: string, schedulingToken?: string) {
  const base = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return body.replaceAll("{{first_name}}", contact.firstName ?? "there").replaceAll("{{company}}", contact.company?.name ?? "your company").replaceAll("{{unsubscribe_url}}", `${base}/unsubscribe/${unsubscribeToken}`).replaceAll("{{scheduling_url}}", schedulingToken ? `${base}/book/${schedulingToken}` : "");
}
export async function addCampaignRecipient(workspaceId: string, campaignId: string, contact: { id?: string; email: string }) {
  if (await isSuppressed(workspaceId, contact.email)) return null;
  return (prisma as any).emailRecipient.create({ data: { workspaceId, campaignId, contactId: contact.id, email: contact.email.toLowerCase(), unsubscribeToken: createToken(), schedulingToken: createToken(18) } });
}
export async function queueFirstStep(workspaceId: string, campaignId: string) {
  const campaign = await (prisma as any).emailCampaign.findFirst({ where: { id: campaignId, workspaceId }, include: { steps: { orderBy: { stepNumber: "asc" } }, recipients: true } });
  if (!campaign || campaign.complianceStatus !== "APPROVED") throw new Error("Campaign must be compliance-approved before queueing sends.");
  const step = campaign.steps[0];
  return Promise.all(campaign.recipients.map((r: any) => queueOrSendEmail({ workspaceId, campaignId, sequenceStepId: step.id, contactId: r.contactId, to: r.email, subject: step.subject, html: renderEmail(step.body, {}, r.unsubscribeToken, r.schedulingToken), senderIdentityId: campaign.senderIdentityId })));
}
