import { createTossPaymentClientFromEnvironment } from "@/lib/payments/toss";
import {
  hashSensitivePaymentValue,
  parsePaymentRequest,
  verifyTossPayment,
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

  const input = parsePaymentRequest(parsed.data);
  if (!input) {
    return Response.json({ code: "PAYMENT_INVALID" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: storedOrder, error: orderError } = await admin
    .from("payment_orders")
    .select("id, order_number, amount, currency, status")
    .eq("id", input.orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (orderError || !storedOrder || input.amount !== storedOrder.amount) {
    return Response.json({ code: "PAYMENT_MISMATCH" }, { status: 409 });
  }

  try {
    const toss = createTossPaymentClientFromEnvironment();
    const payment = await toss.confirm({
      amount: storedOrder.amount,
      idempotencyKey: storedOrder.id,
      orderId: storedOrder.order_number,
      paymentKey: input.paymentKey,
    });
    const verification = verifyTossPayment(
      {
        amount: storedOrder.amount,
        currency: storedOrder.currency,
        id: storedOrder.id,
        orderNumber: storedOrder.order_number,
        status: storedOrder.status,
      },
      payment,
    );
    if (!verification.ok || payment.paymentKey !== input.paymentKey) {
      return Response.json({ code: "PAYMENT_MISMATCH" }, { status: 409 });
    }

    const { data: paymentId, error } = await admin.rpc(
      "record_verified_toss_payment",
      {
        target_order_id: storedOrder.id,
        target_user_id: user.id,
        verified_amount: payment.totalAmount,
        verified_approved_at: payment.approvedAt,
        verified_currency: payment.currency,
        verified_order_number: payment.orderId,
        verified_payment_key_hash: hashSensitivePaymentValue(
          payment.paymentKey,
        ),
        verified_status: payment.status,
      },
    );
    if (error || typeof paymentId !== "string") {
      return Response.json(
        { code: "PAYMENT_RECORD_FAILED" },
        { status: 503 },
      );
    }
    return Response.json({ orderId: storedOrder.id, paymentId });
  } catch {
    return Response.json(
      { code: "PAYMENT_CONFIRM_FAILED" },
      { status: 502 },
    );
  }
}
