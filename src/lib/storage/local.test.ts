import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildOriginalObjectKey } from "./object-key";
import { createLocalImageStorage } from "./local";
import { jpegFixture, pngFixture } from "../../../tests/fixtures/generated-images";

const key = buildOriginalObjectKey({
  userId: "11111111-1111-4111-8111-111111111111",
  jobId: "22222222-2222-4222-8222-222222222222",
  assetId: "33333333-3333-4333-8333-333333333333",
  mimeType: "image/png",
});

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "ai-photo-studio-local-test-"));
  roots.push(root);
  return { root, storage: createLocalImageStorage(root) };
}

describe("createLocalImageStorage", () => {
  it("stores, verifies, and reads a private development image", async () => {
    const { root, storage } = await fixture();
    const bytes = pngFixture();
    const image = {
      data: bytes.toString("base64"),
      mimeType: "image/png" as const,
    };

    const metadata = await storage.storeImage({ key, image });
    await expect(storage.verifyImage({ key, ...metadata })).resolves.toBeUndefined();
    await expect(storage.readImage({ key })).resolves.toEqual({
      body: bytes,
      mimeType: "image/png",
    });

    const entries = await import("node:fs/promises").then(({ readdir }) =>
      readdir(root),
    );
    expect(entries).toHaveLength(1);
    await expect(readFile(join(root, entries[0]))).resolves.toEqual(
      bytes,
    );
  });

  it("deletes an image idempotently", async () => {
    const { storage } = await fixture();
    await storage.storeImage({
      key,
      image: { data: pngFixture().toString("base64"), mimeType: "image/png" },
    });

    await expect(storage.deleteImage({ key })).resolves.toBeUndefined();
    await expect(storage.deleteImage({ key })).resolves.toBeUndefined();
    await expect(storage.readImage({ key })).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("stores, verifies, and reads JPEG with a .jpg local object", async () => {
    const { root, storage } = await fixture();
    const bytes = jpegFixture();
    const jpegKey = buildOriginalObjectKey({
      userId: "11111111-1111-4111-8111-111111111111",
      jobId: "22222222-2222-4222-8222-222222222222",
      assetId: "33333333-3333-4333-8333-333333333333",
      mimeType: "image/jpeg",
    });
    const metadata = await storage.storeImage({
      key: jpegKey,
      image: { data: bytes.toString("base64"), mimeType: "image/jpeg" },
    });

    await expect(
      storage.verifyImage({ key: jpegKey, ...metadata }),
    ).resolves.toBeUndefined();
    await expect(storage.readImage({ key: jpegKey })).resolves.toEqual({
      body: bytes,
      mimeType: "image/jpeg",
    });
    const entries = await import("node:fs/promises").then(({ readdir }) =>
      readdir(root),
    );
    expect(entries[0]).toMatch(/\.jpg$/u);
  });

  it("rejects unsafe keys and mismatched verification metadata", async () => {
    const { storage } = await fixture();
    await expect(
      storage.storeImage({
        key: "../image.png",
        image: { data: pngFixture().toString("base64"), mimeType: "image/png" },
      }),
    ).rejects.toThrow("Invalid local object key");

    const metadata = await storage.storeImage({
      key,
      image: { data: pngFixture().toString("base64"), mimeType: "image/png" },
    });
    await expect(
      storage.verifyImage({ key, ...metadata, byteSize: metadata.byteSize + 1 }),
    ).rejects.toThrow("Local object verification failed");
  });
});
