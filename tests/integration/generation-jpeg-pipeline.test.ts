import { createHash } from "node:crypto";

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { createGoogleImageAdapter } from "../../src/lib/generation/google-adapter";
import {
  executeGenerationPipeline,
  type GenerationPipelineGateway,
} from "../../src/lib/generation/orchestrator";
import { downloadNameForAsset } from "../../src/lib/storage/object-key";
import { createR2Storage } from "../../src/lib/storage/r2";
import { jpegFixture } from "../fixtures/generated-images";

describe("Google JPEG generation storage contract", () => {
  it("extracts, inspects, allocates, publishes, and signs the JPEG result", async () => {
    const image = jpegFixture();
    const checksum = createHash("sha256").update(image).digest("base64");
    const assetId = "33333333-3333-4333-8333-333333333333";
    const allocated: Array<{ key: string; mimeType: string }> = [];
    const send = vi.fn(async (command: PutObjectCommand | HeadObjectCommand) =>
      command instanceof HeadObjectCommand
        ? {
            ContentLength: image.length,
            ContentType: "image/jpeg",
            ChecksumSHA256: checksum,
          }
        : {},
    );
    const sign = vi.fn(
      async (command: GetObjectCommand, expiresIn: number) => {
        expect(command).toBeInstanceOf(GetObjectCommand);
        expect(expiresIn).toBe(600);
        return "https://signed.example.test/jpeg";
      },
    );
    const storage = createR2Storage(
      {
        accountId: "a".repeat(32),
        accessKeyId: "synthetic-access-key",
        secretAccessKey: "synthetic-secret-key",
        bucket: "ai-photo-studio-development",
      },
      { send, sign },
    );
    const gateway = {
      allocateAsset: vi.fn(async ({ key, mimeType }) => {
        allocated.push({ key, mimeType });
      }),
      completeJob: vi.fn(async () => undefined),
      failJob: vi.fn(async () => undefined),
      markAssetAvailable: vi.fn(async () => undefined),
      markAssetFailed: vi.fn(async () => undefined),
      markAssetUploading: vi.fn(async () => undefined),
      markAssetValidating: vi.fn(async () => undefined),
    } satisfies GenerationPipelineGateway;
    const google = createGoogleImageAdapter({
      apiKey: "synthetic-google-key",
      transport: "interactions",
      fetchImpl: vi.fn(async () =>
        Response.json({
          status: "completed",
          steps: [
            {
              type: "model_output",
              content: [
                {
                  type: "image",
                  mime_type: "image/jpeg",
                  data: image.toString("base64"),
                },
              ],
            },
          ],
        }),
      ),
    });

    await expect(
      executeGenerationPipeline(
        {
          assetId,
          jobId: "22222222-2222-4222-8222-222222222222",
          request: {
            prompt: "safe fixture prompt",
            style: "photographic",
            aspectRatio: "1:1",
          },
          userId: "11111111-1111-4111-8111-111111111111",
        },
        { gateway, model: google, storage },
      ),
    ).resolves.toMatchObject({
      status: "succeeded",
      image: { mimeType: "image/jpeg" },
    });

    expect(allocated).toEqual([
      {
        key: expect.stringMatching(/original\.jpg$/u),
        mimeType: "image/jpeg",
      },
    ]);
    const put = send.mock.calls.find(
      ([command]) => command instanceof PutObjectCommand,
    )?.[0] as PutObjectCommand;
    expect(put.input).toMatchObject({
      Key: allocated[0].key,
      ContentType: "image/jpeg",
      ContentLength: image.length,
    });

    const downloadName = downloadNameForAsset(assetId, "image/jpeg");
    await expect(
      storage.createDownloadUrl({
        key: allocated[0].key,
        downloadName,
        expiresIn: 600,
      }),
    ).resolves.toBe("https://signed.example.test/jpeg");
    expect(downloadName).toMatch(/\.jpg$/u);
    expect(sign.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
  });
});
