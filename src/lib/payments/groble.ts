import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const GROBLE_SELLER_REFERENCE_PATTERN =
  /^[A-Za-z0-9\-_.:=~]{1,128}$/u;

const GROBLE_SIGNATURE_PATTERN = /^[a-f0-9]{64}$/iu;
const MAX_TIMESTAMP_DRIFT_SECONDS = 5 * 60;
const PRODUCT_ENVIRONMENT_KEYS = {
  "STARTER-3": "STARTER",
  "STANDARD-7": "STANDARD",
  "PRO-16": "PRO",
} as const;
const GROBLE_PRO_PAYMENT_URL = "https://www.groble.im/payment/gr4xTv";

export type GrobleProductCode = keyof typeof PRODUCT_ENVIRONMENT_KEYS;

export type GrobleProductConfiguration = {
  contentId: string;
  optionId: string | null;
  paymentUrl: string | null;
};

export type GroblePaymentCompleted = {
  content: {
    id: string;
    paymentType: "ONE_TIME";
    title: string;
    type: "SERVICE";
  };
  eventId: string;
  merchantUid: string;
  occurredAt: string;
  options: Array<{
    optionId: string;
    quantity: number;
    subtotal: number;
    unitDiscountedPrice: number;
    unitOriginalPrice: number;
  }>;
  pricing: {
    couponDiscountAmount: number;
    currency: "KRW";
    finalAmount: number;
    optionDiscountAmount: number;
    originalAmount: number;
  };
  purchasedAt: string;
  sellerReference: string;
};

export type GroblePaymentRefunded = {
  cancelledBy: "BUYER" | "SELLER" | "ADMIN";
  eventId: string;
  merchantUid: string;
  occurredAt: string;
  originalAmount: number;
  partialRefund: boolean;
  refundAmount: number;
  refundCurrency: "KRW";
  refundedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBoundedString(value: unknown, maxLength = 256): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isMoney(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isKstIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /\+09:00$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function safeSignatureEqual(expected: string, received: string | null) {
  if (!received || !GROBLE_SIGNATURE_PATTERN.test(received)) return false;
  const expectedBytes = Buffer.from(expected, "hex");
  const receivedBytes = Buffer.from(received, "hex");
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}

function grobleSignature(secret: string, timestamp: string, rawBody: Uint8Array) {
  return createHmac("sha256", secret)
    .update(timestamp, "utf8")
    .update(".", "utf8")
    .update(rawBody)
    .digest("hex");
}

export function verifyGrobleWebhookSignature(input: {
  currentSecret: string;
  nowMilliseconds?: number;
  previousSecret?: string | null;
  previousSignature?: string | null;
  rawBody: Uint8Array;
  signature: string | null;
  timestamp: string | null;
}) {
  if (
    !input.currentSecret ||
    !input.signature ||
    !input.timestamp ||
    !/^\d+$/u.test(input.timestamp)
  ) {
    return false;
  }
  const timestampSeconds = Number(input.timestamp);
  const nowSeconds = Math.floor((input.nowMilliseconds ?? Date.now()) / 1000);
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    Math.abs(nowSeconds - timestampSeconds) > MAX_TIMESTAMP_DRIFT_SECONDS
  ) {
    return false;
  }

  const current = grobleSignature(
    input.currentSecret,
    input.timestamp,
    input.rawBody,
  );
  if (safeSignatureEqual(current, input.signature)) return true;

  if (!input.previousSecret || !input.previousSignature) return false;
  const previous = grobleSignature(
    input.previousSecret,
    input.timestamp,
    input.rawBody,
  );
  return safeSignatureEqual(previous, input.previousSignature);
}

export function parseGroblePaymentCompleted(
  value: unknown,
): GroblePaymentCompleted | null {
  if (!isRecord(value) || value.type !== "payment.completed") return null;
  if (
    !isBoundedString(value.id) ||
    !isBoundedString(value.version, 64) ||
    !isKstIsoTimestamp(value.occurredAt) ||
    !isRecord(value.data) ||
    !isRecord(value.data.object)
  ) {
    return null;
  }

  const object = value.data.object;
  if (
    !isBoundedString(object.merchantUid) ||
    typeof object.sellerReference !== "string" ||
    !GROBLE_SELLER_REFERENCE_PATTERN.test(object.sellerReference) ||
    !isRecord(object.content) ||
    !Array.isArray(object.options) ||
    !isRecord(object.pricing) ||
    !isRecord(object.payment) ||
    !isRecord(object.paymentMethod)
  ) {
    return null;
  }

  const content = object.content;
  const pricing = object.pricing;
  const payment = object.payment;
  const paymentMethod = object.paymentMethod;
  if (
    !isBoundedString(content.id) ||
    !isBoundedString(content.title, 512) ||
    content.type !== "SERVICE" ||
    content.paymentType !== "ONE_TIME" ||
    pricing.currency !== "KRW" ||
    !isMoney(pricing.originalAmount) ||
    !isMoney(pricing.optionDiscountAmount) ||
    !isMoney(pricing.finalAmount) ||
    !isMoney(pricing.couponDiscountAmount) ||
    !isKstIsoTimestamp(payment.purchasedAt) ||
    (paymentMethod.type !== "CARD" && paymentMethod.type !== "FREE")
  ) {
    return null;
  }

  const options = object.options.map((option) => {
    if (
      !isRecord(option) ||
      !isBoundedString(option.optionId) ||
      !isPositiveInteger(option.quantity) ||
      !isMoney(option.unitOriginalPrice) ||
      !isMoney(option.unitDiscountedPrice) ||
      !isMoney(option.subtotal)
    ) {
      return null;
    }
    return {
      optionId: option.optionId,
      quantity: option.quantity,
      subtotal: option.subtotal,
      unitDiscountedPrice: option.unitDiscountedPrice,
      unitOriginalPrice: option.unitOriginalPrice,
    };
  });
  if (options.some((option) => option === null)) return null;

  return {
    content: {
      id: content.id,
      paymentType: "ONE_TIME",
      title: content.title,
      type: "SERVICE",
    },
    eventId: value.id,
    merchantUid: object.merchantUid,
    occurredAt: value.occurredAt,
    options: options as GroblePaymentCompleted["options"],
    pricing: {
      couponDiscountAmount: pricing.couponDiscountAmount,
      currency: "KRW",
      finalAmount: pricing.finalAmount,
      optionDiscountAmount: pricing.optionDiscountAmount,
      originalAmount: pricing.originalAmount,
    },
    purchasedAt: payment.purchasedAt,
    sellerReference: object.sellerReference,
  };
}

export function parseGroblePaymentRefunded(
  value: unknown,
): GroblePaymentRefunded | null {
  if (!isRecord(value) || value.type !== "payment.refunded") return null;
  if (
    !isBoundedString(value.id) ||
    !isBoundedString(value.version, 64) ||
    !isKstIsoTimestamp(value.occurredAt) ||
    !isRecord(value.data) ||
    !isRecord(value.data.object)
  ) {
    return null;
  }
  const object = value.data.object;
  if (
    !isBoundedString(object.merchantUid) ||
    !isRecord(object.pricing) ||
    !isRecord(object.refund)
  ) {
    return null;
  }
  const pricing = object.pricing;
  const refund = object.refund;
  if (
    pricing.currency !== "KRW" ||
    !isMoney(pricing.finalAmount) ||
    refund.currency !== "KRW" ||
    !isPositiveInteger(refund.amount) ||
    typeof refund.partialRefund !== "boolean" ||
    !["BUYER", "SELLER", "ADMIN"].includes(String(refund.cancelledBy)) ||
    !isKstIsoTimestamp(refund.refundedAt) ||
    refund.amount > pricing.finalAmount ||
    (!refund.partialRefund && refund.amount !== pricing.finalAmount)
  ) {
    return null;
  }
  return {
    cancelledBy: refund.cancelledBy as GroblePaymentRefunded["cancelledBy"],
    eventId: value.id,
    merchantUid: object.merchantUid,
    occurredAt: value.occurredAt,
    originalAmount: pricing.finalAmount,
    partialRefund: refund.partialRefund,
    refundAmount: refund.amount,
    refundCurrency: "KRW",
    refundedAt: refund.refundedAt,
  };
}

function optionalEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function validGroblePaymentUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.hostname !== "groble.im" && !url.hostname.endsWith(".groble.im"))
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function grobleProductConfiguration(
  productCode: string,
): GrobleProductConfiguration | null {
  const suffix = PRODUCT_ENVIRONMENT_KEYS[productCode as GrobleProductCode];
  if (!suffix) return null;
  const contentId = optionalEnvironmentValue(`GROBLE_${suffix}_CONTENT_ID`);
  if (!contentId) return null;
  const configuredPaymentUrl = optionalEnvironmentValue(
    `GROBLE_${suffix}_PAYMENT_URL`,
  );
  return {
    contentId,
    optionId: optionalEnvironmentValue(`GROBLE_${suffix}_OPTION_ID`),
    paymentUrl: validGroblePaymentUrl(
      configuredPaymentUrl ??
        (productCode === "PRO-16" && contentId === "gr4xTv"
          ? GROBLE_PRO_PAYMENT_URL
          : null),
    ),
  };
}

export function buildGrobleCheckoutUrl(
  paymentUrl: string,
  sellerReference: string,
) {
  if (!GROBLE_SELLER_REFERENCE_PATTERN.test(sellerReference)) return null;
  const validated = validGroblePaymentUrl(paymentUrl);
  if (!validated) return null;
  const url = new URL(validated);
  url.searchParams.set("ref", sellerReference);
  return url.toString();
}
