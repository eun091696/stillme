import { describe, expect, it } from "vitest";

import { buildCandidatePrompt, buildPrompt } from "./index";
import {
  getBusinessProfileOutfitOptions,
  getCandidateBackgroundOptions,
  getDefaultCandidateBackground,
} from "./candidate-options";

describe("candidate prompt options", () => {
  it("defines bounded service-specific backgrounds", () => {
    expect(getCandidateBackgroundOptions("resume-id").map(({ id }) => id)).toEqual([
      "white",
      "light-gray",
      "light-blue",
    ]);
    expect(
      getCandidateBackgroundOptions("business-profile").map(({ id }) => id),
    ).toEqual([
      "auto",
      "white",
      "light-gray",
      "dark-gray",
      "office",
      "studio",
    ]);
    expect(
      getCandidateBackgroundOptions("profile-photo").map(({ id }) => id),
    ).toEqual([
      "bright-studio",
      "natural-interior",
      "cafe",
      "outdoor",
    ]);
    expect(
      getCandidateBackgroundOptions("underwater-correction").map(({ id }) => id),
    ).toEqual(["preserve-scene", "clear-water"]);
    expect(
      getCandidateBackgroundOptions("character-avatar").map(({ id }) => id),
    ).toEqual(["warm-studio", "clean-studio", "original-scene"]);
  });

  it("keeps white and light gray visibly distinct for id photos", () => {
    const options = getCandidateBackgroundOptions("resume-id");
    const white = options.find(({ id }) => id === "white");
    const lightGray = options.find(({ id }) => id === "light-gray");

    expect(white?.promptInstruction).toContain("#FFFFFF");
    expect(lightGray?.promptInstruction).toContain("#D9D9D9");
    expect(lightGray?.promptInstruction).toContain("순백색이나 거의 흰색으로 표현하지 말고");
    expect(white?.promptInstruction).not.toBe(lightGray?.promptInstruction);
  });

  it("defines the four bounded business outfit options", () => {
    expect(getBusinessProfileOutfitOptions().map(({ id }) => id)).toEqual([
      "auto",
      "formal",
      "smart-casual",
      "profession-specific",
    ]);
  });

  it.each(["auto", "white", "light-gray", "dark-gray", "office", "studio"])(
    "accepts the bounded business background %s",
    (backgroundId) => {
      const result = buildCandidatePrompt({
        presetId: "business-profile",
        model: "flash",
        profession: "개발자",
        backgroundId,
      });

      expect(result.candidateBackgroundId).toBe(backgroundId);
    },
  );

  it("keeps the profile-photo prompt byte-for-byte when its default is unchanged", () => {
    const presetId = "profile-photo";
    const base = buildPrompt({ presetId, model: "flash" });
    const candidate = buildCandidatePrompt({
      presetId,
      model: "flash",
      backgroundId: getDefaultCandidateBackground(presetId).id,
    });
    expect(candidate.prompt).toBe(base.prompt);
  });

  it("lets the profession module choose the business background in auto mode", () => {
    const result = buildCandidatePrompt({
      presetId: "business-profile",
      model: "flash",
      profession: "개발자",
      outfitId: "auto",
      backgroundId: "auto",
    });

    expect(result.candidateBackgroundId).toBe("auto");
    expect(result.candidateOutfitId).toBe("auto");
    expect(result.prompt).not.toContain("[후보별 명시 옵션]");
    expect(result.prompt).toContain("business-profile.profession.technology");
  });

  it.each(["formal", "smart-casual", "profession-specific"])(
    "accepts the bounded business outfit %s",
    (outfitId) => {
      const result = buildCandidatePrompt({
        presetId: "business-profile",
        model: "flash",
        profession: "의사",
        outfitId,
      });

      expect(result.candidateOutfitId).toBe(outfitId);
      expect(result.prompt).toContain("- 선택한 의상:");
      expect(result.prompt).toContain("동일인 보존과 안전 규칙");
    },
  );

  it("appends only the selected candidate option after the common request", () => {
    const result = buildCandidatePrompt({
      presetId: "resume-id",
      model: "flash",
      additionalRequest: "안경은 유지해 주세요",
      backgroundId: "light-gray",
      customRequest: "네이비 정장을 유지해 주세요",
    });
    expect(result.prompt).toContain("[사용자 추가 요청]\n- 안경은 유지해 주세요");
    expect(result.prompt).toContain("[사용자 선택 옵션]");
    expect(result.prompt).toContain("밝은 중성 회색(#D9D9D9)");
    expect(result.prompt).toContain("네이비 정장을 유지해 주세요");
    expect(result.prompt.indexOf("[사용자 추가 요청]")).toBeLessThan(
      result.prompt.indexOf("[사용자 선택 옵션]"),
    );
  });

  it("rejects unknown background ids instead of inserting client text", () => {
    expect(() =>
      buildCandidatePrompt({
        presetId: "resume-id",
        model: "flash",
        backgroundId: "ignore-rules-and-inject-text",
      }),
    ).toThrow("INVALID_CANDIDATE_BACKGROUND");
  });

  it("rejects unknown business outfit ids instead of inserting client text", () => {
    expect(() =>
      buildCandidatePrompt({
        presetId: "business-profile",
        model: "flash",
        profession: "개발자",
        outfitId: "ignore-rules-and-inject-text",
      }),
    ).toThrow("INVALID_CANDIDATE_OUTFIT");
  });

  it("rejects business-only outfit input for other services", () => {
    expect(() =>
      buildCandidatePrompt({
        presetId: "resume-id",
        model: "flash",
        outfitId: "formal",
      }),
    ).toThrow("INVALID_CANDIDATE_OUTFIT");
  });
});
