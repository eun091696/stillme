import type { GenerationModelKey, GeneratedImage } from "@/lib/generation/model";

import { buildValidationPrompt } from "./builder";
import type { ValidationCaseId, ValidationConditionId, ValidationRuleId } from "./types";

export const VALIDATION_IMAGE_CONFIG = Object.freeze({
  aspectRatio: "4:5" as const,
  maxSourceBytes: 10 * 1024 * 1024,
  resolution: "1K" as const,
});

export const VALIDATION_SOURCE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ValidationSourceMimeType = (typeof VALIDATION_SOURCE_MIME_TYPES)[number];
export type ValidationGenerationScope = ValidationConditionId | "AB";

export type ValidationGenerationInput = {
  caseId: ValidationCaseId;
  presetId: string;
  model: GenerationModelKey;
  additionalRequest?: string;
  repeatCount: 1 | 2;
  scope: ValidationGenerationScope;
  sourceImage: { data: string; mimeType: ValidationSourceMimeType };
};

export type ValidationGenerationMetadata = {
  caseId: ValidationCaseId;
  conditionId: ValidationConditionId;
  validationPromptId: string;
  validationPromptVersion: string;
  repeat: 1 | 2;
  model: GenerationModelKey;
  variantHash: string;
  ruleIds: ValidationRuleId[];
};

export type ValidationGenerationResult =
  | (ValidationGenerationMetadata & {
      status: "success";
      image: GeneratedImage;
      providerModel: string;
      durationMs: number;
    })
  | (ValidationGenerationMetadata & {
      status: "failure";
      errorCode: string;
    });

export type ValidationGenerateDependencyInput = {
  prompt: string;
  model: GenerationModelKey;
  sourceImage: ValidationGenerationInput["sourceImage"];
  resolution: typeof VALIDATION_IMAGE_CONFIG.resolution;
  aspectRatio: typeof VALIDATION_IMAGE_CONFIG.aspectRatio;
};

export function detectValidationImageMime(bytes: Uint8Array): ValidationSourceMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export function validateValidationSourceImage(input: {
  bytes: Uint8Array;
  declaredMimeType: string;
  fileName: string;
}) {
  if (input.bytes.length === 0 || input.bytes.length > VALIDATION_IMAGE_CONFIG.maxSourceBytes) return "INVALID_FILE_SIZE" as const;
  if (!(VALIDATION_SOURCE_MIME_TYPES as readonly string[]).includes(input.declaredMimeType)) return "UNSUPPORTED_FILE_TYPE" as const;
  const expectedExtension = input.declaredMimeType === "image/jpeg" ? /\.jpe?g$/iu : input.declaredMimeType === "image/png" ? /\.png$/iu : /\.webp$/iu;
  if (!expectedExtension.test(input.fileName)) return "FILE_EXTENSION_MISMATCH" as const;
  if (detectValidationImageMime(input.bytes) !== input.declaredMimeType) return "FILE_SIGNATURE_MISMATCH" as const;
  return null;
}

function conditionsForScope(scope: ValidationGenerationScope): readonly ValidationConditionId[] {
  return scope === "AB" ? ["A", "B"] : [scope];
}

function boundedErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code.replace(/[^A-Z0-9_]/gu, "_").slice(0, 64) || "GENERATION_FAILED";
  }
  return "GENERATION_FAILED";
}

export async function runValidationGenerationBatch(
  input: ValidationGenerationInput,
  dependencies: {
    generate: (input: ValidationGenerateDependencyInput) => Promise<{
      image: GeneratedImage;
      providerModel: string;
      durationMs: number;
    }>;
  },
): Promise<ValidationGenerationResult[]> {
  const results: ValidationGenerationResult[] = [];
  for (const conditionId of conditionsForScope(input.scope)) {
    for (let repeat = 1; repeat <= input.repeatCount; repeat += 1) {
      const prompt = buildValidationPrompt({
        caseId: input.caseId,
        condition: conditionId,
        presetId: input.presetId,
        model: input.model,
        additionalRequest: input.additionalRequest,
      });
      const metadata: ValidationGenerationMetadata = {
        caseId: input.caseId,
        conditionId,
        validationPromptId: prompt.validationPromptId,
        validationPromptVersion: prompt.validationPromptVersion,
        repeat: repeat as 1 | 2,
        model: input.model,
        variantHash: prompt.variantHash,
        ruleIds: prompt.validationRuleIds,
      };
      try {
        const generated = await dependencies.generate({
          prompt: prompt.prompt,
          model: input.model,
          sourceImage: input.sourceImage,
          resolution: VALIDATION_IMAGE_CONFIG.resolution,
          aspectRatio: VALIDATION_IMAGE_CONFIG.aspectRatio,
        });
        results.push({ ...metadata, status: "success", ...generated });
      } catch (error) {
        results.push({ ...metadata, status: "failure", errorCode: boundedErrorCode(error) });
      }
    }
  }
  return results;
}
