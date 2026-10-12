import type { PromptModule } from "../legacy/types";

export const outputSafetyModule: PromptModule = {
  id: "core.output-safety",
  category: "core",
  section: "출력 안전",
  lines: [
    "텍스트, 워터마크, 로고 또는 AI 생성 흔적을 추가하지 마세요.",
    "다른 인물을 추가하지 마세요.",
  ],
};
