import { describe, expect, it, vi } from "vitest";

import { createTossPaymentClient } from "./toss";

describe("Toss payment client", () => {
  it("confirms with Basic auth and a stable idempotency key", async () => {
    const request = vi.fn<typeof globalThis.fetch>(async () =>
      Promise.resolve(new Response(
        JSON.stringify({
          approvedAt: "2026-07-28T12:00:00+09:00",
          balanceAmount: 4_900,
          cancels: null,
          currency: "KRW",
          orderId: "aps_11111111111141118111111111111111",
          paymentKey: "payment-key-test",
          status: "DONE",
          totalAmount: 4_900,
        }),
        { status: 200 },
      )),
    );
    const client = createTossPaymentClient({
      fetch: request,
      secretKey: "test_secret",
    });

    const result = await client.confirm({
      amount: 4_900,
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      orderId: "aps_11111111111141118111111111111111",
      paymentKey: "payment-key-test",
    });

    expect(result.status).toBe("DONE");
    expect(request).toHaveBeenCalledOnce();
    const [, init] = request.mock.calls[0];
    expect(init?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("test_secret:").toString("base64")}`,
      "Idempotency-Key": "11111111-1111-4111-8111-111111111111",
    });
  });

  it("retrieves by order and cancels with a stable idempotency key", async () => {
    const response = {
      approvedAt: "2026-07-28T12:00:00+09:00",
      balanceAmount: 0,
      cancels: [
        {
          cancelAmount: 4_900,
          canceledAt: "2026-07-28T13:00:00+09:00",
          cancelStatus: "DONE",
          transactionKey: "cancel-transaction",
        },
      ],
      currency: "KRW",
      orderId: "aps_11111111111141118111111111111111",
      paymentKey: "payment-key-test",
      status: "CANCELED",
      totalAmount: 4_900,
    };
    const request = vi.fn<typeof globalThis.fetch>(async () =>
      Promise.resolve(new Response(JSON.stringify(response), { status: 200 })),
    );
    const client = createTossPaymentClient({
      fetch: request,
      secretKey: "test_secret",
    });

    await client.getByOrderId(response.orderId);
    await client.cancel({
      amount: 4_900,
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      paymentKey: response.paymentKey,
      reason: "Customer requested a full refund",
    });

    expect(request.mock.calls[0][0]).toContain(
      `/payments/orders/${response.orderId}`,
    );
    expect(request.mock.calls[1][0]).toContain(
      `/payments/${response.paymentKey}/cancel`,
    );
    expect(request.mock.calls[1][1]?.headers).toMatchObject({
      "Idempotency-Key": "11111111-1111-4111-8111-111111111111",
    });
  });

  it("returns only a provider error code without leaking response details", async () => {
    const client = createTossPaymentClient({
      fetch: async () =>
        new Response(
          JSON.stringify({
            code: "ALREADY_PROCESSED_PAYMENT",
            message: "sensitive provider detail",
          }),
          { status: 409 },
        ),
      secretKey: "test_secret",
    });

    await expect(
      client.get("payment-key-test"),
    ).rejects.toThrow("ALREADY_PROCESSED_PAYMENT");
  });

  it("normalizes network and timeout failures without leaking request secrets", async () => {
    const request = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      throw new Error("network detail containing test_secret");
    });
    const client = createTossPaymentClient({
      fetch: request,
      secretKey: "test_secret",
    });

    await expect(client.get("payment-key-test")).rejects.toThrow(
      "TOSS_NETWORK_ERROR",
    );
    await expect(client.get("payment-key-test")).rejects.not.toThrow(
      "test_secret",
    );
  });

  it("rejects unbounded provider error codes", async () => {
    const client = createTossPaymentClient({
      fetch: async () =>
        new Response(
          JSON.stringify({
            code: "invalid code containing test_secret",
          }),
          { status: 502 },
        ),
      secretKey: "test_secret",
    });

    await expect(client.get("payment-key-test")).rejects.toThrow(
      "TOSS_REQUEST_FAILED",
    );
  });

  it("rejects oversized provider responses", async () => {
    const client = createTossPaymentClient({
      fetch: async () =>
        new Response(JSON.stringify({ padding: "x".repeat(300_000) }), {
          status: 200,
        }),
      secretKey: "test_secret",
    });

    await expect(client.get("payment-key-test")).rejects.toThrow(
      "TOSS_RESPONSE_INVALID",
    );
  });
});
