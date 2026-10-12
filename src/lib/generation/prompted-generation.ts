import { buildPrompt, type PromptBuildResult } from "@/lib/prompts";
import { getGenerationModelVersion, type GenerationModelKey, type GenerationResolution, type GeneratedImage } from "./model";
import { createGoogleImageAdapter, type GoogleImageAdapterErrorCode } from "./google-adapter";
import type { GenerationRequest } from "./validation";

export type PromptedGenerationInput = {
  presetId:
    | "resume-id"
    | "business-profile"
    | "profile-photo"
    | "underwater-correction"
    | "character-avatar";
  model: GenerationModelKey;
  resolution: GenerationResolution;
  additionalRequest?: string;
  sourceImage: { data: string; mimeType: "image/jpeg" | "image/png" | "image/webp" };
  request: GenerationRequest;
};

export type PromptedGenerationResult = {
  prompt: PromptBuildResult;
  image: GeneratedImage;
  providerModel: string;
  durationMs: number;
};

export async function runPromptedGeneration(
  input: PromptedGenerationInput,
  dependencies: { apiKey: string; fetchImpl?: typeof fetch },
): Promise<PromptedGenerationResult> {
  const prompt = buildPrompt({
    presetId: input.presetId,
    model: input.model,
    additionalRequest: input.additionalRequest,
  });
  const model = getGenerationModelVersion(input.model, input.resolution);
  const adapter = createGoogleImageAdapter({
    apiKey: dependencies.apiKey,
    fetchImpl: dependencies.fetchImpl,
    model,
    transport: "interactions",
  });
  const startedAt = Date.now();
  const generated = await adapter.generate(
    { ...input.request, prompt: prompt.prompt },
    { resolution: input.resolution, sourceImage: input.sourceImage, signal: AbortSignal.timeout(120_000) },
  );
  return {
    prompt,
    image: generated.image,
    providerModel: generated.model.providerModel,
    durationMs: Date.now() - startedAt,
  };
}

export type PromptedGenerationErrorCode = GoogleImageAdapterErrorCode | "PROMPT_VALIDATION_FAILED";
