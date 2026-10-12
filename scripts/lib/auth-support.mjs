const CASE_ID_PATTERN = /^AUTH-\d{8}-[A-Z0-9]{6}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const ENVIRONMENTS = new Set(["development", "staging", "production"]);
const ISSUE_TYPES = new Set([
  "login",
  "password-reset",
  "session-expiry",
  "signup",
  "verification",
]);

export function createAuthSupportRecord(input) {
  if (!CASE_ID_PATTERN.test(input.caseId ?? "")) {
    throw new Error("caseId must match AUTH-YYYYMMDD-XXXXXX.");
  }

  if (!ENVIRONMENTS.has(input.environment)) {
    throw new Error("environment must be development, staging, or production.");
  }

  if (!ISSUE_TYPES.has(input.issue)) {
    throw new Error("issue is not a supported authentication issue type.");
  }

  const observedAt = new Date(input.observedAt);
  if (
    Number.isNaN(observedAt.getTime()) ||
    observedAt.toISOString() !== input.observedAt
  ) {
    throw new Error("observedAt must be an ISO-8601 UTC timestamp.");
  }

  if (input.requestId && !REQUEST_ID_PATTERN.test(input.requestId)) {
    throw new Error("requestId must be an opaque 8-128 character identifier.");
  }

  return {
    schemaVersion: "auth-support-v1",
    caseId: input.caseId,
    environment: input.environment,
    issue: input.issue,
    observedAt: input.observedAt,
    ...(input.requestId ? { requestId: input.requestId } : {}),
    allowedEvidence: [
      "route",
      "http_status",
      "provider_error_code",
      "redacted_request_id",
      "timestamp",
    ],
    prohibitedEvidence: [
      "cookie",
      "email",
      "password",
      "recovery_token",
      "session_token",
    ],
    nextProcedure:
      input.issue === "signup" || input.issue === "verification"
        ? "playbooks/SIGNUP_FAILURE.md"
        : "playbooks/LOGIN_FAILURE.md",
  };
}
