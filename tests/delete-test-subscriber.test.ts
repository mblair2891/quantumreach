import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");

describe("delete test subscriber affiliate cleanup", () => {
  it("deletes referral attributions before membership codes", () => {
    const impl = source("lib/admin/delete-test-subscriber.ts");
    const migration = source("prisma/migrations/20260801000000_affiliate_membership_periods/migration.sql");

    expect(migration).toContain("AffiliateReferralAttribution_code_fkey");
    expect(impl).toContain("cleanupAffiliateLifecycle");
    expect(impl).toContain("affiliateReferralAttribution.deleteMany");
    expect(impl).toContain("affiliateCodeId");
    expect(impl).toContain("affiliateMembershipPeriodId");
    expect(impl).toContain("customerUserId");
    expect(impl).toContain("orderId");
    expect(impl).toContain("purchaserEmail");
    expect(impl).toContain("affiliateMembershipCode.deleteMany");
    expect(impl).toContain("affiliateMembershipPeriod.deleteMany");
    expect(impl).toContain("affiliateParticipant.delete");
    expect(impl).toContain("$transaction");

    const attributionIdx = impl.indexOf("affiliateReferralAttribution.deleteMany");
    const codeIdx = impl.indexOf("affiliateMembershipCode.deleteMany");
    const periodIdx = impl.indexOf("affiliateMembershipPeriod.deleteMany");
    const participantIdx = impl.lastIndexOf("affiliateParticipant.delete");
    expect(attributionIdx).toBeGreaterThan(0);
    expect(attributionIdx).toBeLessThan(codeIdx);
    expect(codeIdx).toBeLessThan(periodIdx);
    expect(periodIdx).toBeLessThan(participantIdx);
  });

  it("does not delete membership codes before attributions", () => {
    const impl = source("lib/admin/delete-test-subscriber.ts");
    const loop = impl.slice(impl.indexOf("for (const participant of participants)"));
    expect(loop.indexOf("affiliateReferralAttribution.deleteMany")).toBeLessThan(
      loop.indexOf("affiliateMembershipCode.deleteMany"),
    );
    expect(loop).not.toMatch(
      /affiliateMembershipCode\.deleteMany[\s\S]*affiliateReferralAttribution\.deleteMany/,
    );
  });
});
