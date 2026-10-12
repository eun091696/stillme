import { createTossPaymentClientFromEnvironment } from "@/lib/payments/toss";
import {
  extractVerifiedFullRefund,
  parseRefundRequest,
  verifyTossPaymentIdentity,
} from "@/lib/payments/verification";
import { readSameOriginJson } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PROVIDER_REASONS: Record<string, string> = {
  CUSTOMER_REQUEST: "Customer requested a full refund",
  DUPLICATE_PAYMENT: "Duplicate payment",
  SERVICE_NOT_PROVIDED: "Service was not provided",
};

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
  const input = parseRefundRequest(parsed.data);
  if (!input) {
    return Response.json({ code: "REFUND_INVALID" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("begin_payment_refund", {
    refund_reason_code: input.reasonCode,
    request_idempotency_key: input.idempotencyKey,
    target_payment_id: input.paymentId,
    target_user_id: user.id,
  });
  if (error || !Array.isArray(data) || !data[0]) {
    return Response.json({ code: "REFUND_NOT_ELIGIBLE" }, { status: 409 });
  }
  const refund = data[0] as Record<string, unknown>;
  if (refund.refund_status === "succeeded") {
    return Response.json({
      refundId: refund.refund_id,
      status: refund.refund_status,
    });
  }
  if (refund.refund_status === "failed") {
    return Response.json({ code: "REFUND_FAILED" }, { status: 409 });
  }

  const storedPayment = {
    amount: Number(refund.refund_amount),
    currency: refund.refund_currency as "KRW",
    orderNumber: String(refund.order_number),
    paymentKeyHash: String(refund.payment_key_hash),
  };
  const refundId = String(refund.refund_id);
  try {
    const toss = createTossPaymentClientFromEnvironment();
    const current = await toss.getByOrderId(storedPayment.orderNumber);
    if (!verifyTossPaymentIdentity(storedPayment, current)) {
      await admin.rpc("fail_payment_refund", {
        safe_failure_code: "PROVIDER_IDENTITY_MISMATCH",
        target_refund_id: refundId,
      });
      return Response.json({ code: "REFUND_MISMATCH" }, { status: 409 });
    }
    const canceled = await toss.cancel({
      amount: storedPayment.amount,
      idempotencyKey: refundId,
      paymentKey: current.paymentKey,
      reason: PROVIDER_REASONS[input.reasonCode],
    });
    const verification = extractVerifiedFullRefund(storedPayment, canceled);
    if (!verification) {
      await admin.rpc("mark_payment_refund_reconciliation_required", {
        target_refund_id: refundId,
      });
      return Response.json(
        { refundId, status: "reconciliation_required" },
        { status: 202 },
      );
    }

    const { error: applyError } = await admin.rpc(
      "apply_verified_payment_refund",
      {
        target_refund_id: refundId,
        verified_amount: storedPayment.amount,
        verified_balance_amount: canceled.balanceAmount,
        verified_canceled_at: verification.canceledAt,
        verified_currency: storedPayment.currency,
        verified_order_number: storedPayment.orderNumber,
        verified_payment_key_hash: storedPayment.paymentKeyHash,
        verified_provider_transaction_hash:
          verification.providerTransactionHash,
        verified_status: canceled.status,
      },
    );
    if (applyError) {
      await admin.rpc("mark_payment_refund_reconciliation_required", {
        target_refund_id: refundId,
      });
      return Response.json(
        { refundId, status: "reconciliation_required" },
        { status: 202 },
      );
    }
    return Response.json({ refundId, status: "succeeded" });
  } catch {
    await admin.rpc("mark_payment_refund_reconciliation_required", {
      target_refund_id: refundId,
    });
    return Response.json(
      { refundId, status: "reconciliation_required" },
      { status: 202 },
    );
  }
}
