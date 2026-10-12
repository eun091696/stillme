import { timingSafeEqual } from "node:crypto";

import { cleanupExpiredAssets } from "@/lib/storage/cleanup";

export const runtime = "nodejs";

const MINIMUM_CRON_SECRET_LENGTH = 16;

function cronSecret() {
  const secret = process.env.CRON_SECRET;
  return secret && secret.length >= MINIMUM_CRON_SECRET_LENGTH ? secret : null;
}

function authorized(request: Request, secret: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return (
    authorization.length === expected.length &&
    timingSafeEqual(Buffer.from(authorization), Buffer.from(expected))
  );
}

export async function GET(request: Request) {
  const secret = cronSecret();
  if (!secret) {
    return Response.json(
      { code: "CRON_NOT_CONFIGURED" },
      {
        status: 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
  if (!authorized(request, secret)) {
    return Response.json(
      { code: "UNAUTHORIZED" },
      {
        status: 401,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const requestedLimit = Number(
    new URL(request.url).searchParams.get("limit") ?? 50,
  );
  try {
    const result = await cleanupExpiredAssets(requestedLimit);
    if (result.failed > 0) {
      return Response.json(
        { code: "CLEANUP_PARTIAL_FAILURE", ...result },
        {
          status: 503,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    }
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json(
      { code: "CLEANUP_FAILED" },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
