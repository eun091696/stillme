import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { buildOriginalObjectKey } from "./object-key";
import {
  createR2Storage,
  MAX_DOWNLOAD_URL_TTL_SECONDS,
} from "./r2";
import { jpegFixture, pngFixture } from "../../../tests/fixtures/generated-images";

const config = {
  accountId: "a".repeat(32),
  accessKeyId: "synthetic-access-key",
  secretAccessKey: "synthetic-secret-key",
  bucket: "ai-photo-studio-development",
};

const key = buildOriginalObjectKey({
  userId: "11111111-1111-4111-8111-111111111111",
  jobId: "22222222-2222-4222-8222-222222222222",
  assetId: "33333333-3333-4333-8333-333333333333",
  mimeType: "image/png",
});
const jpegKey = buildOriginalObjectKey({
  userId: "11111111-1111-4111-8111-111111111111",
  jobId: "22222222-2222-4222-8222-222222222222",
  assetId: "33333333-3333-4333-8333-333333333333",
  mimeType: "image/jpeg",
});

describe("createR2Storage", () => {
  it("deletes an exact validated object and treats a missing object as success", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(Object.assign(new Error("missing"), { name: "NoSuchKey" }));
    const storage = createR2Storage(config, { send });

    await expect(storage.deleteImage({ key })).resolves.toBeUndefined();
    await expect(storage.deleteImage({ key })).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
    expect((send.mock.calls[0][0] as DeleteObjectCommand).input).toEqual({
      Bucket: config.bucket,
      Key: key,
    });
    await expect(
      storage.deleteImage({ key: "../private/image.png" }),
    ).rejects.toThrow("Invalid R2 object key");
  });

  it("uploads a private image with size, type, and checksum metadata", async () => {
    const send = vi.fn(async () => ({}));
    const storage = createR2Storage(config, { send });
    const image = pngFixture();
    const checksum = createHash("sha256").update(image).digest("base64");

    await expect(
      storage.storeImage({
        key,
        image: {
          mimeType: "image/png",
          data: image.toString("base64"),
        },
      }),
    ).resolves.toEqual({
      byteSize: image.length,
      checksumSha256: checksum,
      mimeType: "image/png",
    });

    const [[command]] = send.mock
      .calls as unknown as [[PutObjectCommand]];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: config.bucket,
      Key: key,
      ContentType: "image/png",
      ContentLength: image.length,
      ChecksumSHA256: checksum,
    });
  });

  it("uploads JPEG bytes using a .jpg key and JPEG Content-Type", async () => {
    const send = vi.fn(async () => ({}));
    const storage = createR2Storage(config, { send });
    const image = jpegFixture();

    await storage.storeImage({
      key: jpegKey,
      image: { mimeType: "image/jpeg", data: image.toString("base64") },
    });

    const [[command]] = send.mock.calls as unknown as [[PutObjectCommand]];
    expect(command.input).toMatchObject({
      Key: jpegKey,
      ContentType: "image/jpeg",
      ContentLength: image.length,
    });
    expect(jpegKey).toMatch(/original\.jpg$/u);
  });

  it("verifies persisted object metadata before publication", async () => {
    const send = vi.fn(async (command: PutObjectCommand | HeadObjectCommand) => {
      expect(command).toBeInstanceOf(HeadObjectCommand);
      return {
        ContentLength: 5,
        ContentType: "image/png",
        ChecksumSHA256: "checksum",
      };
    });
    const storage = createR2Storage(config, { send });

    await expect(
      storage.verifyImage({
        key,
        byteSize: 5,
        mimeType: "image/png",
        checksumSha256: "checksum",
      }),
    ).resolves.toBeUndefined();
  });

  it("creates only bounded exact-object download grants", async () => {
    const sign = vi.fn(async () => "https://signed.example.test/object");
    const storage = createR2Storage(config, {
      send: vi.fn(),
      sign,
    });

    await expect(
      storage.createDownloadUrl({
        key,
        downloadName: "ai-photo-studio.png",
        expiresIn: MAX_DOWNLOAD_URL_TTL_SECONDS,
      }),
    ).resolves.toBe("https://signed.example.test/object");

    const [[command, expiresIn]] = sign.mock
      .calls as unknown as [[GetObjectCommand, number]];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toEqual({
      Bucket: config.bucket,
      Key: key,
      ResponseContentDisposition:
        'attachment; filename="ai-photo-studio.png"',
    });
    expect(expiresIn).toBe(600);
  });

  it("creates an inline signed URL for an authenticated preview", async () => {
    const sign = vi.fn(async () => "https://signed.example.test/preview");
    const storage = createR2Storage(config, { sign });

    await expect(
      storage.createDownloadUrl({
        key,
        downloadName: "preview.png",
        expiresIn: 60,
        disposition: "inline",
      }),
    ).resolves.toBe("https://signed.example.test/preview");

    const [[command]] = sign.mock.calls as unknown as [[GetObjectCommand, number]];
    expect(command.input.ResponseContentDisposition).toBe(
      'inline; filename="preview.png"',
    );
  });

  it("rejects unsafe keys, download names, and expiry values", async () => {
    const storage = createR2Storage(config, {
      send: vi.fn(),
      sign: vi.fn(),
    });

    await expect(
      storage.createDownloadUrl({
        key: "../private/image.png",
        downloadName: "image.png",
        expiresIn: 60,
      }),
    ).rejects.toThrowError("Invalid R2 object key");

    await expect(
      storage.createDownloadUrl({
        key,
        downloadName: 'image"\r\nX-Unsafe: true.png',
        expiresIn: 60,
      }),
    ).rejects.toThrowError("Invalid R2 download name");

    await expect(
      storage.createDownloadUrl({
        key,
        downloadName: "image.png",
        expiresIn: 601,
      }),
    ).rejects.toThrowError("Invalid R2 download URL expiry");
  });

  it("rejects missing or malformed server configuration", () => {
    expect(() =>
      createR2Storage({ ...config, accountId: "not-an-account" }),
    ).toThrowError("Invalid R2_ACCOUNT_ID");
    expect(() =>
      createR2Storage({ ...config, secretAccessKey: "" }),
    ).toThrowError("Missing R2_SECRET_ACCESS_KEY");
  });
});
