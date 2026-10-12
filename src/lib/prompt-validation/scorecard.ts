import type { ValidationCaseId, ValidationScores, ValidationScoreResult } from "./types";

export const VALIDATION_SCORE_LABELS = {
  identity: "동일인 유지",
  facialGeometry: "얼굴 구조 유지",
  skin: "피부 유지",
  hair: "헤어 유지",
  expression: "표정 유지",
  naturalness: "자연스러움",
  requestFulfillment: "요청 수행",
} as const;

export function evaluateValidationScorecard(scores: ValidationScores, caseId?: ValidationCaseId): ValidationScoreResult {
  const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
  return {
    result: total >= 31 && scores.identity === 5 && scores.facialGeometry === 5 && (caseId !== "CASE-003" || scores.skin >= 4) ? "PASS" : "FAIL",
    total,
    approved: false,
  };
}
