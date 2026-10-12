import { describe, expect, it } from "vitest";

import {
  DEFAULT_GENERATION_MODEL,
  GENERATION_MODEL_PROVIDER_IDS,
  getGenerationModelVersion,
  isGenerationResolution,
  isSupportedGenerationResolution,
} from "./model";

describe("generation model selection", () => {
  it("maps the stable model keys to the approved Google model ids", () => {
    expect(getGenerationModelVersion("flash").providerModel).toBe(
      GENERATION_MODEL_PROVIDER_IDS.flash,
    );
    expect(getGenerationModelVersion("pro").providerModel).toBe(
      GENERATION_MODEL_PROVIDER_IDS.pro,
    );
    expect(getGenerationModelVersion()).toBe(DEFAULT_GENERATION_MODEL);
  });

  it("validates only documented uppercase resolutions", () => {
    expect(isGenerationResolution("2K")).toBe(true);
    expect(isGenerationResolution("4K")).toBe(true);
    expect(isGenerationResolution("2k")).toBe(false);
    expect(isSupportedGenerationResolution("flash", "4K")).toBe(true);
    expect(isSupportedGenerationResolution("pro", "2K")).toBe(true);
  });

  it("rejects unsupported model or resolution values", () => {
    expect(() => getGenerationModelVersion("invalid" as never)).toThrow(
      "Unsupported generation model",
    );
    expect(() => getGenerationModelVersion("flash", "8K" as never)).toThrow(
      "Unsupported generation resolution",
    );
  });
});
