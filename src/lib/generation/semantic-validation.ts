import type { GeneratedImage } from "./model";

export const SEMANTIC_VALIDATOR_VERSION = "aws-identity-google-skin-v1";
export const IDENTITY_ACCEPTANCE_THRESHOLD = 0.9;
export const SKIN_ACCEPTANCE_THRESHOLD = 0.72;

export type SemanticQualityRejectionReason =
  | "IDENTITY_MISMATCH"
  | "SKIN_QUALITY_FAILURE"
  | "IDENTITY_AND_SKIN_FAILURE";

export type SemanticQualityResult = Readonly<{
  identityScore: number;
  skinScore: number;
  status: "accepted" | "rejected";
  reasonCode: SemanticQualityRejectionReason | null;
  validatorVersion: typeof SEMANTIC_VALIDATOR_VERSION;
}>;

export type SemanticValidationInput = {
  sourceImage: GeneratedImage;
  generatedImage: GeneratedImage;
  signal?: AbortSignal;
  // Receives the matched face box in the generated image (relative 0..1), when the identity validator finds one.
  onTargetFace?: (box: { left: number; top: number; width: number; height: number }) => void;
};

export type IdentityImageValidator = {
  compare(input: SemanticValidationInput): Promise<number>;
};

export type SkinImageValidator = {
  inspect(input: SemanticValidationInput): Promise<number>;
};

export type SemanticStageDiagnostic = Readonly<{
  validator: "aws-face" | "gemini-skin";
  status: "pass" | "fail" | "skipped" | "unavailable";
  score: number | null;
  threshold: number;
  reasonCode: SemanticQualityRejectionReason | "IDENTITY_NOT_ACCEPTED" | "SEMANTIC_VALIDATION_UNAVAILABLE" | null;
}>;

export type SemanticImageValidator = {
  validate(
    input: SemanticValidationInput,
    onDiagnostic?: (diagnostic: SemanticStageDiagnostic) => void,
  ): Promise<SemanticQualityResult>;
};

export class SemanticValidationError extends Error {
  constructor(readonly code: "SEMANTIC_VALIDATION_UNAVAILABLE") {
    super(code);
    this.name = "SemanticValidationError";
  }
}

function isUnitScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function classifySemanticQuality(input: {
  identityScore: unknown;
  skinScore: unknown;
}): SemanticQualityResult {
  if (!isUnitScore(input.identityScore) || !isUnitScore(input.skinScore)) {
    throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
  }

  const identityAccepted = input.identityScore >= IDENTITY_ACCEPTANCE_THRESHOLD;
  const skinAccepted = input.skinScore >= SKIN_ACCEPTANCE_THRESHOLD;
  const reasonCode = identityAccepted
    ? skinAccepted
      ? null
      : "SKIN_QUALITY_FAILURE"
    : skinAccepted
      ? "IDENTITY_MISMATCH"
      : "IDENTITY_AND_SKIN_FAILURE";

  return {
    identityScore: input.identityScore,
    skinScore: input.skinScore,
    status: reasonCode ? "rejected" : "accepted",
    reasonCode,
    validatorVersion: SEMANTIC_VALIDATOR_VERSION,
  };
}

// The skin check is a cheap analysis call (no image generation). Real-API calibration on
// 2026-09-27 saw transient failures only under concurrent load, so retry it once instead of
// failing the whole paid production.
export const SKIN_VALIDATION_ATTEMPTS = 2;
const DEFAULT_SKIN_RETRY_DELAY_MS = 500;

async function inspectSkinWithRetry(
  validator: SkinImageValidator,
  input: SemanticValidationInput,
  retryDelayMs: number,
) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const score = await validator.inspect(input);
      if (!isUnitScore(score)) throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
      return score;
    } catch (error) {
      if (attempt >= SKIN_VALIDATION_ATTEMPTS || input.signal?.aborted) throw error;
      if (retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

export function createSemanticImageValidator(dependencies: {
  identityValidator: IdentityImageValidator;
  skinValidator: SkinImageValidator;
  skinRetryDelayMs?: number;
}): SemanticImageValidator {
  return {
    async validate(input, onDiagnostic) {
      // Diagnostic failures must never change the existing acceptance decision.
      const emit = (diagnostic: SemanticStageDiagnostic) => {
        try { onDiagnostic?.(diagnostic); } catch { /* best-effort development logging */ }
      };
      let identityScore: number;
      try {
        identityScore = await dependencies.identityValidator.compare(input);
      } catch (error) {
        emit({ validator: "aws-face", status: "unavailable", score: null, threshold: IDENTITY_ACCEPTANCE_THRESHOLD, reasonCode: "SEMANTIC_VALIDATION_UNAVAILABLE" });
        throw error;
      }
      if (!isUnitScore(identityScore)) {
        emit({ validator: "aws-face", status: "unavailable", score: null, threshold: IDENTITY_ACCEPTANCE_THRESHOLD, reasonCode: "SEMANTIC_VALIDATION_UNAVAILABLE" });
        throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
      }
      if (identityScore < IDENTITY_ACCEPTANCE_THRESHOLD) {
        emit({ validator: "aws-face", status: "fail", score: identityScore, threshold: IDENTITY_ACCEPTANCE_THRESHOLD, reasonCode: "IDENTITY_MISMATCH" });
        emit({ validator: "gemini-skin", status: "skipped", score: null, threshold: SKIN_ACCEPTANCE_THRESHOLD, reasonCode: "IDENTITY_NOT_ACCEPTED" });
        return classifySemanticQuality({ identityScore, skinScore: 1 });
      }
      emit({ validator: "aws-face", status: "pass", score: identityScore, threshold: IDENTITY_ACCEPTANCE_THRESHOLD, reasonCode: null });

      let skinScore: number;
      try {
        skinScore = await inspectSkinWithRetry(
          dependencies.skinValidator,
          input,
          dependencies.skinRetryDelayMs ?? DEFAULT_SKIN_RETRY_DELAY_MS,
        );
      } catch (error) {
        emit({ validator: "gemini-skin", status: "unavailable", score: null, threshold: SKIN_ACCEPTANCE_THRESHOLD, reasonCode: "SEMANTIC_VALIDATION_UNAVAILABLE" });
        throw error;
      }
      if (!isUnitScore(skinScore)) {
        emit({ validator: "gemini-skin", status: "unavailable", score: null, threshold: SKIN_ACCEPTANCE_THRESHOLD, reasonCode: "SEMANTIC_VALIDATION_UNAVAILABLE" });
        throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
      }
      emit({ validator: "gemini-skin", status: skinScore >= SKIN_ACCEPTANCE_THRESHOLD ? "pass" : "fail", score: skinScore, threshold: SKIN_ACCEPTANCE_THRESHOLD, reasonCode: skinScore >= SKIN_ACCEPTANCE_THRESHOLD ? null : "SKIN_QUALITY_FAILURE" });
      return classifySemanticQuality({ identityScore, skinScore });
    },
  };
}

export function appendSemanticRetryGuidance(
  prompt: string,
  reasonCode: SemanticQualityRejectionReason,
  options: { allowExplicitHairChange?: boolean } = {},
) {
  const reasonGuidance = reasonCode === "IDENTITY_MISMATCH"
    ? options.allowExplicitHairChange
      ? "직전 결과는 원본과 동일인으로 보기 어려웠습니다. 얼굴 구조, 비율, 비대칭, 눈·코·입·턱과 피부는 원본 그대로 유지하세요. 선택한 Hair는 얼굴이나 정체성을 바꾸지 않고 적용하세요."
      : "직전 결과는 원본과 동일인으로 보기 어려웠습니다. 얼굴 구조, 비율, 비대칭, 눈·코·입·턱과 헤어라인을 원본 그대로 유지하세요."
    : reasonCode === "SKIN_QUALITY_FAILURE"
      ? "직전 결과에서 피부 특징이 달라졌습니다. 원본에 없는 점, 트러블, 반점, 주근깨, 흉터나 인위적인 피부 질감을 만들지 마세요."
      : "직전 결과는 동일인 보존과 피부 보존 기준을 모두 통과하지 못했습니다. 얼굴과 피부를 새로 생성하지 말고 원본을 변경 불가능한 기준으로 사용하세요.";
  const allowedChanges = options.allowExplicitHairChange
    ? "명시적으로 선택한 헤어스타일과 허용된 의상, 배경, 조명만 변경하세요. 얼굴과 피부는 변경하지 마세요."
    : "의상, 배경과 조명처럼 명시적으로 허용된 요소만 변경하세요.";

  return `${prompt}\n\n[품질 재생성 지침]\n${reasonGuidance}\n${allowedChanges}`;
}
