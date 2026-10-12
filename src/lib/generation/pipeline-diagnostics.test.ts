import { describe, expect, it } from "vitest";

import { createGenerationPipelineLogRecord } from "./pipeline-diagnostics";

describe("generation pipeline diagnostics", () => {
  it("contains only bounded pipeline facts without sensitive content", () => {
    const record = createGenerationPipelineLogRecord({
      assetAllocationSucceeded: true,
      byteLength: 2048,
      correlationId: "11111111-1111-4111-8111-111111111111",
      detectedMimeType: "image/jpeg",
      failureCode: "STORAGE_FAILED",
      pipelineStage: "storage_verification",
      resultMimeType: "image/jpeg",
      storagePublishSucceeded: true,
    });
    const serialized = JSON.stringify(record);

    expect(record).toMatchObject({
      pipeline_stage: "storage_verification",
      result_mime_type: "image/jpeg",
      detected_mime_type: "image/jpeg",
      byte_length: 2048,
      error_code: "STORAGE_FAILED",
    });
    for (const prohibited of [
      "api_key",
      "authorization",
      "base64",
      "prompt",
      "signed_url",
      "user_id",
    ]) {
      expect(serialized).not.toContain(prohibited);
    }
  });
});
