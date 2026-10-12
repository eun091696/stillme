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
  const email = `payment-${label}-${crypto.randomUUID()}@example.test`;
  const password = `Test-${crypto.randomUUID()}-9a`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { display_name: `Payment ${label}` },
  });
  if (error) {
    throw error;
  }

  createdUserIds.add(data.user.id);
  const client = createClient(localSupabaseUrl, localPublishableKey, {
    auth: { persistSession: false },
  });
  const { error: loginError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (loginError) {
    throw loginError;
  }

  return { client, userId: data.user.id };
}

async function createOrder(userId: string, productCode: string) {
  const { data, error } = await admin.rpc("create_payment_order", {
    request_idempotency_key: crypto.randomUUID(),
    target_product_code: productCode,
    target_user_id: userId,
  });
  expect(error).toBeNull();
  return data![0];
}

afterEach(async () => {
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      throw error;
    }
    createdUserIds.delete(userId);
  }
});

describe("Toss payment local integration", () => {
  it("grants credits exactly once and keeps payment records owner-scoped", async () => {
    const owner = await createUserClient("owner");
    const other = await createUserClient("other");
    const idempotencyKey = crypto.randomUUID();
    const firstOrder = await admin.rpc("create_payment_order", {
      request_idempotency_key: idempotencyKey,
      target_product_code: "STARTER-3",
      target_user_id: owner.userId,
    });
    const duplicateOrder = await admin.rpc("create_payment_order", {
      request_idempotency_key: idempotencyKey,
      target_product_code: "STARTER-3",
      target_user_id: owner.userId,
    });
    expect(firstOrder.error).toBeNull();
    expect(duplicateOrder.error).toBeNull();
    expect(duplicateOrder.data).toEqual(firstOrder.data);

    const order = firstOrder.data![0];
    const paymentKeyHash = randomHash();
    const paymentArgs = {
      target_order_id: order.id,
      target_user_id: owner.userId,
      verified_amount: order.amount,
      verified_approved_at: new Date().toISOString(),
      verified_currency: order.currency,
      verified_order_number: order.order_number,
      verified_payment_key_hash: paymentKeyHash,
      verified_status: "DONE",
    };
    const firstPayment = await admin.rpc(
      "record_verified_toss_payment",
      paymentArgs,
    );
    const duplicatePayment = await admin.rpc(
      "record_verified_toss_payment",
      paymentArgs,
    );
    expect(firstPayment.error).toBeNull();
    expect(duplicatePayment.error).toBeNull();
    expect(duplicatePayment.data).toBe(firstPayment.data);

    const { data: ownerBalance, error: balanceError } = await owner.client
      .from("credit_balances")
      .select("balance")
      .single();
    const { data: ownerPayments, error: ownerPaymentsError } =
      await owner.client
        .from("payments")
        .select("amount, currency, provider_status");
    const { data: otherPayments, error: otherPaymentsError } =
      await other.client.from("payments").select("id");
    expect(balanceError).toBeNull();
    expect(ownerPaymentsError).toBeNull();
    expect(otherPaymentsError).toBeNull();
    expect(ownerBalance).toEqual({ balance: 3 });
    expect(ownerPayments).toEqual([
      { amount: 4900, currency: "KRW", provider_status: "DONE" },
    ]);
    expect(otherPayments).toEqual([]);

    const { count, error: ledgerError } = await admin
      .from("credit_ledger_entries")
      .select("id", { count: "exact", head: true })
      .eq("reference_id", order.id)
      .eq("transaction_type", "purchase_grant");
    expect(ledgerError).toBeNull();
    expect(count).toBe(1);
  });

  it("deduplicates verified webhooks and ignores non-DONE states", async () => {
    const owner = await createUserClient("webhook");
    const paidOrder = await createOrder(owner.userId, "STANDARD-7");
    const transmissionId = `tx-${crypto.randomUUID()}`;
    const webhookArgs = {
      verified_amount: paidOrder.amount,
      verified_approved_at: new Date().toISOString(),
      verified_currency: paidOrder.currency,
      verified_order_number: paidOrder.order_number,
      verified_payment_key_hash: randomHash(),
      verified_status: "DONE",
      webhook_event_type: "PAYMENT_STATUS_CHANGED",
      webhook_payload_hash: "c".repeat(64),
      webhook_transmission_id: transmissionId,
    };
    const firstReceipt = await admin.rpc(
      "process_verified_toss_webhook",
      webhookArgs,
    );
    const duplicateReceipt = await admin.rpc(
      "process_verified_toss_webhook",
      webhookArgs,
    );
    expect(firstReceipt.error).toBeNull();
    expect(duplicateReceipt.error).toBeNull();
    expect(firstReceipt.data![0].receipt_status).toBe("processed");
    expect(duplicateReceipt.data).toEqual(firstReceipt.data);

    const ignoredOrder = await createOrder(owner.userId, "STARTER-3");
    const ignoredReceipt = await admin.rpc("process_verified_toss_webhook", {
      ...webhookArgs,
      verified_amount: ignoredOrder.amount,
      verified_approved_at: null,
      verified_order_number: ignoredOrder.order_number,
      verified_payment_key_hash: randomHash(),
      verified_status: "CANCELED",
      webhook_payload_hash: "e".repeat(64),
      webhook_transmission_id: `tx-${crypto.randomUUID()}`,
    });
    expect(ignoredReceipt.error).toBeNull();
    expect(ignoredReceipt.data![0].receipt_status).toBe("ignored");

    const { data: balance, error: balanceError } = await owner.client
      .from("credit_balances")
      .select("balance")
      .single();
    const { data: ignoredOrderState, error: orderError } = await owner.client
      .from("payment_orders")
      .select("status")
      .eq("id", ignoredOrder.id)
      .single();
    expect(balanceError).toBeNull();
    expect(orderError).toBeNull();
    expect(balance).toEqual({ balance: 7 });
    expect(ignoredOrderState).toEqual({ status: "pending" });
  });
});
