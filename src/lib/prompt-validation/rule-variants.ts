import type { ValidationRuleVariant } from "./types";

export const VALIDATION_RULE_VARIANTS = [
  { ruleId: "CARAT-R001", name: "업로드 인물 원본 기준", status: "review", moduleId: "core.source-of-truth", lines: ["업로드된 인물 이미지를 인물 정체성의 유일한 기준으로 사용하세요."], sourceWork: "Work005-001", caseIds: ["CASE-006"] },
  { ruleId: "CARAT-R002", name: "알아볼 수 있는 동일 인물", status: "review", moduleId: "core.identity", lines: ["결과가 업로드된 원본과 즉시 같은 사람으로 인식되도록 동일 인물의 연속성을 유지하세요."], sourceWork: "Work005-001", caseIds: ["CASE-001"] },
  { ruleId: "CARAT-R003", name: "얼굴 구조 불변", status: "candidate", moduleId: "core.facial-geometry", lines: ["얼굴형과 눈·코·입·턱의 형태 및 비율을 원본과 동일하게 유지하세요."], sourceWork: "Work005-001", caseIds: ["CASE-002"] },
  { ruleId: "CARAT-R004", name: "특징적인 인상 보존", status: "candidate", moduleId: "core.expression-baseline", lines: ["카테고리 수준의 표현 변화 안에서도 원본 인물의 특징적인 인상을 유지하세요."], sourceWork: "Work005-001", caseIds: ["CASE-005", "CASE-009", "CASE-010"] },
  { ruleId: "CARAT-R005", name: "헤어 정체성 보존", status: "candidate", moduleId: "core.hair-preservation", lines: ["허용된 정돈 외에는 헤어라인, 가르마, 길이와 질감을 원본 그대로 유지하세요."], sourceWork: "Work005-001", caseIds: ["CASE-004"] },
  { ruleId: "CARAT-R006", name: "정돈 범위만 변경", status: "candidate", moduleId: "category.grooming-delta", lines: ["잔머리와 단정함만 좁은 범위에서 정돈하고 헤어스타일의 정체성은 바꾸지 마세요."], sourceWork: "Work005-001", caseIds: ["CASE-009"] },
  { ruleId: "CARAT-R007", name: "자연스러운 피부톤", status: "candidate", moduleId: "core.skin-tone", lines: ["피부 색조를 입력 이미지에 고정하고 주황색, 회색 또는 인위적으로 밝은 피부로 바꾸지 마세요."], sourceWork: "Work005-001", caseIds: ["CASE-003"] },
  { ruleId: "CARAT-R008", name: "절제된 리터치", status: "review", moduleId: "core.retouch-intensity", lines: ["피부 고유 특징과 질감을 유지하는 낮은 강도의 자연스러운 리터치만 적용하세요."], sourceWork: "Work005-001", caseIds: ["CASE-003"] },
  { ruleId: "CARAT-R011", name: "표정 허용 범위", status: "candidate", moduleId: "category.expression-envelope", lines: ["서비스 유형의 허용 범위 안에서만 표정 강도를 조정하고 입 모양을 통제되지 않게 바꾸지 마세요."], sourceWork: "Work005-001", caseIds: ["CASE-005", "CASE-009", "CASE-010"] },
  { ruleId: "CARAT-R012", name: "허용된 의상 프리셋", status: "review", moduleId: "category.wardrobe", lines: ["의상 편집이 허용된 경우에만 카테고리에 맞는 의상을 적용하세요."], sourceWork: "Work005-001", caseIds: ["CASE-008", "CASE-009", "CASE-010"] },
  { ruleId: "CARAT-R013", name: "단색 배경 프리셋", status: "review", moduleId: "category.background", lines: ["카테고리에 맞는 정돈된 단색 또는 중립 스튜디오 배경을 적용하세요."], sourceWork: "Work005-001", caseIds: ["CASE-008", "CASE-009", "CASE-010"] },
  { ruleId: "CARAT-R014", name: "부드럽고 균일한 스튜디오 조명", status: "review", moduleId: "id.lighting.even-soft", lines: ["얼굴 정보가 명확하도록 부드럽게 확산된 균일한 노출의 조명을 적용하세요."], sourceWork: "Work005-001", caseIds: ["CASE-008", "CASE-009", "CASE-010"] },
  { ruleId: "CARAT-R015", name: "최소한의 자연스러운 그림자", status: "candidate", moduleId: "id.lighting.shadow-level", lines: ["평면적인 오려낸 이미지가 되지 않도록 낮고 자연스러운 그림자만 유지하세요."], sourceWork: "Work005-001", caseIds: ["CASE-008", "CASE-009", "CASE-010"] },
  { ruleId: "CARAT-R019", name: "지정되지 않은 속성 잠금", status: "review", moduleId: "core.edit-boundary", lines: ["명시적으로 허용되지 않은 모든 속성은 원본 그대로 잠그고 부수적인 편집을 하지 마세요."], sourceWork: "Work005-001", caseIds: ["CASE-007"] },
] as const satisfies readonly ValidationRuleVariant[];

export const RUNTIME_EXCLUDED_RULE_IDS = ["CARAT-R020", "CARAT-R021", "CARAT-R022", "CARAT-R023"] as const;
