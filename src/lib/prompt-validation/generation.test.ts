import { describe, expect, it, vi } from "vitest";

import { createGoogleImageAdapter } from "@/lib/generation/google-adapter";
import { getGenerationModelVersion } from "@/lib/generation/model";

import { buildValidationPair } from "./builder";
import {
  detectValidationImageMime,
  runValidationGenerationBatch,
  validateValidationSourceImage,
  VALIDATION_IMAGE_CONFIG,
  type ValidationGenerationInput,
} from "./generation";

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

const caseThreeInput: ValidationGenerationInput = {
  caseId: "CASE-003",
  presetId: "business-id",
  model: "flash",
  additionalRequest: "배경을 조금 더 밝게 해주세요",
  repeatCount: 2,
  scope: "AB",
  sourceImage: { data: "/9j/4A==", mimeType: "image/jpeg" },
};

describe("validation source image", () => {
  it.each([
    ["image/jpeg", "portrait.jpg", JPEG_BYTES],
    ["image/png", "portrait.png", PNG_BYTES],
    ["image/webp", "portrait.webp", WEBP_BYTES],
  ] as const)("accepts %s", (declaredMimeType, fileName, bytes) => {
    expect(detectValidationImageMime(bytes)).toBe(declaredMimeType);
    expect(validateValidationSourceImage({ bytes, declaredMimeType, fileName })).toBeNull();
  });

  it("rejects unsupported, mismatched, and oversized files", () => {
    expect(validateValidationSourceImage({ bytes: JPEG_BYTES, declaredMimeType: "image/gif", fileName: "portrait.gif" }))
      .toBe("UNSUPPORTED_FILE_TYPE");
    expect(validateValidationSourceImage({ bytes: JPEG_BYTES, declaredMimeType: "image/png", fileName: "portrait.png" }))
      .toBe("FILE_SIGNATURE_MISMATCH");
    expect(validateValidationSourceImage({ bytes: JPEG_BYTES, declaredMimeType: "image/jpeg", fileName: "portrait.png" }))
      .toBe("FILE_EXTENSION_MISMATCH");
    expect(validateValidationSourceImage({
      bytes: new Uint8Array(VALIDATION_IMAGE_CONFIG.maxSourceBytes + 1),
      declaredMimeType: "image/jpeg",
      fileName: "portrait.jpg",
    })).toBe("INVALID_FILE_SIZE");
  });
});

describe("CASE-003 manual A/B generation", () => {
  it("keeps fixed modules equal and changes only the skin experiment", () => {
    const pair = buildValidationPair({
      caseId: "CASE-003",
      presetId: "business-id",
      model: "flash",
      additionalRequest: caseThreeInput.additionalRequest,
    });
    const fixed = (moduleIds: string[]) => moduleIds.filter((id) => !id.startsWith("validation."));
    expect(fixed(pair.A.moduleIds)).toEqual(fixed(pair.B.moduleIds));
    expect(pair.A.validationRuleIds).toEqual([]);
    expect(pair.B.validationRuleIds).toEqual(["CARAT-R007", "CARAT-R008"]);
    expect(pair.A.variantHash).not.toBe(pair.B.variantHash);
  });

  it("uses the mocked Google adapter for A/B twice with the exact same source", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({
      output_image: { mime_type: "image/jpeg", data: "/9j/4A==" },
    }));
    const adapter = createGoogleImageAdapter({
      apiKey: "synthetic-test-key",
      model: getGenerationModelVersion("flash", "1K"),
      transport: "interactions",
      fetchImpl,
    });
    const results = await runValidationGenerationBatch(caseThreeInput, {
      async generate(input) {
        const output = await adapter.generate(
          { prompt: input.prompt, style: "portrait", aspectRatio: input.aspectRatio },
          { resolution: input.resolution, sourceImage: input.sourceImage },
        );
        return { image: output.image, providerModel: output.model.providerModel, durationMs: 1 };
      },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(results.map(({ conditionId, repeat }) => `${conditionId}-${repeat}`)).toEqual(["A-1", "A-2", "B-1", "B-2"]);
    expect(results.every((result) => result.validationPromptId === "prompt-validation.case-003")).toBe(true);
    expect(results.every((result) => result.validationPromptVersion === "legacy-module-ab@1.0.0")).toBe(true);
    expect(results.filter((result) => result.conditionId === "A").every((result) => result.ruleIds.length === 0)).toBe(true);
    expect(results.filter((result) => result.conditionId === "B").every((result) => result.ruleIds.join() === "CARAT-R007,CARAT-R008")).toBe(true);
    for (const [, init] of fetchImpl.mock.calls) {
      const payload = JSON.parse(String(init?.body)) as { input: Array<{ type: string; data?: string; mime_type?: string }> };
      const image = payload.input.find((item) => item.type === "image");
      expect(image).toMatchObject({ data: "/9j/4A==", mime_type: "image/jpeg" });
    }
  });

  it("preserves later B results when one A generation fails", async () => {
    let call = 0;
    const results = await runValidationGenerationBatch(caseThreeInput, {
      async generate() {
        call += 1;
        if (call === 1) throw Object.assign(new Error("synthetic failure"), { code: "PROVIDER_RATE_LIMITED" });
        return {
          image: { data: "aW1hZ2U=", mimeType: "image/png" },
          providerModel: "gemini-3.1-flash-image",
          durationMs: 1,
        };
      },
    });
    expect(results).toHaveLength(4);
    expect(results[0]).toMatchObject({ conditionId: "A", repeat: 1, status: "failure", errorCode: "PROVIDER_RATE_LIMITED" });
    expect(results.filter((result) => result.conditionId === "B" && result.status === "success")).toHaveLength(2);
  });
});
