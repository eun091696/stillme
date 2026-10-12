import type { GoogleProviderDiagnostic } from "./google-adapter";

export function createGoogleProviderLogRecord(
  diagnostic: GoogleProviderDiagnostic,
) {
  return {
    schema_version: 1,
    timestamp: new Date().toISOString(),
    severity_text: "ERROR",
    service_name: "ai-photo-studio",
    deployment_environment: process.env.NODE_ENV ?? "development",
    event_name: "google_image_provider.failure",
    outcome: "failure",
    request_id: diagnostic.correlationId,
    http_status_code: diagnostic.httpStatus,
    error_code: diagnostic.failureCode,
    retryable: diagnostic.retryable,
    provider: "google",
    provider_error_code: diagnostic.googleErrorCode,
    provider_error_status: diagnostic.googleErrorStatus,
    provider_message: diagnostic.providerMessage,
    provider_request_id: diagnostic.providerRequestId,
    safety_block_reason: diagnostic.safetyBlockReason,
    model_id: diagnostic.modelId,
    operation_type: diagnostic.operationType,
    request_endpoint: diagnostic.requestShape?.endpoint ?? null,
    input_item_count: diagnostic.requestShape?.inputItemCount ?? null,
    input_item_types: diagnostic.requestShape?.inputItemTypes ?? null,
    image_mime_type: diagnostic.requestShape?.imageMimeType ?? null,
    image_base64_length: diagnostic.requestShape?.imageBase64Length ?? null,
    response_format: diagnostic.requestShape?.responseFormat ?? null,
  } as const;
}

export function logGoogleProviderDiagnostic(
  diagnostic: GoogleProviderDiagnostic,
) {
  console.error(JSON.stringify(createGoogleProviderLogRecord(diagnostic)));
}
