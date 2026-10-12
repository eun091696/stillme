"use client";

import { useState } from "react";

type AuthPasswordFieldProps = {
  autoComplete: "current-password" | "new-password";
  describedBy?: string;
  id?: string;
  name?: string;
  placeholder?: string;
};

export function AuthPasswordField({
  autoComplete,
  describedBy,
  id = "password",
  name = "password",
  placeholder = "비밀번호",
}: AuthPasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="auth-password-field">
      <input
        aria-describedby={describedBy}
        autoComplete={autoComplete}
        id={id}
        maxLength={72}
        minLength={8}
        name={name}
        placeholder={placeholder}
        required
        type={isVisible ? "text" : "password"}
      />
      <button
        aria-label={isVisible ? "비밀번호 숨기기" : "비밀번호 보기"}
        aria-pressed={isVisible}
        className="password-visibility-button"
        onClick={() => setIsVisible((visible) => !visible)}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          {isVisible ? (
            <>
              <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
              <circle cx="12" cy="12" r="2.5" />
            </>
          ) : (
            <>
              <path d="M3 3 21 21" />
              <path d="M10.6 6.1c.5-.1.9-.1 1.4-.1 6 0 9.5 6 9.5 6a17 17 0 0 1-2.3 3.1M6.1 6.2C3.7 8 2.5 12 2.5 12s3.5 6 9.5 6c1.2 0 2.3-.2 3.2-.6M9.9 9.8a3 3 0 0 0 4.2 4.3" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
