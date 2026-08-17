import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { evaluateSenderReadiness } from "@/lib/sending-infrastructure/readiness";
import { warmupDailyLimit } from "@/lib/sending-infrastructure/warmup";
import { dnsValueMatches } from "@/lib/sending-infrastructure/dns-observe";
import { getSendingGates, isSesIdentityVerified, unavailableMessage } from "@/lib/sending-infrastructure/gates";

const source = (path: string) => readFileSync(path, "utf8");

describe("managed sending Path A", () => {
  afterEach(() => {
    delete process.env.EMAIL_SENDING_ENABLED;
    delete process.env.MANAGED_SENDING_ENABLED;
    delete process.env.EMAIL_SANDBOX_MODE;
  });

  it("keeps live provider work behind gates", () => {
    expect(getSendingGates({}).managedSendingEnabled).toBe(false);
    expect(getSendingGates({}).sesConfigured).toBe(false);
    expect(getSendingGates({ EMAIL_SENDING_ENABLED: "true", MANAGED_SENDING_ENABLED: "true" }).managedSendingEnabled).toBe(true);
    expect(unavailableMessage("Managed outbound sending")).toContain("unavailable in this environment");
  });

  it("blocks send when readiness flags are false", () => {
    const ready = {
      domainReady: true,
      mailboxActive: true,
      sesIdentityReady: true,
      dkimReady: true,
      complianceReady: true,
      rampReady: true,
      sendingEnabled: true,
    };
    expect(evaluateSenderReadiness(ready).ready).toBe(true);
    expect(evaluateSenderReadiness({ ...ready, domainReady: false }).blockingReasons).toContain("DOMAIN_READY");
    expect(evaluateSenderReadiness({ ...ready, sendingEnabled: false }).blockingReasons).toContain("SENDING_ENABLED");
  });

  it("enforces the conservative warmup daily cap", () => {
    expect(warmupDailyLimit(1)).toBe(5);
    expect(warmupDailyLimit(10)).toBe(15);
    expect(warmupDailyLimit(30)).toBe(35);
  });

  it("matches DNS values without treating placeholders as verified", () => {
    expect(dnsValueMatches("v=spf1 include:amazonses.com ~all", ["v=spf1 include:amazonses.com ~all"])).toBe(true);
    expect(dnsValueMatches("abc.dkim.amazonses.com", ["xyz.dkim.amazonses.com"])).toBe(false);
    expect(isSesIdentityVerified("Success")).toBe(true);
    expect(isSesIdentityVerified("PENDING")).toBe(false);
  });

  it("never marks domain ready without a verify path and uses SES evidence", () => {
    const byo = source("lib/sending-infrastructure/byo-domain.ts");
    expect(byo).toContain("pollSesDomainIdentity");
    expect(byo).toContain("isSesIdentityVerified");
    expect(byo).toContain("verified ? \"WARMING\"");
    expect(source("lib/sending-infrastructure/ses-identity.ts")).toContain("VerifyDomainIdentityCommand");
    expect(source("lib/sending-infrastructure/outbound.ts")).toContain("sender.fromAddress");
    expect(source("lib/sending-infrastructure/outbound.ts")).not.toContain("noreply@quantumreach.app");
  });

  it("suppresses bounced recipients from the SES webhook", () => {
    const webhook = source("app/api/webhooks/aws-ses/route.ts");
    expect(webhook).toContain("handleSesEvent");
    expect(webhook).toContain("HARD_BOUNCE");
    expect(webhook).toContain("cascadeDomainPause");
  });
});
