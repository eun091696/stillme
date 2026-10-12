import { createHash } from "node:crypto";

import {
  grobleProductConfiguration,
  parseGroblePaymentCompleted,
  parseGroblePaymentRefunded,
  verifyGrobleWebhookSignature,
} from "@/lib/payments/groble";
import { isJsonMediaType, readBoundedBytes } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_WEBHOOK_BYTES = 64 * 1024;
const MAX_IDEMPOTENCY_KEY_LENGTH = 1024;

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function jsonFromBytes(value: Uint8Array) {
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(value),
    ) as unknown;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!isJsonMediaType(request.headers.get("content-type"))) {
    return Response.json({ code: "MEDIA_TYPE_INVALID" }, { status: 415 });
  }

  const idempotencyKey = request.headers.get("x-groble-idempotency-key");
  if (
    !idempotencyKey ||
    idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH
  ) {
    return Response.json({ code: "WEBHOOK_ID_INVALID" }, { status: 400 });
  }

  const body = await readBoundedBytes(request, MAX_WEBHOOK_BYTES);
  if (!body.ok) {
    return Response.json(
      { code: body.status === 413 ? "WEBHOOK_TOO_LARGE" : "WEBHOOK_INVALID" },
      { status: body.status },
    );
  }

  const currentSecret = process.env.GROBLE_WEBHOOK_SECRET;
  if (!currentSecret) {
    return Response.json({ code: "WEBHOOK_NOT_CONFIGURED" }, { status: 503 });
  }
  const signatureValid = verifyGrobleWebhookSignature({
    currentSecret,
    previousSecret: process.env.GROBLE_WEBHOOK_SECRET_PREVIOUS,
    previousSignature: request.headers.get("x-groble-signature-previous"),
    rawBody: body.rawBody,
    signature: request.headers.get("x-groble-signature"),
    timestamp: request.headers.get("x-groble-timestamp"),
  });
  if (!signatureValid) {
    return Response.json({ code: "WEBHOOK_SIGNATURE_INVALID" }, { status: 401 });
  }

  const parsedBody = jsonFromBytes(body.rawBody);
  const refundedEvent = parseGroblePaymentRefunded(parsedBody);
  if (refundedEvent) {
    const merchantUidHash = sha256(refundedEvent.merchantUid);
    const refundFingerprint = sha256(
      [
        refundedEvent.merchantUid,
        refundedEvent.refundAmount,
        refundedEvent.refundCurrency,
        refundedEvent.partialRefund,
        refundedEvent.refundedAt,
      ].join("\u0000"),
    );
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("process_verified_groble_refund", {
      verified_cancelled_by: refundedEvent.cancelledBy,
      verified_currency: refundedEvent.refundCurrency,
      verified_merchant_uid_hash: merchantUidHash,
      verified_original_amount: refundedEvent.originalAmount,
      verified_partial_refund: refundedEvent.partialRefund,
      verified_refund_amount: refundedEvent.refundAmount,
      verified_refund_event_hash: sha256(refundedEvent.eventId),
      verified_refund_fingerprint_hash: refundFingerprint,
      verified_refunded_at: refundedEvent.refundedAt,
      webhook_payload_hash: sha256(body.rawBody),
      webhook_transmission_id: sha256(idempotencyKey),
    });
    if (error || !Array.isArray(data) || !data[0]) {
      return Response.json({ code: "WEBHOOK_PERSIST_FAILED" }, { status: 503 });
    }
    return Response.json(
      {
        receiptId: data[0].receipt_id,
        refundId: data[0].refund_id,
        status: data[0].refund_status,
      },
      { status: 200 },
    );
  }

  const event = parseGroblePaymentCompleted(parsedBody);
  if (!event) {
    return Response.json({ code: "WEBHOOK_INVALID" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin
    .from("payment_orders")
    .select(
      "id, amount, credit_amount, currency, product_code, product_version, status",
    )
    .eq("order_number", event.sellerReference)
    .maybeSingle();
  if (orderError) {
    return Response.json({ code: "WEBHOOK_LOOKUP_FAILED" }, { status: 503 });
  }
  if (!order) {
    return Response.json({ code: "WEBHOOK_MISMATCH" }, { status: 400 });
  }

  const product = grobleProductConfiguration(order.product_code);
  const optionMatches =
    !product?.optionId ||
    (event.options.length === 1 &&
      event.options[0].optionId === product.optionId &&
      event.options[0].quantity === 1);
  if (
    !product ||
    event.content.id !== product.contentId ||
    !optionMatches ||
    event.pricing.currency !== order.currency ||
    event.pricing.finalAmount !== order.amount
  ) {
    return Response.json({ code: "WEBHOOK_MISMATCH" }, { status: 400 });
  }

  const { data, error } = await admin.rpc("process_verified_groble_payment", {
    verified_amount: event.pricing.finalAmount,
    verified_currency: event.pricing.currency,
    verified_merchant_uid_hash: sha256(event.merchantUid),
    verified_order_number: event.sellerReference,
    verified_purchased_at: event.purchasedAt,
    webhook_event_type: "payment.completed",
    webhook_payload_hash: sha256(body.rawBody),
    webhook_transmission_id: sha256(idempotencyKey),
  });
  if (error || !Array.isArray(data) || !data[0]) {
    return Response.json({ code: "WEBHOOK_PERSIST_FAILED" }, { status: 503 });
  }

  return Response.json(
    {
      outcome: data[0].processing_outcome,
      reconciliationId: data[0].reconciliation_id ?? null,
      receiptId: data[0].receipt_id,
      status: data[0].receipt_status,
    },
    { status: 200 },
  );
}
