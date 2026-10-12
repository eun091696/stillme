import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

import {
  createGenerationCreditReconciliationLogRecord,
  reconcileStaleGenerationCreditReservations,
} from "./reconciliation";

describe("generation Credit reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({
      data: [{
        failed_count: 0,
        released_count: 2,
        scanned_count: 3,
        skipped_count: 1,
      }],
      error: null,
    });
  });

  it("invokes the bounded service-role reconciliation RPC", async () => {
    await expect(reconcileStaleGenerationCreditReservations(25)).resolves
      .toEqual({ failed: 0, released: 2, scanned: 3, skipped: 1 });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "reconcile_stale_generation_credit_reservations",
      expect.objectContaining({
        batch_limit: 25,
        stale_after: "30 minutes",
      }),
    );
  });

  it("rejects invalid limits and fails closed on RPC errors", async () => {
    await expect(reconcileStaleGenerationCreditReservations(0)).rejects
      .toThrow("INVALID_RECONCILIATION_LIMIT");
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "failed" } });
    await expect(reconcileStaleGenerationCreditReservations(50)).rejects
      .toThrow("GENERATION_CREDIT_RECONCILIATION_FAILED");
  });

  it("logs only bounded reconciliation counters", () => {
    const record = createGenerationCreditReconciliationLogRecord({
      failed: 1,
      released: 2,
      scanned: 4,
      skipped: 1,
    });
    expect(record).toMatchObject({
      failed_count: 1,
      outcome: "partial_failure",
      released_count: 2,
      scanned_count: 4,
      skipped_count: 1,
    });
    expect(JSON.stringify(record)).not.toMatch(/email|user_id|storage_key/iu);
  });
});
