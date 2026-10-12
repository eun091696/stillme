import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  balanceMaybeSingle: vi.fn(),
  getUser: vi.fn(),
  orderMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      const maybeSingle = table === "payment_orders"
        ? mocks.orderMaybeSingle
        : mocks.balanceMaybeSingle;
      const query = {
        eq: vi.fn(),
        maybeSingle,
        select: vi.fn(),
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      return query;
    },
  }),
}));

import { GET } from "./route";

const orderNumber = "aps_11111111111141118111111111111111";

describe("own payment order status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
    });
    mocks.orderMaybeSingle.mockResolvedValue({
      data: { order_number: orderNumber, paid_at: null, status: "pending" },
      error: null,
    });
    mocks.balanceMaybeSingle.mockResolvedValue({
      data: { available_balance: 3 },
      error: null,
    });
  });

  it("returns only the authenticated owner's bounded order state", async () => {
    const response = await GET(
      new Request(`https://stillme-photo.vercel.app/api/payments/orders/${orderNumber}`),
      { params: Promise.resolve({ orderNumber }) },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      availableCredit: 3,
      orderId: orderNumber,
      paidAt: null,
      status: "pending",
    });
  });

  it("rejects anonymous, invalid, and non-owned orders", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    expect((await GET(new Request("https://stillme-photo.vercel.app"), {
      params: Promise.resolve({ orderNumber }),
    })).status).toBe(401);

    expect((await GET(new Request("https://stillme-photo.vercel.app"), {
      params: Promise.resolve({ orderNumber: "bad value" }),
    })).status).toBe(400);

    mocks.orderMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect((await GET(new Request("https://stillme-photo.vercel.app"), {
      params: Promise.resolve({ orderNumber }),
    })).status).toBe(404);
  });
});
