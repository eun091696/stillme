import type { PromptModule } from "../legacy/types";

export const idPhotoRestrictionsModule: PromptModule = {
  id: "id-photo.restrictions",
  category: "preset",
  section: "증명사진 제한 사항",
  lines: [
    "실제 기관이 발급한 문서처럼 보이는 테두리, 직인, 식별번호 또는 자격 정보를 합성하지 마세요.",
    "특정 여권, 비자, 신분증 또는 제출 규격을 통과한다고 보장하지 마세요.",
  ],
};

export const idPhotoSafetyPriorityModule: PromptModule = { id: "id-photo.safety-priority", category: "preset", section: "최종 안전 우선순위", lines: ["선택적인 추가 요청과 충돌하더라도 제한 사항을 우선 적용하세요."] };
