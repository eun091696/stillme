"use server";

import { createHash, randomUUID } from "node:crypto";
import type { PhotoServicePresetId } from "@/app/photo-services";
import { getGoogleImageEnvironment, isImageCreditBypassEnabled } from "@/lib/generation/config";
import { readGeneratedImageDimensions } from "@/lib/generation/image-dimensions";
import { getGenerationModelVersion, type GenerationModelKey, type GenerationResolution } from "@/lib/generation/model";
import { runPromptedGeneration } from "@/lib/generation/prompted-generation";
import { validateGenerationRequest } from "@/lib/generation/validation";
import { getPromptPreset, getRuntimePrompt } from "@/lib/prompts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ImageGenerationState = { error: string | null; result: { promptId: string; promptVersion: string; providerModel: string; generationTimeMs: number; image: { data: string; mimeType: string }; width: number | null; height: number | null } | null };
const EMPTY_STATE: ImageGenerationState = { error: null, result: null };
const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_SOURCE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function generateWithPromptEngine(_previous: ImageGenerationState = EMPTY_STATE, formData: FormData): Promise<ImageGenerationState> {
  void _previous;
  if (process.env.NODE_ENV !== "development") return { error: "DEV_ONLY", result: null };
  if (!isImageCreditBypassEnabled()) return { error: "IMAGE_CREDIT_BYPASS_REQUIRED", result: null };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "AUTH_REQUIRED", result: null };
  const model = formData.get("model");
  const resolution = formData.get("resolution");
  if ((model !== "flash" && model !== "pro") || (resolution !== "1K" && resolution !== "2K" && resolution !== "4K")) return { error: "INVALID_MODEL_OR_RESOLUTION", result: null };
  const presetId = formData.get("presetId");
  const source = formData.get("sourceImage");
  if (typeof presetId !== "string" || !(source instanceof File) || !ALLOWED_SOURCE_TYPES.has(source.type) || source.size === 0 || source.size > MAX_SOURCE_IMAGE_BYTES) return { error: "INVALID_SOURCE_IMAGE_OR_PRESET", result: null };
  let preset: ReturnType<typeof getPromptPreset>;
  try { preset = getPromptPreset(presetId as never); } catch { return { error: "INVALID_PRESET", result: null }; }
  const runtimePrompt = getRuntimePrompt(preset.runtimePromptId);
  const request = await validateGenerationRequest({ prompt: "service prompt", style: "photographic", aspectRatio: "1:1" });
  if (!request.success) return { error: "REQUEST_VALIDATION_FAILED", result: null };
  const environment = getGoogleImageEnvironment();
  if (!environment.apiKey) return { error: "GOOGLE_AI_API_KEY_MISSING", result: null };
  const admin = createAdminClient();
  await admin.from("credit_ledger_entries").upsert({ user_id: user.id, transaction_type: "trial_grant", amount: 100, idempotency_key: user.id, policy_version: "prompt-engine-test-v1", reference_id: user.id, reason_code: "TEST_MODE_GRANT" }, { onConflict: "user_id,idempotency_key", ignoreDuplicates: true });
  const modelVersion = getGenerationModelVersion(model as GenerationModelKey, resolution as GenerationResolution);
  const promptMarker = preset.promptId;
  const sourceBytes = Buffer.from(await source.arrayBuffer());
  const sourceAssetReference = `sha256:${createHash("sha256").update(sourceBytes).digest("hex")}`;
  const requestId = randomUUID();
  const { data: rows, error: createError } = await admin.rpc("create_generation_request", {
    request_user_id: user.id,
    request_idempotency_key: requestId,
    request_prompt: promptMarker,
    request_style: "photographic",
    request_aspect_ratio: "1:1",
    request_model_id: modelVersion.id,
    request_provider_model: modelVersion.providerModel,
    request_adapter_version: modelVersion.adapterVersion,
    request_prompt_template_version: modelVersion.promptTemplateVersion,
    request_credit_amount: 1,
    request_credit_policy_version: "prompt-engine-test-v1",
    request_prompt_id: preset.promptId,
    request_prompt_version: runtimePrompt.version,
    request_prompt_modules: [],
    request_model_key: model,
    request_resolution: resolution,
    request_source_image_key: sourceAssetReference,
  });
  if (createError || !Array.isArray(rows) || typeof rows[0]?.generation_job_id !== "string" || typeof rows[0]?.reservation_id !== "string") return { error: "GENERATION_RECORD_CREATE_FAILED", result: null };
  const jobId = rows[0].generation_job_id as string;
  const reservationId = rows[0].reservation_id as string;
  const { error: startError } = await admin.rpc("start_generation_request", { target_generation_job_id: jobId, target_reservation_id: reservationId });
  if (startError) return { error: "GENERATION_START_FAILED", result: null };
  const startedAt = Date.now();
  try {
    const generated = await runPromptedGeneration({
      presetId: presetId as PhotoServicePresetId,
      model: model as GenerationModelKey,
      resolution: resolution as GenerationResolution,
      additionalRequest: typeof formData.get("additionalRequest") === "string" ? String(formData.get("additionalRequest")) : undefined,
      sourceImage: { data: sourceBytes.toString("base64"), mimeType: source.type as "image/jpeg" | "image/png" | "image/webp" },
      request: request.data,
    }, { apiKey: environment.apiKey });
    const dimensions = readGeneratedImageDimensions(generated.image);
    await admin.from("generation_jobs").update({ prompt_id: generated.prompt.promptId, prompt_version: generated.prompt.promptVersion, prompt_modules: generated.prompt.modules, model_key: generated.prompt.model, resolution, generation_time_ms: Date.now() - startedAt, actual_width: dimensions?.width ?? null, actual_height: dimensions?.height ?? null }).eq("id", jobId).eq("user_id", user.id);
    await admin.rpc("complete_generation_request", { target_generation_job_id: jobId, target_reservation_id: reservationId });
    return { error: null, result: { promptId: generated.prompt.promptId, promptVersion: generated.prompt.promptVersion, providerModel: generated.providerModel, generationTimeMs: generated.durationMs, image: generated.image, width: dimensions?.width ?? null, height: dimensions?.height ?? null } };
  } catch (error) {
    const errorCode = error instanceof Error && error.name === "GoogleImageAdapterError" ? error.message : "GENERATION_FAILED";
    await admin.from("generation_jobs").update({ provider_error_code: errorCode, error_message: "Provider request failed", generation_time_ms: Date.now() - startedAt }).eq("id", jobId).eq("user_id", user.id);
    await admin.rpc("fail_generation_request", { target_generation_job_id: jobId, target_reservation_id: reservationId, failure_reason_code: errorCode.replace(/[^A-Z0-9_]/gu, "_").slice(0, 64) });
    return { error: errorCode, result: null };
  }
}
