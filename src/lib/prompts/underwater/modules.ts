import type { PromptModule } from "../legacy/types";
export const underwaterModules: readonly PromptModule[] = [
  { id: "underwater.scene-preservation", category: "underwater", section: "수중 장면 보존", lines: ["수중 장면, 피사체의 위치와 자연스러운 공간 관계를 보존하세요."] },
  { id: "underwater.color-recovery", category: "underwater", section: "색감 복원", lines: ["관련 없는 사물이나 색상을 새로 만들지 말고 자연스러운 수중 색감을 복원하세요."] },
  { id: "underwater.natural-quality", category: "underwater", section: "자연스러운 품질", lines: ["물리적으로 자연스러운 빛의 감쇠를 적용하고 실제 사진 같은 결과를 유지하세요."] },
  { id: "underwater.equipment-preservation", category: "underwater", section: "장비 보존", lines: ["사진에 보이는 다이빙 장비와 피사체 사이의 기능적 관계를 보존하세요."] },
  { id: "underwater.restrictions", category: "underwater", section: "제한 사항", lines: ["사람, 텍스트, 로고 또는 인공적인 수중 요소를 새로 추가하지 마세요."] },
];
