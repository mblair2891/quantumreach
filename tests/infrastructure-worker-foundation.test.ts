import { describe, expect, it } from "vitest";
import { CloudflareDnsProvider } from "@/lib/sending-infrastructure/cloudflare";

describe("infrastructure worker safety boundaries", () => {
  it("keeps Cloudflare automation disabled unless explicitly enabled", async () => {
    const prior = process.env.DNS_AUTOMATION_ENABLED;
    delete process.env.DNS_AUTOMATION_ENABLED;
    await expect(new CloudflareDnsProvider().health()).resolves.toMatchObject({ state: "NOT_CONFIGURED" });
    if (prior === undefined) delete process.env.DNS_AUTOMATION_ENABLED; else process.env.DNS_AUTOMATION_ENABLED = prior;
  });
  it("refuses DNS mutation when automation is disabled", async () => {
    const prior = process.env.DNS_AUTOMATION_ENABLED;
    process.env.DNS_AUTOMATION_ENABLED = "false";
    await expect(new CloudflareDnsProvider().upsertManagedRecord("zone", { type: "TXT", name: "example.com", value: "v=test" })).rejects.toThrow("disabled");
    if (prior === undefined) delete process.env.DNS_AUTOMATION_ENABLED; else process.env.DNS_AUTOMATION_ENABLED = prior;
  });
});
