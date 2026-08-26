import { describe, expect, it } from "vitest";
import {
  appendCommercialFooter,
  applyOutreachMergeTags,
  assertInstantlyCompliance,
  hasUnsubscribeMergeTag,
  workspaceSendingIdentity,
} from "@/lib/outbound/compliance";

describe("Instantly campaign compliance helpers", () => {
  it("requires a physical address and unsubscribe merge tag", () => {
    expect(() =>
      assertInstantlyCompliance({
        subject: "Hi",
        body: "Hello {{unsubscribe_url}}",
        identity: { legalName: "Acme", physicalMailingAddress: "" },
      }),
    ).toThrow("physical mailing address");
    expect(() =>
      assertInstantlyCompliance({
        subject: "Hi",
        body: "Hello there",
        identity: { legalName: "Acme", physicalMailingAddress: "1 Main St" },
      }),
    ).toThrow("unsubscribe_url");
    expect(
      assertInstantlyCompliance({
        subject: "Hi",
        body: "Hello {{unsubscribe_url}}",
        identity: { legalName: "Acme", physicalMailingAddress: "1 Main St" },
      }),
    ).toBeUndefined();
  });

  it("applies unsubscribe merge tags and appends a commercial footer", () => {
    expect(hasUnsubscribeMergeTag("see {{unsubscribe_url}}")).toBe(true);
    const body = applyOutreachMergeTags("Hi {{FirstName}} {{unsubscribe_url}}", { firstName: "Ada" }, { unsubscribeUrl: "https://app.test/unsubscribe/tok" });
    const footered = appendCommercialFooter(body, { legalName: "Acme Inc", physicalMailingAddress: "1 Main St" }, "https://app.test/unsubscribe/tok");
    expect(footered).toContain("Hi Ada https://app.test/unsubscribe/tok");
    expect(footered).toContain("Acme Inc");
    expect(footered).toContain("1 Main St");
  });

  it("reads mailing identity from workspace columns or settings JSON", () => {
    expect(
      workspaceSendingIdentity({
        name: "Fallback",
        legalName: null,
        physicalMailingAddress: null,
        settings: { legalName: "From Settings", physicalMailingAddress: "9 King Rd" },
      }),
    ).toEqual({ legalName: "From Settings", physicalMailingAddress: "9 King Rd" });
  });
});
