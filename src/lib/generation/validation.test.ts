import { describe, expect, it, vi } from "vitest";

import {
  GENERATION_PROMPT_LIMITS,
  validateGenerationRequest,
} from "./validation";

describe("validateGenerationRequest", () => {
  it("normalizes and accepts a supported request", async () => {
    await expect(
      validateGenerationRequest({
        prompt: "  서울의 비 오는 밤거리  ",
        style: "photographic",
        aspectRatio: "16:9",
      }),
    ).resolves.toEqual({
      success: true,
      data: {
        prompt: "서울의 비 오는 밤거리",
        style: "photographic",
        aspectRatio: "16:9",
      },
    });
  });

  it("rejects missing, incorrectly typed, and unsupported fields", async () => {
    const result = await validateGenerationRequest({
      prompt: 42,
      style: "unknown",
      aspectRatio: null,
      model: "unapproved-model",
    });

    expect(result).toEqual({
      success: false,
      errors: [
        { field: "unknown.model", code: "UNKNOWN_FIELD" },
        { field: "prompt", code: "INVALID_TYPE" },
        { field: "style", code: "UNSUPPORTED" },
        { field: "aspectRatio", code: "REQUIRED" },
      ],
    });
  });

  it("rejects empty, short, and oversized prompts", async () => {
    await expect(
      validateGenerationRequest({
        prompt: " ",
        style: "portrait",
        aspectRatio: "4:5",
      }),
    ).resolves.toMatchObject({
      success: false,
      errors: [{ field: "prompt", code: "REQUIRED" }],
    });

    await expect(
      validateGenerationRequest({
        prompt: "ab",
        style: "portrait",
        aspectRatio: "4:5",
      }),
    ).resolves.toMatchObject({
      success: false,
      errors: [{ field: "prompt", code: "TOO_SHORT" }],
    });

    await expect(
      validateGenerationRequest({
        prompt: "a".repeat(GENERATION_PROMPT_LIMITS.max + 1),
        style: "portrait",
        aspectRatio: "4:5",
      }),
    ).resolves.toMatchObject({
      success: false,
      errors: [{ field: "prompt", code: "TOO_LONG" }],
    });
  });

  it("rejects control characters before invoking the policy boundary", async () => {
    const policy = vi.fn(() => true);

    const result = await validateGenerationRequest(
      {
        prompt: "safe\u0000looking",
        style: "illustration",
        aspectRatio: "1:1",
      },
      policy,
    );

    expect(result).toEqual({
      success: false,
      errors: [{ field: "prompt", code: "POLICY_REJECTED" }],
    });
    expect(policy).not.toHaveBeenCalled();
  });

  it("uses the policy boundary without exposing the rejected prompt", async () => {
    const policy = vi.fn(async () => false);

    const result = await validateGenerationRequest(
      {
        prompt: "synthetic policy fixture",
        style: "product",
        aspectRatio: "1:1",
      },
      policy,
    );

    expect(policy).toHaveBeenCalledWith("synthetic policy fixture");
    expect(result).toEqual({
      success: false,
      errors: [{ field: "prompt", code: "POLICY_REJECTED" }],
    });
    expect(JSON.stringify(result)).not.toContain("synthetic policy fixture");
  });

  it("returns a bounded error shape for non-object input", async () => {
    await expect(validateGenerationRequest("invalid")).resolves.toEqual({
      success: false,
      errors: [
        { field: "prompt", code: "REQUIRED" },
        { field: "style", code: "REQUIRED" },
        { field: "aspectRatio", code: "REQUIRED" },
      ],
    });
  });
});
