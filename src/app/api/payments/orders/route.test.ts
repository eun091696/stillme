import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

import { POST } from "./route";

function orderRequest(productCode = "STARTER-3") {
  return new Request("https://stillme-photo.vercel.app/api/payments/orders", {
    body: JSON.stringify({
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      productCode,
    }),
    headers: {
      "content-type": "application/json",
      origin: "https://stillme-photo.vercel.app",
    },
    method: "POST",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://stillme-photo.vercel.app";
  process.env.GROBLE_STARTER_CONTENT_ID = "starter-content";
  process.env.GROBLE_STARTER_PAYMENT_URL =
    "https://www.groble.im/payment/iwwH85";
  process.env.GROBLE_STANDARD_CONTENT_ID = "u9RTdR";
  process.env.GROBLE_STANDARD_PAYMENT_URL =
    "https://www.groble.im/payment/u9RTdR";
  process.env.GROBLE_PRO_CONTENT_ID = "gr4xTv";
  process.env.GROBLE_PRO_PAYMENT_URL =
    "https://www.groble.im/payment/gr4xTv";
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "22222222-2222-4222-8222-222222222222" } },
  });
  mocks.rpc.mockResolvedValue({
    data: [
      {
        amount: 4_900,
        credit_amount: 3,
        currency: "KRW",
        id: "33333333-3333-4333-8333-333333333333",
        order_number: "aps_11111111111141118111111111111111",
        status: "pending",
      },
    ],
    error: null,
  });
});

afterEach(() => {
  for (const name of [
    "NEXT_PUBLIC_APP_URL",
    "GROBLE_STARTER_CONTENT_ID",
    "GROBLE_STARTER_PAYMENT_URL",
    "GROBLE_STANDARD_CONTENT_ID",
    "GROBLE_STANDARD_PAYMENT_URL",
    "GROBLE_PRO_CONTENT_ID",
    "GROBLE_PRO_PAYMENT_URL",
  ]) {
    delete process.env[name];
  }
});

describe("Groble payment order", () => {
  it("returns a configured checkout URL with the stored order reference", async () => {
    const response = await POST(orderRequest());
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      checkoutUrl:
        "https://www.groble.im/payment/iwwH85?ref=aps_11111111111141118111111111111111",
      creditAmount: 3,
      orderId: "aps_11111111111141118111111111111111",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("create_payment_order", {
      request_idempotency_key: "11111111-1111-4111-8111-111111111111",
      target_product_code: "STARTER-3",
      target_user_id: "22222222-2222-4222-8222-222222222222",
    });
  });

  it.each([
    ["STARTER-3", "iwwH85"],
    ["STANDARD-7", "u9RTdR"],
    ["PRO-16", "gr4xTv"],
  ])("maps %s to its configured Groble checkout", async (productCode, contentId) => {
    const response = await POST(orderRequest(productCode));
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.checkoutUrl).toBe(
      `https://www.groble.im/payment/${contentId}?ref=aps_11111111111141118111111111111111`,
    );
    expect(mocks.rpc).toHaveBeenCalledWith("create_payment_order", {
      request_idempotency_key: "11111111-1111-4111-8111-111111111111",
      target_product_code: productCode,
      target_user_id: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("does not create an order before Groble product configuration exists", async () => {
    delete process.env.GROBLE_STARTER_CONTENT_ID;
    const response = await POST(orderRequest());
    expect(response.status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("uses the fixed Pro checkout URL when only its optional URL setting is absent", async () => {
    delete process.env.GROBLE_PRO_PAYMENT_URL;
    const response = await POST(orderRequest("PRO-16"));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      checkoutUrl:
        "https://www.groble.im/payment/gr4xTv?ref=aps_11111111111141118111111111111111",
      orderId: "aps_11111111111141118111111111111111",
    });
  });

  it("rejects an unknown product before creating an order", async () => {
    const response = await POST(orderRequest("UNKNOWN"));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not return a checkout URL without a stored seller reference", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ amount: 4_900, credit_amount: 3, currency: "KRW" }],
      error: null,
    });
    const response = await POST(orderRequest());
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "ORDER_CREATE_FAILED",
    });
  });
});
