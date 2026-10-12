export type BusinessProfileStyleId =
  | "auto"
  | "natural"
  | "refined"
  | "dreamy"
  | "modern"
  | "elegant"
  | "hair-designer"
  | "fitness-trainer";

export type BusinessProfileStyleOption = {
  id: BusinessProfileStyleId;
  label: string;
  promptModifier: string | null;
};

const BUSINESS_PROFILE_STYLE_OPTIONS = [
  { id: "auto", label: "추천", promptModifier: null },
  {
    id: "natural",
    label: "자연스러운",
    promptModifier:
      "Natural and approachable professional portrait with realistic, understated photographic treatment.",
  },
  {
    id: "refined",
    label: "세련된",
    promptModifier:
      "Refined and polished professional portrait with clean, sophisticated photographic treatment.",
  },
  {
    id: "dreamy",
    label: "몽환적인",
    promptModifier:
      "Softly atmospheric professional portrait with diffused light, gentle tones and subtle depth while remaining realistic and professional.",
  },
  {
    id: "modern",
    label: "모던",
    promptModifier:
      "Modern and clean professional portrait with contemporary, minimal photographic treatment.",
  },
  {
    id: "elegant",
    label: "고급스러운",
    promptModifier:
      "Elegant and sophisticated professional portrait with restrained, high-end photographic treatment.",
  },
  {
    id: "hair-designer",
    label: "헤어 디자이너",
    promptModifier:
      "헤어디자이너의 친근하고 전문적인 상반신 브랜딩 프로필입니다. 부드러운 확산광과 절제된 헤어 분리광으로 얼굴과 원본 머리카락의 결·윤곽이 함께 보이게 하세요. 배경은 브랜드 없는 중립 스튜디오 또는 흐릿한 살롱 분위기로만 표현하세요. 원본의 헤어라인·가르마·길이·색·질감, 얼굴·피부 특징과 의상 취향을 보존하세요. 요청하지 않은 가위·빗·드라이어·고객·자격증·로고·유니폼을 만들거나 헤어스타일을 시술 전후처럼 바꾸지 마세요. 뷰티 필터나 과한 보정은 금지합니다.",
  },
  {
    id: "fitness-trainer",
    label: "피트니스 트레이너",
    promptModifier:
      "밝고 깨끗한 스튜디오 또는 브랜드가 없는 운동 공간에서 활기차지만 전문적인 프로필로 표현하세요. 체형이나 근육을 과장하거나 얼굴, 피부, 나이를 변경하지 말고 아령, 운동기구, 자격증, 로고, 상의 탈의 또는 광고식 자세를 자동 생성하지 마세요.",
  },
] as const satisfies readonly BusinessProfileStyleOption[];

export function getBusinessProfileStyleOptions(): readonly BusinessProfileStyleOption[] {
  return BUSINESS_PROFILE_STYLE_OPTIONS;
}

export function getDefaultBusinessProfileStyle(): BusinessProfileStyleOption {
  return BUSINESS_PROFILE_STYLE_OPTIONS[0];
}

export function getBusinessProfileStyle(
  styleId: unknown,
): BusinessProfileStyleOption | null {
  if (typeof styleId !== "string") return null;
  return (
    BUSINESS_PROFILE_STYLE_OPTIONS.find((option) => option.id === styleId) ??
    null
  );
}
