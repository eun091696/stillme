import type { GenerationPipelineDiagnostic } from "./orchestrator";

export function createGenerationPipelineLogRecord(
  diagnostic: GenerationPipelineDiagnostic,
) {
  return {
    schema_version: 1,
    timestamp: new Date().toISOString(),
    severity_text: diagnostic.failureCode ? "ERROR" : "INFO",
    service_name: "ai-photo-studio",
    deployment_environment: process.env.NODE_ENV ?? "development",
    event_name: "image_generation.pipeline",
    outcome: diagnostic.failureCode ? "failure" : "success",
    request_id: diagnostic.correlationId,
    pipeline_stage: diagnostic.pipelineStage,
    result_mime_type: diagnostic.resultMimeType,
    detected_mime_type: diagnostic.detectedMimeType,
    byte_length: diagnostic.byteLength,
    asset_allocation_succeeded: diagnostic.assetAllocationSucceeded,
    storage_publish_succeeded: diagnostic.storagePublishSucceeded,
    error_code: diagnostic.failureCode,
  } as const;
}

export function logGenerationPipelineDiagnostic(
  diagnostic: GenerationPipelineDiagnostic,
) {
  const record = createGenerationPipelineLogRecord(diagnostic);
  const serialized = JSON.stringify(record);
  if (diagnostic.failureCode) {
    console.error(serialized);
  } else {
    console.info(serialized);
  }
}
