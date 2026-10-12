import "server-only";

import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

export const NEW_USER_PROMOTION_AMOUNT = 2;
export const NEW_USER_PROMOTION_POLICY_VERSION = "new-user-2-free-v1";
export const NEW_USER_PROMOTION_REASON_CODE = "NEW_USER_2_FREE_GENERATIONS";
export const NEW_USER_PROMOTION_START_AT = "2026-09-23T00:00:00+09:00";

type PromotionUser = {
  id: string;
  created_at: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

type PromotionGrantResult =
  | { granted: false; reason: "INELIGIBLE" }
  | { granted: true }
  | { granted: false; reason: "GRANT_FAILED" };

export function isEligibleForNewUserPromotion(user: PromotionUser) {
  const createdAt = Date.parse(user.created_at);
  const campaignStartAt = Date.parse(NEW_USER_PROMOTION_START_AT);
  const confirmedAt = user.email_confirmed_at ?? user.confirmed_at ?? null;

  return (
    Number.isFinite(createdAt) &&
    createdAt >= campaignStartAt &&
    typeof confirmedAt === "string" &&
    Number.isFinite(Date.parse(confirmedAt))
  );
}

export function newUserPromotionIdempotencyKey(userId: string) {
  const bytes = createHash("sha256")
    .update(`${NEW_USER_PROMOTION_POLICY_VERSION}:${userId}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function grantNewUserPromotion(
  user: PromotionUser,
): Promise<PromotionGrantResult> {
  if (!isEligibleForNewUserPromotion(user)) {
    return { granted: false, reason: "INELIGIBLE" };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("credit_ledger_entries").upsert(
    {
      user_id: user.id,
      transaction_type: "promotion_grant",
      amount: NEW_USER_PROMOTION_AMOUNT,
      idempotency_key: newUserPromotionIdempotencyKey(user.id),
      policy_version: NEW_USER_PROMOTION_POLICY_VERSION,
      reference_id: user.id,
      reason_code: NEW_USER_PROMOTION_REASON_CODE,
    },
    { onConflict: "user_id,idempotency_key", ignoreDuplicates: true },
  );

  return error
    ? { granted: false, reason: "GRANT_FAILED" }
    : { granted: true };
}
