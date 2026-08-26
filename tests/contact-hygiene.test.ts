import { describe, expect, it } from "vitest";
import {
  classifyMapped,
  hygienizeRows,
  isCampaignEligible,
  mapContactRow,
  normalizeEmail,
  parseCsv,
  requiredFieldsFromTemplate,
  sanitizeCompany,
  summarizeHygiene,
} from "@/lib/contacts/hygiene";

const messyCsv = `email,firstName,lastName,company,companyDomain
  Ada@Acme.COM , ada, lovelace, Acme, acme.com
not-an-email, Pat, Prospect, Acme, acme.com
bob@gmail.com, bob, jones, Acme, acme.com
carol@acme.com, carol, nguyen, Acme 🚀 Inc, acme.com
dup@acme.com, A, One, Acme, acme.com
dup@acme.com, A, Two, Acme, acme.com
`;

describe("contact hygiene", () => {
  it("normalizes email trim and lower", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });

  it("title-cases names and strips company emoji", () => {
    const mapped = mapContactRow({ email: "ada@acme.com", firstName: "ada", lastName: "lovelace", company: "Acme 🚀" });
    expect(mapped.firstName).toBe("Ada");
    expect(mapped.lastName).toBe("Lovelace");
    expect(mapped.company).toBe("Acme");
    expect(mapped.companyRaw).toBe("Acme 🚀");
    expect(sanitizeCompany("Acme 🚀 Inc").hadEmoji).toBe(true);
  });

  it("splits messy CSV into ready, needs_review, invalid, and merged duplicates", () => {
    const rows = hygienizeRows(parseCsv(messyCsv));
    const byEmail = (email: string) => rows.filter((row) => row.mapped.email === email);

    const ready = rows.find((row) => row.mapped.email === "ada@acme.com");
    expect(ready?.hygieneStatus).toBe("READY");
    expect(ready?.isValid).toBe(true);

    const invalid = rows.find((row) => row.mapped.email === "not-an-email");
    expect(invalid?.hygieneStatus).toBe("INVALID");
    expect(invalid?.flags).toContain("invalid_email");

    const mismatch = rows.find((row) => row.mapped.email === "bob@gmail.com");
    expect(mismatch?.hygieneStatus).toBe("NEEDS_REVIEW");
    expect(mismatch?.flags).toContain("domain_mismatch");
    expect(mismatch?.hygieneStatus).not.toBe("READY");

    const emoji = rows.find((row) => row.mapped.email === "carol@acme.com");
    expect(emoji?.hygieneStatus).toBe("NEEDS_REVIEW");
    expect(emoji?.flags).toContain("emoji_in_company");
    expect(emoji?.mapped.company).toBe("Acme Inc");

    const dups = byEmail("dup@acme.com");
    expect(dups).toHaveLength(2);
    expect(dups.filter((row) => row.isPrimary)).toHaveLength(1);
    expect(dups.find((row) => !row.isPrimary)?.flags).toContain("duplicate_in_upload");
    expect(dups.find((row) => row.isPrimary)?.mapped.lastName).toBe("One");

    const summary = summarizeHygiene(rows);
    expect(summary.readyCount).toBe(2);
    expect(summary.mergedCount).toBe(1);
    expect(summary.invalidCount).toBe(1);
    expect(summary.needsReviewCount).toBe(2);
  });

  it("flags workspace duplicates without creating a second primary", () => {
    const rows = hygienizeRows(
      [{ email: "ada@acme.com", firstName: "Ada", lastName: "Lovelace" }],
      { existingByEmail: new Map([["ada@acme.com", { id: "c1", email: "ada@acme.com", firstName: "Ada" }]]) },
    );
    expect(rows[0].flags).toContain("duplicate_in_workspace");
    expect(rows[0].isPrimary).toBe(true);
    expect(rows.filter((row) => row.isPrimary)).toHaveLength(1);
  });

  it("marks suppressed rows suppressed", () => {
    const rows = hygienizeRows([{ email: "ada@acme.com", firstName: "Ada", lastName: "Lovelace" }], {
      suppressedEmails: new Set(["ada@acme.com"]),
    });
    expect(rows[0].hygieneStatus).toBe("SUPPRESSED");
    expect(rows[0].isValid).toBe(false);
  });

  it("treats missing required fields as needs_review", () => {
    const classified = classifyMapped(
      { email: "ada@acme.com", firstName: "", lastName: "", company: "" },
      { requiredFields: ["email", "firstName", "company"] },
    );
    expect(classified.hygieneStatus).toBe("NEEDS_REVIEW");
    expect(classified.flags).toContain("missing_required_field");
  });

  it("does not enroll needs_review, invalid, or archived contacts", () => {
    expect(isCampaignEligible({ email: "a@x.com", hygieneStatus: "READY", firstName: "A" })).toBe(true);
    expect(isCampaignEligible({ email: "a@x.com", hygieneStatus: "NEEDS_REVIEW", firstName: "A" })).toBe(false);
    expect(isCampaignEligible({ email: "a@x.com", hygieneStatus: "INVALID", firstName: "A" })).toBe(false);
    expect(isCampaignEligible({ email: "bad", hygieneStatus: "READY", firstName: "A" })).toBe(false);
    expect(requiredFieldsFromTemplate("Hi {{FirstName}}", "See you at {{Company}}")).toEqual(["firstName", "company"]);
    expect(isCampaignEligible({ email: "a@x.com", hygieneStatus: "READY", firstName: "" }, ["firstName"])).toBe(false);
  });
});
