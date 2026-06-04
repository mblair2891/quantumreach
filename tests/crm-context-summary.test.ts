import { describe, expect, it } from "vitest";
import { summarizeCrmContext } from "@/lib/crm/context-summary";

describe("summarizeCrmContext", () => {
  it("turns opportunity CRM context into business-facing fields", () => {
    const summary = summarizeCrmContext("Opportunity", {
      name: "Acme Diagnostic Engagement",
      amount: "15000",
      status: "OPEN",
      closeDate: null,
      company: null,
      contact: null
    });

    expect(summary.recordType).toBe("Opportunity");
    expect(summary.fields).toEqual([
      { label: "Name", value: "Acme Diagnostic Engagement" },
      { label: "Amount", value: "$15,000" },
      { label: "Status", value: "OPEN", tone: "status" },
      { label: "Close date", value: "—" },
      { label: "Company", value: "Not linked", href: undefined },
      { label: "Contact", value: "Not linked", href: undefined }
    ]);
  });

  it("adds readable related record names and links when ids are available", () => {
    const summary = summarizeCrmContext("Opportunity", {
      name: "Expansion",
      amount: 1200.5,
      status: "OPEN",
      closeDate: "2026-07-01T00:00:00.000Z",
      company: { id: "company_1", name: "Acme" },
      contact: { id: "contact_1", firstName: "Ari", lastName: "Patel" }
    });

    expect(summary.fields.find((field) => field.label === "Amount")?.value).toBe("$1,200.50");
    expect(summary.fields.find((field) => field.label === "Company")).toMatchObject({ value: "Acme", href: "/dashboard/companies/company_1" });
    expect(summary.fields.find((field) => field.label === "Contact")).toMatchObject({ value: "Ari Patel", href: "/dashboard/contacts/contact_1" });
  });

  it("uses not-linked placeholders instead of raw empty objects", () => {
    const summary = summarizeCrmContext(null, null);

    expect(summary.recordType).toBe("Not linked");
    expect(summary.fields).toEqual([
      { label: "Name", value: "Not linked" },
      { label: "Status", value: "Not linked", tone: "status" }
    ]);
  });
});
