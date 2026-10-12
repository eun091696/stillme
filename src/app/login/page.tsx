import Link from "next/link";
import { login } from "@/app/auth/actions";
import { AuthPageShell } from "@/app/auth-page-shell";
import { AuthPasswordField } from "@/app/auth-password-field";
import { AuthSubmitButton } from "@/app/auth-submit-button";
import { SocialAuthButtons } from "@/app/social-auth-buttons";
import { AUTHENTICATED_HOME_PATH } from "@/lib/auth/redirect";

export const metadata = {
  title: "STILLME | 로그인",
};

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    next?: string;
    reason?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message, next, reason } = await searchParams;
  const sessionMessage =
    reason === "session_expired"
      ? "세션이 만료되었습니다. 다시 로그인해 주세요."
      : reason === "recovery_required"
        ? "유효한 비밀번호 재설정 링크가 필요합니다."
        : null;
  const destination = next ?? AUTHENTICATED_HOME_PATH;

  return (
    <AuthPageShell>
      <section className="auth-card" aria-labelledby="login-title">
        <h1 id="login-title">계정으로 계속하기</h1>
        <p className="muted">나다움을 지키는 프로필을 시작해 보세요.</p>

        {message ? (
          <p className="notice success" role="status">
            {message}
          </p>
        ) : null}
        {sessionMessage ? (
          <p className="notice error" role="alert">
            {sessionMessage}
          </p>
        ) : null}
        {error ? (
          <p className="notice error" role="alert">
            {error}
          </p>
        ) : null}

        <SocialAuthButtons next={destination} />
        <div className="auth-divider"><span>또는</span></div>

        <form action={login} className="auth-form">
          <input name="next" type="hidden" value={destination} />
          <label htmlFor="email">이메일</label>
          <input
            autoComplete="email"
            id="email"
            name="email"
            placeholder="이메일"
            required
            type="email"
          />
          <label htmlFor="password">비밀번호</label>
          <AuthPasswordField autoComplete="current-password" />
          <AuthSubmitButton pendingLabel="로그인 중">로그인</AuthSubmitButton>
        </form>

        <div className="auth-help-links">
          <Link href="/forgot-password">비밀번호를 잊으셨나요?</Link>
        </div>

        <p className="auth-switch">계정이 없으신가요? <Link href="/signup">회원가입</Link></p>
      </section>
    </AuthPageShell>
  );
}
