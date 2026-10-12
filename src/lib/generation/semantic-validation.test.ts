import { describe, expect, it, vi } from "vitest";

import {
  appendSemanticRetryGuidance,
  classifySemanticQuality,
  createSemanticImageValidator,
  SemanticValidationError,
} from "./semantic-validation";

describe("classifySemanticQuality", () => {
  it("accepts scores that meet both server-owned thresholds", () => {
    expect(classifySemanticQuality({ identityScore: 0.9, skinScore: 0.8 }))
      .toMatchObject({ status: "accepted", reasonCode: null });
  });

  it.each([
    [0.5, 0.8, "IDENTITY_MISMATCH"],
    [0.9, 0.5, "SKIN_QUALITY_FAILURE"],
    [0.5, 0.5, "IDENTITY_AND_SKIN_FAILURE"],
  ] as const)(
    "rejects identity=%s skin=%s with %s",
    (identityScore, skinScore, reasonCode) => {
      expect(classifySemanticQuality({ identityScore, skinScore }))
        .toMatchObject({ status: "rejected", reasonCode });
    },
  );

  it.each([NaN, Infinity, -0.1, 1.1, "0.9", null])(
    "rejects an invalid provider score %s",
    (identityScore) => {
      expect(() => classifySemanticQuality({ identityScore, skinScore: 0.9 }))
        .toThrow(SemanticValidationError);
    },
  );
});

describe("createSemanticImageValidator", () => {
  const input = {
    sourceImage: { data: "source", mimeType: "image/jpeg" as const },
    generatedImage: { data: "generated", mimeType: "image/jpeg" as const },
  };

  it("retries a transient skin check failure once and keeps the real score", async () => {
    const inspect = vi.fn()
      .mockRejectedValueOnce(new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE"))
      .mockResolvedValueOnce(0.9);
    const compare = vi.fn(async () => 0.99);
    const validator = createSemanticImageValidator({
      identityValidator: { compare },
      skinValidator: { inspect },
      skinRetryDelayMs: 0,
    });

    await expect(validator.validate(input)).resolves.toMatchObject({ status: "accepted", skinScore: 0.9 });
    expect(inspect).toHaveBeenCalledTimes(2);
    expect(compare).toHaveBeenCalledTimes(1);
  });

  it("fails closed after the second skin check failure", async () => {
    const inspect = vi.fn(async () => {
      throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
    });
    const validator = createSemanticImageValidator({
      identityValidator: { compare: vi.fn(async () => 0.99) },
      skinValidator: { inspect },
      skinRetryDelayMs: 0,
    });

    await expect(validator.validate(input)).rejects.toBeInstanceOf(SemanticValidationError);
    expect(inspect).toHaveBeenCalledTimes(2);
  });

  it("does not retry a real low skin score", async () => {
    const inspect = vi.fn(async () => 0.3);
    const validator = createSemanticImageValidator({
      identityValidator: { compare: vi.fn(async () => 0.99) },
      skinValidator: { inspect },
      skinRetryDelayMs: 0,
    });

    await expect(validator.validate(input)).resolves.toMatchObject({ status: "rejected", reasonCode: "SKIN_QUALITY_FAILURE" });
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it("skips the paid skin check when AWS rejects identity", async () => {
    const inspect = vi.fn(async () => 0.9);
    const validator = createSemanticImageValidator({
      identityValidator: { compare: vi.fn(async () => 0.5) },
      skinValidator: { inspect },
    });

    await expect(validator.validate(input)).resolves.toMatchObject({
      status: "rejected",
      reasonCode: "IDENTITY_MISMATCH",
    });
    expect(inspect).not.toHaveBeenCalled();
  });

  it("uses Gemini skin scoring only after identity passes", async () => {
    const validator = createSemanticImageValidator({
      identityValidator: { compare: vi.fn(async () => 0.95) },
      skinValidator: { inspect: vi.fn(async () => 0.5) },
    });

    await expect(validator.validate(input)).resolves.toMatchObject({
      status: "rejected",
      reasonCode: "SKIN_QUALITY_FAILURE",
    });
  });

  it("reports the real AWS score and marks the unrun skin check as skipped", async () => {
    const onDiagnostic = vi.fn();
    const inspect = vi.fn(async () => 0.9);
    const validator = createSemanticImageValidator({
      identityValidator: { compare: vi.fn(async () => 0.87) },
      skinValidator: { inspect },
    });
    await expect(validator.validate(input, onDiagnostic)).resolves.toMatchObject({ reasonCode: "IDENTITY_MISMATCH" });
    expect(onDiagnostic.mock.calls.map(([record]) => record)).toEqual([
      { validator: "aws-face", status: "fail", score: 0.87, threshold: 0.9, reasonCode: "IDENTITY_MISMATCH" },
      { validator: "gemini-skin", status: "skipped", score: null, threshold: 0.72, reasonCode: "IDENTITY_NOT_ACCEPTED" },
    ]);
    expect(inspect).not.toHaveBeenCalled();
  });

  it("reports AWS pass and the actual Gemini skin failure separately", async () => {
    const onDiagnostic = vi.fn();
    const validator = createSemanticImageValidator({
      identityValidator: { compare: vi.fn(async () => 0.95) },
      skinValidator: { inspect: vi.fn(async () => 0.61) },
    });
    await expect(validator.validate(input, onDiagnostic)).resolves.toMatchObject({ reasonCode: "SKIN_QUALITY_FAILURE" });
    expect(onDiagnostic.mock.calls.map(([record]) => record)).toEqual([
      { validator: "aws-face", status: "pass", score: 0.95, threshold: 0.9, reasonCode: null },
      { validator: "gemini-skin", status: "fail", score: 0.61, threshold: 0.72, reasonCode: "SKIN_QUALITY_FAILURE" },
    ]);
  });

  it("attributes unavailable validators to the stage without logging a made-up score", async () => {
    for (const unavailable of ["aws-face", "gemini-skin"] as const) {
      const onDiagnostic = vi.fn();
      const validator = createSemanticImageValidator({
        identityValidator: { compare: vi.fn(async () => {
          if (unavailable === "aws-face") throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
          return 0.95;
        }) },
        skinValidator: { inspect: vi.fn(async () => { throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE"); }) },
      });
      await expect(validator.validate(input, onDiagnostic)).rejects.toEqual(new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE"));
      expect(onDiagnostic.mock.calls.at(-1)?.[0]).toEqual({
        validator: unavailable, status: "unavailable", score: null,
        threshold: unavailable === "aws-face" ? 0.9 : 0.72,
        reasonCode: "SEMANTIC_VALIDATION_UNAVAILABLE",
      });
    }
  });

  it("does not let diagnostic logging change the validation decision", async () => {
    const validator = createSemanticImageValidator({
      identityValidator: { compare: vi.fn(async () => 0.95) },
      skinValidator: { inspect: vi.fn(async () => 0.9) },
    });
    await expect(validator.validate(input, () => { throw new Error("LOGGER_FAILED"); }))
      .resolves.toMatchObject({ status: "accepted", reasonCode: null });
  });
});

describe("appendSemanticRetryGuidance", () => {
  it("adds server-owned skin correction without replacing the base prompt", () => {
    const prompt = appendSemanticRetryGuidance(
      "base prompt",
      "SKIN_QUALITY_FAILURE",
    );

    expect(prompt).toContain("base prompt");
    expect(prompt).toContain("원본에 없는 점");
    expect(prompt).toContain("명시적으로 허용된 요소만 변경");
  });

  it("keeps an explicit Hair Designer selection in identity retries without weakening face preservation", () => {
    const prompt = appendSemanticRetryGuidance(
      "[선택한 Hair: 웨이브]",
      "IDENTITY_MISMATCH",
      { allowExplicitHairChange: true },
    );

    expect(prompt).toContain("[선택한 Hair: 웨이브]");
    expect(prompt).toContain("얼굴 구조, 비율, 비대칭, 눈·코·입·턱과 피부는 원본 그대로");
    expect(prompt).toContain("명시적으로 선택한 헤어스타일");
    expect(prompt).not.toContain("헤어라인을 원본 그대로 유지");
    expect(prompt).not.toContain("의상, 배경과 조명처럼 명시적으로 허용된 요소만 변경");
  });
});
