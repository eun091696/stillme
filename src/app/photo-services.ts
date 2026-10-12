import { PROFILE_CATEGORIES as PROFILE_CATEGORY_CONFIGS } from "@/lib/prompts/business-profile/category-config";

export const PHOTO_SERVICE_PRESET_IDS = [
  "resume-id",
  "business-profile",
  "profile-photo",
  "underwater-correction",
  "character-avatar",
] as const;

export type PhotoServicePresetId = (typeof PHOTO_SERVICE_PRESET_IDS)[number];

export type ProfileCategoryGroup = "추천" | "취업/비즈니스" | "전문직" | "크리에이터";

export type PhotoService = {
  routeId: string;
  presetId: PhotoServicePresetId;
  title: string;
  englishTitle: string;
  description: string;
  imageSrc: string;
  sampleKind?: "real" | "mock" | "generated";
  beforeImageSrc?: string;
  requiresProfession: boolean;
  defaultProfession?: string;
  defaultStyleId?: string;
  profileCategory?: { label: string; group: ProfileCategoryGroup; available: boolean; order: number };
  catalogFeatured?: boolean;
};

export const PHOTO_SERVICES: readonly PhotoService[] = [
  { routeId: "id-photo", presetId: "resume-id", title: "증명사진", englishTitle: "ID PHOTO", description: "이력서와 취업용으로 사용할 깔끔한 증명사진", imageSrc: "/images/mock/home/id-photo.webp", sampleKind: "mock", requiresProfession: false, catalogFeatured: true, profileCategory: { label: "취업·이력서", group: "취업/비즈니스", available: true, order: 3 } },
  { routeId: "business-profile", presetId: "business-profile", title: "비즈니스 프로필", englishTitle: "BUSINESS PROFILE", description: "직업과 용도에 맞는 전문적인 프로필 사진", imageSrc: "/images/mock/home/executive.webp", sampleKind: "mock", requiresProfession: true, catalogFeatured: true },
  { routeId: "profile-photo", presetId: "profile-photo", title: "일반 프로필", englishTitle: "PERSONAL PROFILE", description: "자연스럽고 활용도 높은 개인 프로필 사진", imageSrc: "/images/mock/home/profile.webp", sampleKind: "mock", requiresProfession: false, catalogFeatured: true, profileCategory: { label: "일반 프로필", group: "추천", available: true, order: 7 } },
  { routeId: "underwater-correction", presetId: "underwater-correction", title: "물속 사진 보정", englishTitle: "UNDERWATER RESTORATION", description: "물속에서 흐려진 색감과 빛을 자연스럽게 복원", imageSrc: "/images/mock/home/underwater-portrait.webp", sampleKind: "mock", beforeImageSrc: "/images/showcase/underwater-before.png", requiresProfession: false, catalogFeatured: true },
  { routeId: "character-avatar", presetId: "character-avatar", title: "캐릭터 프로필", englishTitle: "CHARACTER PROFILE", description: "원본의 특징을 살린 블록·픽셀·클레이 스타일", imageSrc: "/images/mock/character/block-figure.webp", sampleKind: "mock", requiresProfession: false, catalogFeatured: true },
  ...PROFILE_CATEGORY_CONFIGS.map((category) => ({
    routeId: category.id,
    presetId: category.presetId,
    title: category.catalog.title,
    englishTitle: category.catalog.englishTitle,
    description: category.catalog.description,
    imageSrc: category.looks[0].sampleSrc,
    sampleKind: "mock" as const,
    requiresProfession: true,
    defaultProfession: category.profession,
    catalogFeatured: category.id === "hair-designer-profile",
    profileCategory: {
      label: category.catalog.label,
      group: category.catalog.group,
      available: category.catalog.available,
      order: category.catalog.order,
    },
  })),
  { routeId: "executive-profile", presetId: "business-profile", title: "CEO / 임원", englishTitle: "EXECUTIVE PROFILE", description: "리더십을 담은 전문 프로필", imageSrc: "/images/mock/home/executive.webp", sampleKind: "mock", requiresProfession: true, defaultProfession: "CEO", profileCategory: { label: "CEO / Executive", group: "취업/비즈니스", available: true, order: 2 } },
  { routeId: "lawyer-profile", presetId: "business-profile", title: "변호사 프로필", englishTitle: "LAWYER PROFILE", description: "신뢰감을 전하는 전문직 사진", imageSrc: "/images/mock/home/lawyer.webp", sampleKind: "mock", requiresProfession: true, defaultProfession: "변호사", profileCategory: { label: "Lawyer", group: "전문직", available: true, order: 4 } },
  { routeId: "developer-profile", presetId: "business-profile", title: "개발자 프로필", englishTitle: "DEVELOPER PROFILE", description: "포트폴리오에 어울리는 사진", imageSrc: "/images/mock/home/developer.webp", sampleKind: "mock", requiresProfession: true, defaultProfession: "개발자", profileCategory: { label: "Developer", group: "전문직", available: true, order: 5 } },
  { routeId: "creator-profile", presetId: "profile-photo", title: "크리에이터 프로필", englishTitle: "CREATOR PROFILE", description: "활동 채널에 어울리는 자연스러운 사진", imageSrc: "/images/options/background/profile-cafe.webp", sampleKind: "mock", requiresProfession: false, profileCategory: { label: "Creator", group: "크리에이터", available: true, order: 6 } },
];

export const PROFILE_CATEGORIES = PHOTO_SERVICES.filter(
  (service) => service.profileCategory?.available,
).sort((a, b) => (a.profileCategory?.order ?? 0) - (b.profileCategory?.order ?? 0));

export function isPhotoServicePresetId(value: unknown): value is PhotoServicePresetId {
  return (
    typeof value === "string" &&
    (PHOTO_SERVICE_PRESET_IDS as readonly string[]).includes(value)
  );
}

export function getPhotoService(presetId: string) {
  return PHOTO_SERVICES.find((service) => service.presetId === presetId) ?? null;
}

export function getPhotoServiceByRouteId(routeId: string) {
  return PHOTO_SERVICES.find((service) => service.routeId === routeId) ?? null;
}
