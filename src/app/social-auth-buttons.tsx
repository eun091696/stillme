import { loginWithSocialProvider } from "@/app/auth/actions";
import { AuthSubmitButton } from "@/app/auth-submit-button";
import { SOCIAL_AUTH_PROVIDERS } from "@/lib/auth/social";

type SocialAuthButtonsProps = {
  next: string;
};

function SocialIcon({ provider }: { provider: "kakao" | "google" }) {
  if (provider === "google") {
    return (
      <span aria-hidden="true" className="social-icon google-icon">
        <svg viewBox="0 0 24 24">
          <path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.7 4.7 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z" />
          <path fill="#34a853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.7A10 10 0 0 0 12 22Z" />
          <path fill="#fbbc05" d="M6.5 14a6 6 0 0 1 0-3.9V7.4H3.1a10 10 0 0 0 0 9.3L6.5 14Z" />
          <path fill="#ea4335" d="M12 6.1c1.6 0 3 .5 4.1 1.6l3-3A10 10 0 0 0 3.1 7.4l3.4 2.7A5.9 5.9 0 0 1 12 6.1Z" />
        </svg>
      </span>
    );
  }

  return (
    <span aria-hidden="true" className="social-icon kakao-icon">
      <svg viewBox="0 0 24 24">
        <path d="M12 4.2c-5 0-9 3.1-9 7 0 2.5 1.7 4.7 4.3 5.9l-.9 3.2c-.1.4.3.7.6.4l3.8-2.5h1.2c5 0 9-3.1 9-7s-4-7-9-7Z" />
      </svg>
    </span>
  );
}

export function SocialAuthButtons({ next }: SocialAuthButtonsProps) {
  return (
    <div
      aria-label="소셜 계정으로 계속하기"
      className="social-auth-list"
      role="group"
    >
      {SOCIAL_AUTH_PROVIDERS.map(({ id, label }) => (
        <form action={loginWithSocialProvider} key={id}>
          <input name="next" type="hidden" value={next} />
          <input name="provider" type="hidden" value={id} />
          <AuthSubmitButton
            className={`social-auth-button social-auth-button-${id}`}
            pendingLabel={`${label}로 이동 중`}
          >
            <SocialIcon provider={id} />
            <span>{label}로 계속하기</span>
          </AuthSubmitButton>
        </form>
      ))}
    </div>
  );
}
