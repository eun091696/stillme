import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  throw new Error(
    "Start local Supabase and configure the local test environment.",
  );
}

const localSupabaseUrl = supabaseUrl;
const localPublishableKey = publishableKey;
const localServiceRoleKey = serviceRoleKey;
const admin = createClient(localSupabaseUrl, localServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = new Set<string>();

async function createUserClient(label: string) {
  const email = `integration-${label}-${crypto.randomUUID()}@example.test`;
  const password = `Test-${crypto.randomUUID()}-9a`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { display_name: `Integration ${label}` },
  });

  if (error) {
    throw error;
  }

  createdUserIds.add(data.user.id);
  const client = createClient(localSupabaseUrl, localPublishableKey, {
    auth: { persistSession: false },
  });
  const { error: loginError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (loginError) {
    throw loginError;
  }

  return { client, userId: data.user.id };
}

afterEach(async () => {
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      throw error;
    }
    createdUserIds.delete(userId);
  }
});

describe("GEN-002 and HIST-001 local integration", () => {
  it("exposes available generation metadata only to its owner", async () => {
    const owner = await createUserClient("owner");
    const other = await createUserClient("other");
    const jobId = crypto.randomUUID();
    const assetId = crypto.randomUUID();
    const { error: jobError } = await admin.from("generation_jobs").insert({
      id: jobId,
      user_id: owner.userId,
      idempotency_key: crypto.randomUUID(),
      prompt: "통합 테스트 이미지",
      style: "photographic",
      aspect_ratio: "1:1",
      model_id: "imagen-3",
      provider_model: "imagen-3.0-generate-002",
      adapter_version: "google-v1",
      prompt_template_version: "prompt-v1",
      status: "succeeded",
    });
    expect(jobError).toBeNull();

    const { error: assetError } = await admin.from("assets").insert({
      id: assetId,
      generation_job_id: jobId,
      user_id: owner.userId,
      storage_key: `users/${owner.userId}/generation-jobs/${jobId}/assets/${assetId}/original.png`,
      status: "available",
      mime_type: "image/png",
      checksum_sha256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      byte_size: 68,
      width: 1,
      height: 1,
    });
    expect(assetError).toBeNull();

    const { data: ownerJobs, error: ownerJobError } = await owner.client
      .from("generation_jobs")
      .select("id");
    const { data: ownerAssets, error: ownerAssetError } = await owner.client
      .from("assets")
      .select("id");
    expect(ownerJobError).toBeNull();
    expect(ownerAssetError).toBeNull();
    expect(ownerJobs).toEqual([{ id: jobId }]);
    expect(ownerAssets).toEqual([{ id: assetId }]);

    const { data: otherJobs, error: otherJobError } = await other.client
      .from("generation_jobs")
      .select("id");
    const { data: otherAssets, error: otherAssetError } = await other.client
      .from("assets")
      .select("id");
    expect(otherJobError).toBeNull();
    expect(otherAssetError).toBeNull();
    expect(otherJobs).toEqual([]);
    expect(otherAssets).toEqual([]);
  });
});
