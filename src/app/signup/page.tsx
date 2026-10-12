import Link from "next/link";
import { signup } from "@/app/auth/actions";
import { AuthPageShell } from "@/app/auth-page-shell";
import { AuthPasswordField } from "@/app/auth-password-field";
import { AuthSubmitButton } from "@/app/auth-submit-button";
import { SocialAuthButtons } from "@/app/social-auth-buttons";
import { AUTHENTICATED_HOME_PATH } from "@/lib/auth/redirect";

export const metadata = {
  title: "STILLME | 회원가입",
};

type SignupPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { error } = await searchParams;

  return (
    <AuthPageShell>
      <section className="auth-card" aria-labelledby="signup-title">
        <h1 id="signup-title">계정 만들기</h1>
        <p className="muted">가입을 완료하면 사진 제작 2회를 무료로 시작할 수 있습니다.</p>

        {error ? (
          <p className="notice error" role="alert">
            {error}
          </p>
        ) : null}

        <SocialAuthButtons next={AUTHENTICATED_HOME_PATH} />
        <div className="auth-divider"><span>또는</span></div>

        <form action={signup} className="auth-form">
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
          <AuthPasswordField
            autoComplete="new-password"
            describedBy="password-help"
          />
          <p className="field-help" id="password-help">
            8자 이상 72자 이하로 입력해 주세요.
          </p>
          <label htmlFor="confirmPassword">비밀번호 확인</label>
          <AuthPasswordField
            autoComplete="new-password"
            id="confirmPassword"
            name="confirmPassword"
            placeholder="비밀번호 확인"
          />
          <label className="policy-consent-check">
            <input name="termsAccepted" required type="checkbox" />
            <span><Link href="/terms" target="_blank">이용약관</Link>에 동의합니다. (필수)</span>
          </label>
          <label className="policy-consent-check">
            <input name="privacyAccepted" required type="checkbox" />
            <span><Link href="/privacy" target="_blank">개인정보처리방침</Link>에 동의합니다. (필수)</span>
          </label>
          <AuthSubmitButton pendingLabel="가입 처리 중">회원가입</AuthSubmitButton>
        </form>

        <p className="auth-switch">
          이미 계정이 있나요? <Link href="/login">로그인</Link>
        </p>
      </section>
    </AuthPageShell>
  );
}
