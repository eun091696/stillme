import { expect, test } from "@playwright/test";

const applicationOrigin = "http://localhost:3011";

test("security headers and private cache policy cover public and protected responses", async ({
  page,
  request,
}) => {
  const cspViolations: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text().includes("Content Security Policy")
    ) {
      cspViolations.push(message.text());
    }
  });

  const publicResponse = await request.get("/");
  const contentSecurityPolicy =
    publicResponse.headers()["content-security-policy"];
  expect(publicResponse.headers()["referrer-policy"]).toBe("no-referrer");
  expect(publicResponse.headers()["x-content-type-options"]).toBe("nosniff");
  expect(publicResponse.headers()["x-frame-options"]).toBe("DENY");
  expect(publicResponse.headers()["permissions-policy"]).toBe(
    "camera=(), geolocation=(), microphone=()",
  );
  expect(contentSecurityPolicy).toContain("script-src 'self' 'nonce-");
  expect(contentSecurityPolicy).toContain("'strict-dynamic'");
  expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
  const scriptDirective = contentSecurityPolicy
    .split(";")
    .find((directive) => directive.trim().startsWith("script-src"));
  expect(scriptDirective).not.toContain("'unsafe-inline'");

  const navigation = await page.goto("/");
  const navigationPolicy =
    navigation?.headers()["content-security-policy"] ?? "";
  const nonce = navigationPolicy.match(/'nonce-([^']+)'/u)?.[1];
  expect(nonce).toMatch(/^[a-f0-9]{32}$/u);
  const scriptNonces = await page.locator("script").evaluateAll((scripts) =>
    scripts.map((script) => script.nonce),
  );
  expect(scriptNonces.length).toBeGreaterThan(0);
  expect(scriptNonces.filter((value) => value === nonce).length).toBeGreaterThan(
    0,
  );
  expect(cspViolations).toEqual([]);

  const protectedResponse = await request.get("/account", {
    maxRedirects: 0,
  });
  expect(protectedResponse.status()).toBeGreaterThanOrEqual(300);
  expect(protectedResponse.status()).toBeLessThan(400);
  expect(protectedResponse.headers()["cache-control"]).toContain("no-store");
});

test("cookie-authenticated payment endpoints require bounded same-origin JSON", async ({
  request,
}) => {
  const crossOrigin = await request.post("/api/payments/orders", {
    data: {
      idempotencyKey: crypto.randomUUID(),
      productCode: "STARTER-3",
    },
    headers: { origin: "https://evil.example.test" },
  });
  expect(crossOrigin.status()).toBe(403);
  expect(await crossOrigin.json()).toEqual({ code: "REQUEST_REJECTED" });

  const sameOriginAnonymous = await request.post("/api/payments/orders", {
    data: {
      idempotencyKey: crypto.randomUUID(),
      productCode: "STARTER-3",
    },
    headers: { origin: applicationOrigin },
  });
  expect(sameOriginAnonymous.status()).toBe(401);
  expect(await sameOriginAnonymous.json()).toEqual({
    code: "AUTH_REQUIRED",
  });
  expect(sameOriginAnonymous.headers()["cache-control"]).toContain("no-store");

  const oversized = await request.post("/api/payments/orders", {
    data: { value: "x".repeat(17 * 1024) },
    headers: { origin: applicationOrigin },
  });
  expect(oversized.status()).toBe(413);
  expect(await oversized.json()).toEqual({ code: "REQUEST_REJECTED" });
});
