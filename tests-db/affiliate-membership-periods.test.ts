import "./server-only";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { AffiliateMembershipCode, AffiliateMembershipPeriod, AffiliateParticipant, AffiliateReferralAttribution } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  captureAffiliateAttribution,
  createAffiliateParticipant,
  endAffiliateMembership,
  lockAffiliateAttribution,
  resolveAffiliateCode,
  resumeSuspendedAffiliateMembership,
  startAffiliateMembership,
  suspendAffiliateMembership,
} from "@/lib/affiliates/service";

const remoteDatabaseTimeout = 15_000;
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const affiliateUserId = `affiliate-${suffix}`;
const customerUserId = `customer-${suffix}`;
const ids: { participant?: string; sessions: string[]; orders: string[] } = { sessions: [], orders: [] };
let participant: AffiliateParticipant;
let first: AffiliateMembershipPeriod & { code: AffiliateMembershipCode };
let captured: AffiliateReferralAttribution;

beforeAll(async () => {
  participant = await createAffiliateParticipant({
    email: `${suffix}@example.test`,
    displayName: "Lifecycle Affiliate",
    userId: affiliateUserId,
  });
  ids.participant = participant.id;
  first = await startAffiliateMembership({ participantId: participant.id, code: `FIRST-${suffix}` });
}, remoteDatabaseTimeout);

afterAll(async () => {
  await prisma.affiliateReferralAttribution.deleteMany({
    where: { OR: [{ acquisitionSessionId: { in: ids.sessions } }, { customerUserId: affiliateUserId }] },
  });
  await prisma.customerOrder.deleteMany({ where: { id: { in: ids.orders } } });
  await prisma.acquisitionSession.deleteMany({ where: { id: { in: ids.sessions } } });
  if (ids.participant) {
    await prisma.affiliateMembershipCode.deleteMany({ where: { membershipPeriod: { participantId: ids.participant } } });
    await prisma.affiliateMembershipPeriod.deleteMany({ where: { participantId: ids.participant } });
    await prisma.affiliateParticipant.delete({ where: { id: ids.participant } }).catch(() => undefined);
  }
  await prisma.$disconnect();
}, remoteDatabaseTimeout);

describe.sequential("PostgreSQL affiliate membership periods", () => {
  it("creates a participant and unique code, resolves case-insensitively, and suspends and resumes eligibility", async () => {
    expect(participant.id).toBeTruthy();
    expect(first.code.membershipPeriodId).toBe(first.id);
    expect(await resolveAffiliateCode(first.code.code.toLowerCase())).toEqual({
      codeId: first.code.id,
      membershipPeriodId: first.id,
    });

    await suspendAffiliateMembership(first.id);
    expect(await resolveAffiliateCode(first.code.code)).toBeNull();
    await resumeSuspendedAffiliateMembership(first.id);
    expect(await resolveAffiliateCode(first.code.code)).toEqual({
      codeId: first.code.id,
      membershipPeriodId: first.id,
    });
  }, remoteDatabaseTimeout);

  it("captures idempotently, locks authoritatively, and refuses to overwrite a locked attribution", async () => {
    const session = await prisma.acquisitionSession.create({
      data: { anonymousId: `anon-${suffix}`, landingPage: "/start" },
    });
    ids.sessions.push(session.id);

    captured = (await captureAffiliateAttribution({
      code: first.code.code,
      acquisitionSessionId: session.id,
    }))!;
    expect(captured.affiliateMembershipPeriodId).toBe(first.id);
    expect((await captureAffiliateAttribution({ code: first.code.code, acquisitionSessionId: session.id }))?.id).toBe(captured.id);

    const order = await prisma.customerOrder.create({ data: { userId: customerUserId } });
    ids.orders.push(order.id);
    const locked = await prisma.$transaction((tx) =>
      lockAffiliateAttribution({ acquisitionSessionId: session.id, orderId: order.id, customerUserId }, tx),
    );
    expect(locked?.status).toBe("LOCKED");
    expect((await captureAffiliateAttribution({ code: first.code.code, acquisitionSessionId: session.id }))?.id).toBe(locked?.id);
    expect((await prisma.affiliateReferralAttribution.findUniqueOrThrow({ where: { id: captured.id } })).status).toBe("LOCKED");
  }, remoteDatabaseTimeout);

  it("ends irreversibly, retires the old code, and rejoins with a new period without moving old referrals", async () => {
    await endAffiliateMembership(first.id, "PROGRAM_EXIT");
    await expect(resumeSuspendedAffiliateMembership(first.id)).rejects.toThrow();
    expect(await resolveAffiliateCode(first.code.code)).toBeNull();
    const retired = await prisma.affiliateMembershipCode.findUniqueOrThrow({ where: { id: first.code.id } });
    expect(retired.status).toBe("RETIRED");

    const second = await startAffiliateMembership({ participantId: participant.id, code: `RETURN-${suffix}` });
    expect(second.id).not.toBe(first.id);
    expect(second.code.id).not.toBe(first.code.id);
    expect(second.code.normalizedCode).not.toBe(first.code.normalizedCode);
    expect((await prisma.affiliateReferralAttribution.findUniqueOrThrow({ where: { id: captured.id } })).affiliateMembershipPeriodId).toBe(first.id);
  }, remoteDatabaseTimeout);

  it("invalidates definitive self-referrals instead of locking", async () => {
    const membership = await prisma.affiliateMembershipPeriod.findFirstOrThrow({
      where: { participantId: participant.id, status: "ACTIVE" },
      include: { code: true },
    });
    const session = await prisma.acquisitionSession.create({
      data: { anonymousId: `self-${suffix}`, landingPage: "/start" },
    });
    ids.sessions.push(session.id);
    await captureAffiliateAttribution({ code: membership.code!.code, acquisitionSessionId: session.id });
    const order = await prisma.customerOrder.create({ data: { userId: affiliateUserId } });
    ids.orders.push(order.id);
    const result = await prisma.$transaction((tx) =>
      lockAffiliateAttribution({ acquisitionSessionId: session.id, orderId: order.id, customerUserId: affiliateUserId }, tx),
    );
    expect(result?.status).toBe("INVALIDATED");
    expect(result?.invalidationReason).toBe("SELF_REFERRAL");
  }, remoteDatabaseTimeout);
});
