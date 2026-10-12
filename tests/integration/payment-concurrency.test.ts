import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Start local Supabase and configure the local test environment.",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = new Set<string>();

function randomHash() {
  return crypto.randomUUID().replaceAll("-", "").repeat(2);
}

async function createUser() {
  const { data, error } = await admin.auth.admin.createUser({
    email: `payment-race-${crypto.randomUUID()}@example.test`,
    email_confirm: true,
    password: `Test-${crypto.randomUUID()}-9a`,
    user_metadata: { display_name: "Payment Concurrency" },
  });
  if (error) throw error;
  createdUserIds.add(data.user.id);
  return data.user.id;
}

async function createQueuedJob(userId: string) {
  const id = crypto.randomUUID();
  const { error } = await admin.from("generation_jobs").insert({
    adapter_version: "google-v1",
    aspect_ratio: "1:1",
    id,
    idempotency_key: crypto.randomUUID(),
    model_id: "imagen-3",
    prompt: "payment reservation concurrency test",
    prompt_template_version: "prompt-v1",
    provider_model: "imagen-3.0-generate-002",
    style: "photographic",
    user_id: userId,
  });
  if (error) throw error;
  return id;
}

async function createPaidOrder(userId: string) {
  const { data: orderData, error: orderError } = await admin.rpc(
    "create_payment_order",
    {
      request_idempotency_key: crypto.randomUUID(),
      target_product_code: "STARTER-3",
      target_user_id: userId,
    },
  );
  expect(orderError).toBeNull();
  const order = orderData![0];
  const paymentKeyHash = randomHash();
  const { data: paymentId, error: paymentError } = await admin.rpc(
    "record_verified_toss_payment",
    {
      target_order_id: order.id,
      target_user_id: userId,
      verified_amount: order.amount,
      verified_approved_at: new Date().toISOString(),
      verified_currency: order.currency,
      verified_order_number: order.order_number,
      verified_payment_key_hash: paymentKeyHash,
      verified_status: "DONE",
    },
  );
  expect(paymentError).toBeNull();
  return { order, paymentId: paymentId!, paymentKeyHash };
}

afterEach(async () => {
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
    createdUserIds.delete(userId);
  }
});

describe("payment concurrency and idempotency integration", () => {
  it(
    "grants one package and quarantines the other Groble payment when two merchant UIDs race",
    async () => {
      const userId = await createUser();
      const { data: orderRows, error: orderError } = await admin.rpc(
        "create_payment_order",
        {
          request_idempotency_key: crypto.randomUUID(),
          target_product_code: "STARTER-3",
          target_user_id: userId,
        },
      );
      expect(orderError).toBeNull();
      const order = orderRows![0];
      const purchasedAt = new Date().toISOString();
      const payments = [
        {
          merchant: randomHash(),
          payload: randomHash(),
          transmission: randomHash(),
        },
        {
          merchant: randomHash(),
          payload: randomHash(),
          transmission: randomHash(),
        },
      ];

      const results = await Promise.all(
        payments.map((payment) =>
          admin.rpc("process_verified_groble_payment", {
            verified_amount: order.amount,
            verified_currency: order.currency,
            verified_merchant_uid_hash: payment.merchant,
            verified_order_number: order.order_number,
            verified_purchased_at: purchasedAt,
            webhook_event_type: "payment.completed",
            webhook_payload_hash: payment.payload,
            webhook_transmission_id: payment.transmission,
          }),
        ),
      );
      expect(results.every(({ error }) => error === null)).toBe(true);
      expect(
        results.map(({ data }) => data![0].processing_outcome).sort(),
      ).toEqual(["payment_processed", "reconciliation_required"]);

      const [paymentsResult, reconciliationsResult, grantsResult, balanceResult] =
        await Promise.all([
          admin
            .from("payments")
            .select("id", { count: "exact", head: true })
            .eq("order_id", order.id)
            .eq("provider", "groble"),
          admin
            .from("payment_reconciliation_records")
            .select("id, credit_granted, merchant_uid_hash")
            .eq("order_id", order.id),
          admin
            .from("credit_ledger_entries")
            .select("id", { count: "exact", head: true })
            .eq("reference_id", order.id)
            .eq("transaction_type", "purchase_grant"),
          admin
            .from("credit_balances")
            .select("available_balance, balance")
            .eq("user_id", userId)
            .single(),
        ]);

      expect(paymentsResult.error).toBeNull();
      expect(paymentsResult.count).toBe(1);
      expect(reconciliationsResult.error).toBeNull();
      expect(reconciliationsResult.data).toHaveLength(1);
      expect(reconciliationsResult.data![0].credit_granted).toBe(false);
      expect(payments.map(({ merchant }) => merchant)).toContain(
        reconciliationsResult.data![0].merchant_uid_hash,
      );
      expect(grantsResult.error).toBeNull();
      expect(grantsResult.count).toBe(1);
      expect(balanceResult.error).toBeNull();
      expect(balanceResult.data).toEqual({ available_balance: 3, balance: 3 });
    },
    20_000,
  );

  it(
    "converges concurrent order, confirmation, refund, and reconciliation requests",
    async () => {
      const userId = await createUser();
      const requestId = crypto.randomUUID();

      const orderResults = await Promise.all(
        Array.from({ length: 8 }, () =>
          admin.rpc("create_payment_order", {
            request_idempotency_key: requestId,
            target_product_code: "STARTER-3",
            target_user_id: userId,
          }),
        ),
      );
      expect(orderResults.every(({ error }) => error === null)).toBe(true);
      expect(
        new Set(orderResults.map(({ data }) => data![0].id)).size,
      ).toBe(1);
      const order = orderResults[0].data![0];

      const paymentArgs = {
        target_order_id: order.id,
        target_user_id: userId,
        verified_amount: order.amount,
        verified_approved_at: new Date().toISOString(),
        verified_currency: order.currency,
        verified_order_number: order.order_number,
        verified_payment_key_hash: randomHash(),
        verified_status: "DONE",
      };
      const paymentResults = await Promise.all(
        Array.from({ length: 8 }, () =>
          admin.rpc("record_verified_toss_payment", paymentArgs),
        ),
      );
      expect(paymentResults.every(({ error }) => error === null)).toBe(true);
      expect(new Set(paymentResults.map(({ data }) => data)).size).toBe(1);
      const paymentId = paymentResults[0].data!;

      const refundArgs = {
        refund_reason_code: "CUSTOMER_REQUEST",
        request_idempotency_key: crypto.randomUUID(),
        target_payment_id: paymentId,
        target_user_id: userId,
      };
      const refundResults = await Promise.all(
        Array.from({ length: 8 }, () =>
          admin.rpc("begin_payment_refund", refundArgs),
        ),
      );
      expect(refundResults.every(({ error }) => error === null)).toBe(true);
      expect(
        new Set(refundResults.map(({ data }) => data![0].refund_id)).size,
      ).toBe(1);
      const refundId = refundResults[0].data![0].refund_id;

      const canceledAt = new Date().toISOString();
      const transactionHash = randomHash();
      const applyArgs = {
        target_refund_id: refundId,
        verified_amount: order.amount,
        verified_balance_amount: 0,
        verified_canceled_at: canceledAt,
        verified_currency: order.currency,
        verified_order_number: order.order_number,
        verified_payment_key_hash: paymentArgs.verified_payment_key_hash,
        verified_provider_transaction_hash: transactionHash,
        verified_status: "CANCELED",
      };
      const applyResults = await Promise.all(
        Array.from({ length: 8 }, () =>
          admin.rpc("apply_verified_payment_refund", applyArgs),
        ),
      );
      expect(applyResults.every(({ error }) => error === null)).toBe(true);
      expect(new Set(applyResults.map(({ data }) => data)).size).toBe(1);

      const reconciliationArgs = {
        provider_snapshot_hash: randomHash(),
        target_payment_id: paymentId,
        target_user_id: userId,
        verified_amount: order.amount,
        verified_balance_amount: 0,
        verified_canceled_at: canceledAt,
        verified_currency: order.currency,
        verified_order_number: order.order_number,
        verified_payment_key_hash: paymentArgs.verified_payment_key_hash,
        verified_provider_transaction_hash: transactionHash,
        verified_refund_amount: order.amount,
        verified_status: "CANCELED",
      };
      const reconciliationResults = await Promise.all(
        Array.from({ length: 8 }, () =>
          admin.rpc("reconcile_verified_toss_payment", reconciliationArgs),
        ),
      );
      expect(
        reconciliationResults.every(({ error }) => error === null),
      ).toBe(true);
      expect(
        new Set(
          reconciliationResults.map(
            ({ data }) => data![0].reconciliation_id,
          ),
        ).size,
      ).toBe(1);
      expect(reconciliationResults[0].data![0].reconciliation_outcome).toBe(
        "in_sync",
      );

      const [
        { count: grantCount },
        { count: reversalCount },
        { count: reconciliationCount },
        { data: balance },
      ] = await Promise.all([
        admin
          .from("credit_ledger_entries")
          .select("id", { count: "exact", head: true })
          .eq("reference_id", order.id)
          .eq("transaction_type", "purchase_grant"),
        admin
          .from("credit_ledger_entries")
          .select("id", { count: "exact", head: true })
          .eq("reference_id", refundId)
          .eq("transaction_type", "payment_refund_reversal"),
        admin
          .from("payment_reconciliation_results")
          .select("id", { count: "exact", head: true })
          .eq("payment_id", paymentId),
        admin
          .from("credit_balances")
          .select(
            "balance, reserved_credits, refund_reserved_credits, available_balance",
          )
          .eq("user_id", userId)
          .single(),
      ]);

      expect(grantCount).toBe(1);
      expect(reversalCount).toBe(1);
      expect(reconciliationCount).toBe(1);
      expect(balance).toEqual({
        available_balance: 0,
        balance: 0,
        refund_reserved_credits: 0,
        reserved_credits: 0,
      });
    },
    20_000,
  );

  it(
    "allows only one winner when refund and generation reservations race for the same credits",
    async () => {
      const userId = await createUser();
      const jobId = await createQueuedJob(userId);
      const { paymentId } = await createPaidOrder(userId);

      const [refundResult, generationResult] = await Promise.all([
        admin.rpc("begin_payment_refund", {
          refund_reason_code: "CUSTOMER_REQUEST",
          request_idempotency_key: crypto.randomUUID(),
          target_payment_id: paymentId,
          target_user_id: userId,
        }),
        admin.rpc("reserve_generation_credits", {
          credit_amount: 3,
          credit_policy_version: "commercial-v2",
          request_idempotency_key: crypto.randomUUID(),
          target_generation_job_id: jobId,
        }),
      ]);

      expect(
        [refundResult, generationResult].filter(({ error }) => error === null),
      ).toHaveLength(1);
      expect(
        [refundResult, generationResult].filter(({ error }) => error !== null),
      ).toHaveLength(1);

      const { data: balance, error } = await admin
        .from("credit_balances")
        .select(
          "balance, reserved_credits, refund_reserved_credits, available_balance",
        )
        .eq("user_id", userId)
        .single();
      expect(error).toBeNull();
      expect(balance).toEqual({
        available_balance: 0,
        balance: 3,
        refund_reserved_credits: refundResult.error ? 0 : 3,
        reserved_credits: generationResult.error ? 0 : 3,
      });
    },
    20_000,
  );
});
