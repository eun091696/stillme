import { afterEach, describe, expect, it } from "vitest";

import {
  applicationOrigin,
  isJsonMediaType,
  readBoundedText,
  readSameOriginJson,
} from "@/lib/security/request";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});

function jsonRequest(
  body: string,
  headers: Record<string, string> = {},
) {
  return new Request("https://app.example.test/api/payments/orders", {
    body,
    headers: {
      "content-type": "application/json",
      origin: "https://app.example.test",
      ...headers,
    },
    method: "POST",
  });
}

describe("applicationOrigin", () => {
  it("accepts only a bare HTTP(S) application origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
    expect(applicationOrigin()).toBe("https://app.example.test");

    process.env.NEXT_PUBLIC_APP_URL = "https://user@app.example.test/path";
    expect(applicationOrigin()).toBeNull();
  });
});

describe("readSameOriginJson", () => {
  it("parses bounded same-origin JSON", async () => {
    await expect(
      readSameOriginJson(jsonRequest('{"productCode":"STARTER-20"}'), {
        allowedOrigin: "https://app.example.test",
      }),
    ).resolves.toEqual({
      ok: true,
      data: { productCode: "STARTER-20" },
    });
  });

  it("rejects missing, null, cross-origin and malformed origins", async () => {
    for (const origin of [undefined, "null", "https://evil.example"]) {
      const headers = new Headers({ "content-type": "application/json" });
      if (origin) headers.set("origin", origin);
      const request = new Request(
        "https://app.example.test/api/payments/orders",
        { body: "{}", headers, method: "POST" },
      );

      await expect(
        readSameOriginJson(request, {
          allowedOrigin: "https://app.example.test",
        }),
      ).resolves.toEqual({ ok: false, status: 403 });
    }
  });

  it("rejects non-JSON, malformed and oversized bodies", async () => {
    await expect(
      readSameOriginJson(
        jsonRequest("{}", { "content-type": "text/plain" }),
        { allowedOrigin: "https://app.example.test" },
      ),
    ).resolves.toEqual({ ok: false, status: 415 });

    await expect(
      readSameOriginJson(jsonRequest("{"), {
        allowedOrigin: "https://app.example.test",
      }),
    ).resolves.toEqual({ ok: false, status: 400 });

    await expect(
      readSameOriginJson(
        jsonRequest('{"value":"too-large"}', { "content-length": "999" }),
        { allowedOrigin: "https://app.example.test", maxBytes: 16 },
      ),
    ).resolves.toEqual({ ok: false, status: 413 });

    await expect(
      readSameOriginJson(
        jsonRequest(JSON.stringify({ value: "x".repeat(100) })),
        { allowedOrigin: "https://app.example.test", maxBytes: 16 },
      ),
    ).resolves.toEqual({ ok: false, status: 413 });
  });

  it("fails closed when the application origin is unavailable", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    await expect(readSameOriginJson(jsonRequest("{}"))).resolves.toEqual({
      ok: false,
      status: 503,
    });
  });
});

describe("bounded request body", () => {
  it("accepts only the exact JSON media type with optional UTF-8 charset", () => {
    expect(isJsonMediaType("application/json")).toBe(true);
    expect(isJsonMediaType("application/json; charset=UTF-8")).toBe(true);
    expect(isJsonMediaType("application/jsonp")).toBe(false);
    expect(isJsonMediaType("text/json")).toBe(false);
  });

  it("rejects an invalid content length before reading the body", async () => {
    await expect(
      readBoundedText(
        jsonRequest("{}", { "content-length": "invalid" }),
        16,
      ),
    ).resolves.toEqual({ ok: false, status: 413 });
  });

  it("rejects invalid UTF-8 without exposing the body", async () => {
    const request = new Request(
      "https://app.example.test/api/payments/orders",
      {
        body: new Uint8Array([0xc3, 0x28]),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    await expect(readBoundedText(request, 16)).resolves.toEqual({
      ok: false,
      status: 400,
    });
  });
});
