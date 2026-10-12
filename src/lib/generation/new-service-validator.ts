import "server-only";

import { getCharacterStyle } from "@/lib/prompts/category-flow";
import type { GeneratedImage } from "./model";
import {
  SemanticValidationError,
  type SemanticValidationInput,
} from "./semantic-validation";

const GOOGLE_AI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_RESPONSE_BYTES = 16 * 1024;
const MAX_INPUT_IMAGE_BYTES = 10 * 1024 * 1024;
const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,99}$/u;

export const NEW_SERVICE_ACCEPTANCE_THRESHOLD = 0.78;

export type NewServicePresetId = "underwater-correction" | "character-avatar";

export type NewServiceValidationResult = Readonly<{
  score: number;
  status: "accepted" | "rejected";
}>;

export type NewServiceImageValidator = {
  validate(input: SemanticValidationInput): Promise<NewServiceValidationResult>;
};

type ValidatorOptions = {
  service: NewServicePresetId;
  apiKey: string;
  model: string;
  characterStyleId?: string;
  characterOutfitId?: string;
  fetchImpl?: typeof fetch;
};

const VALIDATION_RUBRICS: Record<NewServicePresetId, string> = {
  "underwater-correction": `Compare the first image, the original underwater scene, with the second image, the corrected result.
Return a serviceScore from 0 to 1 only.
Score scene-subject faithfulness, geometry faithfulness, and realistic underwater color-and-light correction faithfulness. Preserve subjects, count, placement, scale, pose, boundaries and physical geometry. Recover blue/green cast, skin tone when present, contrast and haze naturally while retaining depth, blue water and underwater light falloff. Do not invent, remove, move, duplicate or reshape scene content. A visible face is not required and must not affect the score; if present, preserve its recognizable geometry, skin tone and diving gear. Return only the requested JSON score.`,

  "character-avatar": `Compare the first image, the source person, with the second image, a character avatar result.
Return a serviceScore from 0 to 1 only.
Score whether the result is one recognizable full-body unbranded interlocking toy-brick minifigure-inspired character, not a human-proportioned 3D avatar or photograph. The output is a 2D image depicting a physical toy, not a mesh file; never require rigging or topology. Look for a cylindrical head, simple printed face, molded hair, blocky torso and short jointed limbs with curved claw-like hands. Human fingers and anatomical proportions are incorrect for this service. Preserve source-specific hairstyle/color, eye-brow arrangement and visible distinctive marks through simplified toy printing; preserve outfit colors unless the user selected a neutral outfit. Do not invent accessories. Reject a generic face, extra limbs or figures, cropped feet/head, logos, packaging or an apparent official branded product. Return only the requested JSON score.`,
};

const CHARACTER_STYLE_RUBRICS: Record<"pixel-art" | "clay", string> = {
  "pixel-art": `Compare the source person with a full-body pixel-art character image. Return a serviceScore from 0 to 1 only. It must be one coherent crisp grid-based pixel illustration, not a photo with a pixel filter. Preserve the person's recognizable hair silhouette and color, skin tone, facial layout and visible marks in stylized form. Outfit may be adapted when explicitly requested. Reject another person's features, generic faceless sprites, cropped head or feet, extra people, logos or copyrighted character designs. Return only the JSON score.`,
  clay: `Compare the source person with a full-body handcrafted clay character photograph. Return a serviceScore from 0 to 1 only. It must look like one physical matte-clay figure, not a photograph of a human, branded toy, or generic doll. Preserve recognizable hair silhouette and color, skin tone, facial layout and visible marks in stylized form. Outfit may be adapted when explicitly requested. Reject extra figures or limbs, cropped head or feet, logos or copyrighted character designs. Return only the JSON score.`,
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    serviceScore: { type: "NUMBER" },
  },
  required: ["serviceScore"],
} as const;

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

function parseServiceScore(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
  }
  return value;
}

export function isNewServicePresetId(value: string): value is NewServicePresetId {
  return value === "underwater-correction" || value === "character-avatar";
}

export function createNewServiceValidator({
  service,
  apiKey,
  model,
  characterStyleId,
  characterOutfitId,
  fetchImpl = fetch,
}: ValidatorOptions): NewServiceImageValidator {
  if (!isNewServicePresetId(service) || apiKey.trim().length === 0 || !MODEL_ID_PATTERN.test(model) ||
    (characterStyleId !== undefined && (service !== "character-avatar" || !getCharacterStyle(characterStyleId))) ||
    (characterOutfitId !== undefined && (service !== "character-avatar" || !["original", "neutral"].includes(characterOutfitId)))) {
    throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
  }

  const styleRubric = characterStyleId === "pixel-art" || characterStyleId === "clay" ? CHARACTER_STYLE_RUBRICS[characterStyleId] : null;
  const outfitRubric = service === "character-avatar" ? characterOutfitId === "neutral"
    ? "The user selected a neutral outfit; evaluate identity independently of source outfit color."
    : "The user did not select a new outfit; preserve source outfit colors and silhouette in stylized form."
    : "";
  return {
    async validate({ sourceImage, generatedImage, signal }) {
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
                  { text: `${styleRubric ?? VALIDATION_RUBRICS[service]} ${outfitRubric}` },
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

      let result: unknown;
      try {
        result = JSON.parse(jsonText) as unknown;
      } catch {
        throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
      }
      if (!result || typeof result !== "object") {
        throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
      }

      const score = parseServiceScore((result as { serviceScore?: unknown }).serviceScore);
      return {
        score,
        status: score >= NEW_SERVICE_ACCEPTANCE_THRESHOLD ? "accepted" : "rejected",
      };
    },
  };
}
