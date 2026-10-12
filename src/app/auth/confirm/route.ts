import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { safeAuthCallbackPath } from "@/lib/auth/redirect";
import { grantNewUserPromotion } from "@/lib/credits/new-user-promotion";
import { REQUIRED_POLICY_VERSION } from "@/lib/policies";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

export async function GET(request: NextRequest) {
  const providerError = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const requestedPath = safeAuthCallbackPath(
    request.nextUrl.searchParams.get("next"),
  );

  if (providerError) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "error",
      "소셜 로그인을 완료하지 못했습니다. 다시 시도해 주세요.",
    );
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();

  async function destinationAfterConsent(destination: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "/login";
    const promotion = await grantNewUserPromotion(user);
    if (!promotion.granted && promotion.reason === "GRANT_FAILED") {
      console.error(JSON.stringify({
        event_name: "new_user_promotion.grant_failed",
        error_code: "PROMOTION_GRANT_FAILED",
      }));
    }
    const { data, error } = await supabase
      .from("policy_consents")
      .select("policy_type")
      .eq("user_id", user.id)
      .eq("policy_version", REQUIRED_POLICY_VERSION);
    if (error || new Set((data ?? []).map((row) => row.policy_type)).size < 2) {
      return `/consent?next=${encodeURIComponent(destination)}`;
    }
    return destination;
  }

  if (tokenHash && type && allowedTypes.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(new URL("/reset-password", request.url));
      }
      return NextResponse.redirect(
        new URL(await destinationAfterConsent(requestedPath), request.url),
      );
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(
        new URL(await destinationAfterConsent(requestedPath), request.url),
      );
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "error",
    "인증 링크가 만료되었거나 올바르지 않습니다.",
  );
  return NextResponse.redirect(loginUrl);
}
