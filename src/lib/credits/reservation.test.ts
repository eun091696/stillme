import { describe, expect, it } from "vitest";

import {
  applyCreditReservationTransition,
  isValidCreditReservationAmount,
} from "./reservation";

describe("credit reservation policy", () => {
  it("accepts only positive bounded integer amounts", () => {
    expect(isValidCreditReservationAmount(1)).toBe(true);
    expect(isValidCreditReservationAmount(1_000_000)).toBe(true);
    expect(isValidCreditReservationAmount(0)).toBe(false);
    expect(isValidCreditReservationAmount(1.5)).toBe(false);
    expect(isValidCreditReservationAmount(1_000_001)).toBe(false);
  });

  it("settles only a succeeded generation", () => {
    expect(
      applyCreditReservationTransition(
        "reserved",
        "succeeded",
        false,
        { action: "settle" },
      ),
    ).toEqual({ ok: true, status: "settled" });
    expect(
      applyCreditReservationTransition(
        "reserved",
        "processing",
        false,
        { action: "settle" },
      ),
    ).toEqual({ code: "TERMINAL_INVALID", ok: false });
  });

  it("keeps retryable failures reserved and releases terminal failures", () => {
    expect(
      applyCreditReservationTransition(
        "reserved",
        "failed",
        true,
        { action: "release", reason: "PROVIDER_FAILURE" },
      ),
    ).toEqual({ code: "TERMINAL_INVALID", ok: false });
    expect(
      applyCreditReservationTransition(
        "reserved",
        "failed",
        false,
        { action: "release", reason: "PROVIDER_FAILURE" },
      ),
    ).toEqual({ ok: true, status: "released" });
  });

  it("releases a cancelled generation and makes terminal retries idempotent", () => {
    expect(
      applyCreditReservationTransition(
        "reserved",
        "cancelled",
        false,
        { action: "release", reason: "USER_CANCELLED" },
      ),
    ).toEqual({ ok: true, status: "released" });
    expect(
      applyCreditReservationTransition(
        "settled",
        "succeeded",
        false,
        { action: "settle" },
      ),
    ).toEqual({ ok: true, status: "settled" });
    expect(
      applyCreditReservationTransition(
        "released",
        "cancelled",
        false,
        { action: "release", reason: "USER_CANCELLED" },
      ),
    ).toEqual({ ok: true, status: "released" });
  });

  it("rejects a transition across terminal states", () => {
    expect(
      applyCreditReservationTransition(
        "released",
        "succeeded",
        false,
        { action: "settle" },
      ),
    ).toEqual({ code: "STATE_INVALID", ok: false });
    expect(
      applyCreditReservationTransition(
        "settled",
        "cancelled",
        false,
        { action: "release", reason: "USER_CANCELLED" },
      ),
    ).toEqual({ code: "STATE_INVALID", ok: false });
  });
});
