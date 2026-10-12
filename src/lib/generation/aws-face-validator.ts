import "server-only";

import {
  CompareFacesCommand,
  RekognitionClient,
  type RekognitionClientConfig,
} from "@aws-sdk/client-rekognition";
import sharp from "sharp";

import type { GeneratedImage } from "./model";
import {
  SemanticValidationError,
  type IdentityImageValidator,
} from "./semantic-validation";

const MAX_REKOGNITION_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_FACE_EDGE = 1_600;

type RekognitionLikeClient = Pick<RekognitionClient, "send">;

type AwsFaceValidatorOptions = {
  region: string;
  client?: RekognitionLikeClient;
  normalizeImage?: (image: GeneratedImage) => Promise<Buffer>;
};

async function normalizeForFaceComparison(image: GeneratedImage) {
  let source: Buffer;
  try {
    source = Buffer.from(image.data, "base64");
    const normalized = await sharp(source, { failOn: "error" })
      .rotate()
      .resize({
        width: MAX_FACE_EDGE,
        height: MAX_FACE_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, chromaSubsampling: "4:2:0" })
      .toBuffer();
    if (normalized.length === 0 || normalized.length > MAX_REKOGNITION_IMAGE_BYTES) {
      throw new Error("REKOGNITION_IMAGE_SIZE_INVALID");
    }
    return normalized;
  } catch {
    throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
  }
}

type FaceMatch = { Similarity?: number; Face?: { BoundingBox?: { Left?: number; Top?: number; Width?: number; Height?: number } } };

function bestMatchBox(output: { FaceMatches?: FaceMatch[] }) {
  const best = [...(output.FaceMatches ?? [])].sort((a, b) => (b.Similarity ?? 0) - (a.Similarity ?? 0))[0];
  const b = best?.Face?.BoundingBox;
  if (!b || [b.Left, b.Top, b.Width, b.Height].some((v) => typeof v !== "number" || !Number.isFinite(v))) return null;
  return { left: b.Left as number, top: b.Top as number, width: b.Width as number, height: b.Height as number };
}

function highestSimilarity(output: {
  FaceMatches?: Array<{ Similarity?: number }>;
}) {
  const similarities = (output.FaceMatches ?? [])
    .map((match) => match.Similarity)
    .filter((value): value is number =>
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 100
    );
  if (similarities.length === 0) return 0;
  return Math.max(...similarities) / 100;
}

export function createAwsFaceValidator({
  region,
  client,
  normalizeImage = normalizeForFaceComparison,
}: AwsFaceValidatorOptions): IdentityImageValidator {
  if (!/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/u.test(region)) {
    throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
  }
  const rekognition = client ?? new RekognitionClient({ region } satisfies RekognitionClientConfig);

  return {
    async compare({ sourceImage, generatedImage, signal, onTargetFace }) {
      const [sourceBytes, generatedBytes] = await Promise.all([
        normalizeImage(sourceImage),
        normalizeImage(generatedImage),
      ]);

      try {
        const output = await rekognition.send(
          new CompareFacesCommand({
            SourceImage: { Bytes: sourceBytes },
            TargetImage: { Bytes: generatedBytes },
            SimilarityThreshold: 0,
            QualityFilter: "AUTO",
          }),
          { abortSignal: signal },
        );
        const box = bestMatchBox(output);
        if (box && onTargetFace) onTargetFace(box);
        return highestSimilarity(output);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "name" in error &&
          error.name === "InvalidParameterException"
        ) {
          return 0;
        }
        throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
      }
    },
  };
}
