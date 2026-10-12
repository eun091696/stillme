"use server";

import { createHash, randomUUID } from "node:crypto";

import { isPhotoServicePresetId } from "@/app/photo-services";
import {
  getAwsFaceEnvironment,
  getGoogleImageEnvironment,
  isGenerationServiceConfigured,
  isGenerationTestMode,
  isImageCreditBypassEnabled,
} from "@/lib/generation/config";
import { grantNewUserPromotion } from "@/lib/credits/new-user-promotion";
import {
  CREDIT_POLICY_VERSION,
  GENERATION_CREDIT_COST,
  INITIAL_CANDIDATE_COUNT,
} from "@/lib/generation/credit-policy";
import {
  createGoogleImageAdapter,
  GoogleImageAdapterError,
} from "@/lib/generation/google-adapter";
import { createAwsFaceValidator } from "@/lib/generation/aws-face-validator";
import { createGoogleSkinValidator } from "@/lib/generation/google-skin-validator";
import { normalizeIdPhotoFraming, type FaceBox } from "@/lib/generation/id-photo-framing";
import {
  createNewServiceValidator,
  isNewServicePresetId,
} from "@/lib/generation/new-service-validator";
import {
  ImageQualityError,
  validateGeneratedImageQuality,
} from "@/lib/generation/image-quality";
import { getGenerationModelVersion } from "@/lib/generation/model";
import {
  executeGenerationPipeline,
  type GenerationPipelineGateway,
} from "@/lib/generation/orchestrator";
import { validateGenerationRequest } from "@/lib/generation/validation";
import { logGoogleProviderDiagnostic } from "@/lib/generation/provider-diagnostics";
import { logGenerationPipelineDiagnostic } from "@/lib/generation/pipeline-diagnostics";
import {
  appendSemanticRetryGuidance,
  createSemanticImageValidator,
  SemanticValidationError,
  type SemanticQualityRejectionReason,
  type SemanticStageDiagnostic,
} from "@/lib/generation/semantic-validation";
import {
  AdditionalRequestValidationError,
  buildCandidatePrompt,
  getBusinessProfileStyle,
  normalizeAdditionalRequest,
  normalizeProfession,
  ProfessionValidationError,
} from "@/lib/prompts";
import { getProfileCategory } from "@/lib/prompts/business-profile/category-config";
import { createGenerationStorageFromEnvironment } from "@/lib/storage/generation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const TEST_CREDIT_AMOUNT = 100;
const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_SOURCE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const DEFAULT_RESOLUTION = "1K" as const;
const MAX_QUALITY_REPLACEMENT_CALLS = 2;

export type GenerateImageErrorCode =
  | "AUTH_REQUIRED"
  | "INVALID_PRESET"
  | "INVALID_SOURCE_IMAGE"
  | "ADDITIONAL_REQUEST_REJECTED"
  | "PROFESSION_REQUIRED"
  | "PROFESSION_INVALID"
  | "INVALID_GENERATION_OPTIONS"
  | "SERVICE_UNAVAILABLE"
  | "INSUFFICIENT_CREDIT"
  | "REQUEST_OUTDATED"
  | "REQUEST_FAILED"
  | "PROVIDER_INVALID_REQUEST"
  | "PROVIDER_AUTHENTICATION_FAILED"
  | "PROVIDER_ACCESS_DENIED"
  | "PROVIDER_MODEL_NOT_FOUND"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_REJECTED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_RESPONSE_INVALID"
  | "PROVIDER_TIMEOUT"
  | "SEMANTIC_VALIDATION_FAILED"
  | "SEMANTIC_VALIDATION_UNAVAILABLE"
  | "POST_PROCESSING_FAILED"
  | "ASSET_STORAGE_FAILED"
  | "GENERATION_FAILED";

export type GenerateImageState = {
  error: GenerateImageErrorCode | null;
  result: {
    productionId: string;
    candidates: Array<{
      assetId: string;
      image: {
        data: string;
        mimeType: "image/jpeg" | "image/png" | "image/webp";
      };
    }>;
    generatedImageCount: number;
  } | null;
};

type AdminClient = ReturnType<typeof createAdminClient>;

type HairValidationDiagnostic = Pick<SemanticStageDiagnostic, "validator" | "status" | "score" | "threshold" | "reasonCode"> | {
  validator: "image-structure";
  status: "pass" | "fail";
  score: null;
  threshold: null;
  reasonCode: ImageQualityError["code"] | null;
};

function logHairValidationDiagnostic(
  requestId: string,
  promptVersion: string,
  candidate: number,
  generationCall: number,
  diagnostic: HairValidationDiagnostic,
) {
  if (process.env.NODE_ENV !== "development") return;
  // Allowlisted, bounded fields only: no image bytes, prompt, provider payload or user identity.
  try {
    console.info(JSON.stringify({
      schema_version: 1,
      timestamp: new Date().toISOString(),
      event_name: "hair_designer.validation",
      request_id: requestId,
      prompt_version: promptVersion,
      candidate,
      generation_call: generationCall,
      validator: diagnostic.validator,
      status: diagnostic.status,
      score: diagnostic.score,
      threshold: diagnostic.threshold,
      score_unit: diagnostic.score === null ? null : "0..1",
      failure_reason: diagnostic.reasonCode,
    }));
  } catch { /* diagnostics cannot affect generation */ }
}

// Production-safe timing telemetry: durations and bounded codes only (no scores, prompts, images or user identity).
function logGenerationTiming(event: {
  requestId: string;
  presetId: string;
  promptVersion: string;
  candidate: number | null;
  generationCall: number;
  outcome: string;
  reason: string | null;
  generateMs: number | null;
  validateMs: number | null;
  persistMs: number | null;
  totalMs: number;
}) {
  try {
    console.info(JSON.stringify({
      schema_version: 1,
      timestamp: new Date().toISOString(),
      severity_text: "INFO",
      service_name: "ai-photo-studio",
      deployment_environment: process.env.NODE_ENV ?? "development",
      event_name: event.candidate === null ? "image_generation.production_timing" : "image_generation.candidate_timing",
      request_id: event.requestId,
      preset_id: event.presetId,
      prompt_version: event.promptVersion,
      candidate: event.candidate,
      generation_call: event.generationCall,
      outcome: event.outcome,
      reason_code: event.reason,
      generate_ms: event.generateMs,
      validate_ms: event.validateMs,
      persist_ms: event.persistMs,
      total_ms: event.totalMs,
    }));
  } catch { /* telemetry cannot affect generation */ }
}

function logCreditRecoveryRequired(operation: "cancel" | "fail") {
  console.error(JSON.stringify({
    schema_version: 1,
    timestamp: new Date().toISOString(),
    severity_text: "ERROR",
    service_name: "ai-photo-studio",
    deployment_environment: process.env.NODE_ENV ?? "development",
    event_name: "generation_credit.reconciliation_required",
    outcome: "failure",
    operation,
    error_code: "CREDIT_RELEASE_DEFERRED",
  }));
}

async function failReservedGeneration(
  admin: AdminClient,
  jobId: string,
  reservationId: string,
  reasonCode: string,
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error } = await admin.rpc("fail_generation_request", {
      target_generation_job_id: jobId,
      target_reservation_id: reservationId,
      failure_reason_code: reasonCode,
    });
    if (!error) return true;
  }
  logCreditRecoveryRequired("fail");
  return false;
}

async function cancelReservedGeneration(
  admin: AdminClient,
  jobId: string,
  reservationId: string,
  reasonCode: string,
) {
  const { error } = await admin.rpc("cancel_generation_request", {
    target_generation_job_id: jobId,
    target_reservation_id: reservationId,
    cancellation_reason_code: reasonCode,
  });
  if (error) logCreditRecoveryRequired("cancel");
  return !error;
}

function assertMutation(error: { message: string } | null) {
  if (error) {
    throw new Error("GENERATION_STATE_MUTATION_FAILED");
  }
}

async function grantTestCredits(admin: AdminClient, userId: string) {
  if (!isGenerationTestMode() && !isImageCreditBypassEnabled()) {
    return;
  }

  const { error } = await admin.from("credit_ledger_entries").upsert(
    {
      user_id: userId,
      transaction_type: "trial_grant",
      amount: TEST_CREDIT_AMOUNT,
      idempotency_key: userId,
      policy_version: "test-v1",
      reference_id: userId,
      reason_code: "TEST_MODE_GRANT",
    },
    { onConflict: "user_id,idempotency_key", ignoreDuplicates: true },
  );
  assertMutation(error);
}

function validateSourceImage(value: FormDataEntryValue | null) {
  if (
    !(value instanceof File) ||
    value.size === 0 ||
    value.size > MAX_SOURCE_IMAGE_BYTES ||
    !ALLOWED_SOURCE_TYPES.has(value.type)
  ) {
    return null;
  }

  return value as File & {
    type: "image/jpeg" | "image/png" | "image/webp";
  };
}

function mapPipelineFailure(code: string): GenerateImageErrorCode {
  if (
    code === "PROVIDER_INVALID_REQUEST" ||
    code === "PROVIDER_AUTHENTICATION_FAILED" ||
    code === "PROVIDER_ACCESS_DENIED" ||
    code === "PROVIDER_MODEL_NOT_FOUND" ||
    code === "PROVIDER_RATE_LIMITED" ||
    code === "PROVIDER_REJECTED" ||
    code === "PROVIDER_UNAVAILABLE" ||
    code === "PROVIDER_RESPONSE_INVALID" ||
    code === "PROVIDER_TIMEOUT"
  ) {
    return code;
  }
  if (code === "STORAGE_FAILED") {
    return "ASSET_STORAGE_FAILED";
  }
  if (code.startsWith("IMAGE_")) {
    return "POST_PROCESSING_FAILED";
  }
  return "GENERATION_FAILED";
}

export async function generateImage(
  _previous: GenerateImageState,
  formData: FormData,
): Promise<GenerateImageState> {
  const presetId = formData.get("presetId");
  const sourceImage = validateSourceImage(formData.get("sourceImage"));
  if (!isPhotoServicePresetId(presetId)) {
    return { error: "INVALID_PRESET", result: null };
  }
  if (!sourceImage) {
    return { error: "INVALID_SOURCE_IMAGE", result: null };
  }

  // A productionId only comes from an outdated client page; reject before Credit or generation.
  if (formData.get("productionId") !== null) {
    return { error: "REQUEST_OUTDATED", result: null };
  }

  const categoryEntry = formData.get("categoryId");
  const lookEntry = formData.get("lookId");
  const hairStyleEntry = formData.get("hairStyleId");
  const profileOutfitEntry = formData.get("profileOutfitId");
  const idBackgroundEntry = formData.get("idBackgroundId");
  const idOutfitEntry = formData.get("idOutfitId");
  const idTieEntry = formData.get("idTieId");
  const characterStyleEntry = formData.get("characterStyleId");
  const characterOutfitEntry = formData.get("characterOutfitId");
  const characterBackgroundEntry = formData.get("characterBackgroundId");
  const profileCategory = getProfileCategory(categoryEntry);
  if ([categoryEntry, lookEntry, hairStyleEntry, profileOutfitEntry, idBackgroundEntry, idOutfitEntry, idTieEntry, characterStyleEntry, characterOutfitEntry, characterBackgroundEntry].some((entry) => entry !== null && typeof entry !== "string") ||
    (categoryEntry !== null && (!profileCategory || presetId !== profileCategory.presetId))) {
    return { error: "INVALID_GENERATION_OPTIONS", result: null };
  }
  const styleEntry = formData.get("style");
  if (
    (styleEntry !== null && typeof styleEntry !== "string") ||
    (presetId !== "business-profile" && styleEntry !== null) ||
    (presetId === "business-profile" &&
      styleEntry !== null &&
      !getBusinessProfileStyle(styleEntry))
  ) {
    return { error: "INVALID_GENERATION_OPTIONS", result: null };
  }
  const style = typeof styleEntry === "string" ? styleEntry : null;

  let additionalRequest: string | null;
  let profession: string | null = null;
  try {
    additionalRequest = normalizeAdditionalRequest(
      formData.get("additionalRequest"),
    );
    if (presetId === "business-profile") {
      profession = normalizeProfession(formData.get("profession"));
    }
  } catch (error) {
    if (error instanceof ProfessionValidationError) {
      return {
        error: error.code === "REQUIRED" ? "PROFESSION_REQUIRED" : "PROFESSION_INVALID",
        result: null,
      };
    }
    if (error instanceof AdditionalRequestValidationError) {
      return { error: "ADDITIONAL_REQUEST_REJECTED", result: null };
    }
    return { error: "ADDITIONAL_REQUEST_REJECTED", result: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "AUTH_REQUIRED", result: null };
  }
  if (!isNewServicePresetId(presetId) && !isGenerationServiceConfigured()) {
    return { error: "SERVICE_UNAVAILABLE", result: null };
  }

  const candidateSlots = [1, 2, 3];
  let candidatePrompts: ReturnType<typeof buildCandidatePrompt>[];
  try {
    candidatePrompts = candidateSlots.map((slot) => {
      const outfit = formData.get(`candidateOutfit${slot}`);
      const background = formData.get(`candidateBackground${slot}`);
      const customRequest = formData.get(`candidateRequest${slot}`);
      if (
        (outfit !== null && typeof outfit !== "string") ||
        (background !== null && typeof background !== "string") ||
        (customRequest !== null && typeof customRequest !== "string")
      ) {
        throw new Error("INVALID_CANDIDATE_OPTIONS");
      }
      if (presetId !== "business-profile" && outfit !== null) {
        throw new Error("INVALID_CANDIDATE_OPTIONS");
      }
      return buildCandidatePrompt({
        presetId,
        model: "flash",
        additionalRequest: additionalRequest ?? undefined,
        styleId: style ?? undefined,
        categoryId: typeof categoryEntry === "string" ? categoryEntry : undefined,
        lookId: typeof lookEntry === "string" ? lookEntry : undefined,
        hairStyleId: typeof hairStyleEntry === "string" ? hairStyleEntry : undefined,
        profileOutfitId: typeof profileOutfitEntry === "string" ? profileOutfitEntry : undefined,
        idBackgroundId: typeof idBackgroundEntry === "string" ? idBackgroundEntry : undefined,
        idOutfitId: typeof idOutfitEntry === "string" ? idOutfitEntry : undefined,
        idTieId: typeof idTieEntry === "string" ? idTieEntry : undefined,
        characterStyleId: typeof characterStyleEntry === "string" ? characterStyleEntry : undefined,
        characterOutfitId: typeof characterOutfitEntry === "string" ? characterOutfitEntry : undefined,
        characterBackgroundId: typeof characterBackgroundEntry === "string" ? characterBackgroundEntry : undefined,
        outfitId: outfit ?? undefined,
        backgroundId: background ?? undefined,
        customRequest: customRequest ?? undefined,
        profession: profession ?? undefined,
      });
    });
  } catch (error) {
    if (error instanceof AdditionalRequestValidationError) {
      return { error: "ADDITIONAL_REQUEST_REJECTED", result: null };
    }
    return { error: "INVALID_GENERATION_OPTIONS", result: null };
  }
  const prompt = candidatePrompts[0];
  const outputAspectRatio = presetId === "character-avatar"
    ? "4:5"
    : presetId === "resume-id"
      ? "3:4"
      : "1:1";
  const jobRequest = await validateGenerationRequest({
    prompt: prompt.promptId,
    style: "photographic",
    aspectRatio: outputAspectRatio,
  });
  if (!jobRequest.success) {
    return { error: "REQUEST_FAILED", result: null };
  }

  const sourceBytes = Buffer.from(await sourceImage.arrayBuffer());
  const sourceAssetReference = `sha256:${createHash("sha256")
    .update(sourceBytes)
    .digest("hex")}`;
  const source = {
    data: sourceBytes.toString("base64"),
    mimeType: sourceImage.type,
  };
  const modelVersion = getGenerationModelVersion("flash", DEFAULT_RESOLUTION);
  const requestId = randomUUID();
  const admin = createAdminClient();

  try {
    const promotion = await grantNewUserPromotion(user);
    if (!promotion.granted && promotion.reason === "GRANT_FAILED") {
      console.error(JSON.stringify({
        event_name: "new_user_promotion.grant_failed",
        error_code: "PROMOTION_GRANT_FAILED",
      }));
    }
    await grantTestCredits(admin, user.id);
  } catch {
    return { error: "REQUEST_FAILED", result: null };
  }

  const candidateCount = INITIAL_CANDIDATE_COUNT;

  const { data: createdRows, error: createError } = await admin.rpc(
    "create_generation_request",
    {
      request_user_id: user.id,
      request_idempotency_key: requestId,
      request_prompt: prompt.promptId,
      request_style: jobRequest.data.style,
      request_aspect_ratio: jobRequest.data.aspectRatio,
      request_model_id: modelVersion.id,
      request_provider_model: modelVersion.providerModel,
      request_adapter_version: modelVersion.adapterVersion,
      request_prompt_template_version: modelVersion.promptTemplateVersion,
      request_credit_amount: GENERATION_CREDIT_COST,
      request_credit_policy_version: CREDIT_POLICY_VERSION,
      request_prompt_id: prompt.promptId,
      request_prompt_version: prompt.promptVersion,
      request_prompt_modules: prompt.modules,
      request_model_key: "flash",
      request_resolution: DEFAULT_RESOLUTION,
      request_source_image_key: sourceAssetReference,
    },
  );
  if (createError) {
    if (createError.message.includes("available credit balance is insufficient")) {
      return { error: "INSUFFICIENT_CREDIT", result: null };
    }
    return { error: "REQUEST_FAILED", result: null };
  }
  const created = Array.isArray(createdRows) ? createdRows[0] : null;
  if (
    !created ||
    typeof created.generation_job_id !== "string" ||
    typeof created.reservation_id !== "string"
  ) {
    return { error: "REQUEST_FAILED", result: null };
  }
  const jobId: string = created.generation_job_id;
  const createdReservationId: string = created.reservation_id;
  const reservationId: string | null = createdReservationId;
  const { error: startError } = await admin.rpc("start_generation_request", {
    target_generation_job_id: jobId,
    target_reservation_id: createdReservationId,
  });
  if (startError) {
    await cancelReservedGeneration(
      admin,
      jobId,
      createdReservationId,
      "REQUEST_START_FAILED",
    );
    return { error: "REQUEST_FAILED", result: null };
  }

  let googleEnvironment: ReturnType<typeof getGoogleImageEnvironment>;
  let awsFaceEnvironment: ReturnType<typeof getAwsFaceEnvironment> | null = null;
  try {
    googleEnvironment = getGoogleImageEnvironment();
    if (!isNewServicePresetId(presetId)) {
      awsFaceEnvironment = getAwsFaceEnvironment();
    }
  } catch {
    if (reservationId) {
      await failReservedGeneration(
        admin,
        jobId,
        reservationId,
        "PIPELINE_FAILED",
      );
    }
    return { error: "SERVICE_UNAVAILABLE", result: null };
  }

  let googleAdapter: ReturnType<typeof createGoogleImageAdapter>;
  let semanticValidator: ReturnType<typeof createSemanticImageValidator> | null = null;
  let newServiceValidator: ReturnType<typeof createNewServiceValidator> | null = null;
  let storage: ReturnType<typeof createGenerationStorageFromEnvironment>;
  try {
    googleAdapter = createGoogleImageAdapter({
      apiKey: googleEnvironment.apiKey,
      correlationId: requestId,
      model: modelVersion,
      onDiagnostic: logGoogleProviderDiagnostic,
      transport: "interactions",
    });
    if (isNewServicePresetId(presetId)) {
      newServiceValidator = createNewServiceValidator({
        service: presetId,
        apiKey: googleEnvironment.apiKey,
        model: googleEnvironment.validationModel,
        characterStyleId: presetId === "character-avatar" ? prompt.characterStyleId : undefined,
        characterOutfitId: presetId === "character-avatar" ? prompt.characterOutfitId : undefined,
      });
    } else if (awsFaceEnvironment) {
      semanticValidator = createSemanticImageValidator({
        identityValidator: createAwsFaceValidator({
          region: awsFaceEnvironment.region,
        }),
        skinValidator: createGoogleSkinValidator({
          apiKey: googleEnvironment.apiKey,
          model: googleEnvironment.validationModel,
        }),
      });
    } else {
      throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
    }
    storage = createGenerationStorageFromEnvironment();
  } catch {
    if (reservationId) {
      await failReservedGeneration(
        admin,
        jobId,
        reservationId,
        "PIPELINE_FAILED",
      );
    }
    return { error: "SERVICE_UNAVAILABLE", result: null };
  }
  type Candidate = NonNullable<GenerateImageState["result"]>["candidates"][number];
  const candidateSlotResults: Array<Candidate | null> = Array.from({ length: candidateCount }, () => null);
  const assetIds: string[] = [];
  const maximumGenerationCalls = candidateCount + MAX_QUALITY_REPLACEMENT_CALLS;
  let generationCallCount = 0;
  let failureCode: GenerateImageErrorCode | null = null;
  let failureReasonCode: string | null = null;
  const productionStartedAt = Date.now();
  const recordFailure = (code: GenerateImageErrorCode, reason: string) => {
    if (failureCode) return;
    failureCode = code;
    failureReasonCode = reason;
  };

  // Candidate slots run concurrently; each slot retries on its own while sharing one call budget.
  const runCandidateSlot = async (slot: number) => {
    let retryReason: SemanticQualityRejectionReason | null = null;
    let newServiceRetryPending = false;
    while (!failureCode && generationCallCount < maximumGenerationCalls) {
      const basePrompt = candidatePrompts[slot].prompt;
      const candidatePrompt = retryReason
        ? appendSemanticRetryGuidance(basePrompt, retryReason, {
            allowExplicitHairChange:
              categoryEntry === "hair-designer-profile" &&
              typeof hairStyleEntry === "string" &&
              hairStyleEntry !== "current",
          })
        : newServiceRetryPending
          ? `${basePrompt}\n\n[품질 재생성 지침]\n직전 결과는 이 서비스의 원본 충실도 기준을 통과하지 못했습니다. 원본의 인물·장면 특징을 유지하면서 선택한 수중 보정 또는 캐릭터 스타일 요구사항만 정확히 수행하세요.`
          : basePrompt;
      generationCallCount += 1;
      const callNumber = generationCallCount;
      const timing = { callStartedAt: Date.now(), generateMs: null as number | null, validateMs: null as number | null };
      const logCall = (outcome: string, reason: string | null, persistMs: number | null = null) => logGenerationTiming({
        requestId, presetId, promptVersion: prompt.promptVersion, candidate: slot + 1, generationCall: callNumber,
        outcome, reason, generateMs: timing.generateMs, validateMs: timing.validateMs, persistMs,
        totalMs: Date.now() - timing.callStartedAt,
      });
      const onHairDiagnostic = categoryEntry === "hair-designer-profile" && process.env.NODE_ENV === "development"
        ? (diagnostic: HairValidationDiagnostic) => logHairValidationDiagnostic(
            requestId, prompt.promptVersion, slot + 1, callNumber, diagnostic,
          )
        : null;

      let generated: Awaited<ReturnType<typeof googleAdapter.generate>>;
      try {
        generated = await googleAdapter.generate(
          {
            prompt: candidatePrompt,
            style: "photographic",
            aspectRatio: outputAspectRatio,
          },
          {
            resolution: DEFAULT_RESOLUTION,
            signal: AbortSignal.timeout(120_000),
            sourceImage: source,
          },
        );
        timing.generateMs = Date.now() - timing.callStartedAt;
        const validationStartedAt = Date.now();
        validateGeneratedImageQuality(generated.image, jobRequest.data.aspectRatio);
        onHairDiagnostic?.({ validator: "image-structure", status: "pass", score: null, threshold: null, reasonCode: null });
        if (newServiceValidator) {
          const validationResult = await newServiceValidator.validate({
            sourceImage: source,
            generatedImage: generated.image,
            signal: AbortSignal.timeout(30_000),
          });
          timing.validateMs = Date.now() - validationStartedAt;
          if (validationResult.status === "rejected") {
            logCall("rejected", "NEW_SERVICE_VALIDATION_REJECTED");
            newServiceRetryPending = true;
            continue;
          }
        } else if (semanticValidator) {
          let targetFace: FaceBox | null = null;
          const semanticResult = await semanticValidator.validate({
            sourceImage: source,
            generatedImage: generated.image,
            signal: AbortSignal.timeout(30_000),
            onTargetFace: (box) => { targetFace = box; },
          }, onHairDiagnostic ?? undefined);
          timing.validateMs = Date.now() - validationStartedAt;
          if (semanticResult.status === "rejected") {
            logCall("rejected", semanticResult.reasonCode);
            retryReason = semanticResult.reasonCode;
            continue;
          }
          // ID candidates are generated independently, so align the face size and position across them.
          if (presetId === "resume-id") {
            const framed = await normalizeIdPhotoFraming(generated.image, targetFace);
            if (framed.applied) generated = { ...generated, image: framed.image };
          }
        } else {
          throw new SemanticValidationError("SEMANTIC_VALIDATION_UNAVAILABLE");
        }
      } catch (error) {
        if (error instanceof ImageQualityError) {
          onHairDiagnostic?.({ validator: "image-structure", status: "fail", score: null, threshold: null, reasonCode: error.code });
          logCall("rejected", error.code);
          retryReason = "IDENTITY_AND_SKIN_FAILURE";
          continue;
        }
        if (error instanceof GoogleImageAdapterError) {
          recordFailure(mapPipelineFailure(error.code), error.code);
          logCall("failed", error.code);
        } else if (error instanceof SemanticValidationError) {
          recordFailure(error.code, error.code);
          logCall("failed", error.code);
        } else {
          recordFailure("GENERATION_FAILED", "PIPELINE_FAILED");
          logCall("failed", "PIPELINE_FAILED");
        }
        return;
      }
      // Another slot already failed the production; do not store more assets.
      if (failureCode) return;

      retryReason = null;
      newServiceRetryPending = false;
      const persistStartedAt = Date.now();
        const assetId = randomUUID();
        const gateway: GenerationPipelineGateway = {
          async allocateAsset({ key, mimeType }) {
            const { error } = await admin.from("assets").insert({
              id: assetId,
              generation_job_id: jobId,
              user_id: user.id,
              storage_key: key,
              mime_type: mimeType,
            });
            assertMutation(error);
          },
          async markAssetUploading() {
            const { error } = await admin.from("assets").update({ status: "uploading" })
              .eq("id", assetId).eq("generation_job_id", jobId);
            assertMutation(error);
          },
          async markAssetValidating(metadata) {
            const { error } = await admin.from("assets").update({
              status: "validating",
              byte_size: metadata.byteSize,
              checksum_sha256: metadata.checksumSha256,
              height: metadata.height,
              width: metadata.width,
            }).eq("id", assetId).eq("generation_job_id", jobId);
            assertMutation(error);
          },
          async markAssetAvailable() {
            // All candidates become visible together after the batch succeeds.
          },
          async markAssetFailed() {
            const { error } = await admin.from("assets").update({ status: "failed" })
              .eq("id", assetId).eq("generation_job_id", jobId)
              .in("status", ["allocated", "uploading", "validating"]);
            assertMutation(error);
          },
          async completeJob() {
            // Credit settlement happens once after all initial candidates succeed.
          },
          async failJob(errorCode) {
            if (!reservationId) return;
            const { error } = await admin.rpc("fail_generation_request", {
              target_generation_job_id: jobId,
              target_reservation_id: reservationId,
              failure_reason_code: errorCode,
            });
            assertMutation(error);
          },
        };
        const result = await executeGenerationPipeline(
          { assetId, correlationId: requestId, jobId, request: jobRequest.data, userId: user.id },
          {
            gateway,
            model: {
              model: modelVersion,
              generate: async () => generated,
            },
            storage,
            timeoutMs: 120_000,
            onDiagnostic: logGenerationPipelineDiagnostic,
          },
        );
      if (result.status !== "succeeded") {
        recordFailure(mapPipelineFailure(result.errorCode), result.errorCode);
        logCall("failed", result.errorCode, Date.now() - persistStartedAt);
        return;
      }
      assetIds.push(assetId);
      candidateSlotResults[slot] = { assetId, image: result.image };
      logCall("accepted", null, Date.now() - persistStartedAt);
      return;
    }
  };

  await Promise.all(candidateSlotResults.map((_, slot) => runCandidateSlot(slot)));
  const candidates = candidateSlotResults.filter((candidate): candidate is Candidate => candidate !== null);

  if (!failureCode && candidates.length < candidateCount) {
    failureCode = "SEMANTIC_VALIDATION_FAILED";
    failureReasonCode = "SEMANTIC_VALIDATION_FAILED";
  }
  logGenerationTiming({
    requestId, presetId, promptVersion: prompt.promptVersion, candidate: null, generationCall: generationCallCount,
    outcome: failureCode ? "production_failed" : "production_succeeded", reason: failureReasonCode,
    generateMs: null, validateMs: null, persistMs: null, totalMs: Date.now() - productionStartedAt,
  });

  if (failureCode) {
    if (reservationId && failureReasonCode) {
      await failReservedGeneration(
        admin,
        jobId,
        reservationId,
        failureReasonCode,
      );
    }
    if (assetIds.length > 0) {
      await admin.from("assets").update({ status: "failed" })
        .in("id", assetIds).eq("generation_job_id", jobId)
        .eq("status", "validating");
    }
    return { error: failureCode, result: null };
  }

  const generatedImageCount = candidates.length;
  const { error: completeError } = await admin.rpc(
    "complete_generation_candidate_batch",
    {
      target_asset_ids: assetIds,
      target_generated_image_count: generatedImageCount,
      target_generation_job_id: jobId,
      target_reservation_id: reservationId,
      target_user_id: user.id,
    },
  );
  if (completeError) {
    if (reservationId) {
      await failReservedGeneration(
        admin,
        jobId,
        reservationId,
        "BATCH_COMPLETION_FAILED",
      );
    }
    await admin.from("assets").update({ status: "failed" })
      .in("id", assetIds).eq("generation_job_id", jobId)
      .eq("status", "validating");
    return { error: "REQUEST_FAILED", result: null };
  }

  return {
    error: null,
    result: {
      productionId: jobId,
      candidates,
      generatedImageCount,
    },
  };
}
