import Link from "next/link";
import { resendSignupConfirmation } from "@/app/auth/actions";
import { AuthPageShell } from "@/app/auth-page-shell";
import { AuthSubmitButton } from "@/app/auth-submit-button";

export const metadata = {
  title: "STILLME | 이메일 인증",
};

type VerifyEmailPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const { error, message } = await searchParams;

  return (
    <AuthPageShell>
      <section className="auth-card" aria-labelledby="verify-email-title">
        <h1 id="verify-email-title">이메일을 확인해 주세요</h1>
        <p className="muted">
          입력하신 이메일 주소로 인증 링크를 보냈습니다. 메일에서 인증 버튼을
          누르면 회원가입이 완료됩니다.
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

        <form action={resendSignupConfirmation} className="auth-form">
          <label htmlFor="email">이메일</label>
          <input
            autoComplete="email"
            id="email"
            name="email"
            required
            type="email"
          />
          <AuthSubmitButton pendingLabel="이메일 전송 중">
            인증 이메일 다시 보내기
          </AuthSubmitButton>
        </form>

        <p className="auth-switch">
          이미 인증했나요? <Link href="/login">로그인</Link>
        </p>
      </section>
    </AuthPageShell>
  );
}
