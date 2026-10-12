import type { GeneratedImage } from "./model";
import { inspectGeneratedImage } from "./image-quality";

export function readGeneratedImageDimensions(image: GeneratedImage) {
  try {
    const { width, height } = inspectGeneratedImage(image);
    return { width, height };
  } catch {
    return null;
  }
}
