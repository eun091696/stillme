import { describe, expect, it } from "vitest";
import { readGeneratedImageDimensions } from "./image-dimensions";
import { jpegFixture, pngFixture } from "../../../tests/fixtures/generated-images";

describe("readGeneratedImageDimensions", () => {
  it("reads PNG dimensions from the header", () => {
    const image = pngFixture(20, 15);
    expect(readGeneratedImageDimensions({ mimeType: "image/png", data: image.toString("base64") })).toEqual({ width: 20, height: 15 });
  });

  it("reads JPEG dimensions from the start-of-frame marker", () => {
    const image = jpegFixture(1200, 1200);
    expect(readGeneratedImageDimensions({ mimeType: "image/jpeg", data: image.toString("base64") })).toEqual({ width: 1200, height: 1200 });
  });
});
