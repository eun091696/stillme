import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildGrobleCheckoutUrl,
  grobleProductConfiguration,
  parseGroblePaymentCompleted,
  parseGroblePaymentRefunded,
  verifyGrobleWebhookSignature,
} from "./groble";

const validPayload = {
  data: {
    object: {
      buyer: {
        displayName: "Buyer",
        email: "buyer@example.test",
        phoneNumber: "01000000000",
        type: "INDIVIDUAL",
      },
      content: {
        id: "encoded-content-id",
        paymentType: "ONE_TIME",
        title: "STILLME Starter",
        type: "SERVICE",
      },
      merchantUid: "merchant-uid",
      options: [
        {
          optionId: "encoded-option-id",
          quantity: 1,
          subtotal: 4_900,
          unitDiscountedPrice: 4_900,
          unitOriginalPrice: 4_900,
        },
      ],
      payment: { purchasedAt: "2026-08-25T10:00:00+09:00" },
      paymentMethod: { type: "CARD" },
      pricing: {
        couponDiscountAmount: 0,
        currency: "KRW",
        finalAmount: 4_900,
        optionDiscountAmount: 0,
        originalAmount: 4_900,
      },
      sellerReference: "aps_11111111111141118111111111111111",
    },
  },
  id: "evt_test",
  occurredAt: "2026-08-25T10:00:00+09:00",
  type: "payment.completed",
  version: "2026-04-30",
};

const validRefundPayload = {
  data: {
    object: {
      merchantUid: "merchant-uid",
      pricing: { currency: "KRW", finalAmount: 4_900 },
      refund: {
        amount: 4_900,
        cancelledBy: "BUYER",
        currency: "KRW",
        partialRefund: false,
        reason: "not persisted",
        refundedAt: "2026-08-25T11:00:00+09:00",
      },
    },
  },
  id: "evt_refund",
  occurredAt: "2026-08-25T11:00:00+09:00",
  type: "payment.refunded",
  version: "2026-04-30",
};

function signature(secret: string, timestamp: string, rawBody: Uint8Array) {
  return createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(rawBody)
    .digest("hex");
}

afterEach(() => {
  for (const name of [
    "GROBLE_STARTER_CONTENT_ID",
    "GROBLE_STARTER_OPTION_ID",
    "GROBLE_STARTER_PAYMENT_URL",
  ]) {
    delete process.env[name];
  }
});

describe("Groble webhook verification", () => {
  it("verifies the raw body with the current secret and a fresh timestamp", () => {
    const timestamp = "1787619600";
    const rawBody = new TextEncoder().encode(JSON.stringify(validPayload));
    expect(
      verifyGrobleWebhookSignature({
        currentSecret: "current-secret",
        nowMilliseconds: 1_787_619_600_000,
        rawBody,
        signature: signature("current-secret", timestamp, rawBody),
        timestamp,
      }),
    ).toBe(true);
    expect(
      verifyGrobleWebhookSignature({
        currentSecret: "current-secret",
        nowMilliseconds: 1_787_619_901_000,
        rawBody,
        signature: signature("current-secret", timestamp, rawBody),
        timestamp,
      }),
    ).toBe(false);
    expect(
      verifyGrobleWebhookSignature({
        currentSecret: "current-secret",
        nowMilliseconds: 1_787_619_600_000,
        previousSecret: "previous-secret",
        previousSignature: signature("previous-secret", timestamp, rawBody),
        rawBody,
        signature: null,
        timestamp,
      }),
    ).toBe(false);
  });

  it("accepts the previous signature only when the previous secret is set", () => {
    const timestamp = "1787619600";
    const rawBody = new TextEncoder().encode(JSON.stringify(validPayload));
    const previousSignature = signature("previous-secret", timestamp, rawBody);
    expect(
      verifyGrobleWebhookSignature({
        currentSecret: "current-secret",
        nowMilliseconds: 1_787_619_600_000,
        previousSecret: "previous-secret",
        previousSignature,
        rawBody,
        signature: "0".repeat(64),
        timestamp,
      }),
    ).toBe(true);
    expect(
      verifyGrobleWebhookSignature({
        currentSecret: "current-secret",
        nowMilliseconds: 1_787_619_600_000,
        previousSignature,
        rawBody,
        signature: "0".repeat(64),
        timestamp,
      }),
    ).toBe(false);
  });

  it("parses only the documented one-time service completion fields", () => {
    expect(parseGroblePaymentCompleted(validPayload)).toMatchObject({
      content: { id: "encoded-content-id", type: "SERVICE" },
      merchantUid: "merchant-uid",
      pricing: { currency: "KRW", finalAmount: 4_900 },
      sellerReference: "aps_11111111111141118111111111111111",
    });
    expect(
      parseGroblePaymentCompleted({
        ...validPayload,
        data: {
          object: {
            ...validPayload.data.object,
            content: { ...validPayload.data.object.content, type: "GOODS" },
          },
        },
      }),
    ).toBeNull();
    expect(
      parseGroblePaymentCompleted({
        ...validPayload,
        data: {
          object: { ...validPayload.data.object, sellerReference: "bad value" },
        },
      }),
    ).toBeNull();
  });

  it("loads product identifiers from server-only configuration", () => {
    process.env.GROBLE_STARTER_CONTENT_ID = "content-starter";
    process.env.GROBLE_STARTER_OPTION_ID = "option-starter";
    process.env.GROBLE_STARTER_PAYMENT_URL =
      "https://groble.im/payment/starter";
    expect(grobleProductConfiguration("STARTER-3")).toEqual({
      contentId: "content-starter",
      optionId: "option-starter",
      paymentUrl: "https://groble.im/payment/starter",
    });
    expect(grobleProductConfiguration("UNKNOWN")).toBeNull();
  });

  it("parses documented refunds without retaining buyer or reason fields", () => {
    expect(parseGroblePaymentRefunded(validRefundPayload)).toEqual({
      cancelledBy: "BUYER",
      eventId: "evt_refund",
      merchantUid: "merchant-uid",
      occurredAt: "2026-08-25T11:00:00+09:00",
      originalAmount: 4_900,
      partialRefund: false,
      refundAmount: 4_900,
      refundCurrency: "KRW",
      refundedAt: "2026-08-25T11:00:00+09:00",
    });
    expect(
      parseGroblePaymentRefunded({
        ...validRefundPayload,
        data: {
          object: {
            ...validRefundPayload.data.object,
            refund: {
              ...validRefundPayload.data.object.refund,
              amount: 1_000,
            },
          },
        },
      }),
    ).toBeNull();
  });

  it("adds only a valid seller reference to a Groble HTTPS payment URL", () => {
    expect(
      buildGrobleCheckoutUrl(
        "https://groble.im/payment/starter?campaign=test",
        "aps_11111111111141118111111111111111",
      ),
    ).toBe(
      "https://groble.im/payment/starter?campaign=test&ref=aps_11111111111141118111111111111111",
    );
    expect(
      buildGrobleCheckoutUrl(
        "https://example.test/payment",
        "aps_11111111111141118111111111111111",
      ),
    ).toBeNull();
  });
});
