const DEFAULT_MAX_JSON_BYTES = 16 * 1024;

export type JsonRequestResult =
  | { ok: true; data: unknown }
  | { ok: false; status: 400 | 403 | 413 | 415 | 503 };

export type BoundedTextResult =
  | { ok: true; rawBody: string }
  | { ok: false; status: 400 | 413 };

export type BoundedBytesResult =
  | { ok: true; rawBody: Uint8Array }
  | { ok: false; status: 400 | 413 };

export function isJsonMediaType(value: string | null) {
  return (
    value !== null &&
    /^application\/json(?:\s*;\s*charset=utf-8)?\s*$/iu.test(value)
  );
}

export async function readBoundedText(
  request: Request,
  maxBytes: number,
): Promise<BoundedTextResult> {
  const body = await readBoundedBytes(request, maxBytes);
  if (!body.ok) return body;

  try {
    return {
      ok: true,
      rawBody: new TextDecoder("utf-8", { fatal: true }).decode(body.rawBody),
    };
  } catch {
    return { ok: false, status: 400 };
  }
}

export async function readBoundedBytes(
  request: Request,
  maxBytes: number,
): Promise<BoundedBytesResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("maxBytes must be a positive safe integer");
  }

  const contentLength = request.headers.get("content-length");
  if (
    contentLength !== null &&
    (!/^\d+$/u.test(contentLength) || Number(contentLength) > maxBytes)
  ) {
    return { ok: false, status: 413 };
  }

  if (!request.body) {
    return { ok: true, rawBody: new Uint8Array() };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }

    const body = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return { ok: true, rawBody: body };
  } catch {
    return { ok: false, status: 400 };
  } finally {
    reader.releaseLock();
  }
}

export function applicationOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export async function readSameOriginJson(
  request: Request,
  options: {
    allowedOrigin?: string | null;
    maxBytes?: number;
  } = {},
): Promise<JsonRequestResult> {
  const allowedOrigin = options.allowedOrigin ?? applicationOrigin();
  if (!allowedOrigin) {
    return { ok: false, status: 503 };
  }

  const origin = request.headers.get("origin");
  if (origin !== allowedOrigin) {
    return { ok: false, status: 403 };
  }

  if (!isJsonMediaType(request.headers.get("content-type"))) {
    return { ok: false, status: 415 };
  }

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BYTES;
  const body = await readBoundedText(request, maxBytes);
  if (!body.ok) return body;

  try {
    return { ok: true, data: JSON.parse(body.rawBody) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}
