import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cleanupExpiredAssets: vi.fn() }));

vi.mock("@/lib/storage/cleanup", () => ({
  cleanupExpiredAssets: mocks.cleanupExpiredAssets,
}));

import { GET } from "./route";

function request(secret: string | null, method = "GET") {
  return new Request(
    "https://stillme-photo.vercel.app/api/internal/assets/cleanup?limit=100",
    {
      headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
      method,
    },
  );
}

describe("asset cleanup route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "c".repeat(32);
    mocks.cleanupExpiredAssets.mockResolvedValue({
      queried: 1,
      succeeded: 1,
      deleted: 1,
      skipped: 0,
      failed: 0,
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("accepts Vercel Cron GET requests authenticated by CRON_SECRET", async () => {
    const response = await GET(request("c".repeat(32)));
    expect(response.status).toBe(200);
    expect(mocks.cleanupExpiredAssets).toHaveBeenCalledWith(100);
    await expect(response.json()).resolves.toEqual({
      queried: 1,
      succeeded: 1,
      deleted: 1,
      skipped: 0,
      failed: 0,
    });
  });

  it("accepts a production secret with the documented minimum length", async () => {
    process.env.CRON_SECRET = "c".repeat(16);
    expect((await GET(request("c".repeat(16)))).status).toBe(200);
  });

  it("rejects missing or wrong authorization", async () => {
    expect((await GET(request(null))).status).toBe(401);
    expect((await GET(request("wrong".repeat(8)))).status).toBe(401);
    expect(mocks.cleanupExpiredAssets).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET is missing or undersized", async () => {
    delete process.env.CRON_SECRET;
    const missing = await GET(request(null));
    expect(missing.status).toBe(503);
    await expect(missing.json()).resolves.toEqual({
      code: "CRON_NOT_CONFIGURED",
    });

    process.env.CRON_SECRET = "short";
    expect((await GET(request("short"))).status).toBe(503);
    expect(mocks.cleanupExpiredAssets).not.toHaveBeenCalled();
  });

  it("reports partial failures without hiding successful deletions", async () => {
    mocks.cleanupExpiredAssets.mockResolvedValueOnce({
      queried: 3,
      succeeded: 2,
      deleted: 2,
      skipped: 0,
      failed: 1,
    });

    const response = await GET(request("c".repeat(32)));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: "CLEANUP_PARTIAL_FAILURE",
      queried: 3,
      succeeded: 2,
      deleted: 2,
      skipped: 0,
      failed: 1,
    });
  });
});
