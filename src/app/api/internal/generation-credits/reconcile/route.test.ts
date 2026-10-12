import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reconcile: vi.fn() }));

vi.mock("@/lib/generation/reconciliation", () => ({
  reconcileStaleGenerationCreditReservations: mocks.reconcile,
}));

import { GET, POST } from "./route";

function request(secret: string | null, method = "GET", limit = "50") {
  return new Request(
    `https://stillme-photo.vercel.app/api/internal/generation-credits/reconcile?limit=${limit}`,
    {
      headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
      method,
    },
  );
}

describe("generation Credit reconciliation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "c".repeat(32);
    process.env.GENERATION_RECONCILIATION_SECRET = "g".repeat(32);
    mocks.reconcile.mockResolvedValue({
      failed: 0,
      released: 1,
      scanned: 1,
      skipped: 0,
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.GENERATION_RECONCILIATION_SECRET;
  });

  it("accepts CRON_SECRET and returns no-store counters", async () => {
    const response = await GET(request("c".repeat(32), "GET", "25"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.reconcile).toHaveBeenCalledWith(25);
  });

  it("supports a separate manual reconciliation secret", async () => {
    expect((await POST(request("g".repeat(32), "POST"))).status).toBe(200);
  });

  it("rejects missing, wrong, and undersized secrets", async () => {
    expect((await GET(request(null))).status).toBe(401);
    expect((await GET(request("wrong".repeat(8)))).status).toBe(401);
    process.env.CRON_SECRET = "short";
    delete process.env.GENERATION_RECONCILIATION_SECRET;
    expect((await GET(request("short"))).status).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("returns a retryable status when any reservation could not be reconciled", async () => {
    mocks.reconcile.mockResolvedValueOnce({
      failed: 1,
      released: 0,
      scanned: 1,
      skipped: 0,
    });
    const response = await POST(request("g".repeat(32), "POST"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "RECONCILIATION_PARTIAL_FAILURE",
      failed: 1,
    });
  });

  it("fails closed when reconciliation cannot run", async () => {
    mocks.reconcile.mockRejectedValueOnce(new Error("database unavailable"));
    const response = await GET(request("c".repeat(32)));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "RECONCILIATION_FAILED",
    });
  });
});
