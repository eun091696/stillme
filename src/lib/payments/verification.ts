import { createHash } from "node:crypto";

import type { TossPaymentSnapshot } from "./toss";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const ORDER_NUMBER_PATTERN = /^aps_[0-9a-f]{32}$/u;

export type StoredPaymentOrder = {
  amount: number;
  currency: "KRW";
  id: string;
  orderNumber: string;
  status: "created" | "failed" | "paid" | "pending";
};

export type StoredRefundablePayment = {
  amount: number;
  currency: "KRW";
  orderNumber: string;
  paymentKeyHash: string;
};

type PaymentVerificationResult =
  | { ok: true }
  | {
      code:
        | "AMOUNT_MISMATCH"
        | "CURRENCY_MISMATCH"
        | "ORDER_MISMATCH"
        | "ORDER_STATE_INVALID"
        | "PAYMENT_NOT_DONE";
      ok: false;
    };

export function verifyTossPayment(
  order: StoredPaymentOrder,
  payment: TossPaymentSnapshot,
): PaymentVerificationResult {
  if (!["created", "pending", "paid"].includes(order.status)) {
    return { code: "ORDER_STATE_INVALID", ok: false };
  }
  if (payment.orderId !== order.orderNumber) {
    return { code: "ORDER_MISMATCH", ok: false };
  }
  if (payment.totalAmount !== order.amount) {
    return { code: "AMOUNT_MISMATCH", ok: false };
  }
  if (payment.currency !== order.currency) {
    return { code: "CURRENCY_MISMATCH", ok: false };
  }
  if (payment.status !== "DONE" || !payment.approvedAt) {
    return { code: "PAYMENT_NOT_DONE", ok: false };
  }
  return { ok: true };
}

export function hashSensitivePaymentValue(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function verifyTossPaymentIdentity(
  payment: StoredRefundablePayment,
  snapshot: TossPaymentSnapshot,
) {
  return (
    snapshot.orderId === payment.orderNumber &&
    snapshot.totalAmount === payment.amount &&
    snapshot.currency === payment.currency &&
    hashSensitivePaymentValue(snapshot.paymentKey) === payment.paymentKeyHash
  );
}

export function extractVerifiedFullRefund(
  payment: StoredRefundablePayment,
  snapshot: TossPaymentSnapshot,
) {
  const summary = summarizeVerifiedTossRefunds(payment, snapshot);
  if (
    !summary ||
    snapshot.status !== "CANCELED" ||
    snapshot.balanceAmount !== 0 ||
    summary.refundAmount !== payment.amount ||
    !summary.providerTransactionHash ||
    !summary.canceledAt
  ) {
    return null;
  }
  return {
    canceledAt: summary.canceledAt,
    providerTransactionHash: summary.providerTransactionHash,
    refundAmount: summary.refundAmount,
  };
}

export function summarizeVerifiedTossRefunds(
  payment: StoredRefundablePayment,
  snapshot: TossPaymentSnapshot,
) {
  if (!verifyTossPaymentIdentity(payment, snapshot)) return null;
  const completed = snapshot.cancels.filter(
    (cancellation) => cancellation.cancelStatus === "DONE",
  );
  const transactionKeys = completed.map(
    (cancellation) => cancellation.transactionKey,
  );
  if (new Set(transactionKeys).size !== transactionKeys.length) return null;
  const refundAmount = completed.reduce(
    (total, cancellation) => total + cancellation.cancelAmount,
    0,
  );
  if (refundAmount > payment.amount) return null;
  const transactionIdentity = transactionKeys.sort().join(":");
  const canceledAt = completed
    .map((cancellation) => cancellation.canceledAt)
    .sort()
    .at(-1);
  return {
    canceledAt: canceledAt ?? null,
    providerTransactionHash:
      transactionIdentity.length > 0
        ? hashSensitivePaymentValue(transactionIdentity)
        : null,
    refundAmount,
  };
}

export function hashTossReconciliationSnapshot(
  payment: StoredRefundablePayment,
  snapshot: TossPaymentSnapshot,
) {
  const summary = summarizeVerifiedTossRefunds(payment, snapshot);
  if (!summary) return null;
  return hashSensitivePaymentValue(
    JSON.stringify({
      balanceAmount: snapshot.balanceAmount,
      canceledAt: summary.canceledAt,
      currency: snapshot.currency,
      orderId: snapshot.orderId,
      paymentKeyHash: payment.paymentKeyHash,
      providerTransactionHash: summary.providerTransactionHash,
      refundAmount: summary.refundAmount,
      status: snapshot.status,
      totalAmount: snapshot.totalAmount,
    }),
  );
}

const REFUND_REASONS = new Set([
  "CUSTOMER_REQUEST",
  "DUPLICATE_PAYMENT",
  "SERVICE_NOT_PROVIDED",
]);

export function parseRefundRequest(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (
    typeof body.paymentId !== "string" ||
    !UUID_V4_PATTERN.test(body.paymentId) ||
    typeof body.idempotencyKey !== "string" ||
    !UUID_V4_PATTERN.test(body.idempotencyKey) ||
    typeof body.reasonCode !== "string" ||
    !REFUND_REASONS.has(body.reasonCode)
  ) {
    return null;
  }
  return {
    idempotencyKey: body.idempotencyKey,
    paymentId: body.paymentId,
    reasonCode: body.reasonCode,
  };
}

export function parseReconciliationRequest(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (
    typeof body.paymentId !== "string" ||
    !UUID_V4_PATTERN.test(body.paymentId)
  ) {
    return null;
  }
  return { paymentId: body.paymentId };
}

export function parsePaymentRequest(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (
    typeof body.orderId !== "string" ||
    !UUID_V4_PATTERN.test(body.orderId) ||
    typeof body.paymentKey !== "string" ||
    body.paymentKey.length < 6 ||
    body.paymentKey.length > 200 ||
    !Number.isSafeInteger(body.amount) ||
    Number(body.amount) < 1
  ) {
    return null;
  }
  return {
    amount: Number(body.amount),
    orderId: body.orderId,
    paymentKey: body.paymentKey,
  };
}

export function parseTossPaymentWebhook(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const event = value as Record<string, unknown>;
  if (
    event.eventType !== "PAYMENT_STATUS_CHANGED" ||
    !event.data ||
    typeof event.data !== "object"
  ) {
    return null;
  }
  const data = event.data as Record<string, unknown>;
  if (
    typeof data.paymentKey !== "string" ||
    data.paymentKey.length < 6 ||
    data.paymentKey.length > 200 ||
    typeof data.orderId !== "string" ||
    !ORDER_NUMBER_PATTERN.test(data.orderId)
  ) {
    return null;
  }
  return { orderNumber: data.orderId, paymentKey: data.paymentKey };
}
