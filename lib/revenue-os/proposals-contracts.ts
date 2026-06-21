/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { createToken, hashSnapshot } from "./email";
export async function createProposalFromDeal(workspaceId: string, dealId: string, title = "Revenue OS Proposal") {
  return (prisma as any).proposal.create({ data: { workspaceId, opportunityId: dealId, title, status: "DRAFT", content: { sections: ["executive_summary", "problem", "proposed_solution", "scope", "timeline", "investment", "next_steps"], workflowStatus: "DRAFT" } } });
}
export async function acceptProposalAndGenerateContract(workspaceId: string, proposalId: string, templateContent = "Agreement for {{proposal_title}}") {
  const proposal = await (prisma as any).proposal.findFirst({ where: { id: proposalId, workspaceId } });
  if (!proposal) throw new Error("Proposal not found.");
  await (prisma as any).proposal.update({ where: { id: proposalId }, data: { content: { ...(proposal.content ?? {}), workflowStatus: "ACCEPTED" } } });
  return (prisma as any).contract.create({ data: { workspaceId, proposalId, title: `${proposal.title} Contract`, status: "DRAFT", content: { html: templateContent.replace("{{proposal_title}}", proposal.title), workflowStatus: "DRAFT", counselReviewRequired: true } } });
}
export async function rejectProposalToNurture(workspaceId: string, proposalId: string, dealId?: string) {
  await (prisma as any).proposal.update({ where: { id: proposalId }, data: { content: { workflowStatus: "REJECTED", nurtureRecommended: true } } });
  if (dealId) await (prisma as any).activity.create({ data: { workspaceId, type: "drip.assigned", title: "Proposal rejected; nurture drip recommended", relatedType: "Opportunity", relatedId: dealId } }).catch(() => null);
}
export async function createSigner(workspaceId: string, contractId: string, email: string, name?: string) {
  await (prisma as any).contractAuditEvent.create({ data: { workspaceId, contractId, eventType: "sent", safeMetadata: { emailDomain: email.split("@")[1] ?? null } } }).catch(() => null);
  return (prisma as any).contractSigner.create({ data: { workspaceId, contractId, email: email.toLowerCase(), name, token: createToken(), tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14) } });
}
export async function signContract(token: string, input: { typedName: string; acceptDisclosure: boolean; ip?: string; userAgent?: string }) {
  if (!input.acceptDisclosure) throw new Error("Electronic signature disclosure must be accepted.");
  const signer = await (prisma as any).contractSigner.findUnique({ where: { token } });
  if (!signer || signer.tokenExpiresAt < new Date()) throw new Error("Invalid or expired signer token.");
  const existing = await (prisma as any).contractSignature.count({ where: { signerId: signer.id } });
  if (existing) throw new Error("Signed contracts are immutable.");
  const ipHash = input.ip ? crypto.createHash("sha256").update(input.ip).digest("hex") : undefined;
  const signature = await (prisma as any).contractSignature.create({ data: { workspaceId: signer.workspaceId, signerId: signer.id, signerName: input.typedName, signerEmail: signer.email, method: "TYPED", consentedAt: new Date(), ipHash, userAgent: input.userAgent } });
  await (prisma as any).contractAuditEvent.create({ data: { workspaceId: signer.workspaceId, contractId: signer.contractId, signerId: signer.id, eventType: "signed", safeMetadata: { method: "typed" } } });
  await (prisma as any).contract.update({ where: { id: signer.contractId }, data: { status: "FINAL", content: { signed: true, signedAt: new Date().toISOString() } } }).catch(() => null);
  await (prisma as any).contractDocumentArtifact.create({ data: { workspaceId: signer.workspaceId, contractId: signer.contractId, artifactType: "html_audit_certificate", htmlSnapshot: `Signed by ${input.typedName}`, sha256: hashSnapshot(`${signer.contractId}:${input.typedName}:${signature.signedAt}`) } });
  await (prisma as any).clientWorkspaceProvisioningRequest.create({ data: { workspaceId: signer.workspaceId, contractId: signer.contractId, requestedWorkspaceName: `${input.typedName} Workspace` } }).catch(() => null);
  return signature;
}
