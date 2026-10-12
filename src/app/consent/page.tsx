import { redirect } from "next/navigation";

import { AuthPageShell } from "@/app/auth-page-shell";
import { ConsentForm } from "@/app/consent/consent-form";
import { safeAuthCallbackPath } from "@/lib/auth/redirect";
import { REQUIRED_POLICY_VERSION } from "@/lib/policies";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "STILLME | 필수 정책 동의" };
export const dynamic = "force-dynamic";

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const destination = safeAuthCallbackPath(next ?? null);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(destination)}`);

  const { data } = await supabase
    .from("policy_consents")
    .select("policy_type")
    .eq("user_id", user.id)
    .eq("policy_version", REQUIRED_POLICY_VERSION);
  if (new Set((data ?? []).map((row) => row.policy_type)).size === 2) {
    redirect(destination);
  }

  return (
    <AuthPageShell>
      <section className="auth-card" aria-labelledby="consent-title">
        <h1 id="consent-title">서비스 이용 동의</h1>
        <p className="muted">STILLME를 이용하려면 필수 정책을 확인해 주세요.</p>
        {error ? <p className="notice error" role="alert">{error}</p> : null}
        <ConsentForm destination={destination} />
      </section>
    </AuthPageShell>
  );
}
