import { describe, expect, it, vi } from "vitest";
import { runPromptedGeneration } from "./prompted-generation";

const input = {
  presetId: "resume-id" as const,
  model: "pro" as const,
  resolution: "2K" as const,
  additionalRequest: "안경은 유지해줘",
  sourceImage: { mimeType: "image/png" as const, data: "b3JpZ2luYWw=" },
  request: { prompt: "placeholder", style: "photographic" as const, aspectRatio: "1:1" as const },
};

describe("runPromptedGeneration", () => {
  it("builds the service prompt before passing it to Google", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, options?: RequestInit) => {
      const body = JSON.parse(String(options?.body));
      expect(body.model).toBe("gemini-3-pro-image");
      expect(body.response_format.image_size).toBe("2K");
      expect(body.response_format.mime_type).toBe("image/jpeg");
      expect(body.input[0].text).toContain("[동일인 및 보존 영역]");
      expect(body.input[1]).toMatchObject({ type: "image", data: "b3JpZ2luYWw=" });
      return Response.json({ output_image: { mime_type: "image/jpeg", data: "aW1hZ2U=" } });
    });
    const result = await runPromptedGeneration(input, { apiKey: "server-only-key", fetchImpl });
    expect(result.prompt.promptId).toBe("id-photo.resume-id");
    expect(result.providerModel).toBe("gemini-3-pro-image");
    expect(result.image.mimeType).toBe("image/jpeg");
    expect(result.image.data).toBe("aW1hZ2U=");
  });
});
