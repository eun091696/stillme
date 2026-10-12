import { describe, expect, it } from "vitest";

import {
  applyCreditLedgerDraft,
  validateCreditReversal,
  type CreditLedgerDraft,
  type CreditLedgerEntry,
} from "./ledger";

const grant: CreditLedgerDraft = {
  amount: 3,
  reversalOf: null,
  transactionType: "trial_grant",
};

describe("credit ledger business rules", () => {
  it("applies integer grants and consumption without allowing a negative balance", () => {
    expect(applyCreditLedgerDraft(0, grant)).toEqual({ balance: 3, ok: true });
    expect(
      applyCreditLedgerDraft(3, {
        amount: -1,
        reversalOf: null,
        transactionType: "generation_consume",
      }),
    ).toEqual({ balance: 2, ok: true });
    expect(
      applyCreditLedgerDraft(0, {
        amount: -1,
        reversalOf: null,
        transactionType: "generation_consume",
      }),
    ).toEqual({ code: "BALANCE_INSUFFICIENT", ok: false });
  });

  it("rejects zero, fractional, oversized, and incorrectly signed amounts", () => {
    for (const amount of [0, 1.5, 1_000_001]) {
      expect(applyCreditLedgerDraft(0, { ...grant, amount })).toEqual({
        code: "AMOUNT_INVALID",
        ok: false,
      });
    }
    expect(
      applyCreditLedgerDraft(10, {
        amount: 1,
        reversalOf: null,
        transactionType: "generation_consume",
      }),
    ).toEqual({ code: "AMOUNT_INVALID", ok: false });
  });

  it("requires a full generation restore tied to the original consumption", () => {
    const original: CreditLedgerEntry = {
      amount: -3,
      id: "consume-1",
      transactionType: "generation_consume",
    };
    const restore: CreditLedgerDraft = {
      amount: 3,
      reversalOf: original.id,
      transactionType: "generation_restore",
    };

    expect(validateCreditReversal(0, restore, original)).toEqual({
      balance: 3,
      ok: true,
    });
    expect(
      validateCreditReversal(0, { ...restore, amount: 2 }, original),
    ).toEqual({ code: "REVERSAL_INVALID", ok: false });
  });

  it("allows bounded partial payment reversals without exceeding the grant", () => {
    const original: CreditLedgerEntry = {
      amount: 20,
      id: "purchase-1",
      transactionType: "purchase_grant",
    };
    const refund: CreditLedgerDraft = {
      amount: -5,
      reversalOf: original.id,
      transactionType: "payment_refund_reversal",
    };

    expect(validateCreditReversal(10, refund, original, -10)).toEqual({
      balance: 5,
      ok: true,
    });
    expect(
      validateCreditReversal(
        10,
        { ...refund, amount: -11 },
        original,
        -10,
      ),
    ).toEqual({ code: "REVERSAL_INVALID", ok: false });
  });

  it("requires distinct requester and approver identities for manual adjustments", () => {
    const manual: CreditLedgerDraft = {
      amount: 1,
      approvedBy: "reviewer",
      reasonCode: "SUPPORT_CORRECTION",
      requestedBy: "operator",
      reversalOf: null,
      transactionType: "manual_adjustment",
    };

    expect(applyCreditLedgerDraft(0, manual)).toEqual({
      balance: 1,
      ok: true,
    });
    expect(
      applyCreditLedgerDraft(0, {
        ...manual,
        approvedBy: "operator",
      }),
    ).toEqual({ code: "APPROVAL_INVALID", ok: false });
  });
});
