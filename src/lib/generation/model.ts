import type { GenerationRequest } from "./validation";

export const DEFAULT_GENERATION_MODEL_ID = "google-gemini-image-v1";

/** Stable application-level names. Provider model ids stay in this module. */
export type GenerationModelKey = "flash" | "pro";

export const GENERATION_MODEL_PROVIDER_IDS = Object.freeze({
  flash: "gemini-3.1-flash-image",
  pro: "gemini-3-pro-image",
} as const);

export const DEFAULT_GENERATION_MODEL_KEY: GenerationModelKey = "flash";

export type GenerationResolution = "1K" | "2K" | "4K";

export const SUPPORTED_GENERATION_RESOLUTIONS = Object.freeze([
  "1K",
  "2K",
  "4K",
] as const satisfies readonly GenerationResolution[]);

export function isGenerationModelKey(value: unknown): value is GenerationModelKey {
  return value === "flash" || value === "pro";
}

export function generationModelKeyFromProviderId(
  value: unknown,
): GenerationModelKey | null {
  if (value === GENERATION_MODEL_PROVIDER_IDS.flash) {
    return "flash";
  }

  if (value === GENERATION_MODEL_PROVIDER_IDS.pro) {
    return "pro";
  }

  return null;
}

export function isGenerationResolution(
  value: unknown,
): value is GenerationResolution {
  return (
    typeof value === "string" &&
    (SUPPORTED_GENERATION_RESOLUTIONS as readonly string[]).includes(value)
  );
}

/** Both Nano Banana image models support 1K, 2K, and 4K output. */
export function isSupportedGenerationResolution(
  model: GenerationModelKey,
  resolution: GenerationResolution,
) {
  return isGenerationModelKey(model) && isGenerationResolution(resolution);
}

export type GenerationModelVersion = {
  id: string;
  provider: "google";
  modelKey: GenerationModelKey;
  providerModel: (typeof GENERATION_MODEL_PROVIDER_IDS)[GenerationModelKey];
  outputResolution: GenerationResolution;
  adapterVersion: "1";
  promptTemplateVersion: "style-v1";
};

export const DEFAULT_GENERATION_MODEL: GenerationModelVersion = Object.freeze({
  id: DEFAULT_GENERATION_MODEL_ID,
  provider: "google",
  modelKey: "flash",
  providerModel: GENERATION_MODEL_PROVIDER_IDS.flash,
  outputResolution: "1K",
  adapterVersion: "1",
  promptTemplateVersion: "style-v1",
});

export function getGenerationModelVersion(
  modelKey: GenerationModelKey = DEFAULT_GENERATION_MODEL_KEY,
  outputResolution: GenerationResolution = "1K",
): GenerationModelVersion {
  if (!isGenerationModelKey(modelKey)) {
    throw new Error(`Unsupported generation model: ${String(modelKey)}`);
  }

  if (!isSupportedGenerationResolution(modelKey, outputResolution)) {
    throw new Error(
      `Unsupported generation resolution: ${String(outputResolution)}`,
    );
  }

  if (modelKey === DEFAULT_GENERATION_MODEL_KEY && outputResolution === "1K") {
    return DEFAULT_GENERATION_MODEL;
  }

  return Object.freeze({
    id: `google-gemini-${modelKey}-image-v1`,
    provider: "google",
    modelKey,
    providerModel: GENERATION_MODEL_PROVIDER_IDS[modelKey],
    outputResolution,
    adapterVersion: "1",
    promptTemplateVersion: "style-v1",
  });
}

export const GENERATED_IMAGE_MIME_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
] as const);

export type GeneratedImageMimeType =
  (typeof GENERATED_IMAGE_MIME_TYPES)[number];

export function isGeneratedImageMimeType(
  value: unknown,
): value is GeneratedImageMimeType {
  return (
    typeof value === "string" &&
    (GENERATED_IMAGE_MIME_TYPES as readonly string[]).includes(value)
  );
}

export type GeneratedImage = {
  data: string;
  mimeType: GeneratedImageMimeType;
};

export type GenerationModelResult = {
  image: GeneratedImage;
  model: GenerationModelVersion;
};

export type GenerationModelAdapter = {
  readonly model: GenerationModelVersion;
  generate(
    request: GenerationRequest,
    options?: {
      signal?: AbortSignal;
      resolution?: GenerationResolution;
      sourceImage?: {
        data: string;
        mimeType: GeneratedImageMimeType;
      };
    },
  ): Promise<GenerationModelResult>;
};
