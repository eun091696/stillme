export const PROFESSION_CATEGORIES = [
  "medical",
  "legal",
  "finance",
  "corporate",
  "technology",
  "creative",
  "beauty",
  "fitness",
  "education",
  "sales-consulting",
  "real-estate",
  "hospitality-service",
  "entrepreneur",
  "architecture-interiors",
  "culinary",
  "arts-performance",
  "public-service",
  "therapy-wellness",
  "sports-coaching",
  "research-science",
  "media-broadcast",
  "general-professional",
] as const;

export type ProfessionCategory = (typeof PROFESSION_CATEGORIES)[number];

export type ProfessionStyleModule = Readonly<{
  id: `business-profile.profession.${ProfessionCategory}`;
  category: ProfessionCategory;
  prompt: string;
}>;
