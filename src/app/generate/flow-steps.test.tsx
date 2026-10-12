import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getCategoryFlow } from "@/lib/prompts/category-flow";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { characterOptionImage, FlowOptions, FlowSelection, HairUploadSummary, idOptionImage } from "./flow-steps";

describe("category selection UI", () => {
  it("renders four Hair Designer and three Character image cards with mock disclosure", () => {
    for (const [id, count, field] of [["hair-designer-profile", 4, "lookId"], ["character-avatar", 3, "characterStyleId"]] as const) {
      const flow = getCategoryFlow(id)!;
      const markup = renderToStaticMarkup(<FlowSelection disabled={false} flow={flow} onSelect={() => {}} selectedId={flow.selection!.choices[0].id} step={1} />);
      expect(markup.match(/type="radio"/g)).toHaveLength(count);
      expect(markup).toContain(`name="${field}"`);
      expect(markup).toContain("실제 생성 결과가 아닙니다");
    }
  });

  it("shows the selected Look beside visual customization options", () => {
    const flow = getCategoryFlow("hair-designer-profile")!;
    const choice = flow.selection!.choices[1];
    const markup = renderToStaticMarkup(<FlowOptions disabled={false} flow={flow} idOutfitId="suit" onIdOutfitChange={() => {}} selectedId={choice.id} step={2} />);
    expect(markup).toContain("선택한 Look");
    expect(markup).toContain("Look 촬영 설정");
    expect(markup).toContain(choice.label);
    expect(markup).toContain(choice.sampleSrc);
    expect(markup).toContain("헤어스타일");
    expect(markup).toContain("시스루뱅");
    expect(markup).toContain("hairOptionPicker");
    expect(markup).toContain("<dt>배경</dt>");
    expect(markup).not.toContain('name="hairStyleId"');
    expect(markup).toContain('name="profileOutfitId"');
    expect(markup).toContain('value="current"');
    expect(markup).toContain('alt="원본 의상 유지 선택 예시"');
    expect(markup).toContain("실제 생성 결과가 아닙니다");
  });

  it("keeps the supported Outfit field controlled and reflects changing selections in the upload summary", () => {
    const flow = getCategoryFlow("hair-designer-profile")!;
    const current = renderToStaticMarkup(<FlowOptions disabled={false} flow={flow} idOutfitId="suit" onIdOutfitChange={() => {}} profileOutfitId="current" onProfileOutfitChange={() => {}} step={2} />);
    const jacket = renderToStaticMarkup(<FlowOptions disabled={false} flow={flow} idOutfitId="suit" onIdOutfitChange={() => {}} profileOutfitId="black-jacket" onProfileOutfitChange={() => {}} step={2} />);
    expect(current).toMatch(/name="profileOutfitId" checked="" value="current"/);
    expect(jacket).toMatch(/name="profileOutfitId" checked="" value="black-jacket"/);
    expect(jacket).not.toMatch(/name="profileOutfitId" checked="" value="current"/);
    const summary = renderToStaticMarkup(<HairUploadSummary flow={flow} selectedLookId="black-chic" hairStyleId="wave" profileOutfitId="black-jacket" />);
    expect(summary).toContain("Black Chic");
    expect(summary).toContain("웨이브");
    expect(summary).toContain("블랙 재킷");
    expect(summary).toContain("Look</strong>");
    expect(summary).toContain("헤어</strong>");
    expect(summary).toContain("의상</strong>");
    expect(renderToStaticMarkup(<HairUploadSummary flow={flow} selectedLookId="black-chic" hairStyleId="wave" profileOutfitId="current" />)).toContain("원본 의상 유지");
  });

  it("renders ID options after upload and only offers a tie with a suit", () => {
    const flow = getCategoryFlow("id-photo")!;
    expect(flow.steps).toEqual(["upload", "options"]);
    const suit = renderToStaticMarkup(<FlowOptions disabled={false} flow={flow} idOutfitId="suit" onIdOutfitChange={() => {}} step={2} />);
    expect(suit).toContain("선택한 옵션 예시");
    expect(suit).toContain('src="/images/options/id/white-suit-notie.webp"');
    expect(suit).toContain('name="idBackgroundId"');
    expect(suit).toContain('name="idOutfitId"');
    expect(suit).toContain('name="idTieId"');
    expect(suit).toContain("/images/options/id/light-gray-suit-notie.webp");
    expect(suit).toContain("/images/options/id/white-suit-tie.webp");
    expect(suit).toContain("/images/options/id/white-shirt.webp");
    expect(suit).not.toContain("/images/mock/");
    const uploaded = renderToStaticMarkup(<FlowOptions disabled={false} flow={flow} idOutfitId="suit" onIdOutfitChange={() => {}} sourcePreviewUrl="blob:uploaded-photo" step={2} />);
    expect(uploaded).toContain('src="blob:uploaded-photo"');
    const shirt = renderToStaticMarkup(<FlowOptions disabled={false} flow={flow} idOutfitId="shirt" onIdOutfitChange={() => {}} step={2} />);
    expect(shirt).not.toContain('name="idTieId"');
    expect(shirt).toContain("공식 여권 규격 보장 서비스가 아닙니다");
  });

  it("uses labeled photo references for ID background/tie and character outfit", () => {
    const id = getCategoryFlow("id-photo")!;
    const idMarkup = renderToStaticMarkup(<FlowOptions disabled={false} flow={id} idOutfitId="suit" onIdOutfitChange={() => {}} step={2} />);
    expect(idMarkup).toContain('alt="화이트 선택 예시"');
    expect(idMarkup).toContain('alt="라이트 그레이 선택 예시"');
    expect(idMarkup).toContain('alt="차분한 넥타이 선택 예시"');
    expect(idMarkup).toContain("실제 생성 결과가 아닙니다");
    const character = getCategoryFlow("character-avatar")!;
    const characterMarkup = renderToStaticMarkup(<FlowOptions disabled={false} flow={character} idOutfitId="suit" onIdOutfitChange={() => {}} selectedId="block-figure" step={2} />);
    expect(characterMarkup).toContain('alt="원본 의상 특징 유지 선택 예시"');
    expect(characterMarkup).toContain('alt="중립색 의상 선택 예시"');
    expect(characterMarkup).toContain("characterOptionPicker");
  });

  it("maps every ID and character option combination to a matching existing photo", () => {
    for (const background of ["white", "light-gray"]) {
      expect(idOptionImage(background, "suit", "none")).toBe(`/images/options/id/${background}-suit-notie.webp`);
      expect(idOptionImage(background, "suit", "dark")).toBe(`/images/options/id/${background}-suit-tie.webp`);
      expect(idOptionImage(background, "shirt", "dark")).toBe(`/images/options/id/${background}-shirt.webp`);
    }
    expect(idOptionImage("white", "keep-original", "none", "blob:uploaded")).toBe("blob:uploaded");
    const paths = new Set<string>();
    for (const background of ["white", "light-gray"]) for (const outfit of ["suit", "shirt"]) for (const tie of ["none", "dark"]) paths.add(idOptionImage(background, outfit, tie));
    for (const style of ["block-figure", "pixel-art", "clay"]) for (const outfit of ["original", "neutral"]) for (const scene of ["studio", "original"]) paths.add(characterOptionImage(style, outfit, scene));
    expect(paths.size).toBe(18);
    for (const path of paths) expect(existsSync(join(process.cwd(), "public", path.slice(1)))).toBe(true);
    const character = getCategoryFlow("character-avatar")!;
    const clay = renderToStaticMarkup(<FlowOptions disabled={false} flow={character} idOutfitId="suit" onIdOutfitChange={() => {}} selectedId="clay" step={2} />);
    expect(clay).toContain('src="/images/options/character/clay-original-studio.webp"');
    expect(clay).toContain("/images/options/character/clay-neutral-studio.webp");
    expect(clay).toContain("/images/options/character/clay-original-original.webp");
  });

  it("gives every Hair style its own photo", () => {
    const hair = getCategoryFlow("hair-designer-profile")!.options.find((group) => group.field === "hairStyleId")!;
    const sources = hair.choices.map((choice) => choice.sampleSrc);
    expect(new Set(sources).size).toBe(hair.choices.length);
  });

  it("renders no look or customization controls for underwater enhancement", () => {
    const flow = getCategoryFlow("underwater-correction")!;
    expect(renderToStaticMarkup(<FlowSelection disabled={false} flow={flow} onSelect={() => {}} selectedId="" step={1} />)).toBe("");
    expect(renderToStaticMarkup(<FlowOptions disabled={false} flow={flow} idOutfitId="suit" onIdOutfitChange={() => {}} step={2} />)).toBe("");
  });
});
