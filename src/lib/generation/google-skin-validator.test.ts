import { describe, expect, it, vi } from "vitest";

import { createGoogleSkinValidator } from "./google-skin-validator";
import { SemanticValidationError } from "./semantic-validation";

const sourceImage = {
  data: "c291cmNl",
  mimeType: "image/jpeg" as const,
};
const generatedImage = {
  data: "Z2VuZXJhdGVk",
  mimeType: "image/png" as const,
};

function providerResponse(scores: unknown, status = 200) {
  return new Response(
    JSON.stringify({
      candidates: [{
        content: { parts: [{ text: JSON.stringify(scores) }] },
      }],
    }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );
}

describe("createGoogleSkinValidator", () => {
  it("sends both images and returns the skin preservation score", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => providerResponse({
      skinScore: 0.84,
    }));
    const validator = createGoogleSkinValidator({
      apiKey: "server-key",
      model: "gemini-3.1-flash-lite",
      fetchImpl,
    });

    await expect(validator.inspect({ sourceImage, generatedImage }))
      .resolves.toBe(0.84);

    const [, request] = fetchImpl.mock.calls[0];
    const body = JSON.parse(String(request?.body));
    expect(body.contents[0].parts).toEqual(expect.arrayContaining([
      { inlineData: { mimeType: "image/jpeg", data: "c291cmNl" } },
      { inlineData: { mimeType: "image/png", data: "Z2VuZXJhdGVk" } },
    ]));
    expect(body.generationConfig).toMatchObject({
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        required: ["skinScore"],
      },
    });
  });

  it("ignores provider acceptance booleans and returns only the score", async () => {
    const validator = createGoogleSkinValidator({
      apiKey: "server-key",
      model: "gemini-3.1-flash-lite",
      fetchImpl: async () => providerResponse({
        skinScore: 0.9,
        accepted: false,
      }),
    });

    await expect(validator.inspect({ sourceImage, generatedImage }))
      .resolves.toBe(0.9);
  });

  it.each([
    async () => new Response("provider body", { status: 503 }),
    async () => new Response("not-json", { status: 200 }),
    async () => providerResponse({ skinScore: 2 }),
  ])("fails closed with a bounded error", async (fetchImpl) => {
    const validator = createGoogleSkinValidator({
      apiKey: "server-key",
      model: "gemini-3.1-flash-lite",
      fetchImpl,
    });

    await expect(validator.inspect({ sourceImage, generatedImage }))
      .rejects.toEqual(new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE"));
  });
});
