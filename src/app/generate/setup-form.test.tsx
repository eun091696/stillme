import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getCategoryFlow } from "@/lib/prompts/category-flow";
import { GenerationSetupForm } from "./setup-form";

const base = {
  sampleImageSrc: "/images/mock/home/profile.webp",
  requiresProfession: false,
  professionMaxLength: 80,
  backgroundOptions: [
    { id: "bright-studio", label: "밝은 스튜디오" },
    { id: "natural-interior", label: "자연스러운 실내" },
  ],
  defaultBackgroundId: "bright-studio",
  outfitOptions: [],
  defaultOutfitId: "auto",
  styleOptions: [],
};

describe("progressive setup form", () => {
  it("starts General Profile with photo style, keeps shared backgrounds, then options and upload", () => {
    const html = renderToStaticMarkup(<GenerationSetupForm service={{ ...base, presetId: "profile-photo" }} />);
    expect(html).toContain("스타일을 고르세요");
    expect(html).toContain('name="sharedBackgroundStyle"');
    expect(html).toContain('name="candidateBackground1"');
    expect(html).toContain('name="candidateBackground2"');
    expect(html).toContain('name="candidateBackground3"');
    expect(html).not.toContain('name="candidateRequest1"');
    expect(html).toContain('name="additionalRequest"');
    expect(html.indexOf("스타일을 고르세요")).toBeLessThan(html.indexOf("추가 옵션"));
    expect(html.indexOf("추가 옵션")).toBeLessThan(html.indexOf("사진을 올려주세요"));
    expect(html).toContain("배경 분위기를 보여주는 예시 이미지이며 실제 생성 결과가 아닙니다");
    expect(html).toContain('id="profile-options-title" tabindex="-1"');
    expect(html).toContain("옵션 다시 보기");
  });

  it("shows all three Hair selections in the upload summary and has a focusable Look stage", () => {
    const html = renderToStaticMarkup(<GenerationSetupForm service={{ ...base, presetId: "business-profile", requiresProfession: true, flow: { ...getCategoryFlow("hair-designer-profile")!, profession: "헤어디자이너" } }} />);
    expect(html).toContain("선택한 스타일 요약");
    expect(html).toContain("Look</strong>");
    expect(html).toContain("헤어</strong>");
    expect(html).toContain("의상</strong>");
    expect(html).toContain("원본의 헤어스타일과 색상을 최대한 유지합니다.");
    expect(html).not.toContain("현재 생성 규칙은 원본 헤어 보존을 우선");
    expect(html).toContain('type="hidden" name="hairStyleId" value="current"');
    expect(html).toContain('id="look-step-title" tabindex="-1"');
    expect(html).toContain("스타일 다시 보기");
  });

  it("keeps ID upload before options and Underwater as upload only", () => {
    const id = renderToStaticMarkup(<GenerationSetupForm service={{ ...base, presetId: "resume-id", flow: getCategoryFlow("id-photo")! }} />);
    expect(id.indexOf("사진을 올려주세요")).toBeLessThan(id.indexOf("증명사진 옵션"));
    expect(id).toContain('name="idBackgroundId"');
    const underwater = renderToStaticMarkup(<GenerationSetupForm service={{ ...base, presetId: "underwater-correction", flow: getCategoryFlow("underwater-correction")! }} />);
    expect(underwater).toContain("사진을 올려주세요");
    expect(underwater).not.toContain("다음 단계");
    expect(underwater).not.toContain("추가 옵션");
  });

  it("does not leave a required profession control on the final hidden step", () => {
    const html = renderToStaticMarkup(<GenerationSetupForm service={{ ...base, presetId: "business-profile", requiresProfession: true, styleOptions: [{ id: "auto", label: "추천" }], defaultProfession: "개발자" }} />);
    expect(html).toContain('name="profession"');
    expect(html).toContain('required=""');
    expect(html).toContain('name="candidateBackground3"');
  });
});
