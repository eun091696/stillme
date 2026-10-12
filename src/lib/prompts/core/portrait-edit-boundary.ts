import type { PromptModule } from "../legacy/types";

export const portraitEditBoundaryModule: PromptModule = {
  id: "core.portrait-edit-boundary",
  category: "core",
  section: "편집 범위",
  lines: [
    "의상, 배경, 조명, 구도, 크롭, 자세 정렬과 사진 표현만 프리셋이 지정한 범위에서 변경하세요.",
    "정체성, 얼굴 구조, 피부 특성, 헤어스타일, 표정, 나이, 민족적 특징, 신체 정체성과 영구적인 개인 특징은 변경하지 마세요.",
    "요청된 변경만 수행하고 그 밖의 모든 요소는 원본 그대로 유지하세요.",
  ],
};
