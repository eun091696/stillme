import { HAIR_DESIGNER_CATEGORY } from "./business-profile/category-config";

export type CategoryStep = "look" | "upload" | "options";
export type CategoryMode = "create" | "enhance";
export type CategoryChoice = {
  id: string;
  label: string;
  description?: string;
  sampleSrc?: string;
  sampleKind?: "real" | "mock" | "generated";
  swatch?: string;
  instruction?: string | null;
  components?: { background: string; lighting: string; pose: string; composition: string };
};
export type CategoryOptionGroup = {
  field: "hairStyleId" | "profileOutfitId" | "idBackgroundId" | "idOutfitId" | "idTieId" | "characterOutfitId" | "characterBackgroundId";
  label: string;
  choices: readonly CategoryChoice[];
};
export type CategoryFlow = {
  id: string;
  presetId: string;
  mode: CategoryMode;
  steps: readonly CategoryStep[];
  selection?: { field: "lookId" | "characterStyleId"; label: string; choices: readonly CategoryChoice[] };
  options: readonly CategoryOptionGroup[];
  note?: string;
};

const FLOWS: readonly CategoryFlow[] = [
  {
    id: HAIR_DESIGNER_CATEGORY.id, presetId: HAIR_DESIGNER_CATEGORY.presetId, mode: "create",
    steps: ["look", "options", "upload"],
    selection: { field: "lookId", label: "원하는 Look을 고르세요", choices: HAIR_DESIGNER_CATEGORY.looks.map((look) => ({ id: look.id, label: look.name, description: look.description, sampleSrc: look.sampleSrc, sampleKind: look.sampleKind, components: look.components })) },
    options: [
      { field: "hairStyleId", label: "헤어스타일", choices: HAIR_DESIGNER_CATEGORY.hairChoices.map((hair) => ({ id: hair.id, label: hair.label, sampleSrc: hair.sampleSrc, sampleKind: "mock" as const, instruction: hair.instruction })) },
      { field: "profileOutfitId", label: "의상", choices: HAIR_DESIGNER_CATEGORY.outfitChoices.filter((outfit) => !["light", "dark", "recommended"].includes(outfit.id)).map((outfit) => ({ id: outfit.id, label: outfit.label, sampleSrc: "sampleSrc" in outfit ? outfit.sampleSrc : undefined, sampleKind: "sampleSrc" in outfit ? "mock" as const : undefined })) },
    ],
    note: "얼굴과 피부 등 인물의 정체성을 유지합니다.",
  },
  {
    id: "id-photo", presetId: "resume-id", mode: "create", steps: ["upload", "options"],
    options: [
      { field: "idBackgroundId", label: "배경", choices: [
        { id: "white", label: "화이트", sampleSrc: "/images/options/id/white-suit-notie.webp", sampleKind: "mock" },
        { id: "light-gray", label: "라이트 그레이", sampleSrc: "/images/options/id/light-gray-suit-notie.webp", sampleKind: "mock" },
      ] },
      { field: "idOutfitId", label: "의상", choices: [
        { id: "suit", label: "단정한 정장", sampleSrc: "/images/options/id/white-suit-notie.webp", sampleKind: "mock" },
        { id: "keep-original", label: "원본 의상 유지", swatch: "#d9cbbb" },
        { id: "shirt", label: "셔츠 / 블라우스", sampleSrc: "/images/options/id/white-shirt.webp", sampleKind: "mock" },
      ] },
      { field: "idTieId", label: "넥타이 · 정장 선택 시", choices: [
        { id: "none", label: "넥타이 없음", sampleSrc: "/images/options/id/white-suit-notie.webp", sampleKind: "mock" },
        { id: "dark", label: "차분한 넥타이", sampleSrc: "/images/options/id/white-suit-tie.webp", sampleKind: "mock" },
      ] },
    ],
    note: "머리 모양과 가르마는 원본 그대로 유지합니다. 공식 여권 규격 보장 서비스가 아닙니다.",
  },
  {
    id: "underwater-correction", presetId: "underwater-correction", mode: "enhance", steps: ["upload"], options: [],
    note: "원본 수중 장면의 구도와 피사체를 유지하며 물속의 색과 명료도만 자연스럽게 보정합니다. 인물이 없어도 됩니다.",
  },
  {
    id: "character-avatar", presetId: "character-avatar", mode: "create", steps: ["look", "options", "upload"],
    selection: { field: "characterStyleId", label: "캐릭터 스타일을 고르세요", choices: [
      { id: "block-figure", label: "블록 피규어", description: "브랜드 없는 조립식 피규어", sampleSrc: "/images/options/character/block-figure-original-studio.webp", sampleKind: "mock" },
      { id: "pixel-art", label: "픽셀 아트", description: "선명한 픽셀 일러스트", sampleSrc: "/images/options/character/pixel-art-original-studio.webp", sampleKind: "mock" },
      { id: "clay", label: "클레이", description: "손으로 빚은 듯한 입체감", sampleSrc: "/images/options/character/clay-original-studio.webp", sampleKind: "mock" },
    ] },
    options: [
      { field: "characterOutfitId", label: "의상", choices: [
        { id: "original", label: "원본 의상 특징 유지", sampleSrc: "/images/options/character/block-figure-original-studio.webp", sampleKind: "mock" },
        { id: "neutral", label: "중립색 의상", sampleSrc: "/images/options/character/block-figure-neutral-studio.webp", sampleKind: "mock" },
      ] },
      { field: "characterBackgroundId", label: "배경", choices: [
        { id: "studio", label: "심플 스튜디오", sampleSrc: "/images/options/character/block-figure-original-studio.webp", sampleKind: "mock" },
        { id: "original", label: "원본 배경 분위기", sampleSrc: "/images/options/character/block-figure-original-original.webp", sampleKind: "mock" },
      ] },
    ],
    note: "헤어 · 원본의 헤어 실루엣과 색을 스타일 안에서 알아볼 수 있게 유지합니다.",
  },
];

export function getCategoryFlow(id: unknown): CategoryFlow | null {
  return typeof id === "string" ? FLOWS.find((flow) => flow.id === id) ?? null : null;
}

export function getCategoryChoice(flow: CategoryFlow, field: CategoryOptionGroup["field"], id: unknown) {
  return typeof id === "string" ? flow.options.find((group) => group.field === field)?.choices.find((choice) => choice.id === id) ?? null : null;
}

export function getCharacterStyle(id: unknown) {
  const flow = getCategoryFlow("character-avatar");
  return typeof id === "string" ? flow?.selection?.choices.find((choice) => choice.id === id) ?? null : null;
}
