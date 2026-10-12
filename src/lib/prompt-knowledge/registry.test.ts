import { describe, expect, it } from "vitest";
import { PROMPT_KNOWLEDGE_BASE, PROMPT_KNOWLEDGE_BY_ID } from "./registry";

describe("prompt knowledge base", () => {
  it("contains an explainable rule set across all representative categories", () => {
    expect(PROMPT_KNOWLEDGE_BASE.length).toBeGreaterThanOrEqual(20);
    for (const item of PROMPT_KNOWLEDGE_BASE) {
      expect(item.id).toMatch(/^[a-z0-9.-]+$/u);
      expect(item.english.length).toBeGreaterThan(0);
      expect(item.korean.length).toBeGreaterThan(0);
      expect(item.purpose.length).toBeGreaterThan(10);
      expect(item.effect.length).toBeGreaterThan(0);
      expect(item.source.length).toBeGreaterThan(0);
      expect(item.confidence).toBeGreaterThanOrEqual(0);
      expect(item.confidence).toBeLessThanOrEqual(1);
      expect(PROMPT_KNOWLEDGE_BY_ID[item.id]).toBe(item);
    }
  });

  it("covers the requested categories", () => {
    expect(new Set(PROMPT_KNOWLEDGE_BASE.map((item) => item.category))).toEqual(
      new Set(["identity", "lighting", "quality", "composition", "restriction", "underwater", "portrait"]),
    );
  });

  it("is independent from the prompt builder module registry", () => {
    expect(PROMPT_KNOWLEDGE_BASE.some((item) => item.id === "identity.facial-asymmetry")).toBe(true);
    expect(PROMPT_KNOWLEDGE_BASE.some((item) => item.id === "core.identity-preservation")).toBe(false);
  });
});
