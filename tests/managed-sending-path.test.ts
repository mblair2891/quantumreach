import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { evaluateSenderReadiness } from "@/lib/sending-infrastructure/readiness";
import { warmupDailyLimit } from "@/lib/sending-infrastructure/warmup";
import { dnsValueMatches, evaluateSpfTxtRecords } from "@/lib/sending-infrastructure/dns-observe";
import { displayDnsRecordName, nameserverProviderHint, zoneRelativeHost } from "@/lib/sending-infrastructure/dns-display";
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
    expect(
      evaluateSpfTxtRecords({
        type: "TXT",
        name: "slotdaddy.app",
        values: ["v=spf1 include:amazonses.com include:spf.privateemail.com ~all"],
      }),
    ).toMatchObject({ ok: true, status: "VERIFIED" });
    expect(
      evaluateSpfTxtRecords({
        type: "TXT",
        name: "slotdaddy.app",
        values: ['"v=spf1 include:AMAZONSES.com ~all"'],
      }),
    ).toMatchObject({ ok: true, status: "VERIFIED" });
    expect(
      evaluateSpfTxtRecords({
        type: "TXT",
        name: "slotdaddy.app",
        values: ["v=spf1 include:amazonses.com ~all", "v=spf1 include:spf.privateemail.com ~all"],
      }),
    ).toMatchObject({ ok: false, status: "FAILED", safeError: "MULTIPLE_SPF_RECORDS" });
    expect(
      evaluateSpfTxtRecords({ type: "TXT", name: "slotdaddy.app", values: [], error: "ENODATA" }),
    ).toMatchObject({ ok: false, status: "PENDING" });
  });

  it("never marks domain ready without a verify path and uses SES evidence", () => {
    const byo = source("lib/sending-infrastructure/byo-domain.ts");
    expect(byo).toContain("pollSesDomainIdentity");
    expect(byo).toContain("isSesIdentityVerified");
    expect(byo).toContain('purpose: "SES_VERIFICATION"');
    expect(byo).toContain('purpose: "DKIM"');
    expect(byo).toContain("verified ? \"WARMING\"");
    expect(source("lib/sending-infrastructure/ses-identity.ts")).toContain("VerifyDomainIdentityCommand");
    expect(source("lib/sending-infrastructure/outbound.ts")).toContain("sender.fromAddress");
    expect(source("lib/sending-infrastructure/outbound.ts")).not.toContain("noreply@quantumreach.app");
    expect(byo).toContain("lookupDnsRecord(record.type, record.name)");
    expect(byo).toContain("evaluateDnsRecordMatch");
    expect(byo).not.toContain("zoneRelativeHost(record.name");
    expect(source("app/dashboard/sending/domains/page.tsx")).toContain("Multiple SPF records");
  });

  it("shows zone-relative DNS hosts for common BYO records", () => {
    expect(zoneRelativeHost("slotdaddy.com", "slotdaddy.com")).toBe("@");
    expect(zoneRelativeHost("_dmarc.slotdaddy.com", "slotdaddy.com")).toBe("_dmarc");
    expect(zoneRelativeHost("_amazonses.slotdaddy.com", "slotdaddy.com")).toBe("_amazonses");
    expect(zoneRelativeHost("3dkaiwcmwplgdqq6jtkqybahf54hnvgx._domainkey.slotdaddy.com", "slotdaddy.com")).toBe(
      "3dkaiwcmwplgdqq6jtkqybahf54hnvgx._domainkey",
    );
    expect(displayDnsRecordName("slotdaddy.com", "slotdaddy.com")).toEqual({
      host: "@",
      fullName: "slotdaddy.com",
    });
    expect(nameserverProviderHint(["ns1.cloudflare.com"])).toMatch(/Cloudflare/i);
    expect(nameserverProviderHint(["ns1.example.org"])).toBeNull();
  });

  it("serves production trust pages and a warmup cron", () => {
    expect(source("app/page.tsx")).toContain("SiteFooter");
    expect(source("app/contact/page.tsx")).toContain("support@quantumreach.app");
    expect(source("app/privacy/page.tsx")).toContain("Privacy Policy");
    expect(source("app/terms/page.tsx")).toContain("Terms of Service");
    expect(source("app/pricing/page.tsx")).toContain("Launch");
    expect(source("vercel.json")).toContain("/api/internal/jobs/run");
    expect(source("lib/sending-infrastructure/workspace-mailbox.ts")).toContain("Verify the domain DNS first");
    expect(source("app/dashboard/sending/mailboxes/page.tsx")).toContain("Plan allows");
    expect(source("app/dashboard/sending/mailboxes/page.tsx")).toContain("No mailboxes yet. Create one on a verified domain to start warm-up.");
    expect(source("app/dashboard/sending/mailboxes/page.tsx")).not.toContain("Managed mailbox warm-up");
    expect(source("components/dashboard/create-mailbox-form.tsx")).toContain("Full address:");
    expect(source("components/dashboard/create-mailbox-form.tsx")).toContain("Create mailbox");
    expect(source("lib/managed-domains/purchase.ts")).toContain("DOMAIN_PURCHASING_ENABLED");
    expect(source("lib/managed-domains/purchase.ts")).toContain("purchaseManagedDomainForWorkspace");
    expect(source("lib/sending-infrastructure/outbound.ts")).not.toContain("noreply@quantumreach.app");
  });

  it("lets a workspace owner remove a BYO domain after confirmation", () => {
    const byo = source("lib/sending-infrastructure/byo-domain.ts");
    const actions = source("app/dashboard/sending/domains/actions.ts");
    const form = source("components/dashboard/remove-byo-domain-form.tsx");
    expect(byo).toContain("export async function removeByoDomain");
    expect(byo).toContain("BYO_DOMAIN_REMOVED");
    expect(byo).toContain("deleteSesDomainIdentity");
    expect(byo).toContain("This domain still has mail queued or sending");
    expect(byo).toContain("managedDomain.delete");
    expect(actions).toContain("removeByoDomainAction");
    expect(form).toContain("Remove domain");
    expect(form).toContain("This disconnects the domain from Quantum Reach. It does not delete the domain at your registrar.");
    expect(source("lib/sending-infrastructure/ses-identity.ts")).toContain("DeleteIdentityCommand");
  });

  it("suppresses bounced recipients from the SES webhook", () => {
    const webhook = source("app/api/webhooks/aws-ses/route.ts");
    expect(webhook).toContain("handleSesEvent");
    expect(webhook).toContain("HARD_BOUNCE");
    expect(webhook).toContain("cascadeDomainPause");
  });
});
