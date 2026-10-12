import { PROFESSION_CLASSIFICATION_REGISTRY } from "./registry";
import type { ProfessionCategory } from "./types";

export function normalizeProfessionForClassification(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[._-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function classifyProfession(profession: string): ProfessionCategory {
  const normalized = normalizeProfessionForClassification(profession);
  const match = PROFESSION_CLASSIFICATION_REGISTRY.find(({ aliases }) =>
    aliases.some((alias) =>
      normalized.includes(normalizeProfessionForClassification(alias)),
    ),
  );
  return match?.category ?? "general-professional";
}
