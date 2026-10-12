import { createHash } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { GeneratedImage } from "@/lib/generation/model";
import { inspectGeneratedImage } from "@/lib/generation/image-quality";

import { isOriginalObjectKey, mimeTypeForOriginalObjectKey } from "./object-key";

const ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/u;
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_ENCODED_IMAGE_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4;
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
export const MAX_DOWNLOAD_URL_TTL_SECONDS = 10 * 60;

export type R2StorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

type SendCommand = (
  command: PutObjectCommand | HeadObjectCommand | DeleteObjectCommand,
) => Promise<unknown>;

type SignCommand = (
  command: GetObjectCommand,
  expiresIn: number,
) => Promise<string>;

type R2StorageDependencies = {
  send?: SendCommand;
  sign?: SignCommand;
};

function validateConfig(config: R2StorageConfig) {
  if (!ACCOUNT_ID_PATTERN.test(config.accountId)) {
    throw new Error("Invalid R2_ACCOUNT_ID");
  }
  if (!BUCKET_PATTERN.test(config.bucket)) {
    throw new Error("Invalid R2_BUCKET");
  }
  if (config.accessKeyId.trim().length === 0) {
    throw new Error("Missing R2_ACCESS_KEY_ID");
  }
  if (config.secretAccessKey.trim().length === 0) {
    throw new Error("Missing R2_SECRET_ACCESS_KEY");
  }
}

function decodeImage(image: GeneratedImage) {
  const { data } = image;
  if (
    data.length === 0 ||
    data.length > MAX_ENCODED_IMAGE_LENGTH ||
    !BASE64_PATTERN.test(data)
  ) {
    throw new Error("Invalid generated image data");
  }

  const body = Buffer.from(data, "base64");

  if (body.length === 0 || body.length > MAX_IMAGE_BYTES) {
    throw new Error("Invalid generated image size");
  }

  try {
    const inspected = inspectGeneratedImage(image);
    if (inspected.buffer.length !== body.length) {
      throw new Error("Invalid generated image size");
    }
  } catch {
    throw new Error("Invalid generated image data");
  }
  return body;
}

function requireObjectKey(key: string) {
  if (!isOriginalObjectKey(key)) {
    throw new Error("Invalid R2 object key");
  }
}

export function createR2Storage(
  config: R2StorageConfig,
  dependencies: R2StorageDependencies = {},
) {
  validateConfig(config);

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  const send: SendCommand =
    dependencies.send ?? ((command) => client.send(command));
  const sign: SignCommand =
    dependencies.sign ??
    ((command, expiresIn) =>
      getSignedUrl(client, command, { expiresIn }));

  return {
    async storeImage(input: { key: string; image: GeneratedImage }) {
      requireObjectKey(input.key);
      if (mimeTypeForOriginalObjectKey(input.key) !== input.image.mimeType) {
        throw new Error("Invalid R2 object key MIME type");
      }
      const body = decodeImage(input.image);
      const checksum = createHash("sha256").update(body).digest("base64");

      await send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
          Body: body,
          ContentType: input.image.mimeType,
          ContentLength: body.length,
          ChecksumSHA256: checksum,
        }),
      );

      return {
        byteSize: body.length,
        checksumSha256: checksum,
        mimeType: input.image.mimeType,
      };
    },

    async verifyImage(input: {
      key: string;
      byteSize: number;
      checksumSha256: string;
      mimeType: GeneratedImage["mimeType"];
    }) {
      requireObjectKey(input.key);
      const result = await send(
        new HeadObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
          ChecksumMode: "ENABLED",
        }),
      );

      if (
        typeof result !== "object" ||
        result === null ||
        !("ContentLength" in result) ||
        result.ContentLength !== input.byteSize ||
        !("ContentType" in result) ||
        result.ContentType !== input.mimeType ||
        !("ChecksumSHA256" in result) ||
        result.ChecksumSHA256 !== input.checksumSha256
      ) {
        throw new Error("R2 object verification failed");
      }
    },

    async deleteImage(input: { key: string }) {
      requireObjectKey(input.key);
      try {
        await send(
          new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: input.key,
          }),
        );
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          (("name" in error && error.name === "NoSuchKey") ||
            ("$metadata" in error &&
              typeof error.$metadata === "object" &&
              error.$metadata !== null &&
              "httpStatusCode" in error.$metadata &&
              error.$metadata.httpStatusCode === 404))
        ) {
          return;
        }
        throw error;
      }
    },

    async createDownloadUrl(input: {
      key: string;
      downloadName: string;
      expiresIn: number;
      disposition?: "attachment" | "inline";
    }) {
      requireObjectKey(input.key);

      if (
        !Number.isInteger(input.expiresIn) ||
        input.expiresIn < 1 ||
        input.expiresIn > MAX_DOWNLOAD_URL_TTL_SECONDS
      ) {
        throw new Error("Invalid R2 download URL expiry");
      }

      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u.test(input.downloadName)) {
        throw new Error("Invalid R2 download name");
      }

      return sign(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
          ResponseContentDisposition:
            `${input.disposition ?? "attachment"}; filename="${input.downloadName}"`,
        }),
        input.expiresIn,
      );
    },
  };
}

export function createR2StorageFromEnvironment(
  dependencies?: R2StorageDependencies,
) {
  return createR2Storage(
    {
      accountId: process.env.R2_ACCOUNT_ID ?? "",
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      bucket: process.env.R2_BUCKET ?? "",
    },
    dependencies,
  );
}
