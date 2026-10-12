import { describe, expect, it } from "vitest";

import {
  formatOperatorDate,
  parseOperatorLookupTarget,
  sanitizeOperatorLookup,
} from "@/lib/admin/lookup";

describe("parseOperatorLookupTarget", () => {
  it("accepts and normalizes a single UUID", () => {
    expect(
      parseOperatorLookupTarget(
        " 123E4567-E89B-42D3-A456-426614174000 ",
      ),
    ).toEqual({
      status: "valid",
      userId: "123e4567-e89b-42d3-a456-426614174000",
    });
  });

  it("rejects non-UUID identifiers without forwarding them", () => {
    expect(parseOperatorLookupTarget("customer@example.com")).toEqual({
      status: "invalid",
    });
  });

  it("treats a missing query as an empty lookup", () => {
    expect(parseOperatorLookupTarget(undefined)).toEqual({ status: "empty" });
  });
});

describe("formatOperatorDate", () => {
  it("renders absent timestamps without guessing", () => {
    expect(formatOperatorDate(null)).toBe("—");
  });
});

describe("sanitizeOperatorLookup", () => {
  const rawLookup = {
    user: {
      user_id: "123e4567-e89b-42d3-a456-426614174000",
      display_name: "고객",
      joined_at: "2026-07-30T00:00:00.000Z",
      email: "must-not-leak@example.test",
    },
    credit: {
      balance: 20,
      reserved_credits: 3,
      refund_reserved_credits: 2,
      available_balance: 15,
      internal_note: "must-not-leak",
    },
    payments: [
      {
        order_id: "223e4567-e89b-42d3-a456-426614174000",
        order_number: "ORDER-001",
        product_code: "CREDITS_100",
        amount: 1000,
        credit_amount: 100,
        currency: "KRW",
        status: "paid",
        paid_at: "2026-07-30T00:00:00.000Z",
        created_at: "2026-07-30T00:00:00.000Z",
        payment_key: "must-not-leak",
        provider_payload: { secret: true },
      },
    ],
    generations: [
      {
        generation_job_id: "323e4567-e89b-42d3-a456-426614174000",
        status: "failed",
        style: "photographic",
        aspect_ratio: "1:1",
        model_id: "imagen-4-fast",
        attempt_count: 1,
        last_error_code: "PROVIDER_TIMEOUT",
        created_at: "2026-07-30T00:00:00.000Z",
        updated_at: "2026-07-30T00:01:00.000Z",
        prompt: "must-not-leak",
        provider_error: "must-not-leak",
      },
    ],
  };

  it("returns only the approved minimum DTO fields", () => {
    const sanitized = sanitizeOperatorLookup(rawLookup);

    expect(sanitized.status).toBe("success");
    expect(JSON.stringify(sanitized)).not.toContain("must-not-leak");
    expect(sanitized).toEqual({
      status: "success",
      result: {
        user: {
          user_id: "123e4567-e89b-42d3-a456-426614174000",
          display_name: "고객",
          joined_at: "2026-07-30T00:00:00.000Z",
        },
        credit: {
          balance: 20,
          reserved_credits: 3,
          refund_reserved_credits: 2,
          available_balance: 15,
        },
        payments: [
          {
            order_id: "223e4567-e89b-42d3-a456-426614174000",
            order_number: "ORDER-001",
            product_code: "CREDITS_100",
            amount: 1000,
            credit_amount: 100,
            currency: "KRW",
            status: "paid",
            paid_at: "2026-07-30T00:00:00.000Z",
            created_at: "2026-07-30T00:00:00.000Z",
          },
        ],
        generations: [
          {
            generation_job_id: "323e4567-e89b-42d3-a456-426614174000",
            status: "failed",
            style: "photographic",
            aspect_ratio: "1:1",
            model_id: "imagen-4-fast",
            attempt_count: 1,
            last_error_code: "PROVIDER_TIMEOUT",
            created_at: "2026-07-30T00:00:00.000Z",
            updated_at: "2026-07-30T00:01:00.000Z",
          },
        ],
      },
    });
  });

  it("fails closed for malformed database responses", () => {
    expect(
      sanitizeOperatorLookup({
        ...rawLookup,
        payments: [{ ...rawLookup.payments[0], amount: "1000" }],
      }),
    ).toEqual({ status: "invalid" });
  });

  it("distinguishes an absent user without returning other domain data", () => {
    expect(
      sanitizeOperatorLookup({
        ...rawLookup,
        user: null,
      }),
    ).toEqual({ status: "not_found" });
  });
});
