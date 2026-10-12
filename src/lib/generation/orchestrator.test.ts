import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

import { describe, expect, it, vi } from "vitest";

import { GoogleImageAdapterError } from "./google-adapter";
import { DEFAULT_GENERATION_MODEL } from "./model";
import { jpegFixture } from "../../../tests/fixtures/generated-images";
import {
  executeGenerationPipeline,
  type GenerationPipelineGateway,
} from "./orchestrator";

function crc32(input: Buffer) {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, "ascii");
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBuffer.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return result;
}

function png() {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(4, 0);
  header.writeUInt32BE(4, 4);
  header[8] = 8;
  header[9] = 6;
  const pixels = Buffer.alloc(4 * (1 + 4 * 4));

  return Buffer.concat([
    signature,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function gateway(overrides: Partial<GenerationPipelineGateway> = {}) {
  return {
    allocateAsset: vi.fn(async () => undefined),
    completeJob: vi.fn(async () => undefined),
    failJob: vi.fn(async () => undefined),
    markAssetAvailable: vi.fn(async () => undefined),
    markAssetFailed: vi.fn(async () => undefined),
    markAssetUploading: vi.fn(async () => undefined),
    markAssetValidating: vi.fn(async () => undefined),
    ...overrides,
  } satisfies GenerationPipelineGateway;
}

const request = {
  prompt: "서울의 밤거리 사진",
  style: "photographic",
  aspectRatio: "1:1",
} as const;
const identity = {
  assetId: "33333333-3333-4333-8333-333333333333",
  jobId: "22222222-2222-4222-8222-222222222222",
  request,
  userId: "11111111-1111-4111-8111-111111111111",
};

describe("executeGenerationPipeline", () => {
  it("publishes verified storage metadata before atomically completing the job", async () => {
    const image = png();
    const checksumSha256 = createHash("sha256").update(image).digest("base64");
    const testGateway = gateway();

    await expect(
      executeGenerationPipeline(identity, {
        gateway: testGateway,
        model: {
          model: DEFAULT_GENERATION_MODEL,
          generate: vi.fn(async () => ({
            image: {
              data: image.toString("base64"),
              mimeType: "image/png" as const,
            },
            model: DEFAULT_GENERATION_MODEL,
          })),
        },
        storage: {
          storeImage: vi.fn(async () => ({
            byteSize: image.length,
            checksumSha256,
            mimeType: "image/png" as const,
          })),
          verifyImage: vi.fn(async () => undefined),
        },
      }),
    ).resolves.toEqual({
      status: "succeeded",
      image: {
        data: image.toString("base64"),
        mimeType: "image/png",
      },
    });

    expect(testGateway.markAssetAvailable).toHaveBeenCalledOnce();
    expect(testGateway.completeJob).toHaveBeenCalledOnce();
    expect(testGateway.failJob).not.toHaveBeenCalled();
  });

  it("allocates and publishes a JPEG asset using the provider result MIME", async () => {
    const image = jpegFixture();
    const checksumSha256 = createHash("sha256").update(image).digest("base64");
    const testGateway = gateway();
    const diagnostics = vi.fn();
    const storage = {
      storeImage: vi.fn(async () => ({
        byteSize: image.length,
        checksumSha256,
        mimeType: "image/jpeg" as const,
      })),
      verifyImage: vi.fn(async () => undefined),
    };

    await expect(
      executeGenerationPipeline(
        { ...identity, correlationId: "request-1" },
        {
          gateway: testGateway,
          model: {
            model: DEFAULT_GENERATION_MODEL,
            generate: vi.fn(async () => ({
              image: {
                data: image.toString("base64"),
                mimeType: "image/jpeg" as const,
              },
              model: DEFAULT_GENERATION_MODEL,
            })),
          },
          storage,
          onDiagnostic: diagnostics,
        },
      ),
    ).resolves.toMatchObject({
      status: "succeeded",
      image: { mimeType: "image/jpeg" },
    });

    expect(testGateway.allocateAsset).toHaveBeenCalledWith({
      assetId: identity.assetId,
      key: expect.stringMatching(/original\.jpg$/u),
      mimeType: "image/jpeg",
    });
    expect(storage.storeImage).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(/original\.jpg$/u),
        image: expect.objectContaining({ mimeType: "image/jpeg" }),
      }),
    );
    expect(diagnostics).toHaveBeenLastCalledWith(
      expect.objectContaining({
        assetAllocationSucceeded: true,
        byteLength: image.length,
        detectedMimeType: "image/jpeg",
        failureCode: null,
        pipelineStage: "job_completion",
        resultMimeType: "image/jpeg",
        storagePublishSucceeded: true,
      }),
    );
    expect(JSON.stringify(diagnostics.mock.calls)).not.toContain(
      image.toString("base64"),
    );
  });

  it("releases the job through the bounded failure boundary", async () => {
    const testGateway = gateway();

    await expect(
      executeGenerationPipeline(identity, {
        gateway: testGateway,
        model: {
          model: DEFAULT_GENERATION_MODEL,
          generate: vi.fn(async () => {
            throw new GoogleImageAdapterError(
              "PROVIDER_UNAVAILABLE",
              true,
            );
          }),
        },
        storage: {
          storeImage: vi.fn(),
          verifyImage: vi.fn(),
        },
      }),
    ).resolves.toEqual({
      status: "failed",
      errorCode: "PROVIDER_UNAVAILABLE",
    });

    expect(testGateway.markAssetFailed).toHaveBeenCalledOnce();
    expect(testGateway.failJob).toHaveBeenCalledWith(
      "PROVIDER_UNAVAILABLE",
    );
  });

  it("still releases Credit when asset failure cleanup cannot be persisted", async () => {
    const testGateway = gateway({
      markAssetFailed: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    });

    await expect(
      executeGenerationPipeline(identity, {
        gateway: testGateway,
        model: {
          model: DEFAULT_GENERATION_MODEL,
          generate: vi.fn(async () => {
            throw new GoogleImageAdapterError("PROVIDER_UNAVAILABLE", true);
          }),
        },
        storage: {
          storeImage: vi.fn(),
          verifyImage: vi.fn(),
        },
      }),
    ).resolves.toEqual({
      status: "reconciliation_required",
      errorCode: "PROVIDER_UNAVAILABLE",
    });

    expect(testGateway.markAssetFailed).toHaveBeenCalledOnce();
    expect(testGateway.failJob).toHaveBeenCalledWith(
      "PROVIDER_UNAVAILABLE",
    );
  });

  it("preserves a published result for reconciliation when settlement fails", async () => {
    const image = png();
    const checksumSha256 = createHash("sha256").update(image).digest("base64");
    const testGateway = gateway({
      completeJob: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    });

    await expect(
      executeGenerationPipeline(identity, {
        gateway: testGateway,
        model: {
          model: DEFAULT_GENERATION_MODEL,
          generate: vi.fn(async () => ({
            image: {
              data: image.toString("base64"),
              mimeType: "image/png" as const,
            },
            model: DEFAULT_GENERATION_MODEL,
          })),
        },
        storage: {
          storeImage: vi.fn(async () => ({
            byteSize: image.length,
            checksumSha256,
            mimeType: "image/png" as const,
          })),
          verifyImage: vi.fn(async () => undefined),
        },
      }),
    ).resolves.toEqual({
      status: "reconciliation_required",
      errorCode: "PIPELINE_FAILED",
    });

    expect(testGateway.markAssetAvailable).toHaveBeenCalledOnce();
    expect(testGateway.failJob).not.toHaveBeenCalled();
  });
});
