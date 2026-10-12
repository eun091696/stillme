const PORTRAIT_COMMON_MODULE_IDS = [
  "core.source-of-truth",
  "core.identity-preservation",
  "core.facial-geometry-preservation",
  "core.skin-preservation",
  "core.hair-preservation",
  "core.expression-preservation",
  "core.personal-details-preservation",
  "core.portrait-edit-boundary",
  "core.output-safety",
  "id-photo.composition",
  "id-photo.studio-quality",
] as const;

const STYLE_MODULE_IDS = {
  "profile-id": "style.profile",
  "business-id": "style.business",
  "resume-id": "style.resume",
  "student-id": "style.student",
  "basic-id": "style.basic-id",
} as const;

const MODEL_GUIDANCE = [
  "보존 및 편집 범위 규칙을 우선하고, 허용된 변경만 원본에 충실하게 적용하세요.",
] as const;

/**
 * Work005/Work006의 Module 단위 A/B 실험을 재현하기 위한 Validation 전용 호환 정보다.
 * 운영 Runtime Prompt의 조립에는 사용하지 않는다.
 */
export function getLegacyValidationModuleIds(presetId: string): readonly string[] {
  const styleModuleId = STYLE_MODULE_IDS[presetId as keyof typeof STYLE_MODULE_IDS];
  if (!styleModuleId) throw new Error(`Validation module mapping is absent for preset: ${presetId}`);
  return [
    ...PORTRAIT_COMMON_MODULE_IDS,
    styleModuleId,
    "id-photo.restrictions",
    "id-photo.safety-priority",
  ];
}

export function getLegacyValidationModelGuidance(): readonly string[] {
  return MODEL_GUIDANCE;
}
