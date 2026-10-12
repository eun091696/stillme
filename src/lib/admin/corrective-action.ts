const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CASE_REFERENCE_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{2,127}$/;

export const CREDIT_ADJUSTMENT_REASONS = [
  "DUPLICATE_DEBIT",
  "SERVICE_RECOVERY",
  "PROMOTION_CORRECTION",
  "SUPPORT_CORRECTION",
] as const;

export type CreditAdjustmentReason =
  (typeof CREDIT_ADJUSTMENT_REASONS)[number];

export type CreditAdjustmentValidation =
  | {
      ok: true;
      data: {
        amount: number;
        caseReference: string;
        idempotencyKey: string;
        reason: CreditAdjustmentReason;
        targetUserId: string;
      };
    }
  | { ok: false };

function formValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export function validateCreditAdjustmentRequest(
  formData: FormData,
): CreditAdjustmentValidation {
  const targetUserId = formValue(formData, "targetUserId").toLowerCase();
  const idempotencyKey = formValue(
    formData,
    "idempotencyKey",
  ).toLowerCase();
  const reason = formValue(formData, "reason");
  const caseReference = formValue(formData, "caseReference");
  const amountText = formValue(formData, "amount");
  const amount = Number(amountText);

  if (
    formData.get("confirmed") !== "yes" ||
    !UUID_PATTERN.test(targetUserId) ||
    !UUID_PATTERN.test(idempotencyKey) ||
    !CREDIT_ADJUSTMENT_REASONS.includes(reason as CreditAdjustmentReason) ||
    !CASE_REFERENCE_PATTERN.test(caseReference) ||
    !/^-?\d+$/.test(amountText) ||
    !Number.isSafeInteger(amount) ||
    amount === 0 ||
    Math.abs(amount) > 150
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    data: {
      amount,
      caseReference,
      idempotencyKey,
      reason: reason as CreditAdjustmentReason,
      targetUserId,
    },
  };
}

export function validateCreditAdjustmentApproval(
  formData: FormData,
): string | null {
  const requestId = formValue(formData, "requestId").toLowerCase();
  return formData.get("confirmed") === "yes" && UUID_PATTERN.test(requestId)
    ? requestId
    : null;
}
