import {
  GoogleImageAdapterError,
  type GoogleImageAdapterErrorCode,
} from "./google-adapter";
import {
  detectGeneratedImageMimeType,
  ImageQualityError,
  type ImageQualityErrorCode,
  validateGeneratedImageQuality,
} from "./image-quality";
import { buildOriginalObjectKey } from "../storage/object-key";
import type {
  GeneratedImage,
  GenerationModelAdapter,
} from "./model";
import type { GenerationRequest } from "./validation";

export type GenerationPipelineErrorCode =
  | GoogleImageAdapterErrorCode
  | ImageQualityErrorCode
  | "PROVIDER_TIMEOUT"
  | "STORAGE_FAILED"
  | "PIPELINE_FAILED";

type StoredImageMetadata = {
  byteSize: number;
  checksumSha256: string;
  mimeType: GeneratedImage["mimeType"];
};

export type GenerationPipelineStorage = {
  storeImage(input: {
    key: string;
    image: GeneratedImage;
  }): Promise<StoredImageMetadata>;
  verifyImage(input: {
    key: string;
    byteSize: number;
    checksumSha256: string;
    mimeType: GeneratedImage["mimeType"];
  }): Promise<void>;
};

export type GenerationPipelineGateway = {
  allocateAsset(input: {
    assetId: string;
    key: string;
    mimeType: GeneratedImage["mimeType"];
  }): Promise<void>;
  markAssetUploading(): Promise<void>;
  markAssetValidating(input: {
    byteSize: number;
    checksumSha256: string;
    height: number;
    width: number;
  }): Promise<void>;
  markAssetAvailable(): Promise<void>;
  markAssetFailed(): Promise<void>;
  completeJob(): Promise<void>;
  failJob(errorCode: GenerationPipelineErrorCode): Promise<void>;
};

type ExecuteGenerationPipelineInput = {
  assetId: string;
  correlationId?: string;
  jobId: string;
  request: GenerationRequest;
  userId: string;
};

type ExecuteGenerationPipelineDependencies = {
  gateway: GenerationPipelineGateway;
  model: GenerationModelAdapter;
  storage: GenerationPipelineStorage;
  timeoutMs?: number;
  onDiagnostic?: (diagnostic: GenerationPipelineDiagnostic) => void;
};

export type GenerationPipelineStage =
  | "provider_response"
  | "quality_inspection"
  | "asset_allocation"
  | "storage_publish"
  | "storage_verification"
  | "job_completion";

export type GenerationPipelineDiagnostic = Readonly<{
  assetAllocationSucceeded: boolean;
  byteLength: number | null;
  correlationId: string | null;
  detectedMimeType: GeneratedImage["mimeType"] | null;
  failureCode: GenerationPipelineErrorCode | null;
  pipelineStage: GenerationPipelineStage;
  resultMimeType: GeneratedImage["mimeType"] | null;
  storagePublishSucceeded: boolean;
}>;

export type GenerationPipelineResult =
  | { status: "succeeded"; image: GeneratedImage }
  | { status: "failed"; errorCode: GenerationPipelineErrorCode }
  | {
      status: "reconciliation_required";
      errorCode: GenerationPipelineErrorCode;
    };

function classifyFailure(error: unknown): GenerationPipelineErrorCode {
  if (error instanceof GoogleImageAdapterError) {
    return error.code;
  }
  if (error instanceof ImageQualityError) {
    return error.code;
  }
  if (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return "PROVIDER_TIMEOUT";
  }
  if (error instanceof Error && error.message === "STORAGE_METADATA_MISMATCH") {
    return "STORAGE_FAILED";
  }
  return "PIPELINE_FAILED";
}

export async function executeGenerationPipeline(
  input: ExecuteGenerationPipelineInput,
  dependencies: ExecuteGenerationPipelineDependencies,
): Promise<GenerationPipelineResult> {
  let errorCode: GenerationPipelineErrorCode;
  let outputImage: GeneratedImage;
  let stage: GenerationPipelineStage = "provider_response";
  let resultMimeType: GeneratedImage["mimeType"] | null = null;
  let detectedMimeType: GeneratedImage["mimeType"] | null = null;
  let byteLength: number | null = null;
  let assetAllocationSucceeded = false;
  let storagePublishSucceeded = false;
  const emitDiagnostic = (failureCode: GenerationPipelineErrorCode | null) => {
    try {
      dependencies.onDiagnostic?.({
        assetAllocationSucceeded,
        byteLength,
        correlationId: input.correlationId ?? null,
        detectedMimeType,
        failureCode,
        pipelineStage: stage,
        resultMimeType,
        storagePublishSucceeded,
      });
    } catch {
      // Diagnostics must never replace a bounded pipeline result.
    }
  };

  try {
    const generated = await dependencies.model.generate(input.request, {
      signal: AbortSignal.timeout(dependencies.timeoutMs ?? 60_000),
    });
    outputImage = generated.image;
    resultMimeType = generated.image.mimeType;
    const decodedProviderImage = Buffer.from(generated.image.data, "base64");
    byteLength = decodedProviderImage.length;
    detectedMimeType = detectGeneratedImageMimeType(decodedProviderImage);
    stage = "quality_inspection";
    const quality = validateGeneratedImageQuality(
      generated.image,
      input.request.aspectRatio,
    );
    byteLength = quality.byteSize;
    detectedMimeType = quality.image.mimeType;
    const key = buildOriginalObjectKey({
      userId: input.userId,
      jobId: input.jobId,
      assetId: input.assetId,
      mimeType: quality.image.mimeType,
    });

    stage = "asset_allocation";
    await dependencies.gateway.allocateAsset({
      assetId: input.assetId,
      key,
      mimeType: quality.image.mimeType,
    });
    assetAllocationSucceeded = true;

    stage = "storage_publish";
    await dependencies.gateway.markAssetUploading();
    const stored = await dependencies.storage.storeImage({
      key,
      image: quality.image,
    });
    if (
      stored.byteSize !== quality.byteSize ||
      stored.checksumSha256 !== quality.checksumSha256 ||
      stored.mimeType !== quality.image.mimeType
    ) {
      throw new Error("STORAGE_METADATA_MISMATCH");
    }
    storagePublishSucceeded = true;

    stage = "storage_verification";
    await dependencies.gateway.markAssetValidating({
      byteSize: quality.byteSize,
      checksumSha256: quality.checksumSha256,
      height: quality.height,
      width: quality.width,
    });
    await dependencies.storage.verifyImage({
      key,
      byteSize: quality.byteSize,
      checksumSha256: quality.checksumSha256,
      mimeType: quality.image.mimeType,
    });
    await dependencies.gateway.markAssetAvailable();
  } catch (error) {
    errorCode = classifyFailure(error);
    emitDiagnostic(errorCode);
    let cleanupFailed = false;
    try {
      await dependencies.gateway.markAssetFailed();
    } catch {
      cleanupFailed = true;
    }
    try {
      await dependencies.gateway.failJob(errorCode);
    } catch {
      cleanupFailed = true;
    }
    if (cleanupFailed) {
      return { status: "reconciliation_required", errorCode };
    }
    return { status: "failed", errorCode };
  }

  try {
    stage = "job_completion";
    await dependencies.gateway.completeJob();
    emitDiagnostic(null);
    return { status: "succeeded", image: outputImage };
  } catch {
    return {
      status: "reconciliation_required",
      errorCode: "PIPELINE_FAILED",
    };
  }
}
