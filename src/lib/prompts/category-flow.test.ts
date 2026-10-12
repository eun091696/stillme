import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getCategoryChoice, getCategoryFlow, getCharacterStyle } from "./category-flow";

describe("representative category flows", () => {
  it("keeps four distinct step orders with only create/enhance processing modes", () => {
    expect(getCategoryFlow("hair-designer-profile")).toMatchObject({ mode: "create", steps: ["look", "options", "upload"] });
    expect(getCategoryFlow("id-photo")).toMatchObject({ mode: "create", steps: ["upload", "options"] });
    expect(getCategoryFlow("underwater-correction")).toMatchObject({ mode: "enhance", steps: ["upload"], options: [] });
    expect(getCategoryFlow("character-avatar")).toMatchObject({ mode: "create", steps: ["look", "options", "upload"] });
    expect(getCategoryFlow("unreleased-category")).toBeNull();
  });

  it("offers Hair and Outfit thumbnails without introducing an unsupported server field", () => {
    const hair = getCategoryFlow("hair-designer-profile")!;
    expect(hair.options.map((group) => group.field)).toEqual(["hairStyleId", "profileOutfitId"]);
    expect(hair.options[0].choices.map((choice) => choice.id)).toEqual(["current", "see-through-bangs", "long-straight", "tied", "wave"]);
    expect(hair.options[1].choices.map((choice) => choice.id)).toContain("current");
    expect(hair.options[1].choices.every((choice) => choice.sampleKind === "mock" && Boolean(choice.sampleSrc))).toBe(true);
    for (const group of hair.options) for (const choice of group.choices) if (choice.sampleSrc) expect(existsSync(join(process.cwd(), "public", choice.sampleSrc.slice(1)))).toBe(true);
  });

  it("limits ID choices and keeps every style sample explicitly marked as mock", () => {
    const id = getCategoryFlow("id-photo")!;
    expect(id.selection).toBeUndefined();
    expect(id.options.map((group) => group.field)).toEqual(["idBackgroundId", "idOutfitId", "idTieId"]);
    expect(getCategoryChoice(id, "idBackgroundId", "light-blue")).toBeNull();
    for (const field of ["idBackgroundId", "idTieId"] as const) expect(id.options.find((group) => group.field === field)?.choices.every((choice) => Boolean(choice.sampleSrc))).toBe(true);
    const character = getCategoryFlow("character-avatar")!;
    expect(character.selection?.choices.map((choice) => choice.id)).toEqual(["block-figure", "pixel-art", "clay"]);
    expect(character.options.find((group) => group.field === "characterOutfitId")?.choices.every((choice) => Boolean(choice.sampleSrc))).toBe(true);
    for (const choice of character.selection?.choices ?? []) {
      expect(choice.sampleKind).toBe("mock");
      expect(existsSync(join(process.cwd(), "public", choice.sampleSrc!.slice(1)))).toBe(true);
    }
    expect(getCharacterStyle("licensed-character")).toBeNull();
  });
});
