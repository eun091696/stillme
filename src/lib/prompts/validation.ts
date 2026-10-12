const MAX_ADDITIONAL_REQUEST_LENGTH = 240;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const OVERRIDE_PATTERN = /(?:ignore|disregard|override|disable|remove)\s+(?:all|any|the)?\s*(?:instructions|rules|restrictions|identity|safety)/iu;
const UNSUPPORTED_CATEGORY_PATTERN = /(?:제품\s*사진|상품\s*사진|웨딩|결혼\s*사진|프리\s*다이빙|수중\s*사진|여행\s*사진|일러스트|만화|캐릭터|product\s*photo|wedding|freediving|underwater|travel\s*photo|illustration|cartoon)/iu;
const IDENTITY_CHANGE_PATTERN = /(?:(?:얼굴형|턱(?:선)?|눈|코|입|나이(?:대)?|피부색|인종|민족적\s*특징)\s*(?:을|를)?\s*(?:대폭|크게|완전히|dramatically)?\s*(?:바꿔|변경|수정|줄여|키워|늘려|어리게|늙게|reshape|change|enlarge|slim))|(?:(?:much|far)\s+(?:younger|older))|(?:(?:reshape|change)\s+(?:the\s+)?(?:face|jaw|eyes?|nose|skin\s*tone|race|ethnicity))/iu;
const FABRICATED_AFFILIATION_PATTERN = /(?:(?:학교|회사|기업|브랜드)\s*(?:로고|명칭|이름|교복|유니폼|자격|배지).*(?:만들|추가|생성|넣어))|(?:(?:invent|create|add).*(?:school|company|brand).*(?:logo|uniform|credential|badge))/iu;
const COMPLIANCE_GUARANTEE_PATTERN = /(?:(?:여권|신분증|비자).*(?:제출|규격|적합|통과).*(?:보장|확실|완벽))|(?:(?:guarantee|ensure).*(?:passport|visa|official\s+id).*(?:compliant|accepted|submission))/iu;

export type AdditionalRequestErrorCode =
  | "TOO_LONG"
  | "INVALID_CHARACTER"
  | "SAFETY_OVERRIDE"
  | "IDENTITY_CHANGE"
  | "FABRICATED_AFFILIATION"
  | "COMPLIANCE_GUARANTEE"
  | "UNSUPPORTED_CATEGORY";

export class AdditionalRequestValidationError extends Error {
  constructor(readonly code: AdditionalRequestErrorCode) {
    super(code);
    this.name = "AdditionalRequestValidationError";
  }
}

export function normalizeAdditionalRequest(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (normalized.length > MAX_ADDITIONAL_REQUEST_LENGTH) {
    throw new AdditionalRequestValidationError("TOO_LONG");
  }
  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
    throw new AdditionalRequestValidationError("INVALID_CHARACTER");
  }
  if (OVERRIDE_PATTERN.test(normalized)) {
    throw new AdditionalRequestValidationError("SAFETY_OVERRIDE");
  }
  if (IDENTITY_CHANGE_PATTERN.test(normalized)) {
    throw new AdditionalRequestValidationError("IDENTITY_CHANGE");
  }
  if (FABRICATED_AFFILIATION_PATTERN.test(normalized)) {
    throw new AdditionalRequestValidationError("FABRICATED_AFFILIATION");
  }
  if (COMPLIANCE_GUARANTEE_PATTERN.test(normalized)) {
    throw new AdditionalRequestValidationError("COMPLIANCE_GUARANTEE");
  }
  if (UNSUPPORTED_CATEGORY_PATTERN.test(normalized)) {
    throw new AdditionalRequestValidationError("UNSUPPORTED_CATEGORY");
  }
  return normalized;
}

export const PROMPT_ADDITIONAL_REQUEST_LIMIT = MAX_ADDITIONAL_REQUEST_LENGTH;
