import { describe, expect, it, vi } from "vitest";

import {
  NEW_SERVICE_ACCEPTANCE_THRESHOLD,
  createNewServiceValidator,
} from "./new-service-validator";
import { SemanticValidationError } from "./semantic-validation";

const sourceImage = {
  data: "c291cmNl",
  mimeType: "image/jpeg" as const,
};
const generatedImage = {
  data: "Z2VuZXJhdGVk",
  mimeType: "image/png" as const,
};

function providerResponse(result: unknown, status = 200) {
  return new Response(
    JSON.stringify({
      candidates: [{
        content: { parts: [{ text: JSON.stringify(result) }] },
      }],
    }),
    { status, headers: { "content-type": "application/json" } },
  );
}

describe("createNewServiceValidator", () => {
  it("assesses underwater scenes without requiring a face", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => providerResponse({ serviceScore: 0.9 }));
    const validator = createNewServiceValidator({
      service: "underwater-correction",
      apiKey: "server-key",
      model: "gemini-3.1-flash-lite",
      fetchImpl,
    });

    await expect(validator.validate({ sourceImage, generatedImage }))
      .resolves.toEqual({ score: 0.9, status: "accepted" });

    const [, request] = fetchImpl.mock.calls[0];
    const body = JSON.parse(String(request?.body));
    expect(body.contents[0].parts[0].text).toContain("A visible face is not required");
    expect(body.contents[0].parts).toEqual(expect.arrayContaining([
      { inlineData: { mimeType: "image/jpeg", data: "c291cmNl" } },
      { inlineData: { mimeType: "image/png", data: "Z2VuZXJhdGVk" } },
    ]));
    expect(body.generationConfig).toMatchObject({
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: { required: ["serviceScore"] },
    });
  });

  it("assesses the existing unbranded block figure by default", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => providerResponse({
      serviceScore: NEW_SERVICE_ACCEPTANCE_THRESHOLD - 0.01,
    }));
    const validator = createNewServiceValidator({
      service: "character-avatar",
      apiKey: "server-key",
      model: "gemini-3.1-flash-lite",
      fetchImpl,
    });

    await expect(validator.validate({ sourceImage, generatedImage }))
      .resolves.toEqual({
        score: NEW_SERVICE_ACCEPTANCE_THRESHOLD - 0.01,
        status: "rejected",
      });

    const [, request] = fetchImpl.mock.calls[0];
    const body = JSON.parse(String(request?.body));
    expect(body.contents[0].parts[0].text).toContain("unbranded interlocking toy-brick");
    expect(body.contents[0].parts[0].text).toContain("cylindrical head");
  });

  it.each(["pixel-art", "clay"])("uses a style-specific rubric for %s", async (characterStyleId) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => providerResponse({ serviceScore: 0.91 }));
    const validator = createNewServiceValidator({ service: "character-avatar", characterStyleId, characterOutfitId: "neutral", apiKey: "server-key", model: "gemini-3.1-flash-lite", fetchImpl });
    await expect(validator.validate({ sourceImage, generatedImage })).resolves.toEqual({ score: 0.91, status: "accepted" });
    const body = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(body.contents[0].parts[0].text).toContain(characterStyleId === "clay" ? "handcrafted clay" : "pixel-art character");
    expect(body.contents[0].parts[0].text).not.toContain("cylindrical head");
    expect(body.contents[0].parts[0].text).toContain("selected a neutral outfit");
  });

  it("rejects unsupported style rubrics before calling the provider", () => {
    expect(() => createNewServiceValidator({ service: "character-avatar", characterStyleId: "unknown", apiKey: "server-key", model: "gemini-3.1-flash-lite" })).toThrow(SemanticValidationError);
  });

  it.each([
    async () => new Response("provider body", { status: 503 }),
    async () => new Response("not-json", { status: 200 }),
    async () => providerResponse({ serviceScore: 2 }),
  ])("fails closed for provider and malformed responses", async (fetchImpl) => {
    const validator = createNewServiceValidator({
      service: "underwater-correction",
      apiKey: "server-key",
      model: "gemini-3.1-flash-lite",
      fetchImpl,
    });

    await expect(validator.validate({ sourceImage, generatedImage }))
      .rejects.toEqual(new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE"));
  });
});
