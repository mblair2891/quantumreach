import { prisma } from "@/lib/db/prisma";
import { createMailboxForJob } from "@/lib/sending-infrastructure/worker";
import { processQueuedEmailSend } from "@/lib/sending-infrastructure/campaign-service";
import { CloudflareDnsProvider } from "@/lib/sending-infrastructure/cloudflare";
import { expireWarmupOverrides, runMailboxWarmupEvaluation } from "@/lib/sending-infrastructure/warmup-service";

/** Durable serverless job runner. Jobs are claimed with a conditional update so two cron
 * invocations cannot execute the same record. Provider operations must remain idempotent. */
export type InfrastructureJobType =
  | "DOMAIN_REGISTRATION" | "DOMAIN_DNS_CONFIGURATION" | "MAILBOX_PROVISION"
  | "MAILBOX_SYNC" | "SENDER_IDENTITY_SETUP" | "SES_IDENTITY_VERIFICATION"
  | "CAMPAIGN_SEND_BATCH" | "REPLY_SYNC" | "USAGE_RECONCILIATION"
  | "DELIVERABILITY_RECONCILIATION" | "SUBSCRIPTION_RECONCILIATION"
  | "PROVIDER_HEALTH_CHECK" | "SETUP_QUEUE_RECALCULATION"
  | "WARMUP_DAILY_EVALUATION" | "WARMUP_OVERRIDE_EXPIRATION";

const retryDelayMs = (attempt: number) => Math.min(6 * 60 * 60_000, 60_000 * 2 ** Math.max(0, attempt - 1));
const safeError = (error: unknown) => error instanceof Error ? error.message.slice(0, 500) : "Unexpected job failure.";

export async function enqueueDurableJob(input: { workspaceId?: string | null; jobType: InfrastructureJobType | string; idempotencyKey: string; payload?: unknown; maxAttempts?: number }) {
  return prisma.infrastructureJob.upsert({
    where: { idempotencyKey: input.idempotencyKey }, update: {},
    create: { workspaceId: input.workspaceId, jobType: input.jobType, idempotencyKey: input.idempotencyKey, payload: input.payload as object ?? {}, maxAttempts: input.maxAttempts ?? 5 },
  });
}

export async function claimNextInfrastructureJob(workerId: string, now = new Date()) {
  const candidate = await prisma.infrastructureJob.findFirst({
    where: { status: { in: ["QUEUED", "RETRY_SCHEDULED"] }, nextAttemptAt: { lte: now } },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
  });
  if (!candidate) return null;
  const claimed = await prisma.infrastructureJob.updateMany({
    where: { id: candidate.id, status: { in: ["QUEUED", "RETRY_SCHEDULED"] }, lockedAt: null },
    data: { status: "RUNNING", lockedAt: now, lockedBy: workerId, attemptCount: { increment: 1 } },
  });
  return claimed.count === 1 ? prisma.infrastructureJob.findUnique({ where: { id: candidate.id } }) : null;
}

export async function recoverStaleInfrastructureJobs(now = new Date(), leaseMs = 10 * 60_000) {
  const staleBefore = new Date(now.getTime() - leaseMs);
  return prisma.infrastructureJob.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: staleBefore } },
    data: { status: "RETRY_SCHEDULED", lockedAt: null, lockedBy: null, nextAttemptAt: now, lastSafeError: "Worker lease expired; job safely rescheduled." },
  });
}

async function executeClaimedJob(job: NonNullable<Awaited<ReturnType<typeof claimNextInfrastructureJob>>>) {
  console.info(JSON.stringify({ event: "infrastructure_job_execute", jobId: job.id, jobType: job.jobType, workspaceId: job.workspaceId, attempt: job.attemptCount }));
  if (job.jobType === "MAILBOX_PROVISION") await createMailboxForJob(job);
  else if (job.jobType === "DOMAIN_DNS_CONFIGURATION") await configureDomainDns(job);
  else if (job.jobType === "WARMUP_DAILY_EVALUATION") { const payload=job.payload as {profileId?:string;evaluationDate?:string;isSimulated?:boolean;scenarioIdentifier?:string}; if(!payload.profileId)throw new Error("Warm-up profile is required."); await runMailboxWarmupEvaluation({profileId:payload.profileId,evaluationDate:payload.evaluationDate?new Date(payload.evaluationDate):undefined,isSimulated:payload.isSimulated,scenarioIdentifier:payload.scenarioIdentifier}); }
  else if (job.jobType === "WARMUP_OVERRIDE_EXPIRATION") await expireWarmupOverrides();
  else if (job.jobType === "CAMPAIGN_SEND_BATCH") { const payload=job.payload as {emailSendId?:string}; if(!payload.emailSendId)throw new Error("Email send is required."); await processQueuedEmailSend(payload.emailSendId); }
  // Other job types are deliberately durable no-ops until their configured provider adapter exists.
  // They remain observable rather than reporting fabricated external success.
  else if (["MAILBOX_SYNC", "REPLY_SYNC", "SES_IDENTITY_VERIFICATION"].includes(job.jobType)) {
    throw new Error(`${job.jobType} requires a configured provider adapter.`);
  }
}

/** Applies only records owned by Quantum Reach.  The provider boundary never deletes a
 * zone or an unmarked record, making this safe to retry after a partial failure. */
async function configureDomainDns(job: NonNullable<Awaited<ReturnType<typeof claimNextInfrastructureJob>>>) {
  const domainId = typeof job.payload === "object" && job.payload && "domainId" in job.payload
    ? String((job.payload as { domainId: unknown }).domainId) : "";
  const domain = await prisma.managedDomain.findFirst({
    where: { id: domainId, ...(job.workspaceId ? { OR: [{ workspaceId: job.workspaceId }, { assignments: { some: { workspaceId: job.workspaceId, status: "ACTIVE" } } }] } : {}) },
    include: { dnsRecords: true },
  });
  if (!domain) throw new Error("Managed domain was not found in the job workspace.");
  const provider = new CloudflareDnsProvider();
  if (!provider.enabled()) throw new Error("DNS automation is disabled.");
  const zone = await provider.findZone(domain.rootDomain);
  if (!zone) throw new Error("Cloudflare zone was not found for the managed domain.");
  for (const record of domain.dnsRecords) {
    const result = await provider.upsertManagedRecord(zone.id, { type: record.type, name: record.name, value: record.value, ttl: record.ttl ?? undefined });
    const providerRecordId = result && typeof result === "object" && "id" in result ? String(result.id) : null;
    await prisma.domainDnsRecord.update({ where: { id: record.id }, data: { status: "APPLIED", providerRecordId, safeError: null, lastCheckedAt: new Date() } });
  }
}

export async function runInfrastructureJobs(input: { workerId: string; limit?: number }) {
  const limit = Math.max(1, Math.min(input.limit ?? 10, 50));
  const summary = { claimed: 0, succeeded: 0, retried: 0, failed: 0, blocked: 0 };
  for (let i = 0; i < limit; i++) {
    const job = await claimNextInfrastructureJob(input.workerId);
    if (!job) break;
    summary.claimed++;
    try {
      await executeClaimedJob(job);
      await prisma.infrastructureJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", lockedAt: null, lockedBy: null, lastSafeError: null } });
      summary.succeeded++;
    } catch (error) {
      const message = safeError(error);
      const exhausted = job.attemptCount >= job.maxAttempts;
      const blocked = /requires a configured|disabled/i.test(message);
      await prisma.infrastructureJob.update({ where: { id: job.id }, data: {
        status: blocked ? "BLOCKED" : exhausted ? "FAILED" : "RETRY_SCHEDULED", lockedAt: null, lockedBy: null, lastSafeError: message,
        nextAttemptAt: blocked || exhausted ? job.nextAttemptAt : new Date(Date.now() + retryDelayMs(job.attemptCount)),
      } });
      if (blocked) summary.blocked++; else if (exhausted) summary.failed++; else summary.retried++;
    }
  }
  return summary;
}

export async function retryInfrastructureJobByOperator(id: string) {
  return prisma.infrastructureJob.updateMany({ where: { id, status: { in: ["FAILED", "BLOCKED"] } }, data: { status: "QUEUED", lockedAt: null, lockedBy: null, nextAttemptAt: new Date(), lastSafeError: null } });
}
export async function cancelInfrastructureJobByOperator(id: string) {
  return prisma.infrastructureJob.updateMany({ where: { id, status: { in: ["QUEUED", "RETRY_SCHEDULED", "BLOCKED"] } }, data: { status: "CANCELED", lockedAt: null, lockedBy: null } });
}
