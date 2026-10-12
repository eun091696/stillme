import "server-only";

import type { GeneratedImage } from "./model";
import {
  SemanticValidationError,
  type SkinImageValidator,
} from "./semantic-validation";

const GOOGLE_AI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_RESPONSE_BYTES = 16 * 1024;
const MAX_INPUT_IMAGE_BYTES = 10 * 1024 * 1024;
const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,99}$/u;

const VALIDATION_RUBRIC = `Compare the first image, which is the original source portrait, with the second image, which is an edited result.
Return a skinScore from 0 to 1 only.
skinScore measures whether the person's permanent skin identity is preserved while allowing natural professional retouching of blemishes.
ALLOWED, do not lower the score for it: reducing or removing temporary or minor blemishes such as acne, pimples, redness, small scattered spots, light freckle-like pigmentation and uneven tone, as long as realistic skin texture remains.
Step 1, the most important check: look at every distinct dark, brown or reddish dot, spot or mark on the face and neck in the edited image and find it in the original at the same place. If the edited image has a distinct mark where the original has clear skin, the edit invented a mark: return 0.3 or lower, even if the rest of the skin looks natural.
Step 2: if a distinct, well-defined mole that clearly stands out from the surrounding skin, a birthmark or a scar that is visible in the original is missing, moved, duplicated or reshaped in the edited image, return 0.4 or lower. Small scattered spots and light freckles are not moles.
Step 3: if the skin looks plastic, waxy, porcelain or heavily airbrushed without natural texture, or the overall skin tone changed, return 0.5 or lower.
If no step applies, return a high score.
Do not identify the person. Do not score clothing, background, lighting, framing, or pose. Do not describe either image. Return only the requested JSON score.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    skinScore: { type: "NUMBER" },
  },
  required: ["skinScore"],
} as const;

type ValidatorOptions = {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
};

function imagePart(image: GeneratedImage) {
  const bytes = Buffer.from(image.data, "base64");
  if (bytes.length === 0 || bytes.length > MAX_INPUT_IMAGE_BYTES) {
    throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
  }
  return {
    inlineData: {
      mimeType: image.mimeType,
      data: image.data,
    },
  };
}

function extractJsonText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return null;

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const content = (candidate as { content?: unknown }).content;
    if (!content || typeof content !== "object") continue;
    const parts = (content as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }
  return null;
}

async function readBoundedJson(response: Response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
  }
}

function parseSkinScore(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
  }
  return value;
}

export function createGoogleSkinValidator({
  apiKey,
  model,
  fetchImpl = fetch,
}: ValidatorOptions): SkinImageValidator {
  if (apiKey.trim().length === 0 || !MODEL_ID_PATTERN.test(model)) {
    throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
  }

  return {
    async inspect({ sourceImage, generatedImage, signal }) {
      let response: Response;
      try {
        response = await fetchImpl(
          `${GOOGLE_AI_BASE_URL}/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [
                  { text: VALIDATION_RUBRIC },
                  imagePart(sourceImage),
                  imagePart(generatedImage),
                ],
              }],
              generationConfig: {
                temperature: 0,
                responseMimeType: "application/json",
                responseSchema: RESPONSE_SCHEMA,
              },
            }),
            cache: "no-store",
            signal,
          },
        );
      } catch {
        throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
      }

      if (!response.ok) {
        throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
      }

      const payload = await readBoundedJson(response);
      const jsonText = extractJsonText(payload);
      if (!jsonText) {
        throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
      }

      let scores: unknown;
      try {
        scores = JSON.parse(jsonText) as unknown;
      } catch {
        throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
      }
      if (!scores || typeof scores !== "object") {
        throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
      }

      return parseSkinScore((scores as { skinScore?: unknown }).skinScore);
    },
  };
}
