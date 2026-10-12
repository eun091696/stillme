import type { ReactNode } from "react";
import { SiteHeader } from "@/app/site-header";

type AuthPageShellProps = {
  children: ReactNode;
};

export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <div className="auth-page">
      <SiteHeader />
      <main className="auth-main" id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
