import { describe, expect, it } from "vitest";
import { formatSeverityLabel, normalizeRiskAssumptionSections } from "@/lib/diagnostics/report-sections";

describe("diagnostic report risk and assumption sections", () => {
  it("normalizes stored analyzer risks and assumptions into business-facing content", () => {
    const sections = normalizeRiskAssumptionSections({
      risks: [
        { label: "Resistance to New Processes", severity: "MEDIUM", description: "Some team members may resist adopting structured CRM workflows." },
        { title: "Insufficient Training", severity: "high", impact: "New tools may be used inconsistently." }
      ],
      assumptions: [
        "Leadership is committed to CRM implementation and training.",
        { assumption: "Sales teams are open to adopting structured workflows." }
      ]
    });

    expect(sections.risks).toEqual([
      { label: "Resistance to New Processes", severity: "Medium", description: "Some team members may resist adopting structured CRM workflows." },
      { label: "Insufficient Training", severity: "High", description: "New tools may be used inconsistently." }
    ]);
    expect(sections.assumptions).toEqual(["Leadership is committed to CRM implementation and training.", "Sales teams are open to adopting structured workflows."]);
  });

  it("returns empty production sections instead of raw JSON for missing values", () => {
    const sections = normalizeRiskAssumptionSections({ risks: null, assumptions: {} });

    expect(sections.risks).toEqual([]);
    expect(sections.assumptions).toEqual([]);
  });

  it("supports legacy risk arrays and readable severity labels", () => {
    const sections = normalizeRiskAssumptionSections([{ risk: "Adoption delay", severity: "urgent_issue", detail: "Rollout may slip." }]);

    expect(sections.risks).toEqual([{ label: "Adoption delay", severity: "Urgent Issue", description: "Rollout may slip." }]);
    expect(sections.assumptions).toEqual([]);
    expect(formatSeverityLabel("LOW")).toBe("Low");
  });
});
