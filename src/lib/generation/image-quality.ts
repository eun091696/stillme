import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";

import type { GeneratedImage } from "./model";
import type { GenerationAspectRatio } from "./validation";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const JPEG_END_OF_IMAGE = Buffer.from([0xff, 0xd9]);
const WEBP_RIFF_SIGNATURE = Buffer.from("RIFF", "ascii");
const WEBP_FORMAT_SIGNATURE = Buffer.from("WEBP", "ascii");
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_DIMENSION = 4096;
const MAX_PIXELS = 16_777_216;
const PROHIBITED_CHUNKS = new Set(["acTL", "eXIf", "iTXt", "tEXt", "zTXt"]);
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
  0xcf,
]);

const EXPECTED_ASPECT_RATIOS: Record<GenerationAspectRatio, number> = {
  "1:1": 1,
  "3:4": 3 / 4,
  "4:5": 4 / 5,
  "16:9": 16 / 9,
};

export type ImageQualityErrorCode =
  | "IMAGE_DATA_INVALID"
  | "IMAGE_FORMAT_UNSUPPORTED"
  | "IMAGE_METADATA_PROHIBITED"
  | "IMAGE_DIMENSIONS_INVALID"
  | "IMAGE_ASPECT_RATIO_MISMATCH";

export class ImageQualityError extends Error {
  constructor(readonly code: ImageQualityErrorCode) {
    super(code);
    this.name = "ImageQualityError";
  }
}

type PngChunk = {
  type: string;
  data: Buffer;
};

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

function parsePng(buffer: Buffer) {
  if (
    buffer.length < 45 ||
    !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    throw new ImageQualityError("IMAGE_FORMAT_UNSUPPORTED");
  }

  const chunks: PngChunk[] = [];
  let offset = PNG_SIGNATURE.length;

  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) {
      throw new ImageQualityError("IMAGE_DATA_INVALID");
    }

    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) {
      throw new ImageQualityError("IMAGE_DATA_INVALID");
    }

    const typeBuffer = buffer.subarray(offset + 4, offset + 8);
    const type = typeBuffer.toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = buffer.readUInt32BE(offset + 8 + length);
    const actualCrc = crc32(Buffer.concat([typeBuffer, data]));

    if (actualCrc !== expectedCrc) {
      throw new ImageQualityError("IMAGE_DATA_INVALID");
    }
    if (PROHIBITED_CHUNKS.has(type)) {
      throw new ImageQualityError("IMAGE_METADATA_PROHIBITED");
    }

    chunks.push({ type, data });
    offset = end;

    if (type === "IEND") {
      if (offset !== buffer.length) {
        throw new ImageQualityError("IMAGE_DATA_INVALID");
      }
      break;
    }
  }

  const header = chunks[0];
  if (
    header?.type !== "IHDR" ||
    header.data.length !== 13 ||
    chunks.at(-1)?.type !== "IEND"
  ) {
    throw new ImageQualityError("IMAGE_DATA_INVALID");
  }

  const width = header.data.readUInt32BE(0);
  const height = header.data.readUInt32BE(4);
  const bitDepth = header.data[8];
  const colorType = header.data[9];
  const compression = header.data[10];
  const filter = header.data[11];
  const interlace = header.data[12];
  const channels = new Map([
    [0, 1],
    [2, 3],
    [3, 1],
    [4, 2],
    [6, 4],
  ]).get(colorType);

  if (
    width < 1 ||
    height < 1 ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION ||
    width * height > MAX_PIXELS ||
    bitDepth !== 8 ||
    channels === undefined ||
    compression !== 0 ||
    filter !== 0 ||
    interlace !== 0
  ) {
    throw new ImageQualityError("IMAGE_DIMENSIONS_INVALID");
  }

  const imageData = Buffer.concat(
    chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data),
  );
  const expectedInflatedLength = height * (1 + width * channels);

  if (imageData.length === 0) {
    throw new ImageQualityError("IMAGE_DATA_INVALID");
  }

  try {
    const inflated = inflateSync(imageData, {
      maxOutputLength: expectedInflatedLength,
    });
    if (inflated.length !== expectedInflatedLength) {
      throw new ImageQualityError("IMAGE_DATA_INVALID");
    }
  } catch (error) {
    if (error instanceof ImageQualityError) {
      throw error;
    }
    throw new ImageQualityError("IMAGE_DATA_INVALID");
  }

  return { width, height };
}

function parseJpeg(buffer: Buffer) {
  if (
    buffer.length < 12 ||
    !buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE) ||
    !buffer.subarray(-JPEG_END_OF_IMAGE.length).equals(JPEG_END_OF_IMAGE)
  ) {
    throw new ImageQualityError("IMAGE_FORMAT_UNSUPPORTED");
  }

  let offset = 2;
  let dimensions: { width: number; height: number } | null = null;

  while (offset < buffer.length - 2) {
    if (buffer[offset] !== 0xff) {
      throw new ImageQualityError("IMAGE_DATA_INVALID");
    }
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xda) break;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 2 > buffer.length) {
      throw new ImageQualityError("IMAGE_DATA_INVALID");
    }

    const segmentLength = buffer.readUInt16BE(offset);
    const segmentEnd = offset + segmentLength;
    if (segmentLength < 2 || segmentEnd > buffer.length) {
      throw new ImageQualityError("IMAGE_DATA_INVALID");
    }
    if (marker === 0xe1 || marker === 0xfe) {
      throw new ImageQualityError("IMAGE_METADATA_PROHIBITED");
    }
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 8) {
        throw new ImageQualityError("IMAGE_DATA_INVALID");
      }
      dimensions = {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset = segmentEnd;
  }

  if (!dimensions) {
    throw new ImageQualityError("IMAGE_DATA_INVALID");
  }
  return dimensions;
}

function decodeCanonicalBase64(data: string) {
  const buffer = Buffer.from(data, "base64");

  if (
    data.length === 0 ||
    buffer.length === 0 ||
    buffer.length > MAX_IMAGE_BYTES ||
    buffer.toString("base64") !== data
  ) {
    throw new ImageQualityError("IMAGE_DATA_INVALID");
  }

  return buffer;
}

export function detectGeneratedImageMimeType(buffer: Buffer) {
  if (buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return "image/png" as const;
  }
  if (buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) {
    return "image/jpeg" as const;
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).equals(WEBP_RIFF_SIGNATURE) &&
    buffer.subarray(8, 12).equals(WEBP_FORMAT_SIGNATURE)
  ) {
    return "image/webp" as const;
  }
  return null;
}

export function inspectGeneratedImage(image: GeneratedImage) {
  const buffer = decodeCanonicalBase64(image.data);
  const detectedMimeType = detectGeneratedImageMimeType(buffer);
  if (!detectedMimeType || detectedMimeType !== image.mimeType) {
    throw new ImageQualityError("IMAGE_FORMAT_UNSUPPORTED");
  }

  const dimensions = detectedMimeType === "image/png"
    ? parsePng(buffer)
    : detectedMimeType === "image/jpeg"
      ? parseJpeg(buffer)
      : null;
  if (!dimensions) {
    throw new ImageQualityError("IMAGE_FORMAT_UNSUPPORTED");
  }

  if (
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.width > MAX_DIMENSION ||
    dimensions.height > MAX_DIMENSION ||
    dimensions.width * dimensions.height > MAX_PIXELS
  ) {
    throw new ImageQualityError("IMAGE_DIMENSIONS_INVALID");
  }

  return { buffer, detectedMimeType, ...dimensions };
}

export function validateGeneratedImageQuality(
  image: GeneratedImage,
  expectedAspectRatio: GenerationAspectRatio,
) {
  const { buffer, detectedMimeType, width, height } = inspectGeneratedImage(image);
  const actualRatio = width / height;
  const targetRatio = EXPECTED_ASPECT_RATIOS[expectedAspectRatio];
  const deviation = Math.abs(actualRatio - targetRatio) / targetRatio;

  if (deviation > 0.02) {
    throw new ImageQualityError("IMAGE_ASPECT_RATIO_MISMATCH");
  }

  return {
    image: {
      mimeType: detectedMimeType,
      data: buffer.toString("base64"),
    },
    width,
    height,
    byteSize: buffer.length,
    checksumSha256: createHash("sha256").update(buffer).digest("base64"),
    qualityVersion: "image-quality-v1" as const,
  };
}
