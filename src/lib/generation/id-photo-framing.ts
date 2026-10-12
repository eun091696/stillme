import "server-only";

import sharp from "sharp";

import type { GeneratedImage } from "./model";

// Relative face box from AWS CompareFaces (0..1 of image width/height).
export type FaceBox = { left: number; top: number; width: number; height: number };

// ID photo framing target: face box height as a share of the image height, and where the face box starts.
// Candidates are generated independently, so the model picks a different camera distance each time.
// We only zoom in (crop) toward this target; a candidate whose face is already larger is left unchanged.
export const ID_FACE_HEIGHT_RATIO = 0.52;
export const ID_FACE_TOP_RATIO = 0.17;
export const ID_MAX_ZOOM = 1.5;

export type CropRect = { left: number; top: number; width: number; height: number };

export function computeIdPhotoCrop(box: FaceBox, imageWidth: number, imageHeight: number): CropRect | null {
  const valid = [box.left, box.top, box.width, box.height].every((v) => Number.isFinite(v))
    && box.width > 0 && box.height > 0 && imageWidth > 0 && imageHeight > 0;
  if (!valid) return null;
  const faceHeight = box.height * imageHeight;
  let cropHeight = faceHeight / ID_FACE_HEIGHT_RATIO;
  if (cropHeight >= imageHeight * 0.97) return null;
  cropHeight = Math.max(cropHeight, imageHeight / ID_MAX_ZOOM);
  const cropWidth = cropHeight * (imageWidth / imageHeight);
  const faceCenterX = (box.left + box.width / 2) * imageWidth;
  let left = faceCenterX - cropWidth / 2;
  let top = box.top * imageHeight - ID_FACE_TOP_RATIO * cropHeight;
  left = Math.min(Math.max(0, left), imageWidth - cropWidth);
  top = Math.min(Math.max(0, top), imageHeight - cropHeight);
  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.min(imageWidth, Math.round(cropWidth)),
    height: Math.min(imageHeight, Math.round(cropHeight)),
  };
}

// Returns a reframed image at the original pixel size, or the original image when no crop is needed or on error.
export async function normalizeIdPhotoFraming(image: GeneratedImage, box: FaceBox | null): Promise<{ image: GeneratedImage; applied: boolean }> {
  if (!box) return { image, applied: false };
  try {
    const input = Buffer.from(image.data, "base64");
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height) return { image, applied: false };
    const crop = computeIdPhotoCrop(box, meta.width, meta.height);
    if (!crop) return { image, applied: false };
    const pipeline = sharp(input).extract(crop).resize(meta.width, meta.height, { kernel: "lanczos3" });
    const output = image.mimeType === "image/png"
      ? await pipeline.png().toBuffer()
      : image.mimeType === "image/webp"
        ? await pipeline.webp({ quality: 95 }).toBuffer()
        : await pipeline.jpeg({ quality: 95 }).toBuffer();
    return { image: { data: output.toString("base64"), mimeType: image.mimeType }, applied: true };
  } catch {
    return { image, applied: false };
  }
}
