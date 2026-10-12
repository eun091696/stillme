export type CandidateServicePresetId =
  | "resume-id"
  | "business-profile"
  | "profile-photo"
  | "underwater-correction"
  | "character-avatar";

export type CandidateBackgroundOption = {
  id: string;
  label: string;
  promptInstruction: string | null;
};

export type BusinessProfileOutfitId =
  | "auto"
  | "formal"
  | "smart-casual"
  | "profession-specific";

export type BusinessProfileOutfitOption = {
  id: BusinessProfileOutfitId;
  label: string;
  promptInstruction: string | null;
};

const BUSINESS_PROFILE_OUTFIT_OPTIONS = [
  { id: "auto", label: "추천", promptInstruction: null },
  {
    id: "formal",
    label: "정장",
    promptInstruction:
      "이 후보의 의상은 검정, 네이비 또는 중립색의 단정하고 절제된 맞춤형 비즈니스 정장으로 표현하세요. 성별에 따른 특정 아이템을 과도하게 강제하지 말고 로고, 배지, 불필요한 액세서리를 추가하지 마세요. 의상에 맞추기 위해 얼굴이나 머리카락을 변경하지 마세요.",
  },
  {
    id: "smart-casual",
    label: "스마트 캐주얼",
    promptInstruction:
      "이 후보의 의상은 비즈니스 프로필에 적합한 깔끔하고 현대적이며 절제된 스마트 캐주얼 전문 의상으로 표현하세요. 패션 화보풍, 홈웨어, 로고, 브랜드 문자 또는 새로운 액세서리를 만들지 마세요.",
  },
  {
    id: "profession-specific",
    label: "직업 전문 의상",
    promptInstruction:
      "이 후보의 의상만 사용자가 입력한 실제 직업과 서버 분류 직업군에 어울리는 자연스러운 전문 의상으로 표현하세요. 의료 전문직은 깨끗한 의료 전문 의상이나 흰 가운을 사용할 수 있고, 미용 전문직은 절제된 살롱 전문 스타일을 사용할 수 있습니다. 전용 의상이 없는 직업은 가장 자연스러운 전문 의상으로 표현하세요. 청진기, 가위, 계산기, 노트북, 법봉, 책, 열쇠, 명찰, 배지, 회사·기관 로고 또는 특정 회사 유니폼은 만들지 마세요.",
  },
] as const satisfies readonly BusinessProfileOutfitOption[];

const BACKGROUND_OPTIONS = {
  "resume-id": [
    {
      id: "white",
      label: "흰색",
      promptInstruction:
        "이 사진의 배경을 명확한 순백색(#FFFFFF)의 균일하고 깨끗한 스튜디오 배경으로 교체하세요. 회색이나 푸른색 색조, 그라데이션, 그림자, 비네팅, 무늬 또는 얼룩을 만들지 마세요.",
    },
    {
      id: "light-gray",
      label: "연한 회색",
      promptInstruction:
        "이 사진의 배경을 흰색과 육안으로 명확히 구분되는 밝은 중성 회색(#D9D9D9)의 균일하고 깨끗한 스튜디오 배경으로 교체하세요. 순백색이나 거의 흰색으로 표현하지 말고 그라데이션, 그림자, 비네팅, 무늬 또는 얼룩을 만들지 마세요.",
    },
    {
      id: "light-blue",
      label: "연한 하늘색",
      promptInstruction:
        "이 사진의 배경 기본값만 균일하고 깨끗한 연한 하늘색 스튜디오 배경으로 대체하세요. 배경에 그라데이션, 그림자, 비네팅, 무늬 또는 얼룩을 만들지 마세요.",
    },
  ],
  "business-profile": [
    { id: "auto", label: "추천", promptInstruction: null },
    {
      id: "white",
      label: "화이트",
      promptInstruction:
        "이 후보의 배경을 깨끗하고 무늬 없는 화이트 전문 스튜디오 배경으로 표현하세요.",
    },
    {
      id: "light-gray",
      label: "라이트 그레이",
      promptInstruction:
        "이 후보의 배경을 단정하고 균일한 라이트 그레이 전문 스튜디오 배경으로 표현하세요.",
    },
    {
      id: "dark-gray",
      label: "다크 그레이",
      promptInstruction:
        "이 후보의 배경을 절제된 다크 그레이 전문 스튜디오로 표현하고 얼굴이 어둡게 가려지지 않게 하세요.",
    },
    {
      id: "office",
      label: "오피스",
      promptInstruction:
        "이 후보의 배경을 실제 촬영처럼 자연스럽고 단정한 현대적 오피스 공간으로 표현하세요. 절제된 깊이만 사용하고 읽을 수 있는 텍스트, 특정 회사 로고 또는 허위 소속 정보는 만들지 마세요.",
    },
    {
      id: "studio",
      label: "스튜디오",
      promptInstruction:
        "이 후보의 배경을 실제 촬영 같은 은은한 깊이가 있는 깨끗하고 미니멀한 프로페셔널 스튜디오로 표현하세요. 소품이나 촬영 장비는 보이지 않게 하세요.",
    },
  ],
  "profile-photo": [
    { id: "bright-studio", label: "밝은 스튜디오", promptInstruction: null },
    {
      id: "natural-interior",
      label: "자연스러운 실내",
      promptInstruction:
        "이 사진의 배경은 생활감이 과하지 않은 단정하고 자연스러운 실내 공간으로 표현하세요. 실제 카메라로 촬영한 듯한 깊이를 유지하세요.",
    },
    {
      id: "cafe",
      label: "카페",
      promptInstruction:
        "이 사진의 배경은 특정 상표나 로고가 보이지 않는 차분하고 자연스러운 카페 공간으로 표현하세요. 과도한 연출 없이 인물 중심으로 유지하세요.",
    },
    {
      id: "outdoor",
      label: "야외",
      promptInstruction:
        "이 사진의 배경은 부드러운 자연광이 있는 단정한 야외 공간으로 표현하세요. 특정 장소를 허위로 재현하지 말고 인물 중심의 자연스러운 깊이를 유지하세요.",
    },
  ],
  "underwater-correction": [
    { id: "preserve-scene", label: "원본 물속 배경 유지", promptInstruction: null },
    {
      id: "clear-water",
      label: "맑고 자연스럽게",
      promptInstruction:
        "원본 수중 장면과 모든 피사체는 유지하면서 물속의 부유물과 색 편향만 절제해, 실제 맑은 물에서 촬영한 것처럼 자연스럽게 정돈하세요.",
    },
  ],
  "character-avatar": [
    { id: "warm-studio", label: "따뜻한 스튜디오", promptInstruction: null },
    {
      id: "clean-studio",
      label: "깔끔한 스튜디오",
      promptInstruction:
        "블록 피규어 뒤 배경만 무늬와 소품이 없는 밝고 중립적인 스튜디오로 표현하세요. 원본의 고유한 얼굴 표시, 헤어와 의상 색은 유지하세요.",
    },
    {
      id: "original-scene",
      label: "원본 분위기 유지",
      promptInstruction:
        "원본 사진의 배경 구성과 분위기를 단순한 조립식 블록 장면으로 번역하되, 새로운 장소나 소품을 만들거나 공식 브랜드 제품처럼 보이게 하지 마세요.",
    },
  ],
} as const satisfies Record<
  CandidateServicePresetId,
  readonly CandidateBackgroundOption[]
>;

export function getCandidateBackgroundOptions(
  presetId: CandidateServicePresetId,
): readonly CandidateBackgroundOption[] {
  return BACKGROUND_OPTIONS[presetId];
}

export function getDefaultCandidateBackground(
  presetId: CandidateServicePresetId,
): CandidateBackgroundOption {
  return BACKGROUND_OPTIONS[presetId][0];
}

export function getCandidateBackground(
  presetId: CandidateServicePresetId,
  backgroundId: unknown,
): CandidateBackgroundOption | null {
  if (typeof backgroundId !== "string") return null;
  return (
    BACKGROUND_OPTIONS[presetId].find(
      (option) => option.id === backgroundId,
    ) ?? null
  );
}

export function getBusinessProfileOutfitOptions(): readonly BusinessProfileOutfitOption[] {
  return BUSINESS_PROFILE_OUTFIT_OPTIONS;
}

export function getDefaultBusinessProfileOutfit(): BusinessProfileOutfitOption {
  return BUSINESS_PROFILE_OUTFIT_OPTIONS[0];
}

export function getBusinessProfileOutfit(
  outfitId: unknown,
): BusinessProfileOutfitOption | null {
  if (typeof outfitId !== "string") return null;
  return (
    BUSINESS_PROFILE_OUTFIT_OPTIONS.find((option) => option.id === outfitId) ??
    null
  );
}
