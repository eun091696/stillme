"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type AuthSubmitButtonProps = {
  children: ReactNode;
  className?: string;
  pendingLabel: string;
};

export function AuthSubmitButton({
  children,
  className,
  pendingLabel,
}: AuthSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-disabled={pending}
      className={className}
      disabled={pending}
      type="submit"
    >
      {pending ? (
        <>
          <span aria-hidden="true" className="auth-spinner" />
          <span>{pendingLabel}</span>
        </>
      ) : children}
    </button>
  );
}
