import { describe, expect, it, vi } from "vitest";

import {
  createGoogleProviderLogRecord,
  logGoogleProviderDiagnostic,
} from "./provider-diagnostics";

const diagnostic = {
  correlationId: "11111111-1111-4111-8111-111111111111",
  failureCode: "PROVIDER_ACCESS_DENIED" as const,
  googleErrorCode: "permission_denied",
  googleErrorStatus: "PERMISSION_DENIED",
  httpStatus: 403,
  modelId: "gemini-3.1-flash-image",
  operationType: "interactions" as const,
  providerMessage: "Permission was denied for the requested resource.",
  providerRequestId: "provider-request-1",
  requestShape: {
    endpoint: "https://generativelanguage.googleapis.com/v1beta/interactions" as const,
    inputItemCount: 2,
    inputItemTypes: ["text", "image"] as const,
    imageMimeType: "image/jpeg" as const,
    imageBase64Length: 1024,
    responseFormat: {
      type: "image" as const,
      mime_type: "image/jpeg" as const,
      aspect_ratio: "4:5" as const,
      image_size: "1K" as const,
    },
  },
  retryable: false,
  safetyBlockReason: null,
};

describe("Google provider diagnostics", () => {
  it("creates an allowlisted structured record without sensitive fields", () => {
    const record = createGoogleProviderLogRecord(diagnostic);

    expect(record).toMatchObject({
      event_name: "google_image_provider.failure",
      request_id: diagnostic.correlationId,
      provider_error_code: "permission_denied",
      error_code: "PROVIDER_ACCESS_DENIED",
      model_id: "gemini-3.1-flash-image",
      operation_type: "interactions",
      request_endpoint:
        "https://generativelanguage.googleapis.com/v1beta/interactions",
      input_item_types: ["text", "image"],
      image_base64_length: 1024,
    });
    expect(Object.keys(record)).not.toEqual(
      expect.arrayContaining([
        "api_key",
        "authorization",
        "image",
        "object_key",
        "prompt",
        "signed_url",
        "user_id",
      ]),
    );
  });

  it("writes only the structured allowlisted record", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logGoogleProviderDiagnostic(diagnostic);

    expect(error).toHaveBeenCalledOnce();
    const serialized = String(error.mock.calls[0][0]);
    expect(JSON.parse(serialized)).toMatchObject({
      request_id: diagnostic.correlationId,
      http_status_code: 403,
    });
    expect(serialized).not.toContain("GOOGLE_AI_API_KEY");
    error.mockRestore();
  });
});
