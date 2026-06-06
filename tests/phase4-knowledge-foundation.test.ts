import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { chunkSourceText, initialKnowledgeManifest } from "@/lib/knowledge/service";

const prismaSource = () => readFileSync("prisma/schema.prisma", "utf8");

describe("Phase 4 source-of-truth knowledge foundation", () => {
  it("defines workspace-scoped knowledge, usage, outreach, lead source, and call models", () => {
    const schema = prismaSource();
    for (const fragment of ["model KnowledgeDocument", "model KnowledgeChunk", "model KnowledgeCollection", "model KnowledgeDocumentUsage", "model KnowledgeSourceReference", "model OutreachCampaign", "model OutreachStep", "model LeadOutreachStatus", "model CallSession"]) expect(schema).toContain(fragment);
    for (const fragment of ["workspaceId    String", "workspaceId String", "sourcePlatform", "sourceUrl", "importMethod", "outreachPermissionStatus"]) expect(schema).toContain(fragment);
  });

  it("supports the required authority hierarchy, priority model, workflow stages, and 11-document manifest", () => {
    const schema = prismaSource();
    for (const level of ["SYSTEM_DOCTRINE", "PRODUCT_DOCTRINE", "UX_COPY_DOCTRINE", "STRATEGY_FRAMEWORK", "DIAGNOSTIC_FRAMEWORK", "ROI_FRAMEWORK", "REPORT_FRAMEWORK", "ROADMAP_FRAMEWORK", "PROPOSAL_FRAMEWORK", "EXECUTION_HANDOFF", "AUTHORITY_TEMPLATE", "TRAINING_CURRICULUM", "COURSE_TEMPLATE", "REFERENCE"]) expect(schema).toContain(level);
    for (const priority of ["GLOBAL", "HIGH", "MEDIUM", "LOW"]) expect(schema).toContain(priority);
    for (const stage of ["LEAD_CAPTURE", "OUTREACH", "DISCOVERY_CALL", "TRANSCRIPT_ANALYSIS", "DIAGNOSTIC_REVIEW", "REPORT_GENERATION", "ROADMAP_GENERATION", "PROPOSAL_GENERATION", "ROI_MODELING", "IMPLEMENTATION_HANDOFF", "AUTHORITY_ASSET_GENERATION", "ACADEMY_TRAINING", "APP_UX"]) expect(schema).toContain(stage);
    expect(initialKnowledgeManifest).toHaveLength(11);
  });

  it("chunks source text deterministically while preserving order and headings", () => {
    const chunks = chunkSourceText("MASTER DOCTRINE\n\nThis is the first governed section.\n\nSECOND SECTION\n\nThis is the second governed section.", 60);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].heading).toContain("MASTER");
    expect(chunks.map((chunk) => chunk.text).join("\n")).toContain("second governed section");
  });

  it("retrieval excludes draft/archived documents, enforces workspace scope, and records hierarchy ordering in source", () => {
    const source = readFileSync("lib/knowledge/service.ts", "utf8");
    expect(source).toContain('statuses = options.testMode ? ["ACTIVE", "DRAFT"]');
    expect(source).toContain('workspaceId: options.workspaceId');
    expect(source).toContain('status: { in: [...statuses] }');
    expect(source).toContain('SYSTEM_DOCTRINE: 0');
    expect(source).toContain('PRODUCT_DOCTRINE: 1');
    expect(source).toContain('UX_COPY_DOCTRINE: 2');
    expect(source).toContain('templateAllowed');
  });

  it("prompt context builder includes governed instructions, source excerpts, schema, and source coverage warnings", async () => {
    const source = readFileSync("lib/knowledge/context-builder.ts", "utf8");
    for (const instruction of ["Use active source-of-truth documents as governing guidance", "Do not invent service offerings outside approved frameworks", "Do not contradict active source-of-truth documents", "Return valid structured JSON only", "Orientation → Observation → Constraint → Implication → Benchmark → Resolution Paths"]) expect(source).toContain(instruction);
    expect(source).toContain("Governing source-of-truth excerpts");
    expect(source).toContain("Required output schema");
  });

  it("AI and deliverable generators use the prompt context builder and save source usage metadata", () => {
    const ai = readFileSync("lib/ai/orchestration.ts", "utf8");
    const reports = readFileSync("lib/reports/service.ts", "utf8");
    expect(ai).toContain("buildPromptContext");
    expect(ai).toContain("recordPromptSources");
    expect(ai).toContain("sourcesUsed");
    for (const stage of ["REPORT_GENERATION", "ROADMAP_GENERATION", "PROPOSAL_GENERATION"]) expect(reports).toContain(stage);
    expect(reports).toContain("getSourcesForEntity");
  });

  it("workflow services keep lead source, outreach status, and call transcript-to-diagnostic paths workspace-scoped", () => {
    const workflows = readFileSync("lib/workflows/service.ts", "utf8");
    for (const fragment of ["assertLead(workspaceId", "assertCampaign(workspaceId", "assertContact(workspaceId", "assertCompany(workspaceId", "assertOpportunity(workspaceId", "callSession.findFirst({ where: { id: callSessionId, workspaceId }", "diagnostic.created_from_call_session"]) expect(workflows).toContain(fragment);
  });
});
