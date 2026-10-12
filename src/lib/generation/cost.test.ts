import { describe, expect, it } from "vitest";

import {
  estimateGenerationCostMicrousd,
  GENERATION_COST_BASELINE,
  isWithinSuccessfulGenerationBudget,
  microusdToPlanningKrw,
  microusdToUsd,
} from "./cost";

describe("generation cost baseline", () => {
  it("keeps the maximum validated prompt and one 1K image within budget", () => {
    const cost = estimateGenerationCostMicrousd({
      inputTokens: GENERATION_COST_BASELINE.maximumPlanningInputTokens,
      successfulImages: 1,
    });

    expect(cost).toBe(69_000);
    expect(microusdToUsd(cost)).toBe(0.069);
    expect(microusdToPlanningKrw(cost)).toBe(110.4);
    expect(isWithinSuccessfulGenerationBudget(cost)).toBe(true);
  });

  it("projects batch volume without floating point accumulation", () => {
    const unitCost = estimateGenerationCostMicrousd({
      inputTokens: GENERATION_COST_BASELINE.maximumPlanningInputTokens,
    });
    const tenThousandGenerationCost = unitCost * 10_000;

    expect(microusdToUsd(tenThousandGenerationCost)).toBe(690);
  });

  it("tracks text output and every successful image explicitly", () => {
    expect(
      estimateGenerationCostMicrousd({
        inputTokens: 1_000,
        textOutputTokens: 1_000,
        successfulImages: 2,
      }),
    ).toBe(137_500);
  });

  it("fails closed for invalid counters", () => {
    expect(() =>
      estimateGenerationCostMicrousd({ inputTokens: -1 }),
    ).toThrow(RangeError);
    expect(() =>
      estimateGenerationCostMicrousd({ inputTokens: 0.5 }),
    ).toThrow(RangeError);
    expect(() =>
      isWithinSuccessfulGenerationBudget(Number.NaN),
    ).toThrow(RangeError);
  });

  it("pins the provider pricing evidence version and resolution", () => {
    expect(GENERATION_COST_BASELINE).toMatchObject({
      pricingVersion: "google-ai-2026-07-30",
      modelId: "google-gemini-image-v1",
      resolution: "1K",
      imageOutputMicrousd: 67_000,
      maximumPlanningInputTokens: 4_000,
      successfulGenerationBudgetMicrousd: 70_000,
    });
  });
});
