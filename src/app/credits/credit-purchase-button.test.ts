import { afterEach, describe, expect, it, vi } from "vitest";

import { requestPaymentCheckout } from "./credit-purchase-button";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("credit checkout request", () => {
  it("creates a server order with a client idempotency key", async () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
    });
    const fetcher = vi.fn(async () =>
      Response.json({
        checkoutUrl:
          "https://www.groble.im/payment/iwwH85?ref=aps_server_reference",
        orderId: "aps_server_reference",
      }),
    );

    await expect(requestPaymentCheckout("STARTER-3", fetcher)).resolves.toEqual({
      checkoutUrl:
        "https://www.groble.im/payment/iwwH85?ref=aps_server_reference",
      orderId: "aps_server_reference",
    });
    expect(fetcher).toHaveBeenCalledWith("/api/payments/orders", {
      body: JSON.stringify({
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
        productCode: "STARTER-3",
      }),
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
  });

  it("rejects a failed order or a response without a checkout URL", async () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
    });
    const failed = vi.fn(async () =>
      Response.json({ code: "ORDER_CREATE_FAILED" }, { status: 409 }),
    );
    const missingUrl = vi.fn(async () =>
      Response.json({ orderId: "aps_server_reference" }),
    );

    await expect(requestPaymentCheckout("STARTER-3", failed)).rejects.toThrow(
      "PAYMENT_ORDER_FAILED",
    );
    await expect(
      requestPaymentCheckout("STARTER-3", missingUrl),
    ).rejects.toThrow("PAYMENT_ORDER_FAILED");
  });
});
