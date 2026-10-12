import { createHash } from "node:crypto";
import { mkdir, open, readFile, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { GeneratedImage } from "@/lib/generation/model";
import { inspectGeneratedImage } from "@/lib/generation/image-quality";

import {
  extensionForImageMimeType,
  isOriginalObjectKey,
  mimeTypeForOriginalObjectKey,
} from "./object-key";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function defaultStorageRoot() {
  const workspace = createHash("sha256")
    .update(process.cwd())
    .digest("hex")
    .slice(0, 16);
  return join(tmpdir(), "ai-photo-studio-development-assets", workspace);
}

function decodeImage(image: GeneratedImage) {
  try {
    return inspectGeneratedImage(image).buffer;
  } catch {
    throw new Error("Invalid local generated image");
  }
}

function fileNameForKey(key: string) {
  if (!isOriginalObjectKey(key)) {
    throw new Error("Invalid local object key");
  }
  const mimeType = mimeTypeForOriginalObjectKey(key);
  if (!mimeType) throw new Error("Invalid local object key");
  return `${createHash("sha256").update(key).digest("hex")}.${extensionForImageMimeType(mimeType)}`;
}

export function createLocalImageStorage(root = defaultStorageRoot()) {
  function pathForKey(key: string) {
    return join(root, fileNameForKey(key));
  }

  return {
    kind: "local" as const,

    async storeImage(input: { key: string; image: GeneratedImage }) {
      const body = decodeImage(input.image);
      await mkdir(root, { recursive: true, mode: 0o700 });
      const handle = await open(pathForKey(input.key), "wx", 0o600);
      try {
        await handle.writeFile(body);
      } finally {
        await handle.close();
      }

      return {
        byteSize: body.length,
        checksumSha256: createHash("sha256").update(body).digest("base64"),
        mimeType: input.image.mimeType,
      };
    },

    async verifyImage(input: {
      key: string;
      byteSize: number;
      checksumSha256: string;
      mimeType: GeneratedImage["mimeType"];
    }) {
      const keyMimeType = mimeTypeForOriginalObjectKey(input.key);
      if (!keyMimeType || keyMimeType !== input.mimeType) {
        throw new Error("Local object verification failed");
      }
      const path = pathForKey(input.key);
      const metadata = await stat(path);
      if (!metadata.isFile() || metadata.size !== input.byteSize) {
        throw new Error("Local object verification failed");
      }
      const body = await readFile(path);
      const checksum = createHash("sha256").update(body).digest("base64");
      if (checksum !== input.checksumSha256) {
        throw new Error("Local object verification failed");
      }
      try {
        inspectGeneratedImage({
          data: body.toString("base64"),
          mimeType: input.mimeType,
        });
      } catch {
        throw new Error("Local object verification failed");
      }
    },

    async readImage(input: { key: string }) {
      const body = await readFile(pathForKey(input.key));
      if (body.length === 0 || body.length > MAX_IMAGE_BYTES) {
        throw new Error("Invalid local generated image");
      }
      const mimeType = mimeTypeForOriginalObjectKey(input.key);
      if (!mimeType) throw new Error("Invalid local generated image");
      try {
        inspectGeneratedImage({ data: body.toString("base64"), mimeType });
      } catch {
        throw new Error("Invalid local generated image");
      }
      return { body, mimeType };
    },

    async deleteImage(input: { key: string }) {
      try {
        await unlink(pathForKey(input.key));
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return;
        }
        throw error;
      }
    },
  };
}

export function createLocalImageStorageFromEnvironment() {
  return createLocalImageStorage();
}
