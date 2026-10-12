import { describe, expect, it } from "vitest";

import { GENERATION_CREDIT_COST, INITIAL_CANDIDATE_COUNT } from "./credit-policy";

describe("photo production credit policy", () => {
  it("uses one credit for exactly three candidates", () => {
    expect(GENERATION_CREDIT_COST).toBe(1);
    expect(INITIAL_CANDIDATE_COUNT).toBe(3);
  });
});
