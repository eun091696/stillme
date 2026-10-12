import type { PromptModule } from "../legacy/types";

export const facialGeometryModule: PromptModule = {
  id: "core.facial-geometry-preservation",
  category: "core",
  section: "얼굴 구조 보존",
  lines: [
    "원본의 얼굴형, 두상, 턱선, 광대, 눈과 눈꺼풀, 눈썹, 코, 입술, 귀와 얼굴 비율을 그대로 유지하세요.",
    "자연스러운 좌우 비대칭을 보존하고 얼굴을 더 대칭적이거나 이상적인 형태로 바꾸지 마세요.",
  ],
};
