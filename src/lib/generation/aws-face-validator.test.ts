import { CompareFacesCommand } from "@aws-sdk/client-rekognition";
import { describe, expect, it, vi } from "vitest";

import { jpegFixture } from "../../../tests/fixtures/generated-images";
import { createAwsFaceValidator } from "./aws-face-validator";
import { SemanticValidationError } from "./semantic-validation";

function image() {
  return {
    data: jpegFixture().toString("base64"),
    mimeType: "image/jpeg" as const,
  };
}

describe("createAwsFaceValidator", () => {
  it("normalizes both images and converts AWS similarity to a unit score", async () => {
    const send = vi.fn(async (command: CompareFacesCommand) => {
      expect(command.input.SimilarityThreshold).toBe(0);
      expect(command.input.QualityFilter).toBe("AUTO");
      expect(command.input.SourceImage?.Bytes).toBeInstanceOf(Uint8Array);
      expect(command.input.TargetImage?.Bytes).toBeInstanceOf(Uint8Array);
      return {
        FaceMatches: [{ Similarity: 91.5 }, { Similarity: 87 }],
      };
    });
    const validator = createAwsFaceValidator({
      region: "ap-northeast-2",
      client: { send } as never,
      normalizeImage: async () => Buffer.from("normalized"),
    });

    await expect(validator.compare({
      sourceImage: image(),
      generatedImage: image(),
    })).resolves.toBe(0.915);
    expect(send).toHaveBeenCalledOnce();
  });

  it("treats a valid no-match response as identity score zero", async () => {
    const validator = createAwsFaceValidator({
      region: "ap-northeast-2",
      client: { send: vi.fn(async () => ({ FaceMatches: [] })) } as never,
      normalizeImage: async () => Buffer.from("normalized"),
    });

    await expect(validator.compare({
      sourceImage: image(),
      generatedImage: image(),
    })).resolves.toBe(0);
  });

  it("treats a no-face provider response as a non-match", async () => {
    const validator = createAwsFaceValidator({
      region: "ap-northeast-2",
      client: {
        send: vi.fn(async () => {
          const error = new Error("no face");
          error.name = "InvalidParameterException";
          throw error;
        }),
      } as never,
      normalizeImage: async () => Buffer.from("normalized"),
    });

    await expect(validator.compare({
      sourceImage: image(),
      generatedImage: image(),
    })).resolves.toBe(0);
  });

  it("fails closed for AWS transport or credential failures", async () => {
    const validator = createAwsFaceValidator({
      region: "ap-northeast-2",
      client: {
        send: vi.fn(async () => {
          throw new Error("secret provider body");
        }),
      } as never,
      normalizeImage: async () => Buffer.from("normalized"),
    });

    await expect(validator.compare({
      sourceImage: image(),
      generatedImage: image(),
    })).rejects.toEqual(
      new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE"),
    );
  });

  it("rejects invalid regions before creating the provider client", () => {
    expect(() => createAwsFaceValidator({ region: "../unsafe" }))
      .toThrow(SemanticValidationError);
  });
});
