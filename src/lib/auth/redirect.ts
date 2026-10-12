export const AUTHENTICATED_HOME_PATH = "/generate";

const AUTH_CALLBACK_PATHS = new Set([
  "/account",
  "/admin",
  AUTHENTICATED_HOME_PATH,
  "/generations",
  "/credits",
  "/reset-password",
]);

const GENERATION_SERVICE_PATH =
  /^\/generate\/(?:business-profile|character-avatar|id-photo|profile-photo|underwater-correction)$/u;

export function safeAuthCallbackPath(value: string | null) {
  return value &&
    (AUTH_CALLBACK_PATHS.has(value) || GENERATION_SERVICE_PATH.test(value))
    ? value
    : AUTHENTICATED_HOME_PATH;
}
