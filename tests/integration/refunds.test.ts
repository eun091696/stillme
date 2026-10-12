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
const admin = createClient(localSupabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = new Set<string>();

function randomHash() {
  return crypto.randomUUID().replaceAll("-", "").repeat(2);
}

async function createUserClient(label: string) {
  const email = `refund-${label}-${crypto.randomUUID()}@example.test`;
  const password = `Test-${crypto.randomUUID()}-9a`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { display_name: `Refund ${label}` },
  });
  if (error) throw error;
  createdUserIds.add(data.user.id);

  const client = createClient(localSupabaseUrl, localPublishableKey, {
    auth: { persistSession: false },
  });
  const { error: loginError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (loginError) throw loginError;
  return { client, userId: data.user.id };
}

afterEach(async () => {
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
    createdUserIds.delete(userId);
  }
});

describe("payment refund local integration", () => {
  it("reserves and reverses credits exactly once through service RPCs", async () => {
    const owner = await createUserClient("owner");
    const other = await createUserClient("other");
    const { data: orderData, error: orderError } = await admin.rpc(
      "create_payment_order",
      {
        request_idempotency_key: crypto.randomUUID(),
        target_product_code: "STARTER-3",
        target_user_id: owner.userId,
      },
    );
    expect(orderError).toBeNull();
    const order = orderData![0];
    const paymentKeyHash = randomHash();
    const { data: paymentId, error: paymentError } = await admin.rpc(
      "record_verified_toss_payment",
      {
        target_order_id: order.id,
        target_user_id: owner.userId,
        verified_amount: order.amount,
        verified_approved_at: new Date().toISOString(),
        verified_currency: order.currency,
        verified_order_number: order.order_number,
        verified_payment_key_hash: paymentKeyHash,
        verified_status: "DONE",
      },
    );
    expect(paymentError).toBeNull();

    const idempotencyKey = crypto.randomUUID();
    const beginArgs = {
      refund_reason_code: "CUSTOMER_REQUEST",
      request_idempotency_key: idempotencyKey,
      target_payment_id: paymentId,
      target_user_id: owner.userId,
    };
    const firstIntent = await admin.rpc("begin_payment_refund", beginArgs);
    const duplicateIntent = await admin.rpc("begin_payment_refund", beginArgs);
    expect(firstIntent.error).toBeNull();
    expect(duplicateIntent.error).toBeNull();
    expect(duplicateIntent.data).toEqual(firstIntent.data);
    const refund = firstIntent.data![0];

    const { data: reservedBalance, error: reservedBalanceError } =
      await owner.client
        .from("credit_balances")
        .select("balance, available_balance, refund_reserved_credits")
        .single();
    expect(reservedBalanceError).toBeNull();
    expect(reservedBalance).toEqual({
      available_balance: 0,
      balance: 3,
      refund_reserved_credits: 3,
    });

    const applyArgs = {
      target_refund_id: refund.refund_id,
      verified_amount: order.amount,
      verified_balance_amount: 0,
      verified_canceled_at: new Date().toISOString(),
      verified_currency: order.currency,
      verified_order_number: order.order_number,
      verified_payment_key_hash: paymentKeyHash,
      verified_provider_transaction_hash: randomHash(),
      verified_status: "CANCELED",
    };
    const firstApply = await admin.rpc(
      "apply_verified_payment_refund",
      applyArgs,
    );
    const duplicateApply = await admin.rpc(
      "apply_verified_payment_refund",
      applyArgs,
    );
    expect(firstApply.error).toBeNull();
    expect(duplicateApply.error).toBeNull();
    expect(duplicateApply.data).toBe(firstApply.data);

    const { data: ownerRefunds, error: ownerRefundsError } = await owner.client
      .from("payment_refunds")
      .select("amount, credit_amount, currency, reason_code, status");
    const { data: otherRefunds, error: otherRefundsError } = await other.client
      .from("payment_refunds")
      .select("id");
    const { data: finalBalance, error: finalBalanceError } = await owner.client
      .from("credit_balances")
      .select("balance, available_balance, refund_reserved_credits")
      .single();
    expect(ownerRefundsError).toBeNull();
    expect(otherRefundsError).toBeNull();
    expect(finalBalanceError).toBeNull();
    expect(ownerRefunds).toEqual([
      {
        amount: 4900,
        credit_amount: 3,
        currency: "KRW",
        reason_code: "CUSTOMER_REQUEST",
        status: "succeeded",
      },
    ]);
    expect(otherRefunds).toEqual([]);
    expect(finalBalance).toEqual({
      available_balance: 0,
      balance: 0,
      refund_reserved_credits: 0,
    });
  });
});
