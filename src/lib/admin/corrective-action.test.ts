import { describe, expect, it } from "vitest";

import {
  validateCreditAdjustmentApproval,
  validateCreditAdjustmentRequest,
} from "@/lib/admin/corrective-action";

const requestIdempotencyKey = crypto.randomUUID();

function validRequest() {
  const formData = new FormData();
  formData.set("targetUserId", "123e4567-e89b-42d3-a456-426614174000");
  formData.set("idempotencyKey", requestIdempotencyKey);
  formData.set("amount", "10");
  formData.set("reason", "SERVICE_RECOVERY");
  formData.set("caseReference", "SUPPORT-2026-001");
  formData.set("confirmed", "yes");
  return formData;
}

describe("validateCreditAdjustmentRequest", () => {
  it("accepts a confirmed bounded request", () => {
    expect(validateCreditAdjustmentRequest(validRequest())).toEqual({
      ok: true,
      data: {
        amount: 10,
        caseReference: "SUPPORT-2026-001",
        idempotencyKey: requestIdempotencyKey,
        reason: "SERVICE_RECOVERY",
        targetUserId: "123e4567-e89b-42d3-a456-426614174000",
      },
    });
  });

  it.each(["0", "151", "-151", "1.5", "not-a-number"])(
    "rejects unsafe amount %s",
    (amount) => {
      const formData = validRequest();
      formData.set("amount", amount);
      expect(validateCreditAdjustmentRequest(formData)).toEqual({
        ok: false,
      });
    },
  );

  it("rejects a request without explicit confirmation", () => {
    const formData = validRequest();
    formData.delete("confirmed");
    expect(validateCreditAdjustmentRequest(formData)).toEqual({ ok: false });
  });

  it("rejects free-text reasons and unsafe case references", () => {
    const formData = validRequest();
    formData.set("reason", "please add credit");
    formData.set("caseReference", "customer email@example.test");
    expect(validateCreditAdjustmentRequest(formData)).toEqual({ ok: false });
  });
});

describe("validateCreditAdjustmentApproval", () => {
  it("requires both a UUID and explicit confirmation", () => {
    const formData = new FormData();
    formData.set("requestId", "323e4567-e89b-42d3-a456-426614174000");
    formData.set("confirmed", "yes");
    expect(validateCreditAdjustmentApproval(formData)).toBe(
      "323e4567-e89b-42d3-a456-426614174000",
    );

    formData.delete("confirmed");
    expect(validateCreditAdjustmentApproval(formData)).toBeNull();
  });
});
