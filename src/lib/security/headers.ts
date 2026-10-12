const NONCE_PATTERN = /^[A-Za-z0-9+/=_-]{16,128}$/u;

export function createContentSecurityPolicy({
  development,
  nonce,
}: {
  development: boolean;
  nonce: string;
}) {
  if (!NONCE_PATTERN.test(nonce)) {
    throw new Error("Content Security Policy nonce is invalid");
  }

  const developmentConnections = development
    ? " http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*"
    : "";
  const developmentScript = development ? " 'unsafe-eval'" : "";
  const styleSources = development
    ? "'self' 'unsafe-inline'"
    : `'self' 'nonce-${nonce}'`;
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentScript}`,
    `style-src ${styleSources}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co${developmentConnections}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ];

  if (!development) {
    directives.push("upgrade-insecure-requests");
  }

  return `${directives.join("; ")};`;
}

export function createCspNonce() {
  return crypto.randomUUID().replaceAll("-", "");
}
