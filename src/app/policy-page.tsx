import Link from "next/link";
import type { ReactNode } from "react";

import { SiteHeader } from "@/app/site-header";

export function PolicyPage({
  children,
  eyebrow,
  title,
  updatedAt = "2026년 8월 25일",
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  updatedAt?: string;
}) {
  return (
    <>
    <SiteHeader />
    <main className="policy-shell" id="main-content" tabIndex={-1}>
      <nav aria-label="홈으로 이동" className="policy-home"><Link href="/">← STILLME</Link></nav>
      <article className="policy-document">
        <header>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="muted">시행일 및 최종 수정일: {updatedAt}</p>
        </header>
        {children}
      </article>
    </main>
    </>
  );
}
