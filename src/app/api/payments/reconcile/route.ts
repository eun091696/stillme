import { createTossPaymentClientFromEnvironment } from "@/lib/payments/toss";
import {
  hashSensitivePaymentValue,
  hashTossReconciliationSnapshot,
  parseReconciliationRequest,
  summarizeVerifiedTossRefunds,
} from "@/lib/payments/verification";
import { readSameOriginJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const parsed = await readSameOriginJson(request);
  if (!parsed.ok) {
    return Response.json(
      { code: "REQUEST_REJECTED" },
      { status: parsed.status },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ code: "AUTH_REQUIRED" }, { status: 401 });
  }
  const input = parseReconciliationRequest(parsed.data);
  if (!input) {
    return Response.json({ code: "RECONCILIATION_INVALID" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: payment, error } = await admin
    .from("payments")
    .select("id, amount, currency, payment_key_hash, provider, payment_orders!inner(order_number)")
    .eq("id", input.paymentId)
    .eq("user_id", user.id)
    .maybeSingle();
  const relation = payment?.payment_orders as unknown as
    | { order_number: string }
    | undefined;
  if (error || !payment || !relation) {
    return Response.json({ code: "PAYMENT_NOT_FOUND" }, { status: 404 });
  }
  if (payment.provider !== "toss") {
    return Response.json(
      { code: "RECONCILIATION_PROVIDER_UNSUPPORTED" },
      { status: 409 },
    );
  }
  const storedPayment = {
    amount: payment.amount,
    currency: payment.currency as "KRW",
    orderNumber: relation.order_number,
    paymentKeyHash: payment.payment_key_hash,
  };

  try {
    const snapshot =
      await createTossPaymentClientFromEnvironment().getByOrderId(
        storedPayment.orderNumber,
      );
    const summary = summarizeVerifiedTossRefunds(storedPayment, snapshot);
    const snapshotHash = hashTossReconciliationSnapshot(
      storedPayment,
      snapshot,
    );
    if (!summary || !snapshotHash) {
      return Response.json(
        { code: "RECONCILIATION_MISMATCH" },
        { status: 409 },
      );
    }
    const { data, error: reconciliationError } = await admin.rpc(
      "reconcile_verified_toss_payment",
      {
        provider_snapshot_hash: snapshotHash,
        target_payment_id: payment.id,
        target_user_id: user.id,
        verified_amount: snapshot.totalAmount,
        verified_balance_amount: snapshot.balanceAmount,
        verified_canceled_at: summary.canceledAt,
        verified_currency: snapshot.currency,
        verified_order_number: snapshot.orderId,
        verified_payment_key_hash: hashSensitivePaymentValue(
          snapshot.paymentKey,
        ),
        verified_provider_transaction_hash:
          summary.providerTransactionHash,
        verified_refund_amount: summary.refundAmount,
        verified_status: snapshot.status,
      },
    );
    if (reconciliationError || !Array.isArray(data) || !data[0]) {
      return Response.json(
        { code: "RECONCILIATION_FAILED" },
        { status: 503 },
      );
    }
    return Response.json({
      outcome: data[0].reconciliation_outcome,
      reconciliationId: data[0].reconciliation_id,
      refundId: data[0].refund_id,
    });
  } catch {
    return Response.json(
      { code: "RECONCILIATION_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
