import "server-only";

import { deleteStoredAsset } from "./asset-deletion";
import { createAdminClient } from "../supabase/admin";

export type AssetCleanupResult = {
  queried: number;
  succeeded: number;
  deleted: number;
  skipped: number;
  failed: number;
};

export async function cleanupExpiredAssets(
  limit = 50,
): Promise<AssetCleanupResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("INVALID_CLEANUP_LIMIT");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("list_expired_asset_cleanup", {
    as_of: new Date().toISOString(),
    batch_limit: limit,
  });
  if (error) throw new Error("ASSET_CLEANUP_LIST_FAILED");

  const candidates = (Array.isArray(data) ? data : []).slice(0, limit) as Array<{
    asset_id: string;
    user_id: string;
  }>;
  let succeeded = 0;
  let deleted = 0;
  let skipped = 0;
  let failed = 0;
  for (const candidate of candidates) {
    try {
      const result = await deleteStoredAsset(
        candidate.asset_id,
        candidate.user_id,
      );
      succeeded += 1;
      if (result === "deleted") {
        deleted += 1;
      } else {
        skipped += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return {
    queried: candidates.length,
    succeeded,
    deleted,
    skipped,
    failed,
  };
}
