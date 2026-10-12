import "server-only";

import { createGenerationStorageFromEnvironment } from "./generation";
import { createAdminClient } from "../supabase/admin";

const DELETABLE_STATUSES = [
  "allocated",
  "uploading",
  "validating",
  "available",
  "failed",
] as const;

export type AssetDeletionResult = "deleted" | "not_found";

export async function deleteStoredAsset(
  assetId: string,
  userId: string,
): Promise<AssetDeletionResult> {
  const admin = createAdminClient();
  const { data: existing, error: loadError } = await admin
    .from("assets")
    .select("id, user_id, storage_key, status, mime_type")
    .eq("id", assetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (loadError) throw new Error("ASSET_DELETE_LOAD_FAILED");
  if (!existing) return "not_found";
  if (existing.status === "deleted") return "deleted";

  let asset = existing;
  if (asset.status !== "deleting") {
    const { data: claimed, error: claimError } = await admin
      .from("assets")
      .update({ status: "deleting" })
      .eq("id", assetId)
      .eq("user_id", userId)
      .in("status", [...DELETABLE_STATUSES])
      .select("id, user_id, storage_key, status, mime_type")
      .maybeSingle();
    if (claimError) throw new Error("ASSET_DELETE_CLAIM_FAILED");
    if (!claimed) {
      const { data: current } = await admin
        .from("assets")
        .select("id, user_id, storage_key, status, mime_type")
        .eq("id", assetId)
        .eq("user_id", userId)
        .maybeSingle();
      if (current?.status === "deleted") return "deleted";
      if (current?.status !== "deleting") {
        throw new Error("ASSET_DELETE_CLAIM_FAILED");
      }
      asset = current;
    } else {
      asset = claimed;
    }
  }

  if (asset.mime_type !== null) {
    const storage = createGenerationStorageFromEnvironment();
    await storage.deleteImage({ key: asset.storage_key });
  }

  const { data: completed, error: completeError } = await admin
    .from("assets")
    .update({ status: "deleted" })
    .eq("id", asset.id)
    .eq("user_id", asset.user_id)
    .eq("status", "deleting")
    .select("id")
    .maybeSingle();
  if (completeError) throw new Error("ASSET_DELETE_FINALIZE_FAILED");
  if (!completed) {
    const { data: current } = await admin
      .from("assets")
      .select("status")
      .eq("id", asset.id)
      .eq("user_id", asset.user_id)
      .maybeSingle();
    if (current?.status !== "deleted") {
      throw new Error("ASSET_DELETE_FINALIZE_FAILED");
    }
  }
  return "deleted";
}
