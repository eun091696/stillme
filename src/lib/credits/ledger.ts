export const CREDIT_LEDGER_MAX_ABSOLUTE_AMOUNT = 1_000_000;

export const CREDIT_TRANSACTION_TYPES = [
  "purchase_grant",
  "trial_grant",
  "promotion_grant",
  "generation_consume",
  "generation_restore",
  "payment_refund_reversal",
  "expiration",
  "manual_adjustment",
] as const;

export type CreditTransactionType = (typeof CREDIT_TRANSACTION_TYPES)[number];

export type CreditLedgerDraft = {
  transactionType: CreditTransactionType;
  amount: number;
  reversalOf: string | null;
  requestedBy?: string | null;
  approvedBy?: string | null;
  reasonCode?: string | null;
};

export type CreditLedgerEntry = Pick<
  CreditLedgerDraft,
  "amount" | "transactionType"
> & {
  id: string;
};

type CreditLedgerResult =
  | { ok: true; balance: number }
  | {
      ok: false;
      code:
        | "APPROVAL_INVALID"
        | "AMOUNT_INVALID"
        | "BALANCE_INSUFFICIENT"
        | "REVERSAL_INVALID";
    };

const POSITIVE_TYPES = new Set<CreditTransactionType>([
  "purchase_grant",
  "trial_grant",
  "promotion_grant",
  "generation_restore",
]);
const NEGATIVE_TYPES = new Set<CreditTransactionType>([
  "generation_consume",
  "payment_refund_reversal",
  "expiration",
]);

export function applyCreditLedgerDraft(
  currentBalance: number,
  draft: CreditLedgerDraft,
): CreditLedgerResult {
  if (
    !Number.isSafeInteger(currentBalance) ||
    currentBalance < 0 ||
    !Number.isSafeInteger(draft.amount) ||
    draft.amount === 0 ||
    Math.abs(draft.amount) > CREDIT_LEDGER_MAX_ABSOLUTE_AMOUNT ||
    (POSITIVE_TYPES.has(draft.transactionType) && draft.amount < 0) ||
    (NEGATIVE_TYPES.has(draft.transactionType) && draft.amount > 0)
  ) {
    return { code: "AMOUNT_INVALID", ok: false };
  }

  const requiresReversal =
    draft.transactionType === "generation_restore" ||
    draft.transactionType === "payment_refund_reversal";
  if (requiresReversal !== Boolean(draft.reversalOf)) {
    return { code: "REVERSAL_INVALID", ok: false };
  }

  if (draft.transactionType === "manual_adjustment") {
    if (
      !draft.reasonCode ||
      !draft.requestedBy ||
      !draft.approvedBy ||
      draft.requestedBy === draft.approvedBy
    ) {
      return { code: "APPROVAL_INVALID", ok: false };
    }
  } else if (draft.requestedBy || draft.approvedBy) {
    return { code: "APPROVAL_INVALID", ok: false };
  }

  const balance = currentBalance + draft.amount;
  if (balance < 0 || !Number.isSafeInteger(balance)) {
    return { code: "BALANCE_INSUFFICIENT", ok: false };
  }

  return { balance, ok: true };
}

export function validateCreditReversal(
  currentBalance: number,
  draft: CreditLedgerDraft,
  original: CreditLedgerEntry,
  priorRefundAmount = 0,
): CreditLedgerResult {
  if (
    draft.reversalOf !== original.id ||
    !Number.isSafeInteger(priorRefundAmount) ||
    priorRefundAmount > 0
  ) {
    return { code: "REVERSAL_INVALID", ok: false };
  }

  if (
    draft.transactionType === "generation_restore" &&
    (original.transactionType !== "generation_consume" ||
      draft.amount !== -original.amount)
  ) {
    return { code: "REVERSAL_INVALID", ok: false };
  }

  if (
    draft.transactionType === "payment_refund_reversal" &&
    (original.transactionType !== "purchase_grant" ||
      Math.abs(priorRefundAmount + draft.amount) > original.amount)
  ) {
    return { code: "REVERSAL_INVALID", ok: false };
  }

  return applyCreditLedgerDraft(currentBalance, draft);
}
