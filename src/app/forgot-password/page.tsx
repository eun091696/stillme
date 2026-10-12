import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";
import { SiteHeader } from "@/app/site-header";

export const metadata = {
  title: "STILLME | 비밀번호 찾기",
};

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const { error, message } = await searchParams;

  return (
    <>
    <SiteHeader />
    <main className="page-shell" id="main-content" tabIndex={-1}>
      <section className="auth-card" aria-labelledby="forgot-password-title">
        <h1 id="forgot-password-title">비밀번호 찾기</h1>
        <p className="muted">
          가입한 이메일로 안전한 비밀번호 재설정 링크를 보내드립니다.
        </p>

        {message ? (
          <p className="notice success" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="notice error" role="alert">
            {error}
          </p>
        ) : null}

        <form action={requestPasswordReset} className="auth-form">
          <label htmlFor="email">이메일</label>
          <input
            autoComplete="email"
            id="email"
            name="email"
            required
            type="email"
          />
          <button type="submit">재설정 이메일 보내기</button>
        </form>

        <p className="auth-switch">
          비밀번호가 기억났나요? <Link href="/login">로그인</Link>
        </p>
      </section>
    </main>
    </>
  );
}
