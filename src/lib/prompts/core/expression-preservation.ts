import type { PromptModule } from "../legacy/types";

export const expressionPreservationModule: PromptModule = {
  id: "core.expression-preservation",
  category: "core",
  section: "표정 보존",
  lines: [
    "원본의 표정, 눈의 개방 정도, 입 모양, 미소 정도와 감정 상태를 유지하세요.",
    "명시적으로 허용된 요청이 없다면 미소나 다른 표정을 새로 만들지 마세요.",
  ],
};
