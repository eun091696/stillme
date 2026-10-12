import { deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import {
  detectGeneratedImageMimeType,
  ImageQualityError,
  validateGeneratedImageQuality,
} from "./image-quality";
import { jpegFixture } from "../../../tests/fixtures/generated-images";

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

function png(width: number, height: number, extraChunks: Buffer[] = []) {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const pixels = Buffer.alloc(height * (1 + width * 4));

  return Buffer.concat([
    signature,
    chunk("IHDR", header),
    ...extraChunks,
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("validateGeneratedImageQuality", () => {
  it("validates a decoded PNG and returns publishable metadata", () => {
    const data = png(16, 16).toString("base64");

    expect(
      validateGeneratedImageQuality(
        { mimeType: "image/png", data },
        "1:1",
      ),
    ).toMatchObject({
      image: { mimeType: "image/png", data },
      width: 16,
      height: 16,
      qualityVersion: "image-quality-v1",
    });
  });

  it("validates JPEG magic bytes, dimensions, and publishable metadata", () => {
    const jpeg = jpegFixture(16, 16);

    expect(detectGeneratedImageMimeType(jpeg)).toBe("image/jpeg");
    expect(
      validateGeneratedImageQuality(
        { mimeType: "image/jpeg", data: jpeg.toString("base64") },
        "1:1",
      ),
    ).toMatchObject({
      image: { mimeType: "image/jpeg" },
      width: 16,
      height: 16,
      byteSize: jpeg.length,
    });
  });

  it("keeps PNG magic detection and rejects declared MIME mismatches", () => {
    const pngData = png(8, 8);
    const jpegData = jpegFixture(8, 8);
    expect(detectGeneratedImageMimeType(pngData)).toBe("image/png");

    expect(() =>
      validateGeneratedImageQuality(
        { mimeType: "image/jpeg", data: pngData.toString("base64") },
        "1:1",
      ),
    ).toThrowError(new ImageQualityError("IMAGE_FORMAT_UNSUPPORTED"));
    expect(() =>
      validateGeneratedImageQuality(
        { mimeType: "image/png", data: jpegData.toString("base64") },
        "1:1",
      ),
    ).toThrowError(new ImageQualityError("IMAGE_FORMAT_UNSUPPORTED"));
  });

  it("rejects MIME mismatches and aspect mismatches", () => {
    const data = png(16, 16).toString("base64");

    expect(() =>
      validateGeneratedImageQuality(
        { mimeType: "image/jpeg", data },
        "1:1",
      ),
    ).toThrowError(new ImageQualityError("IMAGE_FORMAT_UNSUPPORTED"));

    expect(() =>
      validateGeneratedImageQuality(
        { mimeType: "image/png", data },
        "16:9",
      ),
    ).toThrowError(
      new ImageQualityError("IMAGE_ASPECT_RATIO_MISMATCH"),
    );
  });

  it("rejects embedded metadata and animation control chunks", () => {
    for (const type of ["tEXt", "iTXt", "zTXt", "eXIf", "acTL"]) {
      const data = png(8, 8, [chunk(type, Buffer.from("fixture"))]).toString(
        "base64",
      );

      expect(() =>
        validateGeneratedImageQuality(
          { mimeType: "image/png", data },
          "1:1",
        ),
      ).toThrowError(
        new ImageQualityError("IMAGE_METADATA_PROHIBITED"),
      );
    }
  });

  it("rejects corrupt or non-canonical image data", () => {
    const corrupt = png(8, 8);
    corrupt[corrupt.length - 1] ^= 0xff;

    for (const data of [
      corrupt.toString("base64"),
      "not-base64",
      Buffer.from("not an image").toString("base64"),
    ]) {
      expect(() =>
        validateGeneratedImageQuality(
          { mimeType: "image/png", data },
          "1:1",
        ),
      ).toThrow();
    }
  });
});
