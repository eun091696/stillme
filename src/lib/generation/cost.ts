import { DEFAULT_GENERATION_MODEL_ID } from "./model";

const MICROS_PER_USD = 1_000_000;

export const GENERATION_COST_BASELINE = Object.freeze({
  pricingVersion: "google-ai-2026-07-30",
  modelId: DEFAULT_GENERATION_MODEL_ID,
  resolution: "1K",
  currency: "USD",
  inputMicrousdPerMillionTokens: 500_000,
  textOutputMicrousdPerMillionTokens: 3_000_000,
  imageOutputMicrousd: 67_000,
  maximumPlanningInputTokens: 4_000,
  successfulGenerationBudgetMicrousd: 70_000,
  planningKrwPerUsd: 1_600,
});

type GenerationCostInput = {
  inputTokens: number;
  textOutputTokens?: number;
  successfulImages?: number;
};

function assertNonNegativeInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer`);
  }
}

function tokenCostMicrousd(tokens: number, ratePerMillion: number) {
  return Math.ceil((tokens * ratePerMillion) / 1_000_000);
}

export function estimateGenerationCostMicrousd({
  inputTokens,
  textOutputTokens = 0,
  successfulImages = 1,
}: GenerationCostInput) {
  assertNonNegativeInteger(inputTokens, "inputTokens");
  assertNonNegativeInteger(textOutputTokens, "textOutputTokens");
  assertNonNegativeInteger(successfulImages, "successfulImages");

  return (
    tokenCostMicrousd(
      inputTokens,
      GENERATION_COST_BASELINE.inputMicrousdPerMillionTokens,
    ) +
    tokenCostMicrousd(
      textOutputTokens,
      GENERATION_COST_BASELINE.textOutputMicrousdPerMillionTokens,
    ) +
    successfulImages * GENERATION_COST_BASELINE.imageOutputMicrousd
  );
}

export function microusdToUsd(microusd: number) {
  assertNonNegativeInteger(microusd, "microusd");
  return microusd / MICROS_PER_USD;
}

export function microusdToPlanningKrw(microusd: number) {
  return (
    microusdToUsd(microusd) *
    GENERATION_COST_BASELINE.planningKrwPerUsd
  );
}

export function isWithinSuccessfulGenerationBudget(microusd: number) {
  assertNonNegativeInteger(microusd, "microusd");
  return (
    microusd <=
    GENERATION_COST_BASELINE.successfulGenerationBudgetMicrousd
  );
}
