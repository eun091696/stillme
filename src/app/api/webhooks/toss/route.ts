import { createTossPaymentClientFromEnvironment } from "@/lib/payments/toss";
import {
  hashSensitivePaymentValue,
  parseTossPaymentWebhook,
} from "@/lib/payments/verification";
import {
  isJsonMediaType,
  readBoundedText,
} from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_WEBHOOK_BYTES = 64 * 1024;
const TRANSMISSION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;

export async function POST(request: Request) {
  if (!isJsonMediaType(request.headers.get("content-type"))) {
    return Response.json({ code: "MEDIA_TYPE_INVALID" }, { status: 415 });
  }
  const transmissionId = request.headers.get(
    "tosspayments-webhook-transmission-id",
  );
  if (!transmissionId || !TRANSMISSION_ID_PATTERN.test(transmissionId)) {
    return Response.json({ code: "WEBHOOK_ID_INVALID" }, { status: 400 });
  }

  const body = await readBoundedText(request, MAX_WEBHOOK_BYTES);
  if (!body.ok) {
    return Response.json(
      {
        code:
          body.status === 413 ? "WEBHOOK_TOO_LARGE" : "WEBHOOK_INVALID",
      },
      { status: body.status },
    );
  }
  const rawBody = body.rawBody;
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody) as unknown;
  } catch {
    parsedBody = null;
  }
  const event = parseTossPaymentWebhook(parsedBody);
  if (!event) {
    return Response.json({ code: "WEBHOOK_INVALID" }, { status: 400 });
  }

  try {
    const toss = createTossPaymentClientFromEnvironment();
    const payment = await toss.get(event.paymentKey);
    if (
      payment.paymentKey !== event.paymentKey ||
      payment.orderId !== event.orderNumber
    ) {
      return Response.json({ code: "WEBHOOK_MISMATCH" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: order, error: orderError } = await admin
      .from("payment_orders")
      .select("amount, currency")
      .eq("order_number", payment.orderId)
      .maybeSingle();
    if (
      orderError ||
      !order ||
      order.amount !== payment.totalAmount ||
      order.currency !== payment.currency
    ) {
      return Response.json({ code: "WEBHOOK_MISMATCH" }, { status: 401 });
    }

    const { data, error } = await admin.rpc(
      "process_verified_toss_webhook",
      {
        verified_amount: payment.totalAmount,
        verified_approved_at: payment.approvedAt,
        verified_currency: payment.currency,
        verified_order_number: payment.orderId,
        verified_payment_key_hash: hashSensitivePaymentValue(
          payment.paymentKey,
        ),
        verified_status: payment.status,
        webhook_event_type: "PAYMENT_STATUS_CHANGED",
        webhook_payload_hash: hashSensitivePaymentValue(rawBody),
        webhook_transmission_id: transmissionId,
      },
    );
    if (error || !Array.isArray(data) || !data[0]) {
      return Response.json({ code: "WEBHOOK_PERSIST_FAILED" }, { status: 503 });
    }
    return Response.json(
      {
        receiptId: data[0].receipt_id,
        status: data[0].receipt_status,
      },
      { status: 200 },
    );
  } catch {
    return Response.json({ code: "WEBHOOK_VERIFY_FAILED" }, { status: 503 });
  }
}
