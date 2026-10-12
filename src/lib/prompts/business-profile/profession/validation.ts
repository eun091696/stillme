const PROFESSION_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/u;
const PROFESSION_ALLOWED_PATTERN = /^[\p{L}\p{M}\p{N}\s.,&/+()'’-]+$/u;
const PROFESSION_OVERRIDE_PATTERN = /(?:ignore|disregard|override|disable|remove)\s+(?:all|any|the)?\s*(?:instructions|rules|restrictions|identity|safety)|(?:지시|규칙|제한|동일인|안전).*(?:무시|해제|제거|덮어)/iu;

export const PROFESSION_MAX_LENGTH = 80;

export type ProfessionValidationErrorCode =
  | "REQUIRED"
  | "TOO_LONG"
  | "INVALID_CHARACTER"
  | "SAFETY_OVERRIDE";

export class ProfessionValidationError extends Error {
  constructor(readonly code: ProfessionValidationErrorCode) {
    super(code);
    this.name = "ProfessionValidationError";
  }
}

export function normalizeProfession(value: unknown) {
  if (typeof value !== "string") {
    throw new ProfessionValidationError("REQUIRED");
  }
  const normalized = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (!normalized) {
    throw new ProfessionValidationError("REQUIRED");
  }
  if (normalized.length > PROFESSION_MAX_LENGTH) {
    throw new ProfessionValidationError("TOO_LONG");
  }
  if (
    PROFESSION_CONTROL_PATTERN.test(value) ||
    !PROFESSION_ALLOWED_PATTERN.test(normalized)
  ) {
    throw new ProfessionValidationError("INVALID_CHARACTER");
  }
  if (PROFESSION_OVERRIDE_PATTERN.test(normalized)) {
    throw new ProfessionValidationError("SAFETY_OVERRIDE");
  }
  return normalized;
}
