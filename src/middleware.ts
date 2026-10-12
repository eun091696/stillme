import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  createContentSecurityPolicy,
  createCspNonce,
} from "@/lib/security/headers";
import {
  isProtectedPath,
  updateSession,
} from "@/lib/supabase/middleware";

function requiresSessionRefresh(pathname: string) {
  return (
    isProtectedPath(pathname) ||
    pathname === "/forgot-password" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/verify-email"
    || pathname === "/consent"
  );
}

export async function middleware(request: NextRequest) {
  const nonce = createCspNonce();
  const contentSecurityPolicy = createContentSecurityPolicy({
    development: process.env.NODE_ENV === "development",
    nonce,
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = requiresSessionRefresh(request.nextUrl.pathname)
    ? await updateSession(request, requestHeaders)
    : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
