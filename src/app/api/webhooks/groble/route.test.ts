import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    }),
    rpc: mocks.rpc,
  }),
}));

import { POST } from "./route";

const payload = {
  data: {
    object: {
      content: {
        id: "starter-content",
        paymentType: "ONE_TIME",
        title: "STILLME Starter",
        type: "SERVICE",
      },
      merchantUid: "groble-merchant-uid",
      options: [
        {
          optionId: "starter-option",
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

const refundPayload = {
  data: {
    object: {
      buyer: { email: "buyer@example.test", phoneNumber: "01000000000" },
      merchantUid: "groble-merchant-uid",
      pricing: { currency: "KRW", finalAmount: 4_900 },
      refund: {
        amount: 4_900,
        cancelledBy: "BUYER",
        currency: "KRW",
        partialRefund: false,
        reason: "must-not-persist",
        refundedAt: "2026-08-25T11:00:00+09:00",
      },
    },
  },
  id: "evt_refund",
  occurredAt: "2026-08-25T11:00:00+09:00",
  type: "payment.refunded",
  version: "2026-04-30",
};

function requestFor(
  value: unknown,
  options: {
    previous?: boolean;
    secret?: string;
    timestampSeconds?: number;
  } = {},
) {
  const rawBody = JSON.stringify(value);
  const timestamp = String(
    options.timestampSeconds ?? Math.floor(Date.now() / 1000),
  );
  const secret = options.secret ?? "current-secret";
  const signed = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const headers = new Headers({
    "content-type": "application/json",
    "x-groble-idempotency-key": "delivery-key",
    "x-groble-signature": options.previous ? "0".repeat(64) : signed,
    "x-groble-timestamp": timestamp,
  });
  if (options.previous) headers.set("x-groble-signature-previous", signed);
  return new Request("https://stillme-photo.vercel.app/api/webhooks/groble", {
    body: rawBody,
    headers,
    method: "POST",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GROBLE_WEBHOOK_SECRET = "current-secret";
  process.env.GROBLE_STARTER_CONTENT_ID = "starter-content";
  process.env.GROBLE_STARTER_OPTION_ID = "starter-option";
  mocks.maybeSingle.mockResolvedValue({
    data: {
      amount: 4_900,
      credit_amount: 3,
      currency: "KRW",
      id: "11111111-1111-4111-8111-111111111111",
      product_code: "STARTER-3",
      product_version: "commercial-v2",
      status: "pending",
    },
    error: null,
  });
  mocks.rpc.mockResolvedValue({
    data: [
      {
        processing_outcome: "payment_processed",
        receipt_id: "receipt-id",
        receipt_status: "processed",
        reconciliation_id: null,
      },
    ],
    error: null,
  });
});

afterEach(() => {
  for (const name of [
    "GROBLE_WEBHOOK_SECRET",
    "GROBLE_WEBHOOK_SECRET_PREVIOUS",
    "GROBLE_STARTER_CONTENT_ID",
    "GROBLE_STARTER_OPTION_ID",
  ]) {
    delete process.env[name];
  }
});

describe("Groble payment.completed webhook", () => {
  it("persists an exact verified order and passes no buyer data to the database", async () => {
    const response = await POST(requestFor(payload));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "process_verified_groble_payment",
      expect.objectContaining({
        verified_amount: 4_900,
        verified_currency: "KRW",
        verified_order_number: payload.data.object.sellerReference,
        webhook_event_type: "payment.completed",
      }),
    );
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain("buyer");
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain(
      payload.data.object.merchantUid,
    );
  });

  it("supports the documented previous signature during secret rotation", async () => {
    process.env.GROBLE_WEBHOOK_SECRET_PREVIOUS = "previous-secret";
    const response = await POST(
      requestFor(payload, { previous: true, secret: "previous-secret" }),
    );
    expect(response.status).toBe(200);
  });

  it("rejects an invalid signature before parsing or persistence", async () => {
    const response = await POST(requestFor(payload, { secret: "wrong-secret" }));
    expect(response.status).toBe(401);
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an expired timestamp before parsing or persistence", async () => {
    const response = await POST(
      requestFor(payload, {
        timestampSeconds: Math.floor(Date.now() / 1000) - 301,
      }),
    );
    expect(response.status).toBe(401);
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects mismatched amount, content, or configured option", async () => {
    const response = await POST(
      requestFor({
        ...payload,
        data: {
          object: {
            ...payload.data.object,
            pricing: { ...payload.data.object.pricing, finalAmount: 4_901 },
          },
        },
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();

    const contentResponse = await POST(
      requestFor({
        ...payload,
        data: {
          object: {
            ...payload.data.object,
            content: {
              ...payload.data.object.content,
              id: "forged-content",
            },
          },
        },
      }),
    );
    expect(contentResponse.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();

    const extraOptionResponse = await POST(
      requestFor({
        ...payload,
        data: {
          object: {
            ...payload.data.object,
            options: [
              ...payload.data.object.options,
              {
                optionId: "unconfigured-extra",
                quantity: 1,
                subtotal: 0,
                unitDiscountedPrice: 0,
                unitOriginalPrice: 0,
              },
            ],
          },
        },
      }),
    );
    expect(extraOptionResponse.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails closed when the product mapping is not configured", async () => {
    delete process.env.GROBLE_STARTER_CONTENT_ID;
    const response = await POST(requestFor(payload));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns 2xx after an extra real payment is durably quarantined", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: {
        amount: 4_900,
        credit_amount: 3,
        currency: "KRW",
        id: "11111111-1111-4111-8111-111111111111",
        product_code: "STARTER-3",
        product_version: "commercial-v2",
        status: "paid",
      },
      error: null,
    });
    mocks.rpc.mockResolvedValueOnce({
      data: [
        {
          processing_outcome: "reconciliation_required",
          receipt_id: "receipt-extra",
          receipt_status: "quarantined",
          reconciliation_id: "reconciliation-id",
        },
      ],
      error: null,
    });

    const response = await POST(requestFor(payload));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      outcome: "reconciliation_required",
      receiptId: "receipt-extra",
      reconciliationId: "reconciliation-id",
      status: "quarantined",
    });
  });

  it("returns 5xx when the verified payment cannot be durably recorded", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "database unavailable" },
    });
    const response = await POST(requestFor(payload));
    expect(response.status).toBe(503);
  });
});

describe("Groble payment.refunded webhook", () => {
  it("durably processes a verified refund using hashes and bounded fields", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{
        receipt_id: "refund-receipt",
        receipt_status: "processed",
        refund_id: "refund-id",
        refund_status: "credit_reversed",
      }],
      error: null,
    });
    const response = await POST(requestFor(refundPayload));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "process_verified_groble_refund",
      expect.objectContaining({
        verified_cancelled_by: "BUYER",
        verified_currency: "KRW",
        verified_original_amount: 4_900,
        verified_partial_refund: false,
        verified_refund_amount: 4_900,
      }),
    );
    const persisted = JSON.stringify(mocks.rpc.mock.calls);
    expect(persisted).not.toContain("groble-merchant-uid");
    expect(persisted).not.toContain("buyer@example.test");
    expect(persisted).not.toContain("01000000000");
    expect(persisted).not.toContain("must-not-persist");
  });

  it("returns 2xx for a durable reconciliation and 5xx on persistence failure", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{
        receipt_id: "refund-receipt",
        receipt_status: "quarantined",
        refund_id: "refund-id",
        refund_status: "reconciliation_required",
      }],
      error: null,
    });
    expect((await POST(requestFor(refundPayload))).status).toBe(200);

    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "database unavailable" },
    });
    expect((await POST(requestFor(refundPayload))).status).toBe(503);
  });

  it("rejects invalid signatures and stale timestamps before persistence", async () => {
    expect(
      (await POST(requestFor(refundPayload, { secret: "wrong-secret" }))).status,
    ).toBe(401);
    expect(
      (await POST(requestFor(refundPayload, {
        timestampSeconds: Math.floor(Date.now() / 1000) - 301,
      }))).status,
    ).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
