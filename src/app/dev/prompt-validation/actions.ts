"use server";

import { randomUUID } from "node:crypto";

import { getGoogleImageEnvironment, isImageCreditBypassEnabled } from "@/lib/generation/config";
import { createGoogleImageAdapter } from "@/lib/generation/google-adapter";
import { getGenerationModelVersion, isGenerationModelKey } from "@/lib/generation/model";
import {
  runValidationGenerationBatch,
  validateValidationSourceImage,
  type ValidationGenerationResult,
  type ValidationGenerationScope,
  type ValidationSourceMimeType,
} from "@/lib/prompt-validation/generation";
import { VALIDATION_CASE_REGISTRY } from "@/lib/prompt-validation/registry";
import type { ValidationCaseId } from "@/lib/prompt-validation/types";

export type ValidationGenerationActionResult = {
  error: string | null;
  results: ValidationGenerationResult[];
};

function actionError(error: string): ValidationGenerationActionResult {
  return { error, results: [] };
}

export async function generateValidationImages(formData: FormData): Promise<ValidationGenerationActionResult> {
  if (process.env.NODE_ENV !== "development") return actionError("DEV_ONLY");
  if (!isImageCreditBypassEnabled()) return actionError("IMAGE_CREDIT_BYPASS_REQUIRED");

  const caseId = formData.get("caseId");
  const presetId = formData.get("presetId");
  const model = formData.get("model");
  const scope = formData.get("scope");
  const repeatValue = formData.get("repeatCount");
  const sourceFile = formData.get("sourceImage");
  const additionalRequest = formData.get("additionalRequest");
  const validationCase = typeof caseId === "string"
    ? VALIDATION_CASE_REGISTRY[caseId as ValidationCaseId]
    : undefined;
  if (
    typeof caseId !== "string" || !validationCase ||
    typeof presetId !== "string" || !(validationCase.allowedPresetIds as readonly string[]).includes(presetId) ||
    !isGenerationModelKey(model) ||
    (scope !== "A" && scope !== "B" && scope !== "AB") ||
    (repeatValue !== "1" && repeatValue !== "2") || !(sourceFile instanceof File)
  ) return actionError("INVALID_VALIDATION_REQUEST");

  const sourceBytes = new Uint8Array(await sourceFile.arrayBuffer());
  const sourceError = validateValidationSourceImage({
    bytes: sourceBytes,
    declaredMimeType: sourceFile.type,
    fileName: sourceFile.name,
  });
  if (sourceError) return actionError(sourceError);

  const environment = getGoogleImageEnvironment();
  if (!environment.apiKey) return actionError("PROVIDER_CONFIGURATION_MISSING");

  const results = await runValidationGenerationBatch({
    caseId: caseId as ValidationCaseId,
    presetId,
    model,
    additionalRequest: typeof additionalRequest === "string" ? additionalRequest : undefined,
    repeatCount: Number(repeatValue) as 1 | 2,
    scope: scope as ValidationGenerationScope,
    sourceImage: {
      data: Buffer.from(sourceBytes).toString("base64"),
      mimeType: sourceFile.type as ValidationSourceMimeType,
    },
  }, {
    async generate(input) {
      const adapter = createGoogleImageAdapter({
        apiKey: environment.apiKey,
        correlationId: randomUUID(),
        model: getGenerationModelVersion(input.model, input.resolution),
        transport: "interactions",
      });
      const startedAt = Date.now();
      const generated = await adapter.generate(
        { prompt: input.prompt, style: "portrait", aspectRatio: input.aspectRatio },
        { resolution: input.resolution, sourceImage: input.sourceImage, signal: AbortSignal.timeout(120_000) },
      );
      return {
        image: generated.image,
        providerModel: generated.model.providerModel,
        durationMs: Date.now() - startedAt,
      };
    },
  });
  return { error: null, results };
}
