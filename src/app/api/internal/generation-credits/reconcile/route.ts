import { timingSafeEqual } from "node:crypto";

import { reconcileStaleGenerationCreditReservations } from "@/lib/generation/reconciliation";

function authorized(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const secrets = [
    process.env.CRON_SECRET,
    process.env.GENERATION_RECONCILIATION_SECRET,
  ].filter((secret): secret is string => Boolean(secret && secret.length >= 32));

  return secrets.some((secret) => {
    const expected = `Bearer ${secret}`;
    return authorization.length === expected.length && timingSafeEqual(
      Buffer.from(authorization),
      Buffer.from(expected),
    );
  });
}

async function reconcile(request: Request) {
  if (!authorized(request)) {
    return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const requestedLimit = Number(
    new URL(request.url).searchParams.get("limit") ?? 50,
  );
  try {
    const result = await reconcileStaleGenerationCreditReservations(
      requestedLimit,
    );
    if (result.failed > 0) {
      return Response.json(
        { code: "RECONCILIATION_PARTIAL_FAILURE", ...result },
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
      { code: "RECONCILIATION_FAILED" },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

export const GET = reconcile;
export const POST = reconcile;
