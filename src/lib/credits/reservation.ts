import { CREDIT_LEDGER_MAX_ABSOLUTE_AMOUNT } from "./ledger";

export const CREDIT_RESERVATION_RELEASE_REASONS = [
  "USER_CANCELLED",
  "PROVIDER_FAILURE",
  "POST_PROCESSING_FAILURE",
  "STORAGE_FAILURE",
] as const;

export type CreditReservationReleaseReason =
  (typeof CREDIT_RESERVATION_RELEASE_REASONS)[number];
export type CreditReservationStatus = "released" | "reserved" | "settled";
export type GenerationSettlementStatus =
  | "cancelled"
  | "failed"
  | "processing"
  | "queued"
  | "succeeded";

type ReservationTransition =
  | { action: "release"; reason: CreditReservationReleaseReason }
  | { action: "settle" };

type ReservationTransitionResult =
  | { ok: true; status: CreditReservationStatus }
  | {
      code:
        | "AMOUNT_INVALID"
        | "REASON_INVALID"
        | "STATE_INVALID"
        | "TERMINAL_INVALID";
      ok: false;
    };

export function isValidCreditReservationAmount(amount: number) {
  return (
    Number.isSafeInteger(amount) &&
    amount > 0 &&
    amount <= CREDIT_LEDGER_MAX_ABSOLUTE_AMOUNT
  );
}

export function applyCreditReservationTransition(
  reservationStatus: CreditReservationStatus,
  jobStatus: GenerationSettlementStatus,
  retryable: boolean,
  transition: ReservationTransition,
): ReservationTransitionResult {
  if (reservationStatus === "settled" && transition.action === "settle") {
    return { ok: true, status: "settled" };
  }
  if (reservationStatus === "released" && transition.action === "release") {
    return { ok: true, status: "released" };
  }
  if (reservationStatus !== "reserved") {
    return { code: "STATE_INVALID", ok: false };
  }

  if (transition.action === "settle") {
    return jobStatus === "succeeded"
      ? { ok: true, status: "settled" }
      : { code: "TERMINAL_INVALID", ok: false };
  }

  if (!CREDIT_RESERVATION_RELEASE_REASONS.includes(transition.reason)) {
    return { code: "REASON_INVALID", ok: false };
  }

  return jobStatus === "cancelled" ||
    (jobStatus === "failed" && !retryable)
    ? { ok: true, status: "released" }
    : { code: "TERMINAL_INVALID", ok: false };
}
