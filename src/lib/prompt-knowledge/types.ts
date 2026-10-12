export type KnowledgeCategory = "identity" | "lighting" | "quality" | "composition" | "restriction" | "underwater" | "portrait";

export type PromptKnowledgeRule = {
  id: string;
  category: KnowledgeCategory;
  english: string;
  korean: string;
  purpose: string;
  effect: readonly string[];
  worksFor: readonly string[];
  avoidFor: readonly string[];
  source: readonly string[];
  confidence: number;
  notes: string;
  testCount?: number;
  successRate?: number;
  failureTags?: readonly string[];
  lastUpdated?: string;
  relatedRules?: readonly string[];
  recommendedModel?: "flash" | "pro" | "both";
  promptVersion?: string;
};
