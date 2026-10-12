import { describe, expect, it } from "vitest";

import { buildCandidatePrompt } from "../builder";
import {
  getBusinessProfileStyle,
  getBusinessProfileStyleOptions,
} from "./style";

const EXPECTED_MODIFIERS = {
  natural:
    "Natural and approachable professional portrait with realistic, understated photographic treatment.",
  refined:
    "Refined and polished professional portrait with clean, sophisticated photographic treatment.",
  dreamy:
    "Softly atmospheric professional portrait with diffused light, gentle tones and subtle depth while remaining realistic and professional.",
  modern:
    "Modern and clean professional portrait with contemporary, minimal photographic treatment.",
  elegant:
    "Elegant and sophisticated professional portrait with restrained, high-end photographic treatment.",
  "hair-designer":
    "헤어디자이너의 친근하고 전문적인 상반신 브랜딩 프로필입니다. 부드러운 확산광과 절제된 헤어 분리광으로 얼굴과 원본 머리카락의 결·윤곽이 함께 보이게 하세요. 배경은 브랜드 없는 중립 스튜디오 또는 흐릿한 살롱 분위기로만 표현하세요. 원본의 헤어라인·가르마·길이·색·질감, 얼굴·피부 특징과 의상 취향을 보존하세요. 요청하지 않은 가위·빗·드라이어·고객·자격증·로고·유니폼을 만들거나 헤어스타일을 시술 전후처럼 바꾸지 마세요. 뷰티 필터나 과한 보정은 금지합니다.",
  "fitness-trainer":
    "밝고 깨끗한 스튜디오 또는 브랜드가 없는 운동 공간에서 활기차지만 전문적인 프로필로 표현하세요. 체형이나 근육을 과장하거나 얼굴, 피부, 나이를 변경하지 말고 아령, 운동기구, 자격증, 로고, 상의 탈의 또는 광고식 자세를 자동 생성하지 마세요.",
} as const;

describe("business profile style", () => {
  it("defines the bounded style ids", () => {
    expect(getBusinessProfileStyleOptions().map(({ id }) => id)).toEqual([
      "auto",
      "natural",
      "refined",
      "dreamy",
      "modern",
      "elegant",
      "hair-designer",
      "fitness-trainer",
    ]);
  });

  it("keeps the default prompt byte-for-byte identical in auto mode", () => {
    const input = {
      presetId: "business-profile",
      model: "flash",
      profession: "의사",
      outfitId: "auto",
      backgroundId: "auto",
    } as const;
    const defaultResult = buildCandidatePrompt(input);
    const autoResult = buildCandidatePrompt({ ...input, styleId: "auto" });

    expect(autoResult.styleId).toBe("auto");
    expect(autoResult.styleModifier).toBeUndefined();
    expect(autoResult.prompt).toBe(defaultResult.prompt);
    expect(autoResult.prompt).not.toContain("[촬영 스타일]");
  });

  it.each(Object.entries(EXPECTED_MODIFIERS))(
    "assembles the exact %s modifier",
    (styleId, modifier) => {
      const result = buildCandidatePrompt({
        presetId: "business-profile",
        model: "flash",
        profession: "헤어디자이너",
        styleId,
      });

      expect(result.styleId).toBe(styleId);
      expect(result.styleModifier).toBe(modifier);
      expect(result.prompt).toContain(`[촬영 스타일]\n- ${modifier}`);
      expect(result.prompt).toContain("business-profile.profession.beauty");
    },
  );

  it("keeps explicit candidate options and requests intact", () => {
    const result = buildCandidatePrompt({
      presetId: "business-profile",
      model: "flash",
      profession: "변호사",
      styleId: "dreamy",
      outfitId: "smart-casual",
      backgroundId: "white",
      customRequest: "이 후보는 약한 3/4 각도로 표현해 주세요",
      additionalRequest: "안경은 원본대로 유지해 주세요",
    });

    expect(result.prompt).toContain(EXPECTED_MODIFIERS.dreamy);
    expect(result.prompt).toContain("스마트 캐주얼 전문 의상");
    expect(result.prompt).toContain("화이트 전문 스튜디오 배경");
    expect(result.prompt).toContain("이 후보는 약한 3/4 각도로 표현해 주세요");
    expect(result.prompt).toContain("안경은 원본대로 유지해 주세요");
    expect(result.prompt).toContain("명시적인 후보별 의상과 배경을 변경하지 않습니다");
  });

  it("rejects invalid ids and never maps client text into the prompt", () => {
    expect(getBusinessProfileStyle("client-injected-style")).toBeNull();
    expect(() =>
      buildCandidatePrompt({
        presetId: "business-profile",
        model: "flash",
        profession: "개발자",
        styleId: "client-injected-style",
      }),
    ).toThrow("INVALID_BUSINESS_PROFILE_STYLE");
  });

  it("rejects business-only style input for other services", () => {
    expect(() =>
      buildCandidatePrompt({
        presetId: "profile-photo",
        model: "flash",
        styleId: "natural",
      }),
    ).toThrow("INVALID_BUSINESS_PROFILE_STYLE");
  });
});
