export const GENERATION_PROMPT_LIMITS = {
  min: 3,
  max: 1_000,
} as const;

export const SUPPORTED_GENERATION_STYLES = [
  "photographic",
  "portrait",
  "product",
  "illustration",
] as const;

export const SUPPORTED_ASPECT_RATIOS = ["1:1", "3:4", "4:5", "16:9"] as const;

export type GenerationStyle = (typeof SUPPORTED_GENERATION_STYLES)[number];
export type GenerationAspectRatio =
  (typeof SUPPORTED_ASPECT_RATIOS)[number];

export type GenerationRequest = {
  prompt: string;
  style: GenerationStyle;
  aspectRatio: GenerationAspectRatio;
};

export type GenerationRequestField =
  | keyof GenerationRequest
  | `unknown.${string}`;

export type GenerationRequestErrorCode =
  | "REQUIRED"
  | "INVALID_TYPE"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "UNSUPPORTED"
  | "POLICY_REJECTED"
  | "UNKNOWN_FIELD";

export type GenerationRequestError = {
  field: GenerationRequestField;
  code: GenerationRequestErrorCode;
};

export type GenerationPromptPolicy = (
  prompt: string,
) => boolean | Promise<boolean>;

export type GenerationRequestValidationResult =
  | {
      success: true;
      data: GenerationRequest;
    }
  | {
      success: false;
      errors: GenerationRequestError[];
    };

const REQUEST_FIELDS = new Set(["prompt", "style", "aspectRatio"]);
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSupportedStyle(value: string): value is GenerationStyle {
  return (SUPPORTED_GENERATION_STYLES as readonly string[]).includes(value);
}

function isSupportedAspectRatio(
  value: string,
): value is GenerationAspectRatio {
  return (SUPPORTED_ASPECT_RATIOS as readonly string[]).includes(value);
}

export async function validateGenerationRequest(
  input: unknown,
  promptPolicy?: GenerationPromptPolicy,
): Promise<GenerationRequestValidationResult> {
  if (!isRecord(input)) {
    return {
      success: false,
      errors: [
        { field: "prompt", code: "REQUIRED" },
        { field: "style", code: "REQUIRED" },
        { field: "aspectRatio", code: "REQUIRED" },
      ],
    };
  }

  const errors: GenerationRequestError[] = [];

  for (const field of Object.keys(input)) {
    if (!REQUEST_FIELDS.has(field)) {
      errors.push({
        field: `unknown.${field}`,
        code: "UNKNOWN_FIELD",
      });
    }
  }

  const promptValue = input.prompt;
  const styleValue = input.style;
  const aspectRatioValue = input.aspectRatio;
  let prompt: string | undefined;

  if (promptValue === undefined || promptValue === null) {
    errors.push({ field: "prompt", code: "REQUIRED" });
  } else if (typeof promptValue !== "string") {
    errors.push({ field: "prompt", code: "INVALID_TYPE" });
  } else {
    prompt = promptValue.trim();

    if (prompt.length === 0) {
      errors.push({ field: "prompt", code: "REQUIRED" });
    } else if (prompt.length < GENERATION_PROMPT_LIMITS.min) {
      errors.push({ field: "prompt", code: "TOO_SHORT" });
    } else if (prompt.length > GENERATION_PROMPT_LIMITS.max) {
      errors.push({ field: "prompt", code: "TOO_LONG" });
    } else if (CONTROL_CHARACTER_PATTERN.test(prompt)) {
      errors.push({ field: "prompt", code: "POLICY_REJECTED" });
    } else if (promptPolicy && !(await promptPolicy(prompt))) {
      errors.push({ field: "prompt", code: "POLICY_REJECTED" });
    }
  }

  if (styleValue === undefined || styleValue === null) {
    errors.push({ field: "style", code: "REQUIRED" });
  } else if (typeof styleValue !== "string") {
    errors.push({ field: "style", code: "INVALID_TYPE" });
  } else if (!isSupportedStyle(styleValue)) {
    errors.push({ field: "style", code: "UNSUPPORTED" });
  }

  if (aspectRatioValue === undefined || aspectRatioValue === null) {
    errors.push({ field: "aspectRatio", code: "REQUIRED" });
  } else if (typeof aspectRatioValue !== "string") {
    errors.push({ field: "aspectRatio", code: "INVALID_TYPE" });
  } else if (!isSupportedAspectRatio(aspectRatioValue)) {
    errors.push({ field: "aspectRatio", code: "UNSUPPORTED" });
  }

  if (
    errors.length > 0 ||
    prompt === undefined ||
    typeof styleValue !== "string" ||
    !isSupportedStyle(styleValue) ||
    typeof aspectRatioValue !== "string" ||
    !isSupportedAspectRatio(aspectRatioValue)
  ) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      prompt,
      style: styleValue,
      aspectRatio: aspectRatioValue,
    },
  };
}
