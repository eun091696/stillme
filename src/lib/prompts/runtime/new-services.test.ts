import { describe, expect, it } from "vitest";

import { buildCandidatePrompt } from "../builder";
import { getRuntimePrompt } from "./index";

describe("new service runtime prompts", () => {
  it("keeps underwater correction bounded to natural restoration", () => {
    const prompt = getRuntimePrompt("underwater-correction");
    expect(prompt.version).toBe("1.2.0");
    expect(prompt.body).toContain("인물이 없는 사진도 허용");
    expect(prompt.body).toContain("화이트밸런스");
    expect(prompt.body).toContain("멀리 있는 물과 그림자를 인위적으로 붉게 칠하지");
    expect(prompt.body).toContain("점·주근깨");
  });

  it("requires a recognizable unbranded full-body brick figurine", () => {
    const prompt = getRuntimePrompt("character-avatar");
    expect(prompt.version).toBe("3.1.0");
    expect(prompt.body).toContain("원통형 머리");
    expect(prompt.body).toContain("집게처럼 굽은 손");
    expect(prompt.body).toContain("점의 위치나 수를 바꾸거나");
    expect(prompt.body).toContain("공식 LEGO 로고");
    expect(prompt.body).not.toContain("사람의 해부학적 손가락과 근육을 그리세요");
  });

  it.each([
    ["underwater-correction", "preserve-scene"],
    ["character-avatar", "warm-studio"],
  ] as const)("builds bounded candidate options for %s", (presetId, backgroundId) => {
    const result = buildCandidatePrompt({ presetId, backgroundId, model: "flash" });
    expect(result.presetId).toBe(presetId);
    expect(result.candidateBackgroundId).toBe(backgroundId);
    expect(result.professionModuleId).toBeUndefined();
  });
});
