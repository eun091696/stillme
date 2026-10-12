import { describe, expect, it } from "vitest";

import type { TossPaymentSnapshot } from "./toss";
import {
  hashSensitivePaymentValue,
  extractVerifiedFullRefund,
  parseReconciliationRequest,
  parseRefundRequest,
  parsePaymentRequest,
  parseTossPaymentWebhook,
  verifyTossPayment,
  verifyTossPaymentIdentity,
} from "./verification";

const order = {
  amount: 4_900,
  currency: "KRW" as const,
  id: "11111111-1111-4111-8111-111111111111",
  orderNumber: "aps_11111111111141118111111111111111",
  status: "pending" as const,
};
const payment: TossPaymentSnapshot = {
  approvedAt: "2026-07-28T12:00:00+09:00",
  balanceAmount: 4_900,
  cancels: [],
  currency: "KRW",
  orderId: order.orderNumber,
  paymentKey: "payment-key-test",
  status: "DONE",
  totalAmount: 4_900,
};

describe("Toss payment verification", () => {
  it("accepts only a completed exact order snapshot", () => {
    expect(verifyTossPayment(order, payment)).toEqual({ ok: true });
    expect(
      verifyTossPayment(order, { ...payment, totalAmount: 4_901 }),
    ).toEqual({ code: "AMOUNT_MISMATCH", ok: false });
    expect(
      verifyTossPayment(order, { ...payment, orderId: "other-order" }),
    ).toEqual({ code: "ORDER_MISMATCH", ok: false });
    expect(
      verifyTossPayment(order, { ...payment, status: "IN_PROGRESS" }),
    ).toEqual({ code: "PAYMENT_NOT_DONE", ok: false });
  });

  it("parses bounded client confirmation input", () => {
    expect(
      parsePaymentRequest({
        amount: 4_900,
        orderId: order.id,
        paymentKey: payment.paymentKey,
      }),
    ).toEqual({
      amount: 4_900,
      orderId: order.id,
      paymentKey: payment.paymentKey,
    });
    expect(parsePaymentRequest({ amount: 4_900, orderId: "bad" })).toBeNull();
  });

  it("accepts only PAYMENT_STATUS_CHANGED webhook identity fields", () => {
    expect(
      parseTossPaymentWebhook({
        data: {
          orderId: order.orderNumber,
          paymentKey: payment.paymentKey,
          status: "DONE",
        },
        eventType: "PAYMENT_STATUS_CHANGED",
      }),
    ).toEqual({
      orderNumber: order.orderNumber,
      paymentKey: payment.paymentKey,
    });
    expect(
      parseTossPaymentWebhook({
        data: { orderId: order.orderNumber, paymentKey: payment.paymentKey },
        eventType: "CANCEL_STATUS_CHANGED",
      }),
    ).toBeNull();
  });

  it("hashes sensitive provider identifiers without retaining the value", () => {
    const hash = hashSensitivePaymentValue(payment.paymentKey);
    expect(hash).toMatch(/^[a-f0-9]{64}$/u);
    expect(hash).not.toContain(payment.paymentKey);
  });

  it("verifies a full cancellation and hashes its transaction identity", () => {
    const stored = {
      amount: order.amount,
      currency: order.currency,
      orderNumber: order.orderNumber,
      paymentKeyHash: hashSensitivePaymentValue(payment.paymentKey),
    };
    const canceled = {
      ...payment,
      balanceAmount: 0,
      cancels: [
        {
          cancelAmount: 4_900,
          canceledAt: "2026-07-28T13:00:00+09:00",
          cancelStatus: "DONE",
          transactionKey: "cancel-transaction",
        },
      ],
      status: "CANCELED",
    };

    expect(verifyTossPaymentIdentity(stored, canceled)).toBe(true);
    expect(extractVerifiedFullRefund(stored, canceled)).toMatchObject({
      canceledAt: "2026-07-28T13:00:00+09:00",
      refundAmount: 4_900,
    });
    expect(
      extractVerifiedFullRefund(stored, {
        ...canceled,
        balanceAmount: 1,
      }),
    ).toBeNull();
  });

  it("rejects duplicate cancellation transaction identities", () => {
    const stored = {
      amount: order.amount,
      currency: order.currency,
      orderNumber: order.orderNumber,
      paymentKeyHash: hashSensitivePaymentValue(payment.paymentKey),
    };
    const duplicatedCancellation = {
      ...payment,
      balanceAmount: 0,
      cancels: [
        {
          cancelAmount: 2_450,
          canceledAt: "2026-07-28T13:00:00+09:00",
          cancelStatus: "DONE",
          transactionKey: "duplicated-transaction",
        },
        {
          cancelAmount: 2_450,
          canceledAt: "2026-07-28T13:01:00+09:00",
          cancelStatus: "DONE",
          transactionKey: "duplicated-transaction",
        },
      ],
      status: "CANCELED",
    };

    expect(
      extractVerifiedFullRefund(stored, duplicatedCancellation),
    ).toBeNull();
  });

  it("parses bounded refund and reconciliation requests", () => {
    const paymentId = "11111111-1111-4111-8111-111111111111";
    const idempotencyKey = "22222222-2222-4222-8222-222222222222";
    expect(
      parseRefundRequest({
        idempotencyKey,
        paymentId,
        reasonCode: "CUSTOMER_REQUEST",
      }),
    ).toEqual({ idempotencyKey, paymentId, reasonCode: "CUSTOMER_REQUEST" });
    expect(
      parseRefundRequest({
        idempotencyKey,
        paymentId,
        reasonCode: "raw customer text",
      }),
    ).toBeNull();
    expect(parseReconciliationRequest({ paymentId })).toEqual({ paymentId });
  });
});
