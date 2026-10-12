import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { RouteFocus } from "./route-focus";
import { SiteFooter } from "./site-footer";

export const metadata: Metadata = {
  title: "STILLME | 사진은 달라져도, 여전히 나",
  description: "증명사진부터 비즈니스와 개인 프로필까지, 나다움을 지키는 온라인 사진 스튜디오",
  icons: { icon: "/brand/stillme-logo.png", apple: "/brand/stillme-logo.png" },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await headers();

  return (
    <html lang="ko">
      <body>
        <a className="skip-link" href="#main-content">
          본문으로 건너뛰기
        </a>
        <RouteFocus />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
