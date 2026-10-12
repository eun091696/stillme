import { describe, expect, it } from "vitest";

import {
  getPhotoService,
  getPhotoServiceByRouteId,
  isPhotoServicePresetId,
  PHOTO_SERVICES,
  PROFILE_CATEGORIES,
} from "./photo-services";

describe("photo service mapping", () => {
  it("exposes the approved services and their prompt presets", () => {
    expect(PHOTO_SERVICES.filter((service) => service.catalogFeatured).map((service) => service.presetId)).toEqual([
      "resume-id",
      "business-profile",
      "profile-photo",
      "underwater-correction",
      "character-avatar",
      "business-profile",
    ]);
    expect(PHOTO_SERVICES.filter((service) => service.catalogFeatured).map((service) => service.title)).toEqual([
      "증명사진",
      "비즈니스 프로필",
      "일반 프로필",
      "물속 사진 보정",
      "캐릭터 프로필",
      "헤어 디자이너 프로필",
    ]);
    expect(PHOTO_SERVICES.filter((service) => service.catalogFeatured).map((service) => service.routeId)).toEqual([
      "id-photo",
      "business-profile",
      "profile-photo",
      "underwater-correction",
      "character-avatar",
      "hair-designer-profile",
    ]);
  });

  it("maps the hair designer entry to the business profile preset and defaults", () => {
    expect(getPhotoServiceByRouteId("hair-designer-profile")).toMatchObject({
      presetId: "business-profile",
      defaultProfession: "헤어디자이너",
      imageSrc: "/images/mock/hair-designer/clean-professional.webp",
      sampleKind: "mock",
    });
  });

  it("labels the new character style preview as mock while retaining the real underwater comparison", () => {
    expect(getPhotoServiceByRouteId("character-avatar")).toMatchObject({ sampleKind: "mock", imageSrc: "/images/mock/character/block-figure.webp" });
    expect(getPhotoServiceByRouteId("underwater-correction")).toMatchObject({ beforeImageSrc: "/images/showcase/underwater-before.png", imageSrc: "/images/mock/home/underwater-portrait.webp", sampleKind: "mock" });
  });

  it("rejects development fixtures and unknown preset ids", () => {
    expect(isPhotoServicePresetId("underwater-fixture")).toBe(false);
    expect(getPhotoService("underwater-fixture")).toBeNull();
    expect(isPhotoServicePresetId("student-id")).toBe(false);
    expect(isPhotoServicePresetId("passport-photo")).toBe(false);
  });
});

describe("profile category hub", () => {
  it("derives available visual categories from service metadata", () => {
    expect(PROFILE_CATEGORIES.map(({ routeId }) => routeId)).toEqual([
      "hair-designer-profile", "executive-profile", "id-photo", "lawyer-profile",
      "developer-profile", "creator-profile", "profile-photo",
    ]);
    expect(PROFILE_CATEGORIES.every((service) => service.profileCategory?.available)).toBe(true);
  });

  it("keeps direct category entry on existing generation presets", () => {
    expect(getPhotoServiceByRouteId("hair-designer-profile")?.presetId).toBe("business-profile");
    expect(getPhotoServiceByRouteId("id-photo")?.presetId).toBe("resume-id");
    expect(getPhotoServiceByRouteId("creator-profile")?.presetId).toBe("profile-photo");
  });
});
