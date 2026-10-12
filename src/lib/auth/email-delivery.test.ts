import { describe, expect, it } from "vitest";

import {
  authEmailErrorMessage,
  isAuthEmailRateLimit,
} from "@/lib/auth/email-delivery";

describe("auth email delivery errors", () => {
  it("recognizes provider rate limits by stable status or error code", () => {
    expect(isAuthEmailRateLimit({ status: 429 })).toBe(true);
    expect(
      isAuthEmailRateLimit({ code: "over_email_send_rate_limit" }),
    ).toBe(true);
    expect(isAuthEmailRateLimit({ code: "email_rate_limit_exceeded" })).toBe(
      true,
    );
  });

  it("does not classify unrelated authentication errors as rate limits", () => {
    expect(isAuthEmailRateLimit({ status: 400 })).toBe(false);
    expect(isAuthEmailRateLimit({ code: "validation_failed" })).toBe(false);
    expect(isAuthEmailRateLimit(null)).toBe(false);
  });

  it("returns bounded Korean messages without exposing provider details", () => {
    expect(authEmailErrorMessage({ status: 429 })).toBe(
      "현재 인증 이메일 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
    );
    expect(authEmailErrorMessage({ status: 503 })).toBe(
      "인증 이메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});
