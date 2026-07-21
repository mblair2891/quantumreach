import { prisma } from "@/lib/db/prisma";
import { getMailboxProvider } from "./providers";

export async function createMailboxForJob(job: { id: string; idempotencyKey: string; payload: unknown; workspaceId: string | null }) {
  const mailboxId = typeof job.payload === "object" && job.payload && "mailboxId" in job.payload ? String((job.payload as { mailboxId: string }).mailboxId) : "";
  const mailbox = await prisma.managedMailbox.findFirst({ where: { id: mailboxId, ...(job.workspaceId ? { workspaceId: job.workspaceId } : {}) } });
  if (!mailbox) throw new Error("Managed mailbox was not found in the job workspace.");
  if (mailbox.status === "ACTIVE") return; // retry-safe: provider work already persisted.
  const provider = getMailboxProvider();
  const health = provider.getProviderHealth();
  if (health.state === "NOT_CONFIGURED") throw new Error("Mailbox provider is disabled or not configured.");
  const result = await provider.createMailbox({ workspaceId: mailbox.workspaceId, domainName: mailbox.emailAddress.split("@")[1], localPart: mailbox.localPart, displayName: mailbox.displayName ?? undefined, idempotencyKey: job.idempotencyKey });
  await prisma.$transaction([
    prisma.managedMailbox.update({ where: { id: mailbox.id }, data: { provider: provider.key as never, providerMailboxId: result.providerMailboxId, status: result.status as never, provisioningStatus: result.status } }),
    prisma.mailboxProvisioningEvent.updateMany({ where: { managedMailboxId: mailbox.id, idempotencyKey: job.idempotencyKey }, data: { status: result.status, safeSummary: result.safeMessage } }),
  ]);
  if (result.status !== "ACTIVE") throw new Error(result.safeMessage || "Mailbox provider did not activate the mailbox.");
}
