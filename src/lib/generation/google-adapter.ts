import {
  DEFAULT_GENERATION_MODEL,
  getGenerationModelVersion,
  type GenerationModelKey,
  type GenerationModelVersion,
  type GeneratedImage,
  type GenerationModelAdapter,
  type GenerationModelResult,
  type GenerationResolution,
} from "./model";
import { getGoogleImageEnvironment } from "./config";
import type {
  GenerationRequest,
  GenerationStyle,
} from "./validation";

const GOOGLE_AI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1/models";
export const GOOGLE_INTERACTIONS_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/interactions";
/** Google Interactions currently accepts JPEG as its image output MIME type. */
export const GOOGLE_INTERACTIONS_OUTPUT_MIME_TYPE = "image/jpeg" as const;
const MAX_ENCODED_IMAGE_BYTES = 30 * 1024 * 1024;
const MAX_PROVIDER_ERROR_BYTES = 64 * 1024;
const MAX_PROVIDER_IDENTIFIER_LENGTH = 128;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const SUPPORTED_IMAGE_TYPES = new Set<GeneratedImage["mimeType"]>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const STYLE_INSTRUCTIONS: Record<GenerationStyle, string> = {
  photographic: "사실적인 사진을 생성하세요.",
  portrait: "완성도 높은 인물 사진을 생성하세요.",
  product: "깔끔한 상업용 제품 사진을 생성하세요.",
  illustration: "세밀한 일러스트레이션을 생성하세요.",
};

export type GoogleImageAdapterErrorCode =
  | "PROVIDER_INVALID_REQUEST"
  | "PROVIDER_AUTHENTICATION_FAILED"
  | "PROVIDER_ACCESS_DENIED"
  | "PROVIDER_MODEL_NOT_FOUND"
  | "PROVIDER_REJECTED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_RESPONSE_INVALID";

export type GoogleProviderOperation = "generate-content" | "interactions";

export type GoogleInteractionsRequest = Readonly<{
  model: string;
  store: false;
  input: readonly (
    | Readonly<{ type: "text"; text: string }>
    | Readonly<{
        type: "image";
        mime_type: GeneratedImage["mimeType"];
        data: string;
      }>
  )[];
  response_format: Readonly<{
    type: "image";
    mime_type: typeof GOOGLE_INTERACTIONS_OUTPUT_MIME_TYPE;
    aspect_ratio: GenerationRequest["aspectRatio"];
    image_size: GenerationResolution;
  }>;
}>;

export type GoogleInteractionsRequestShape = Readonly<{
  endpoint: typeof GOOGLE_INTERACTIONS_ENDPOINT;
  inputItemCount: number;
  inputItemTypes: readonly ("text" | "image")[];
  imageMimeType: GeneratedImage["mimeType"] | null;
  imageBase64Length: number | null;
  responseFormat: GoogleInteractionsRequest["response_format"];
}>;

type GoogleSourceImage = Readonly<{
  data: string;
  mimeType: GeneratedImage["mimeType"];
}>;

export type GoogleProviderDiagnostic = Readonly<{
  correlationId: string | null;
  failureCode: GoogleImageAdapterErrorCode;
  googleErrorCode: number | string | null;
  googleErrorStatus: string | null;
  httpStatus: number;
  modelId: string;
  operationType: GoogleProviderOperation;
  providerMessage: string | null;
  providerRequestId: string | null;
  requestShape: GoogleInteractionsRequestShape | null;
  retryable: boolean;
  safetyBlockReason: string | null;
}>;

export class GoogleImageAdapterError extends Error {
  constructor(
    readonly code: GoogleImageAdapterErrorCode,
    readonly retryable: boolean,
    readonly diagnostic: GoogleProviderDiagnostic | null = null,
  ) {
    super(code);
    this.name = "GoogleImageAdapterError";
  }
}

type GoogleImageAdapterOptions = {
  apiKey: string;
  correlationId?: string;
  fetchImpl?: typeof fetch;
  model?: GenerationModelKey | GenerationModelVersion;
  onDiagnostic?: (diagnostic: GoogleProviderDiagnostic) => void;
  transport?: "generate-content" | "interactions";
};

const SAFETY_BLOCK_CODES = new Set([
  "BLOCKLIST",
  "CONTENT_BLOCKED",
  "IMAGE_OTHER",
  "IMAGE_PROHIBITED_CONTENT",
  "IMAGE_RECITATION",
  "IMAGE_SAFETY",
  "LANGUAGE",
  "PROHIBITED_CONTENT",
  "RECITATION",
  "SAFETY",
  "SPII",
]);

function buildPrompt(request: GenerationRequest) {
  return `${STYLE_INSTRUCTIONS[request.style]}\n\n${request.prompt}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedIdentifier(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_PROVIDER_IDENTIFIER_LENGTH ||
    !/^[A-Za-z0-9._:-]+$/u.test(value)
  ) {
    return null;
  }
  return value;
}

function normalizeSafetyCode(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/-/gu, "_").toUpperCase();
  return SAFETY_BLOCK_CODES.has(normalized) ? normalized : null;
}

function findSafetyBlockReason(value: unknown, depth = 0): string | null {
  if (depth > 5) return null;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 20)) {
      const reason = findSafetyBlockReason(item, depth + 1);
      if (reason) return reason;
    }
    return null;
  }
  if (!isRecord(value)) return null;

  for (const key of [
    "blockReason",
    "block_reason",
    "finishReason",
    "finish_reason",
    "reason",
    "code",
  ]) {
    const reason = normalizeSafetyCode(value[key]);
    if (reason) return reason;
  }

  for (const key of [
    "error",
    "details",
    "promptFeedback",
    "prompt_feedback",
    "candidates",
    "safetyRatings",
    "safety_ratings",
  ]) {
    const reason = findSafetyBlockReason(value[key], depth + 1);
    if (reason) return reason;
  }
  return null;
}

function canonicalProviderMessage(value: unknown) {
  if (typeof value !== "string") return null;
  const message = value.replace(/\s+/gu, " ").trim();
  const knownMessages: Array<[RegExp, string]> = [
    [/api key.*(?:invalid|missing|expired)|(?:invalid|missing).*api key/iu, "API key is invalid, missing, or inactive."],
    [/permission|access denied|forbidden/iu, "Permission was denied for the requested resource."],
    [/billing|payment/iu, "Provider billing configuration requires attention."],
    [/model.*not found|not found.*model|endpoint.*not found/iu, "The requested model or endpoint was not found."],
    [/invalid (?:argument|request)|malformed|unknown parameter/iu, "The provider rejected the request schema."],
    [/quota|rate limit|too many requests/iu, "The provider quota or rate limit was exceeded."],
    [/blocked.*(?:safety|policy)|(?:safety|policy).*blocked|prohibited content/iu, "The provider reported a safety or policy block."],
    [/temporarily unavailable|service unavailable|internal error/iu, "The provider service is temporarily unavailable."],
  ];
  return knownMessages.find(([pattern]) => pattern.test(message))?.[1] ?? null;
}

function providerMessageForError(
  value: unknown,
  googleErrorCode: number | string | null,
  googleErrorStatus: string | null,
) {
  const canonical = canonicalProviderMessage(value);
  if (canonical) return canonical;

  if (
    googleErrorCode === "invalid_request" ||
    googleErrorCode === "parameter_unknown" ||
    googleErrorStatus === "INVALID_ARGUMENT"
  ) {
    return "The provider rejected one or more request fields.";
  }

  return null;
}

function parseProviderErrorPayload(payload: unknown) {
  const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
  const rawCode = error?.code;
  const googleErrorCode =
    typeof rawCode === "number" && Number.isInteger(rawCode)
      ? rawCode
      : boundedIdentifier(rawCode);
  const googleErrorStatus = boundedIdentifier(error?.status);
  return {
    googleErrorCode,
    googleErrorStatus,
    providerMessage: providerMessageForError(
      error?.message,
      googleErrorCode,
      googleErrorStatus,
    ),
    safetyBlockReason: findSafetyBlockReason(payload),
  };
}

function normalizeImageBase64(sourceImage: GoogleSourceImage) {
  const dataUrlMatch = sourceImage.data.match(
    /^data:(image\/(?:jpeg|png|webp));base64,(.*)$/u,
  );
  const data = dataUrlMatch?.[2] ?? sourceImage.data;

  if (dataUrlMatch?.[1] !== undefined && dataUrlMatch[1] !== sourceImage.mimeType) {
    throw new GoogleImageAdapterError("PROVIDER_INVALID_REQUEST", false);
  }
  if (
    data.length === 0 ||
    data.length > MAX_ENCODED_IMAGE_BYTES ||
    !BASE64_PATTERN.test(data)
  ) {
    throw new GoogleImageAdapterError("PROVIDER_INVALID_REQUEST", false);
  }

  return data;
}

export function buildGoogleInteractionsRequest({
  model,
  prompt,
  aspectRatio,
  resolution,
  sourceImage,
}: Readonly<{
  model: string;
  prompt: string;
  aspectRatio: GenerationRequest["aspectRatio"];
  resolution: GenerationResolution;
  sourceImage?: GoogleSourceImage;
}>): GoogleInteractionsRequest {
  const normalizedImage = sourceImage
    ? {
        type: "image" as const,
        mime_type: sourceImage.mimeType,
        data: normalizeImageBase64(sourceImage),
      }
    : null;

  return {
    model,
    store: false,
    input: [
      { type: "text", text: prompt },
      ...(normalizedImage ? [normalizedImage] : []),
    ],
    response_format: {
      type: "image",
      mime_type: GOOGLE_INTERACTIONS_OUTPUT_MIME_TYPE,
      aspect_ratio: aspectRatio,
      image_size: resolution,
    },
  };
}

function interactionsRequestShape(
  body: GoogleInteractionsRequest,
): GoogleInteractionsRequestShape {
  const image = body.input.find((item) => item.type === "image");
  return {
    endpoint: GOOGLE_INTERACTIONS_ENDPOINT,
    inputItemCount: body.input.length,
    inputItemTypes: body.input.map((item) => item.type),
    imageMimeType: image?.mime_type ?? null,
    imageBase64Length: image?.data.length ?? null,
    responseFormat: body.response_format,
  };
}

async function readBoundedJson(response: Response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_ERROR_BYTES) {
    return null;
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_PROVIDER_ERROR_BYTES) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function providerRequestId(response: Response) {
  return boundedIdentifier(
    response.headers.get("x-goog-request-id") ??
      response.headers.get("x-request-id"),
  );
}

function generatedImageFromContent(value: unknown): GeneratedImage | null {
  if (!isRecord(value) || value.type !== "image") return null;
  const mimeType = value.mime_type;
  const data = value.data;
  if (
    typeof mimeType !== "string" ||
    !SUPPORTED_IMAGE_TYPES.has(mimeType as GeneratedImage["mimeType"]) ||
    typeof data !== "string" ||
    data.length === 0 ||
    data.length > MAX_ENCODED_IMAGE_BYTES ||
    !BASE64_PATTERN.test(data)
  ) {
    return null;
  }
  return { mimeType: mimeType as GeneratedImage["mimeType"], data };
}

function parseGeneratedImage(payload: unknown): GeneratedImage | null {
  if (!isRecord(payload)) {
    return null;
  }

  const outputImage = payload.output_image;
  if (isRecord(outputImage)) {
    const image = generatedImageFromContent({ type: "image", ...outputImage });
    if (image) return image;
  }

  if (Array.isArray(payload.steps)) {
    for (const step of payload.steps) {
      if (
        !isRecord(step) ||
        step.type !== "model_output" ||
        !Array.isArray(step.content)
      ) {
        continue;
      }
      for (const content of step.content) {
        const image = generatedImageFromContent(content);
        if (image) return image;
      }
    }
  }

  if (!Array.isArray(payload.candidates)) return null;

  for (const candidate of payload.candidates) {
    if (!isRecord(candidate) || !isRecord(candidate.content)) {
      continue;
    }

    const parts = candidate.content.parts;
    if (!Array.isArray(parts)) {
      continue;
    }

    for (const part of parts) {
      if (!isRecord(part) || !isRecord(part.inlineData)) {
        continue;
      }

      const mimeType = part.inlineData.mimeType;
      const data = part.inlineData.data;

      if (
        typeof mimeType !== "string" ||
        !SUPPORTED_IMAGE_TYPES.has(mimeType as GeneratedImage["mimeType"]) ||
        typeof data !== "string" ||
        data.length === 0 ||
        data.length > MAX_ENCODED_IMAGE_BYTES ||
        !BASE64_PATTERN.test(data)
      ) {
        continue;
      }

      return {
        mimeType: mimeType as GeneratedImage["mimeType"],
        data,
      };
    }
  }

  return null;
}

function classifyProviderError(
  status: number,
  safetyBlockReason: string | null,
  providerMessage: string | null,
) {
  if (safetyBlockReason) {
    return { code: "PROVIDER_REJECTED", retryable: false } as const;
  }

  if (status === 400) {
    return { code: "PROVIDER_INVALID_REQUEST", retryable: false } as const;
  }
  if (status === 401) {
    return { code: "PROVIDER_AUTHENTICATION_FAILED", retryable: false } as const;
  }
  if (status === 402) {
    // Prepaid provider balance exhausted: an operator billing problem, not a bad user request.
    return { code: "PROVIDER_ACCESS_DENIED", retryable: false } as const;
  }
  if (status === 403) {
    return { code: "PROVIDER_ACCESS_DENIED", retryable: false } as const;
  }
  if (status === 404) {
    return { code: "PROVIDER_MODEL_NOT_FOUND", retryable: false } as const;
  }
  if (
    status === 429 &&
    providerMessage === "Provider billing configuration requires attention."
  ) {
    return { code: "PROVIDER_ACCESS_DENIED", retryable: false } as const;
  }
  if (status === 429) {
    return { code: "PROVIDER_RATE_LIMITED", retryable: true } as const;
  }

  if (status >= 500) {
    return { code: "PROVIDER_UNAVAILABLE", retryable: true } as const;
  }

  return { code: "PROVIDER_INVALID_REQUEST", retryable: false } as const;
}

export function createGoogleImageAdapter({
  apiKey,
  correlationId,
  fetchImpl = fetch,
  model: requestedModel = DEFAULT_GENERATION_MODEL,
  onDiagnostic,
  transport = "generate-content",
}: GoogleImageAdapterOptions): GenerationModelAdapter {
  if (apiKey.trim().length === 0) {
    throw new Error("Missing required environment variable: GOOGLE_AI_API_KEY");
  }

  const model =
    typeof requestedModel === "string"
      ? getGenerationModelVersion(requestedModel)
      : requestedModel;

  return {
    model,
    async generate(request, options): Promise<GenerationModelResult> {
      const resolution = options?.resolution ?? model.outputResolution;
      const sourceImage = options?.sourceImage;
      const requestUrl = transport === "interactions"
        ? GOOGLE_INTERACTIONS_ENDPOINT
        : `${GOOGLE_AI_BASE_URL}/${model.providerModel}:generateContent`;
      const body = transport === "interactions"
        ? buildGoogleInteractionsRequest({
            model: model.providerModel,
            prompt: request.prompt,
            aspectRatio: request.aspectRatio,
            resolution,
            sourceImage,
          })
        : {
            contents: [{ parts: [{ text: buildPrompt(request) }, ...(sourceImage ? [{ inlineData: { mimeType: sourceImage.mimeType, data: sourceImage.data } }] : [])] }],
            generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: request.aspectRatio, imageSize: resolution } },
          };
      const response = await fetchImpl(
        requestUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(body),
          cache: "no-store",
          signal: options?.signal,
        },
      );

      const emitDiagnostic = (diagnostic: GoogleProviderDiagnostic) => {
        try {
          onDiagnostic?.(diagnostic);
        } catch {
          // Telemetry must never replace the bounded provider failure.
        }
      };

      if (!response.ok) {
        const parsed = parseProviderErrorPayload(await readBoundedJson(response));
        const failure = classifyProviderError(
          response.status,
          parsed.safetyBlockReason,
          parsed.providerMessage,
        );
        const diagnostic: GoogleProviderDiagnostic = {
          correlationId: boundedIdentifier(correlationId),
          failureCode: failure.code,
          googleErrorCode: parsed.googleErrorCode,
          googleErrorStatus: parsed.googleErrorStatus,
          httpStatus: response.status,
          modelId: model.providerModel,
          operationType: transport,
          providerMessage: parsed.providerMessage,
          providerRequestId: providerRequestId(response),
          requestShape:
            transport === "interactions"
              ? interactionsRequestShape(body as GoogleInteractionsRequest)
              : null,
          retryable: failure.retryable,
          safetyBlockReason: parsed.safetyBlockReason,
        };
        emitDiagnostic(diagnostic);
        throw new GoogleImageAdapterError(
          failure.code,
          failure.retryable,
          diagnostic,
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new GoogleImageAdapterError(
          "PROVIDER_RESPONSE_INVALID",
          false,
        );
      }
      const safetyBlockReason = findSafetyBlockReason(payload);
      if (safetyBlockReason) {
        const diagnostic: GoogleProviderDiagnostic = {
          correlationId: boundedIdentifier(correlationId),
          failureCode: "PROVIDER_REJECTED",
          googleErrorCode: null,
          googleErrorStatus: null,
          httpStatus: response.status,
          modelId: model.providerModel,
          operationType: transport,
          providerMessage: "The provider reported a safety or policy block.",
          providerRequestId: providerRequestId(response),
          requestShape:
            transport === "interactions"
              ? interactionsRequestShape(body as GoogleInteractionsRequest)
              : null,
          retryable: false,
          safetyBlockReason,
        };
        emitDiagnostic(diagnostic);
        throw new GoogleImageAdapterError(
          "PROVIDER_REJECTED",
          false,
          diagnostic,
        );
      }

      const image = parseGeneratedImage(payload);
      if (!image) {
        throw new GoogleImageAdapterError(
          "PROVIDER_RESPONSE_INVALID",
          false,
        );
      }

      return {
        image,
        model,
      };
    },
  };
}

export function createGoogleImageAdapterFromEnvironment(
  fetchImpl?: typeof fetch,
) {
  const environment = getGoogleImageEnvironment();
  return createGoogleImageAdapter({
    apiKey: environment.apiKey,
    model: environment.defaultModel,
    fetchImpl,
  });
}
