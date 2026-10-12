import type { PromptVersion } from "../types";

export type ProfileCategoryConfig = {
  id: string;
  promptVersion: PromptVersion;
  presetId: "business-profile";
  profession: string;
  catalog: {
    title: string;
    englishTitle: string;
    description: string;
    label: string;
    group: "추천" | "취업/비즈니스" | "전문직" | "크리에이터";
    order: number;
    available: boolean;
  };
  promptInstruction: string;
  looks: readonly {
    id: string;
    name: string;
    description: string;
    sampleSrc: string;
    sampleKind: "mock" | "real" | "generated";
    components: {
      background: string;
      lighting: string;
      pose: string;
      composition: string;
      mood: string;
      defaultOutfit: string;
    };
  }[];
  hairChoices: readonly { id: string; label: string; sampleSrc: string; instruction: string | null }[];
  outfitChoices: readonly {
    id: string;
    label: string;
    sampleSrc?: string;
    instruction: string | null;
  }[];
};

// These are editorial UI mockups, not verified STILLME outputs.
export const HAIR_DESIGNER_CATEGORY = {
  id: "hair-designer-profile",
  promptVersion: "2.5.3",
  presetId: "business-profile",
  profession: "헤어디자이너",
  catalog: { title: "헤어 디자이너 프로필", englishTitle: "HAIR DESIGNER PROFILE", description: "네 가지 촬영 분위기에서 나다운 브랜딩 프로필 선택", label: "Hair Designer", group: "크리에이터", order: 1, available: true },
  promptInstruction: "미용실이나 시술 현장 대신 실제 촬영한 현대적인 개인 브랜딩 인물 사진으로 표현하세요. 직업 소품, 로고, 유니폼, 전형적인 AI 얼굴은 피하세요. 원본 헤어라인과 모발 색·질감을 유지하고, 길이와 스타일은 명시적 Hair 선택이 없을 때 유지하세요.",
  looks: [
    {
      id: "clean-professional", name: "Clean Professional", description: "맑은 스튜디오, 단정한 인상",
      sampleSrc: "/images/mock/hair-designer/clean-professional.webp", sampleKind: "mock",
      components: {
        background: "브랜드 없는 부드러운 오프화이트 스튜디오 배경",
        lighting: "얼굴과 원본 머리카락의 결이 보이는 부드러운 확산광",
        pose: "힘을 빼고 카메라를 바라보는 자연스러운 자세",
        composition: "어깨와 상반신이 충분히 보이는 균형 잡힌 프로필 구도",
        mood: "깔끔하고 친근한 개인 브랜딩 사진",
        defaultOutfit: "로고 없는 단정한 중립색 의상, 원본 의상 취향 존중",
      },
    },
    {
      id: "black-chic", name: "Black Chic", description: "짙은 톤, 절제된 자신감",
      sampleSrc: "/images/mock/hair-designer/black-chic.webp", sampleKind: "mock",
      components: {
        background: "미용실이 아닌 절제된 차콜 톤 스튜디오 배경",
        lighting: "얼굴이 어두워지지 않는 부드러운 측면 조명과 섬세한 헤어 분리광",
        pose: "자연스럽고 편안한 정면 또는 약한 측면 자세",
        composition: "얼굴과 어깨가 또렷한 상반신 프레이밍",
        mood: "세련되고 과장 없는 블랙 톤 퍼스널 브랜딩",
        defaultOutfit: "로고 없는 심플한 다크 톤 테일러드 의상",
      },
    },
    {
      id: "soft-natural", name: "Soft Natural", description: "따뜻한 빛, 편안한 표정",
      sampleSrc: "/images/mock/hair-designer/soft-natural.webp", sampleKind: "mock",
      components: {
        background: "특정 장소가 드러나지 않는 따뜻한 베이지 스튜디오 배경",
        lighting: "피부색과 머리카락의 질감을 보존하는 은은한 자연광",
        pose: "어깨의 긴장을 풀고 자연스럽게 시선을 주는 자세",
        composition: "너무 타이트하지 않은 상반신 인물 중심 구도",
        mood: "따뜻하고 신뢰감 있는 자연스러운 인물 사진",
        defaultOutfit: "브랜드 없는 밝고 편안한 중립색 의상",
      },
    },
    {
      id: "editorial", name: "Editorial", description: "선명한 구도, 차분한 존재감",
      sampleSrc: "/images/mock/hair-designer/editorial.webp", sampleKind: "mock",
      components: {
        background: "소품 없는 절제된 웜 그레이 스튜디오 배경",
        lighting: "현실적인 깊이와 얼굴의 형태가 보이는 부드러운 측면광",
        pose: "부자연스럽지 않은 약한 측면 포즈",
        composition: "시선을 인물에 모으는 여백 있는 상반신 에디토리얼 구도",
        mood: "패션 판타지가 아닌 실제 촬영 같은 절제된 에디토리얼 인물 사진",
        defaultOutfit: "로고 없는 현대적인 미니멀 테일러드 의상",
      },
    },
  ],
  hairChoices: [
    { id: "current", label: "원본 유지", sampleSrc: "/images/options/hair/current.webp", instruction: null },
    { id: "see-through-bangs", label: "시스루뱅", sampleSrc: "/images/options/hair/see-through-bangs.webp", instruction: "원본 인물의 얼굴과 머리색을 유지하면서 가벼운 시스루 앞머리로 연출해 주세요." },
    { id: "long-straight", label: "긴 생머리", sampleSrc: "/images/options/hair/long-straight.webp", instruction: "원본 인물의 얼굴과 머리색을 유지하면서 긴 생머리로 연출해 주세요." },
    { id: "tied", label: "묶은 머리", sampleSrc: "/images/options/hair/tied.webp", instruction: "원본 인물의 얼굴과 머리색을 유지하면서 머리를 자연스럽게 묶어 주세요." },
    { id: "wave", label: "웨이브", sampleSrc: "/images/options/hair/wave.webp", instruction: "원본 인물의 얼굴과 머리색을 유지하면서 자연스러운 웨이브로 연출해 주세요." },
  ],
  outfitChoices: [
    { id: "current", label: "원본 의상 유지", sampleSrc: "/images/options/outfit/current.webp", instruction: "원본 의상의 색과 형태를 유지하세요. 얼굴은 변경하지 않고 Hair 선택은 별도로 적용하세요." },
    { id: "recommended", label: "Look 추천 의상", instruction: null },
    { id: "light", label: "밝은 톤", sampleSrc: "/images/mock/hair-designer/clean-professional.webp", instruction: "의상만 브랜드 없는 밝은 중립색의 단정한 상의로 조정하세요. 얼굴은 변경하지 않고 Hair 선택은 별도로 적용하세요." },
    { id: "dark", label: "짙은 톤", sampleSrc: "/images/mock/hair-designer/black-chic.webp", instruction: "의상만 브랜드 없는 짙은 중립색의 단정한 테일러드 상의로 조정하세요. 얼굴은 변경하지 않고 Hair 선택은 별도로 적용하세요." },
    { id: "black-jacket", label: "블랙 재킷", sampleSrc: "/images/options/outfit/black-jacket.webp", instruction: "브랜드 없는 검은색 재킷으로 의상만 바꾸세요. 얼굴은 유지하고 Hair 선택은 별도로 적용하세요." },
    { id: "white-shirt", label: "화이트 셔츠", sampleSrc: "/images/options/outfit/white-shirt.webp", instruction: "브랜드 없는 흰 셔츠로 의상만 바꾸세요. 얼굴은 유지하고 Hair 선택은 별도로 적용하세요." },
    { id: "knit", label: "니트", sampleSrc: "/images/options/outfit/knit.webp", instruction: "브랜드 없는 단정한 니트로 의상만 바꾸세요. 얼굴은 유지하고 Hair 선택은 별도로 적용하세요." },
    { id: "casual", label: "캐주얼", sampleSrc: "/images/options/outfit/casual.webp", instruction: "브랜드 없는 편안한 캐주얼 상의로 의상만 바꾸세요. 얼굴은 유지하고 Hair 선택은 별도로 적용하세요." },
  ],
} as const satisfies ProfileCategoryConfig;

export const PROFILE_CATEGORIES: readonly ProfileCategoryConfig[] = [HAIR_DESIGNER_CATEGORY];

export function getProfileCategory(id: unknown): ProfileCategoryConfig | null {
  return typeof id === "string" ? PROFILE_CATEGORIES.find((category) => category.id === id) ?? null : null;
}

export function getProfileLook(category: ProfileCategoryConfig, id: unknown) {
  return typeof id === "string" ? category.looks.find((look) => look.id === id) ?? null : null;
}

export function getProfileHair(category: ProfileCategoryConfig, id: unknown) {
  return typeof id === "string" ? category.hairChoices.find((hair) => hair.id === id) ?? null : null;
}

export function getProfileOutfit(category: ProfileCategoryConfig, id: unknown) {
  return typeof id === "string" ? category.outfitChoices.find((outfit) => outfit.id === id) ?? null : null;
}
