type AuthEmailError = {
  code?: string;
  status?: number;
};

const EMAIL_RATE_LIMIT_CODES = new Set([
  "email_rate_limit_exceeded",
  "over_email_send_rate_limit",
  "over_request_rate_limit",
]);

export function isAuthEmailRateLimit(error: AuthEmailError | null) {
  return (
    error?.status === 429 ||
    (typeof error?.code === "string" &&
      EMAIL_RATE_LIMIT_CODES.has(error.code))
  );
}

export function authEmailErrorMessage(error: AuthEmailError) {
  return isAuthEmailRateLimit(error)
    ? "현재 인증 이메일 요청이 많습니다. 잠시 후 다시 시도해 주세요."
    : "인증 이메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
