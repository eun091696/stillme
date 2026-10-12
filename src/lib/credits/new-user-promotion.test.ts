import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}));

import {
  grantNewUserPromotion,
  isEligibleForNewUserPromotion,
  NEW_USER_PROMOTION_AMOUNT,
  NEW_USER_PROMOTION_POLICY_VERSION,
  newUserPromotionIdempotencyKey,
} from "./new-user-promotion";

const eligibleUser = {
  id: "11111111-1111-4111-8111-111111111111",
  created_at: "2026-09-23T01:00:00.000Z",
  email_confirmed_at: "2026-09-23T01:01:00.000Z",
};

describe("new user promotion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
    mocks.upsert.mockResolvedValue({ error: null });
  });

  it("requires a confirmed account created after the campaign start", () => {
    expect(isEligibleForNewUserPromotion(eligibleUser)).toBe(true);
    expect(isEligibleForNewUserPromotion({
      ...eligibleUser,
      created_at: "2026-09-22T00:00:00.000Z",
    })).toBe(false);
    expect(isEligibleForNewUserPromotion({
      ...eligibleUser,
      email_confirmed_at: null,
    })).toBe(false);
  });

  it("creates a deterministic campaign-specific UUID", () => {
    const key = newUserPromotionIdempotencyKey(eligibleUser.id);
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    expect(newUserPromotionIdempotencyKey(eligibleUser.id)).toBe(key);
    expect(key).not.toBe(eligibleUser.id);
  });

  it("records two promotional Credits with an idempotent ledger identity", async () => {
    await expect(grantNewUserPromotion(eligibleUser)).resolves.toEqual({ granted: true });
    expect(mocks.from).toHaveBeenCalledWith("credit_ledger_entries");
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: NEW_USER_PROMOTION_AMOUNT,
        policy_version: NEW_USER_PROMOTION_POLICY_VERSION,
        reason_code: "NEW_USER_2_FREE_GENERATIONS",
        reference_id: eligibleUser.id,
        transaction_type: "promotion_grant",
        user_id: eligibleUser.id,
      }),
      { onConflict: "user_id,idempotency_key", ignoreDuplicates: true },
    );
  });

  it("does not touch the ledger for an ineligible account", async () => {
    await expect(grantNewUserPromotion({
      ...eligibleUser,
      email_confirmed_at: null,
    })).resolves.toEqual({ granted: false, reason: "INELIGIBLE" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
