import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteStoredAsset: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("./asset-deletion", () => ({
  deleteStoredAsset: mocks.deleteStoredAsset,
}));
vi.mock("../supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

import { cleanupExpiredAssets } from "./cleanup";

describe("cleanupExpiredAssets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({
      data: [
        { asset_id: "asset-1", user_id: "user-1" },
        { asset_id: "asset-2", user_id: "user-2" },
        { asset_id: "asset-3", user_id: "user-3" },
      ],
      error: null,
    });
    mocks.deleteStoredAsset
      .mockResolvedValueOnce("deleted")
      .mockResolvedValueOnce("not_found")
      .mockRejectedValueOnce(new Error("temporary"));
  });

  it("processes a bounded batch and leaves failures retryable", async () => {
    await expect(cleanupExpiredAssets(3)).resolves.toEqual({
      queried: 3,
      succeeded: 2,
      deleted: 1,
      skipped: 1,
      failed: 1,
    });
    expect(mocks.deleteStoredAsset).toHaveBeenCalledTimes(3);
    expect(mocks.rpc).toHaveBeenCalledWith("list_expired_asset_cleanup", {
      as_of: expect.any(String),
      batch_limit: 3,
    });
  });

  it("rejects unsafe batch sizes", async () => {
    await expect(cleanupExpiredAssets(0)).rejects.toThrow(
      "INVALID_CLEANUP_LIMIT",
    );
    await expect(cleanupExpiredAssets(101)).rejects.toThrow(
      "INVALID_CLEANUP_LIMIT",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
