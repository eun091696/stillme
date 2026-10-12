import type { PromptModule } from "../legacy/types";

export const sourceOfTruthModule: PromptModule = {
  id: "core.source-of-truth",
  category: "core",
  section: "원본 기준",
  lines: [
    "업로드된 이미지만 인물의 정체성, 얼굴, 피부, 머리카락, 표정과 개인 특징의 기준으로 사용하세요.",
    "원본에서 확인할 수 없는 인물 특징을 추측하거나 새로 만들지 마세요.",
  ],
};
