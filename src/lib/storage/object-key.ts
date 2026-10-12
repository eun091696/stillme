import type {
  GeneratedImage,
  GeneratedImageMimeType,
} from "@/lib/generation/model";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const IMAGE_EXTENSIONS: Record<GeneratedImage["mimeType"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const EXTENSION_MIME_TYPES: Record<string, GeneratedImageMimeType> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function extensionForImageMimeType(mimeType: GeneratedImageMimeType) {
  return IMAGE_EXTENSIONS[mimeType];
}

export function mimeTypeForOriginalObjectKey(value: string) {
  if (!isOriginalObjectKey(value)) return null;
  const extension = value.slice(value.lastIndexOf(".") + 1);
  return EXTENSION_MIME_TYPES[extension] ?? null;
}

export function downloadNameForAsset(
  assetId: string,
  mimeType: GeneratedImageMimeType,
  options?: {
    service?: string;
    createdAt?: string | Date;
    candidateNumber?: number;
  },
) {
  requireUuidV4("assetId", assetId);
  const services = new Set([
    "id-photo",
    "business-profile",
    "profile-photo",
    "underwater-correction",
    "character-avatar",
  ]);
  const service = options?.service && services.has(options.service)
    ? options.service
    : "photo";
  const createdAt = options?.createdAt
    ? new Date(options.createdAt)
    : new Date();
  const safeCreatedAt = Number.isNaN(createdAt.getTime())
    ? new Date()
    : createdAt;
  const koreaTime = new Date(safeCreatedAt.getTime() + 9 * 60 * 60 * 1000);
  const dateTime = [
    koreaTime.getUTCFullYear(),
    String(koreaTime.getUTCMonth() + 1).padStart(2, "0"),
    String(koreaTime.getUTCDate()).padStart(2, "0"),
  ].join("") + "-" + [
    String(koreaTime.getUTCHours()).padStart(2, "0"),
    String(koreaTime.getUTCMinutes()).padStart(2, "0"),
    String(koreaTime.getUTCSeconds()).padStart(2, "0"),
  ].join("");
  const candidateNumber = Number.isInteger(options?.candidateNumber) &&
      (options?.candidateNumber ?? 0) >= 1 &&
      (options?.candidateNumber ?? 0) <= 5
    ? options?.candidateNumber
    : 1;

  return `stillme-${service}-${dateTime}-${String(candidateNumber).padStart(2, "0")}.${extensionForImageMimeType(mimeType)}`;
}

type OriginalObjectKeyInput = {
  userId: string;
  jobId: string;
  assetId: string;
  mimeType: GeneratedImage["mimeType"];
};

function requireUuidV4(name: string, value: string) {
  if (!UUID_V4_PATTERN.test(value)) {
    throw new Error(`Invalid ${name}`);
  }
}

export function buildOriginalObjectKey({
  userId,
  jobId,
  assetId,
  mimeType,
}: OriginalObjectKeyInput) {
  requireUuidV4("userId", userId);
  requireUuidV4("jobId", jobId);
  requireUuidV4("assetId", assetId);

  return [
    "users",
    userId,
    "generation-jobs",
    jobId,
    "assets",
    assetId,
    `original.${extensionForImageMimeType(mimeType)}`,
  ].join("/");
}

export function isOriginalObjectKey(value: string) {
  const parts = value.split("/");
  const fileParts = parts[6]?.split(".") ?? [];

  return (
    parts.length === 7 &&
    parts[0] === "users" &&
    UUID_V4_PATTERN.test(parts[1]) &&
    parts[2] === "generation-jobs" &&
    UUID_V4_PATTERN.test(parts[3]) &&
    parts[4] === "assets" &&
    UUID_V4_PATTERN.test(parts[5]) &&
    fileParts[0] === "original" &&
    ["jpg", "png", "webp"].includes(fileParts[1]) &&
    fileParts.length === 2
  );
}
