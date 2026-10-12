import { redirect } from "next/navigation";
import { updatePassword } from "@/app/auth/actions";
import { SiteHeader } from "@/app/site-header";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "STILLME | 새 비밀번호 설정",
};

type ResetPasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?reason=recovery_required");
  }

  return (
    <>
    <SiteHeader />
    <main className="page-shell" id="main-content" tabIndex={-1}>
      <section className="auth-card" aria-labelledby="reset-password-title">
        <h1 id="reset-password-title">새 비밀번호 설정</h1>
        <p className="muted">
          변경을 완료하면 모든 세션이 종료되며 다시 로그인해야 합니다.
        </p>

        {error ? (
          <p className="notice error" role="alert">
            {error}
          </p>
        ) : null}

        <form action={updatePassword} className="auth-form">
          <label htmlFor="password">새 비밀번호</label>
          <input
            autoComplete="new-password"
            id="password"
            maxLength={72}
            minLength={8}
            name="password"
            required
            type="password"
          />
          <label htmlFor="confirmPassword">새 비밀번호 확인</label>
          <input
            autoComplete="new-password"
            id="confirmPassword"
            maxLength={72}
            minLength={8}
            name="confirmPassword"
            required
            type="password"
          />
          <button type="submit">비밀번호 변경</button>
        </form>
      </section>
    </main>
    </>
  );
}
