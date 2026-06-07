export const TXT_IMPORT_MAX_FILES = 12;
export const TXT_IMPORT_MAX_FILE_SIZE_BYTES = 128 * 1024;
export const TXT_IMPORT_DESCRIPTION_FALLBACK = "Imported source-of-truth document.";


export const knowledgeImportAuthorityLevels = ["SYSTEM_DOCTRINE", "PRODUCT_DOCTRINE", "UX_COPY_DOCTRINE", "STRATEGY_FRAMEWORK", "DIAGNOSTIC_FRAMEWORK", "ROI_FRAMEWORK", "REPORT_FRAMEWORK", "ROADMAP_FRAMEWORK", "PROPOSAL_FRAMEWORK", "EXECUTION_HANDOFF", "AUTHORITY_TEMPLATE", "TRAINING_CURRICULUM", "COURSE_TEMPLATE", "REFERENCE"] as const;
export const knowledgeImportPriorities = ["GLOBAL", "HIGH", "MEDIUM", "LOW"] as const;
export const knowledgeImportStatuses = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export const knowledgeImportWorkflowStages = ["LEAD_CAPTURE", "OUTREACH", "DISCOVERY_CALL", "TRANSCRIPT_ANALYSIS", "DIAGNOSTIC_REVIEW", "REPORT_GENERATION", "ROADMAP_GENERATION", "PROPOSAL_GENERATION", "ROI_MODELING", "IMPLEMENTATION_HANDOFF", "AUTHORITY_ASSET_GENERATION", "ACADEMY_TRAINING", "APP_UX", "OFFER_CREATION", "POSITIONING"] as const;

export type KnowledgeImportAuthorityLevel = "SYSTEM_DOCTRINE" | "PRODUCT_DOCTRINE" | "UX_COPY_DOCTRINE" | "STRATEGY_FRAMEWORK" | "DIAGNOSTIC_FRAMEWORK" | "ROI_FRAMEWORK" | "REPORT_FRAMEWORK" | "ROADMAP_FRAMEWORK" | "PROPOSAL_FRAMEWORK" | "EXECUTION_HANDOFF" | "AUTHORITY_TEMPLATE" | "TRAINING_CURRICULUM" | "COURSE_TEMPLATE" | "REFERENCE";
export type KnowledgeImportPriority = "GLOBAL" | "HIGH" | "MEDIUM" | "LOW";
export type KnowledgeImportStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type KnowledgeImportWorkflowStage = "LEAD_CAPTURE" | "OUTREACH" | "DISCOVERY_CALL" | "TRANSCRIPT_ANALYSIS" | "DIAGNOSTIC_REVIEW" | "REPORT_GENERATION" | "ROADMAP_GENERATION" | "PROPOSAL_GENERATION" | "ROI_MODELING" | "IMPLEMENTATION_HANDOFF" | "AUTHORITY_ASSET_GENERATION" | "ACADEMY_TRAINING" | "APP_UX" | "OFFER_CREATION" | "POSITIONING";

export type TxtImportPreview = {
  clientId: string;
  title: string;
  description: string;
  sourceFileName: string;
  sourceMimeType: string;
  sourceText: string;
  documentType: KnowledgeImportAuthorityLevel;
  authorityLevel: KnowledgeImportAuthorityLevel;
  priority: KnowledgeImportPriority;
  workflowStages: KnowledgeImportWorkflowStage[];
  version: string;
  status: KnowledgeImportStatus;
};

export type TxtImportFileInput = { name: string; type?: string; size: number; text: string; clientId?: string };

export function cleanImportTitle(value: string) {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/^#{1,6}\s*/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[\s:—-]+$/g, "")
    .trim()
    .slice(0, 140)
    .trim();
}

function meaningfulLines(sourceText: string) {
  return sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^[-*_`#\s]+$/.test(line));
}

export function extractTxtImportTitle(sourceFileName: string, sourceText: string) {
  const heading = meaningfulLines(sourceText).find((line) => {
    const cleaned = cleanImportTitle(line);
    return cleaned.length >= 3 && cleaned.length <= 140 && (/^#{1,6}\s+/.test(line) || /^[A-Z][A-Z0-9\s,:;—&()/-]{6,}$/.test(line) || /^[A-Z][\w\s,;:—&()/-]{6,}$/.test(line));
  });
  return cleanImportTitle(heading ?? sourceFileName) || "Untitled knowledge document";
}

export function extractTxtImportDescription(sourceText: string) {
  const paragraphs = sourceText
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/^#{1,6}\s*/gm, "").replace(/[*_`>\[\]()]/g, "").replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length >= 30 && !/^[-–—\s]+$/.test(paragraph));
  const description = paragraphs[0] ?? meaningfulLines(sourceText).join(" ").replace(/[*_`>#]/g, " ").replace(/\s+/g, " ").trim();
  if (!description) return TXT_IMPORT_DESCRIPTION_FALLBACK;
  const limited = description.slice(0, 420).trim();
  return limited.length < description.length ? `${limited.replace(/[.,;:!?\s]+$/g, "")}…` : limited;
}

export function validateTxtImportFile(file: { name: string; type?: string; size: number }) {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".txt")) return `${file.name} is not supported. Upload .txt files only.`;
  if (file.size > TXT_IMPORT_MAX_FILE_SIZE_BYTES) return `${file.name} is too large. The per-file limit is ${Math.round(TXT_IMPORT_MAX_FILE_SIZE_BYTES / 1024)} KB.`;
  return null;
}

export function validateTxtImportFileCount(count: number) {
  if (count > TXT_IMPORT_MAX_FILES) return `Upload ${TXT_IMPORT_MAX_FILES} or fewer .txt files at a time.`;
  if (count < 1) return "Select at least one .txt file to import.";
  return null;
}

const stageDefaults: Record<KnowledgeImportAuthorityLevel, KnowledgeImportWorkflowStage[]> = {
  SYSTEM_DOCTRINE: ["DISCOVERY_CALL", "TRANSCRIPT_ANALYSIS", "DIAGNOSTIC_REVIEW", "REPORT_GENERATION", "ROADMAP_GENERATION", "PROPOSAL_GENERATION", "IMPLEMENTATION_HANDOFF"],
  PRODUCT_DOCTRINE: ["LEAD_CAPTURE", "DISCOVERY_CALL", "TRANSCRIPT_ANALYSIS", "DIAGNOSTIC_REVIEW", "REPORT_GENERATION", "ROADMAP_GENERATION", "PROPOSAL_GENERATION"],
  UX_COPY_DOCTRINE: ["APP_UX", "TRANSCRIPT_ANALYSIS", "REPORT_GENERATION", "ROADMAP_GENERATION", "PROPOSAL_GENERATION"],
  STRATEGY_FRAMEWORK: ["DISCOVERY_CALL", "TRANSCRIPT_ANALYSIS", "REPORT_GENERATION", "ROADMAP_GENERATION", "ROI_MODELING", "POSITIONING"],
  DIAGNOSTIC_FRAMEWORK: ["DISCOVERY_CALL", "TRANSCRIPT_ANALYSIS", "DIAGNOSTIC_REVIEW"],
  ROI_FRAMEWORK: ["ROI_MODELING", "PROPOSAL_GENERATION"],
  REPORT_FRAMEWORK: ["DIAGNOSTIC_REVIEW", "REPORT_GENERATION", "ROADMAP_GENERATION", "PROPOSAL_GENERATION"],
  ROADMAP_FRAMEWORK: ["ROADMAP_GENERATION", "IMPLEMENTATION_HANDOFF"],
  PROPOSAL_FRAMEWORK: ["PROPOSAL_GENERATION"],
  EXECUTION_HANDOFF: ["PROPOSAL_GENERATION", "ROADMAP_GENERATION", "IMPLEMENTATION_HANDOFF"],
  AUTHORITY_TEMPLATE: ["AUTHORITY_ASSET_GENERATION", "OUTREACH", "POSITIONING"],
  TRAINING_CURRICULUM: ["ACADEMY_TRAINING", "DISCOVERY_CALL", "TRANSCRIPT_ANALYSIS", "ROI_MODELING", "OFFER_CREATION"],
  COURSE_TEMPLATE: ["ACADEMY_TRAINING"],
  REFERENCE: []
};

export function suggestTxtImportMetadata(sourceFileName: string, title: string, sourceText = "") {
  const haystack = `${sourceFileName} ${title} ${sourceText.slice(0, 2000)}`.toLowerCase();
  let documentType: KnowledgeImportAuthorityLevel = "REFERENCE";
  let authorityLevel: KnowledgeImportAuthorityLevel = "REFERENCE";
  let priority: KnowledgeImportPriority = "MEDIUM";

  if (haystack.includes("operating doctrine")) { documentType = "SYSTEM_DOCTRINE"; authorityLevel = "SYSTEM_DOCTRINE"; priority = "GLOBAL"; }
  else if (haystack.includes("rollout directive")) { documentType = "PRODUCT_DOCTRINE"; authorityLevel = "PRODUCT_DOCTRINE"; priority = "GLOBAL"; }
  else if (haystack.includes("copy") && haystack.includes("ux") && haystack.includes("decision architecture")) { documentType = "UX_COPY_DOCTRINE"; authorityLevel = "UX_COPY_DOCTRINE"; priority = "GLOBAL"; }
  else if (haystack.includes("business strategy") || haystack.includes("exit architecture")) { documentType = "STRATEGY_FRAMEWORK"; authorityLevel = "STRATEGY_FRAMEWORK"; priority = "HIGH"; }
  else if (haystack.includes("execution handoff")) { documentType = "EXECUTION_HANDOFF"; authorityLevel = "EXECUTION_HANDOFF"; priority = "HIGH"; }
  else if (haystack.includes("finesse")) { documentType = "REPORT_FRAMEWORK"; authorityLevel = "STRATEGY_FRAMEWORK"; priority = "HIGH"; }
  else if (haystack.includes("curriculum")) { documentType = "TRAINING_CURRICULUM"; authorityLevel = "TRAINING_CURRICULUM"; priority = "MEDIUM"; }
  else if (haystack.includes("mastery template")) { documentType = "COURSE_TEMPLATE"; authorityLevel = "COURSE_TEMPLATE"; priority = "MEDIUM"; }
  else if (haystack.includes("authority figure") || haystack.includes("authority dominance")) { documentType = "AUTHORITY_TEMPLATE"; authorityLevel = "AUTHORITY_TEMPLATE"; priority = "MEDIUM"; }

  return { documentType, authorityLevel, priority, workflowStages: stageDefaults[authorityLevel] };
}

export function buildTxtImportPreview(file: TxtImportFileInput): TxtImportPreview {
  const title = extractTxtImportTitle(file.name, file.text);
  const suggestion = suggestTxtImportMetadata(file.name, title, file.text);
  return {
    clientId: file.clientId ?? `${file.name}-${file.size}`,
    title,
    description: extractTxtImportDescription(file.text),
    sourceFileName: file.name,
    sourceMimeType: file.type || "text/plain",
    sourceText: file.text,
    documentType: suggestion.documentType,
    authorityLevel: suggestion.authorityLevel,
    priority: suggestion.priority,
    workflowStages: suggestion.workflowStages,
    version: "1.0",
    status: "DRAFT"
  };
}
