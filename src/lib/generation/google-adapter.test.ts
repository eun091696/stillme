import { describe, expect, it, vi } from "vitest";

import {
  buildGoogleInteractionsRequest,
  createGoogleImageAdapter,
  createGoogleImageAdapterFromEnvironment,
  GoogleImageAdapterError,
} from "./google-adapter";
import { DEFAULT_GENERATION_MODEL } from "./model";

const request = {
  prompt: "서울의 비 오는 밤거리",
  style: "photographic",
  aspectRatio: "16:9",
} as const;

describe("createGoogleImageAdapter", () => {
  it("serializes the official Interactions text-only request shape", () => {
    expect(
      buildGoogleInteractionsRequest({
        model: "gemini-3.1-flash-image",
        prompt: "safe test prompt",
        aspectRatio: "1:1",
        resolution: "1K",
      }),
    ).toMatchInlineSnapshot(`
      {
        "input": [
          {
            "text": "safe test prompt",
            "type": "text",
          },
        ],
        "model": "gemini-3.1-flash-image",
        "response_format": {
          "aspect_ratio": "1:1",
          "image_size": "1K",
          "mime_type": "image/jpeg",
          "type": "image",
        },
        "store": false,
      }
    `);
  });

  it.each(["image/jpeg", "image/png"] as const)(
    "serializes an official Interactions %s image-edit request",
    (mimeType) => {
      const payload = buildGoogleInteractionsRequest({
        model: "gemini-3.1-flash-image",
        prompt: "safe edit instruction",
        aspectRatio: "4:5",
        resolution: "2K",
        sourceImage: { mimeType, data: "aW1hZ2U=" },
      });

      expect(payload).toEqual({
        model: "gemini-3.1-flash-image",
        store: false,
        input: [
          { type: "text", text: "safe edit instruction" },
          { type: "image", mime_type: mimeType, data: "aW1hZ2U=" },
        ],
        response_format: {
          type: "image",
          mime_type: "image/jpeg",
          aspect_ratio: "4:5",
          image_size: "2K",
        },
      });
      expect(payload).not.toHaveProperty("contents");
      expect(payload).not.toHaveProperty("generationConfig");
      expect(JSON.stringify(payload)).not.toContain("inlineData");
    },
  );

  it("removes a matching data URL prefix before serialization", () => {
    const payload = buildGoogleInteractionsRequest({
      model: "gemini-3.1-flash-image",
      prompt: "safe edit instruction",
      aspectRatio: "1:1",
      resolution: "1K",
      sourceImage: {
        mimeType: "image/png",
        data: "data:image/png;base64,aW1hZ2U=",
      },
    });

    expect(payload.input[1]).toEqual({
      type: "image",
      mime_type: "image/png",
      data: "aW1hZ2U=",
    });
  });

  it("rejects a data URL whose declared MIME type does not match", () => {
    expect(() =>
      buildGoogleInteractionsRequest({
        model: "gemini-3.1-flash-image",
        prompt: "safe edit instruction",
        aspectRatio: "1:1",
        resolution: "1K",
        sourceImage: {
          mimeType: "image/jpeg",
          data: "data:image/png;base64,aW1hZ2U=",
        },
      }),
    ).toThrowError(GoogleImageAdapterError);
  });

  it("calls the approved provider model and returns version metadata", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: "aW1hZ2U=",
                  },
                },
              ],
            },
          },
        ],
      }),
    );
    const adapter = createGoogleImageAdapter({
      apiKey: "synthetic-test-key",
      fetchImpl,
    });

    await expect(adapter.generate(request)).resolves.toEqual({
      image: {
        mimeType: "image/png",
        data: "aW1hZ2U=",
      },
      model: DEFAULT_GENERATION_MODEL,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, options] = fetchImpl.mock
      .calls[0] as unknown as Parameters<typeof fetch>;
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-image:generateContent",
    );
    expect(options).toMatchObject({
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": "synthetic-test-key",
      },
    });
    expect(JSON.parse(String(options?.body))).toEqual({
      contents: [
        {
          parts: [
            {
              text: "사실적인 사진을 생성하세요.\n\n서울의 비 오는 밤거리",
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K",
        },
      },
    });
  });

  it("passes a built prompt, source image, and resolution through interactions", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ output_image: { mime_type: "image/jpeg", data: "aW1hZ2U=" } }));
    const adapter = createGoogleImageAdapter({ apiKey: "synthetic-test-key", model: "pro", transport: "interactions", fetchImpl });
    await adapter.generate({ ...request, prompt: "[작업]\n요청한 이미지를 생성하세요." }, { resolution: "4K", sourceImage: { mimeType: "image/png", data: "b3JpZ2luYWw=" } });
    const [url, options] = fetchImpl.mock.calls[0] as unknown as Parameters<typeof fetch>;
    const body = JSON.parse(String(options?.body));
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
    expect(body.model).toBe("gemini-3-pro-image");
    expect(body.store).toBe(false);
    expect(body.response_format.image_size).toBe("4K");
    expect(body.response_format.mime_type).toBe("image/jpeg");
    expect(body.input).toContainEqual({ type: "image", mime_type: "image/png", data: "b3JpZ2luYWw=" });
  });

  it("keeps storage disabled when an interactions request is retried", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: { code: "unavailable" } }, { status: 503 }),
      )
      .mockResolvedValueOnce(
        Response.json({ output_image: { mime_type: "image/jpeg", data: "aW1hZ2U=" } }),
      );
    const adapter = createGoogleImageAdapter({
      apiKey: "synthetic-test-key",
      transport: "interactions",
      fetchImpl,
    });

    await expect(adapter.generate(request)).rejects.toMatchObject({
      retryable: true,
    });
    await adapter.generate(request);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const [, options] of fetchImpl.mock.calls as unknown as Array<
      Parameters<typeof fetch>
    >) {
      expect(JSON.parse(String(options?.body)).store).toBe(false);
    }
  });

  it("extracts a JPEG from the REST Interactions model_output step", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        id: "interaction-1",
        status: "completed",
        steps: [
          {
            type: "model_output",
            content: [
              { type: "text", text: "Image generated." },
              {
                type: "image",
                mime_type: "image/jpeg",
                data: "aW1hZ2U=",
              },
            ],
          },
        ],
      }),
    );
    const adapter = createGoogleImageAdapter({
      apiKey: "synthetic-test-key",
      transport: "interactions",
      fetchImpl,
    });

    await expect(adapter.generate(request)).resolves.toMatchObject({
      image: { mimeType: "image/jpeg", data: "aW1hZ2U=" },
    });
  });

  it("selects Nano Banana Pro without duplicating provider ids in callers", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: "image/png", data: "aW1hZ2U=" } }],
            },
          },
        ],
      }),
    );
    const adapter = createGoogleImageAdapter({
      apiKey: "synthetic-test-key",
      model: "pro",
      fetchImpl,
    });

    await adapter.generate(request);
    const [url] = fetchImpl.mock
      .calls[0] as unknown as Parameters<typeof fetch>;
    expect(String(url)).toContain(
      "/gemini-3-pro-image:generateContent",
    );
    expect(adapter.model.modelKey).toBe("pro");
  });

  it("maps provider HTTP failures to distinct bounded errors", async () => {
    for (const [status, code, retryable] of [
      [400, "PROVIDER_INVALID_REQUEST", false],
      [401, "PROVIDER_AUTHENTICATION_FAILED", false],
      [403, "PROVIDER_ACCESS_DENIED", false],
      [404, "PROVIDER_MODEL_NOT_FOUND", false],
      [429, "PROVIDER_RATE_LIMITED", true],
      [500, "PROVIDER_UNAVAILABLE", true],
      [503, "PROVIDER_UNAVAILABLE", true],
    ] as const) {
      const adapter = createGoogleImageAdapter({
        apiKey: "synthetic-test-key",
        fetchImpl: vi.fn(async () =>
          Response.json(
            { error: { code: status, status: "SYNTHETIC_ERROR" } },
            { status },
          ),
        ),
      });

      await expect(adapter.generate(request)).rejects.toMatchObject({
        name: "GoogleImageAdapterError",
        code,
        retryable,
      });
    }
  });

  it("maps a billing-related 429 to non-retryable access denied", async () => {
    const diagnostics = vi.fn();
    const adapter = createGoogleImageAdapter({
      apiKey: "synthetic-test-key",
      onDiagnostic: diagnostics,
      fetchImpl: vi.fn(async () =>
        Response.json(
          {
            error: {
              code: "too_many_requests",
              message: "The project billing configuration requires attention.",
            },
          },
          { status: 429 },
        ),
      ),
    });

    await expect(adapter.generate(request)).rejects.toMatchObject({
      code: "PROVIDER_ACCESS_DENIED",
      retryable: false,
    });
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        failureCode: "PROVIDER_ACCESS_DENIED",
        httpStatus: 429,
        providerMessage: "Provider billing configuration requires attention.",
        retryable: false,
      }),
    );
  });

  it("maps a depleted prepaid balance (402) to non-retryable access denied", async () => {
    const diagnostics = vi.fn();
    const adapter = createGoogleImageAdapter({
      apiKey: "synthetic-test-key",
      onDiagnostic: diagnostics,
      fetchImpl: vi.fn(async () =>
        Response.json(
          [{
            error: {
              code: 402,
              message: "Your prepayment credits are depleted. Please go to AI Studio to manage your project and billing.",
              status: "RESOURCE_EXHAUSTED",
            },
          }],
          { status: 402 },
        ),
      ),
    });

    await expect(adapter.generate(request)).rejects.toMatchObject({
      code: "PROVIDER_ACCESS_DENIED",
      retryable: false,
    });
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({ failureCode: "PROVIDER_ACCESS_DENIED", httpStatus: 402, retryable: false }),
    );
  });

  it("maps only structured policy evidence to provider rejected", async () => {
    const diagnostics = vi.fn();
    const adapter = createGoogleImageAdapter({
      apiKey: "synthetic-test-key",
      correlationId: "11111111-1111-4111-8111-111111111111",
      onDiagnostic: diagnostics,
      fetchImpl: vi.fn(
        async () =>
          Response.json(
            {
              error: {
                code: "image_safety",
                message: "Image generation was blocked by safety policy.",
              },
            },
            {
              status: 400,
              headers: { "x-goog-request-id": "provider-request-1" },
            },
          ),
      ),
    });

    await expect(adapter.generate(request)).rejects.toMatchObject({
      code: "PROVIDER_REJECTED",
      retryable: false,
    });
    expect(diagnostics).toHaveBeenCalledWith({
      correlationId: "11111111-1111-4111-8111-111111111111",
      failureCode: "PROVIDER_REJECTED",
      googleErrorCode: "image_safety",
      googleErrorStatus: null,
      httpStatus: 400,
      modelId: "gemini-3.1-flash-image",
      operationType: "generate-content",
      providerMessage: "The provider reported a safety or policy block.",
      providerRequestId: "provider-request-1",
      requestShape: null,
      retryable: false,
      safetyBlockReason: "IMAGE_SAFETY",
    });
  });

  it("maps successful generateContent safety feedback to provider rejected", async () => {
    const adapter = createGoogleImageAdapter({
      apiKey: "synthetic-test-key",
      fetchImpl: vi.fn(async () =>
        Response.json({ promptFeedback: { blockReason: "SAFETY" } }),
      ),
    });

    await expect(adapter.generate(request)).rejects.toMatchObject({
      code: "PROVIDER_REJECTED",
      retryable: false,
    });
  });

  it("falls back safely when the provider error body is not JSON", async () => {
    const diagnostics = vi.fn();
    const adapter = createGoogleImageAdapter({
      apiKey: "synthetic-test-key",
      onDiagnostic: diagnostics,
      fetchImpl: vi.fn(
        async () => new Response("not-json private body", { status: 400 }),
      ),
    });

    await expect(adapter.generate(request)).rejects.toMatchObject({
      code: "PROVIDER_INVALID_REQUEST",
    });
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        googleErrorCode: null,
        googleErrorStatus: null,
        providerMessage: null,
        safetyBlockReason: null,
      }),
    );
  });

  it("parses a Google 400 code, status, and bounded message category", async () => {
    const diagnostics = vi.fn();
    const adapter = createGoogleImageAdapter({
      apiKey: "synthetic-test-key",
      correlationId: "11111111-1111-4111-8111-111111111111",
      transport: "interactions",
      onDiagnostic: diagnostics,
      fetchImpl: vi.fn(async () =>
        Response.json(
          {
            error: {
              code: "invalid_request",
              status: "INVALID_ARGUMENT",
              message: "Unknown provider request field with private detail",
            },
          },
          { status: 400 },
        ),
      ),
    });

    await expect(adapter.generate(request)).rejects.toMatchObject({
      code: "PROVIDER_INVALID_REQUEST",
    });
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        googleErrorCode: "invalid_request",
        googleErrorStatus: "INVALID_ARGUMENT",
        providerMessage: "The provider rejected one or more request fields.",
        requestShape: {
          endpoint:
            "https://generativelanguage.googleapis.com/v1beta/interactions",
          inputItemCount: 1,
          inputItemTypes: ["text"],
          imageMimeType: null,
          imageBase64Length: null,
          responseFormat: {
            type: "image",
            mime_type: "image/jpeg",
            aspect_ratio: "16:9",
            image_size: "1K",
          },
        },
      }),
    );
    expect(JSON.stringify(diagnostics.mock.calls[0][0])).not.toContain(
      "private detail",
    );
  });

  it("does not expose provider bodies or sensitive request data in diagnostics", async () => {
    const diagnostics = vi.fn();
    const adapter = createGoogleImageAdapter({
      apiKey: "synthetic-test-key",
      correlationId: "invalid correlation with spaces",
      onDiagnostic: diagnostics,
      fetchImpl: vi.fn(async () =>
        Response.json(
          {
            error: {
              code: 401,
              status: "UNAUTHENTICATED",
              message:
                "API key invalid: AIzaSyntheticSecret. prompt=private-personal-prompt https://signed.example/private",
            },
          },
          { status: 401 },
        ),
      ),
    });

    await expect(adapter.generate(request)).rejects.toBeInstanceOf(
      GoogleImageAdapterError,
    );
    const serialized = JSON.stringify(diagnostics.mock.calls[0][0]);
    expect(serialized).not.toContain("synthetic-test-key");
    expect(serialized).not.toContain("AIzaSyntheticSecret");
    expect(serialized).not.toContain("private-personal-prompt");
    expect(serialized).not.toContain("signed.example");
    expect(serialized).not.toContain(request.prompt);
    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: null,
        providerMessage: "API key is invalid, missing, or inactive.",
      }),
    );
  });

  it("rejects successful responses without a supported bounded image", async () => {
    const adapter = createGoogleImageAdapter({
      apiKey: "synthetic-test-key",
      fetchImpl: vi.fn(async () =>
        Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "application/octet-stream",
                      data: "not base64",
                    },
                  },
                ],
              },
            },
          ],
        }),
      ),
    });

    await expect(adapter.generate(request)).rejects.toMatchObject({
      code: "PROVIDER_RESPONSE_INVALID",
      retryable: false,
    });
  });

  it("requires a server-side API key", () => {
    expect(() =>
      createGoogleImageAdapter({ apiKey: " " }),
    ).toThrowError("Missing required environment variable: GOOGLE_AI_API_KEY");
  });
});

describe("createGoogleImageAdapterFromEnvironment", () => {
  it("reads only the server-side API key variable", () => {
    vi.stubEnv("GOOGLE_AI_API_KEY", "synthetic-environment-key");

    const adapter = createGoogleImageAdapterFromEnvironment();

    expect(adapter.model).toBe(DEFAULT_GENERATION_MODEL);
    vi.unstubAllEnvs();
  });
});
