import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { buildPaymentIncidentDrillReport } from "./lib/incident-drill.mjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

if (
  !supabaseUrl ||
  !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(supabaseUrl) ||
  !serviceRoleKey
) {
  throw new Error("Payment incident drill requires local Supabase.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = new Set();

function hashSynthetic(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function requireData(promise, label) {
  const { data, error } = await promise;
  if (error || data === null) {
    throw new Error(`${label} failed.`);
  }
  return data;
}

async function createSyntheticUser(label) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `incident-drill-${label}-${randomUUID()}@example.test`,
    email_confirm: true,
    password: `Test-${randomUUID()}-9a`,
    user_metadata: { display_name: "Payment Incident Drill" },
  });
  if (error) throw new Error("Synthetic incident user setup failed.");
  createdUserIds.add(data.user.id);
  return data.user.id;
}

async function createPaidOrder(userId, label) {
  const orderRows = await requireData(
    admin.rpc("create_payment_order", {
      request_idempotency_key: randomUUID(),
      target_product_code: "STARTER-3",
      target_user_id: userId,
    }),
    "Synthetic order setup",
  );
  const order = orderRows[0];
  assert.ok(order);

  const paymentKeyHash = hashSynthetic(`payment-key-${label}-${randomUUID()}`);
  const paymentId = await requireData(
    admin.rpc("record_verified_toss_payment", {
      target_order_id: order.id,
      target_user_id: userId,
      verified_amount: order.amount,
      verified_approved_at: new Date().toISOString(),
      verified_currency: order.currency,
      verified_order_number: order.order_number,
      verified_payment_key_hash: paymentKeyHash,
      verified_status: "DONE",
    }),
    "Synthetic payment setup",
  );

  return { order, paymentId, paymentKeyHash };
}

async function reconcileCanceledPayment({
  label,
  order,
  paymentId,
  paymentKeyHash,
  snapshotHash,
  userId,
}) {
  return requireData(
    admin.rpc("reconcile_verified_toss_payment", {
      provider_snapshot_hash: snapshotHash,
      target_payment_id: paymentId,
      target_user_id: userId,
      verified_amount: order.amount,
      verified_balance_amount: 0,
      verified_canceled_at: new Date().toISOString(),
      verified_currency: order.currency,
      verified_order_number: order.order_number,
      verified_payment_key_hash: paymentKeyHash,
      verified_provider_transaction_hash: hashSynthetic(
        `provider-transaction-${label}`,
      ),
      verified_refund_amount: order.amount,
      verified_status: "CANCELED",
    }),
    "Payment reconciliation",
  );
}

async function runAutomaticRepairScenario() {
  const userId = await createSyntheticUser("repair");
  const payment = await createPaidOrder(userId, "repair");
  const snapshotHash = hashSynthetic(`snapshot-repair-${randomUUID()}`);
  const first = await reconcileCanceledPayment({
    ...payment,
    label: "repair",
    snapshotHash,
    userId,
  });
  const replay = await reconcileCanceledPayment({
    ...payment,
    label: "repair",
    snapshotHash,
    userId,
  });

  const [balance, grantCount, reversalCount, reconciliationCount] =
    await Promise.all([
      requireData(
        admin
          .from("credit_balances")
          .select(
            "balance, reserved_credits, refund_reserved_credits, available_balance",
          )
          .eq("user_id", userId)
          .single(),
        "Repaired balance verification",
      ),
      admin
        .from("credit_ledger_entries")
        .select("id", { count: "exact", head: true })
        .eq("reference_id", payment.order.id)
        .eq("transaction_type", "purchase_grant"),
      admin
        .from("credit_ledger_entries")
        .select("id", { count: "exact", head: true })
        .eq("reference_id", first[0].refund_id)
        .eq("transaction_type", "payment_refund_reversal"),
      admin
        .from("payment_reconciliation_results")
        .select("id", { count: "exact", head: true })
        .eq("payment_id", payment.paymentId),
    ]);

  return {
    outcome: first[0].reconciliation_outcome,
    replayConverged:
      replay[0].reconciliation_id === first[0].reconciliation_id,
    ledgerInvariant:
      grantCount.error === null &&
      reversalCount.error === null &&
      reconciliationCount.error === null &&
      grantCount.count === 1 &&
      reversalCount.count === 1 &&
      reconciliationCount.count === 1 &&
      balance.balance === 0 &&
      balance.available_balance === 0 &&
      balance.reserved_credits === 0 &&
      balance.refund_reserved_credits === 0,
  };
}

async function runManualReviewScenario() {
  const userId = await createSyntheticUser("review");
  const payment = await createPaidOrder(userId, "review");
  const jobId = randomUUID();
  await requireData(
    admin.from("generation_jobs").insert({
      adapter_version: "google-v1",
      aspect_ratio: "1:1",
      id: jobId,
      idempotency_key: randomUUID(),
      model_id: "imagen-3",
      prompt: "synthetic payment incident drill",
      prompt_template_version: "prompt-v1",
      provider_model: "imagen-3.0-generate-002",
      style: "photographic",
      user_id: userId,
    }).select("id"),
    "Synthetic generation setup",
  );
  await requireData(
    admin.rpc("reserve_generation_credits", {
      credit_amount: 3,
      credit_policy_version: "commercial-v2",
      request_idempotency_key: randomUUID(),
      target_generation_job_id: jobId,
    }),
    "Synthetic credit reservation",
  );

  const reconciliation = await reconcileCanceledPayment({
    ...payment,
    label: "review",
    snapshotHash: hashSynthetic(`snapshot-review-${randomUUID()}`),
    userId,
  });
  const [balance, reversalCount] = await Promise.all([
    requireData(
      admin
        .from("credit_balances")
        .select(
          "balance, reserved_credits, refund_reserved_credits, available_balance",
        )
        .eq("user_id", userId)
        .single(),
      "Review-required balance verification",
    ),
    admin
      .from("credit_ledger_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("transaction_type", "payment_refund_reversal"),
  ]);

  return {
    outcome: reconciliation[0].reconciliation_outcome,
    preservedCredits:
      reversalCount.error === null &&
      reversalCount.count === 0 &&
      balance.balance === 3 &&
      balance.available_balance === 0 &&
      balance.reserved_credits === 3 &&
      balance.refund_reserved_credits === 0,
  };
}

async function cleanup() {
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error("Synthetic incident cleanup failed.");
    createdUserIds.delete(userId);
  }
}

async function main() {
  try {
    const [repair, review] = await Promise.all([
      runAutomaticRepairScenario(),
      runManualReviewScenario(),
    ]);
    const report = buildPaymentIncidentDrillReport({
      observedAt: new Date().toISOString(),
      repairedOutcome: repair.outcome,
      repairedReplayConverged: repair.replayConverged,
      repairedLedgerInvariant: repair.ledgerInvariant,
      reviewOutcome: review.outcome,
      reviewPreservedCredits: review.preservedCredits,
    });
    assert.equal(report.status, "passed");
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Payment incident drill failed.",
  );
  process.exitCode = 1;
});
