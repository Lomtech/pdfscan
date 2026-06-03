export type Category =
  | "programming"
  | "framework"
  | "cloud-devops"
  | "database"
  | "tool"
  | "methodology"
  | "language"
  | "soft-skill";

export interface Skill {
  id: string;
  label: string;
  category: Category;
  aliases?: string[];
  matchTerms?: string[];
  caseSensitive?: boolean;
}

export type DocType = "JD" | "CV" | "unknown";

export interface Classification {
  type: DocType;
  confidence: number;
  jdScore: number;
  cvScore: number;
}

export interface SkillHit {
  skillId: string;
  count: number;
}

export interface ExtractionResult {
  skills: SkillHit[];
  yearsExperience: number | null;
  educationKeywords: string[];
  spokenLanguages: string[];
}

export type ParseMethod = "text" | "ocr" | "empty";

export interface AiSkill {
  name: string;
  category: string | null;
  level: number | null;
  levelMax: number | null;
  required: boolean | null;
}

export interface AiResult {
  roleTitle: string | null;
  docType: string | null;
  skills: AiSkill[];
  model: string;
  at: number;
}

export interface DocRecord {
  id: string;
  name: string;
  bytes: number;
  text: string;
  parseMethod: ParseMethod;
  classification: Classification;
  extraction: ExtractionResult;
  addedAt: number;
  /** Original PDF bytes, kept so KI-Analyse can re-render pages on demand. */
  blob?: Blob;
  /** Structured result from the optional Claude-vision analysis. */
  ai?: AiResult;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  programming: "Programmiersprache",
  framework: "Framework/Library",
  "cloud-devops": "Cloud/DevOps",
  database: "Datenbank",
  tool: "Tool/Plattform",
  methodology: "Methodik/Standard",
  language: "Sprache",
  "soft-skill": "Soft Skill",
};
