import { describe, expect, it } from "vitest";

import {
  createContentSecurityPolicy,
  createCspNonce,
} from "@/lib/security/headers";

describe("Content Security Policy", () => {
  it("creates a unique nonce suitable for a CSP source expression", () => {
    const first = createCspNonce();
    const second = createCspNonce();

    expect(first).toMatch(/^[a-f0-9]{32}$/u);
    expect(second).toMatch(/^[a-f0-9]{32}$/u);
    expect(first).not.toBe(second);
  });

  it("uses a strict production policy without broad unsafe exceptions", () => {
    const policy = createContentSecurityPolicy({
      development: false,
      nonce: "0123456789abcdef0123456789abcdef",
    });

    expect(policy).toContain(
      "script-src 'self' 'nonce-0123456789abcdef0123456789abcdef' 'strict-dynamic'",
    );
    expect(policy).toContain("style-src 'self' 'nonce-");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("permits only the development evaluator and loopback connections in development", () => {
    const policy = createContentSecurityPolicy({
      development: true,
      nonce: "0123456789abcdef0123456789abcdef",
    });

    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("http://127.0.0.1:*");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  it("rejects attacker-controlled nonce syntax", () => {
    expect(() =>
      createContentSecurityPolicy({
        development: false,
        nonce: "bad'; script-src *",
      }),
    ).toThrow("nonce is invalid");
  });
});
