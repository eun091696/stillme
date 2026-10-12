import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteImage: vi.fn(),
  maybeSingle: vi.fn(),
  update: vi.fn(),
}));

vi.mock("./generation", () => ({
  createGenerationStorageFromEnvironment: () => ({
    deleteImage: mocks.deleteImage,
  }),
}));
vi.mock("../supabase/admin", () => ({
  createAdminClient: () => {
    const query = {
      eq: vi.fn(),
      in: vi.fn(),
      maybeSingle: mocks.maybeSingle,
      select: vi.fn(),
      update: mocks.update,
    };
    query.eq.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.select.mockReturnValue(query);
    mocks.update.mockReturnValue(query);
    return { from: () => query };
  },
}));

import { deleteStoredAsset } from "./asset-deletion";

const asset = {
  id: "33333333-3333-4333-8333-333333333333",
  user_id: "11111111-1111-4111-8111-111111111111",
  storage_key:
    "users/11111111-1111-4111-8111-111111111111/generation-jobs/22222222-2222-4222-8222-222222222222/assets/33333333-3333-4333-8333-333333333333/original.png",
  status: "available",
  mime_type: "image/png",
};

describe("deleteStoredAsset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteImage.mockResolvedValue(undefined);
  });

  it("does not delete an asset outside the authenticated owner boundary", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      deleteStoredAsset(asset.id, asset.user_id),
    ).resolves.toBe("not_found");
    expect(mocks.deleteImage).not.toHaveBeenCalled();
  });

  it("preserves the key while claiming, deletes storage, then finalizes", async () => {
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: asset, error: null })
      .mockResolvedValueOnce({
        data: { ...asset, status: "deleting" },
        error: null,
      })
      .mockResolvedValueOnce({ data: { id: asset.id }, error: null });

    await expect(
      deleteStoredAsset(asset.id, asset.user_id),
    ).resolves.toBe("deleted");
    expect(mocks.deleteImage).toHaveBeenCalledWith({ key: asset.storage_key });
    expect(mocks.update).toHaveBeenNthCalledWith(1, { status: "deleting" });
    expect(mocks.update).toHaveBeenNthCalledWith(2, { status: "deleted" });
  });

  it("retries a previously claimed deletion safely", async () => {
    mocks.maybeSingle
      .mockResolvedValueOnce({
        data: { ...asset, status: "deleting" },
        error: null,
      })
      .mockResolvedValueOnce({ data: { id: asset.id }, error: null });

    await expect(
      deleteStoredAsset(asset.id, asset.user_id),
    ).resolves.toBe("deleted");
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledWith({ status: "deleted" });
  });

  it("does not finalize the row when object deletion fails", async () => {
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: asset, error: null })
      .mockResolvedValueOnce({
        data: { ...asset, status: "deleting" },
        error: null,
      });
    mocks.deleteImage.mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(
      deleteStoredAsset(asset.id, asset.user_id),
    ).rejects.toThrow("storage unavailable");
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledWith({ status: "deleting" });
  });
});
