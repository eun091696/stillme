import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTHENTICATED_HOME_PATH } from "@/lib/auth/redirect";
import { REQUIRED_POLICY_VERSION } from "@/lib/policies";
import { getSupabaseConfig } from "./config";

export function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));
}

export function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/account") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/generate") ||
    pathname.startsWith("/credits") ||
    pathname.startsWith("/generations")
    || pathname === "/consent"
  );
}

export async function updateSession(
  request: NextRequest,
  requestHeaders = new Headers(request.headers),
) {
  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  const { publishableKey, url } = getSupabaseConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({
          request: { headers: requestHeaders },
        });
        cookiesToSet.forEach(({ name, options, value }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    if (hasSupabaseAuthCookie(request)) {
      loginUrl.searchParams.set("reason", "session_expired");
    }
    return NextResponse.redirect(loginUrl);
  }

  let hasRequiredConsent = false;
  if (user) {
    const { data, error } = await supabase
      .from("policy_consents")
      .select("policy_type")
      .eq("user_id", user.id)
      .eq("policy_version", REQUIRED_POLICY_VERSION);
    hasRequiredConsent =
      !error && new Set((data ?? []).map((row) => row.policy_type)).size === 2;
    if (
      isProtectedPath(request.nextUrl.pathname) &&
      request.nextUrl.pathname !== "/consent" &&
      !hasRequiredConsent
    ) {
      const consentUrl = request.nextUrl.clone();
      consentUrl.pathname = "/consent";
      consentUrl.search = "";
      consentUrl.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(consentUrl);
    }
    if (request.nextUrl.pathname === "/consent" && hasRequiredConsent) {
      const destination = request.nextUrl.clone();
      destination.pathname = AUTHENTICATED_HOME_PATH;
      destination.search = "";
      return NextResponse.redirect(destination);
    }
  }

  if (
    user &&
    (request.nextUrl.pathname === "/login" ||
      request.nextUrl.pathname === "/signup" ||
      request.nextUrl.pathname === "/forgot-password" ||
      request.nextUrl.pathname === "/verify-email")
  ) {
    const authenticatedHomeUrl = request.nextUrl.clone();
    authenticatedHomeUrl.pathname = hasRequiredConsent
      ? AUTHENTICATED_HOME_PATH
      : "/consent";
    authenticatedHomeUrl.search = "";
    return NextResponse.redirect(authenticatedHomeUrl);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
