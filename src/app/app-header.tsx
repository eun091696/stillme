"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/app/brand-mark";
import { MobileNavigation } from "@/app/mobile-navigation";

export function AppHeader({ availableCredit, signedIn }: { availableCredit: number | null; signedIn: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: "/generate/profile", label: "프로필 사진" },
    { href: "/generate/id-photo", label: "증명사진" },
    { href: "/generate/character-avatar", label: "캐릭터 사진" },
    { href: "/generate/underwater-correction", label: "사진 보정" },
    { href: "/generations", label: "내 사진" },
  ] as const;
  const profileDetail = pathname === "/generate/profile-photo" || /^\/generate\/[a-z-]+-profile$/.test(pathname);
  const navigation = links.map((link) => {
    const current = pathname === link.href ? "page" :
      link.href === "/generate/profile" && profileDetail ? "location" : undefined;
    return (
      <Link aria-current={current} className={current ? "is-active" : undefined} href={link.href} key={link.href}>
        {link.label}
      </Link>
    );
  });

  return (
    <header className="app-header">
      <BrandMark className="app-brand" />
      <nav aria-label="스튜디오 메뉴" className="app-nav">{navigation}</nav>
      <div className="app-header-account">
        <Link
          aria-current={pathname === "/credits" ? "page" : undefined}
          aria-label={signedIn ? availableCredit === null ? "크레딧 확인" : `사용 가능 크레딧 ${availableCredit}개` : "크레딧 안내"}
          className="app-credit-pill"
          href="/credits"
        >
          <span>크레딧</span>{signedIn ? <strong>{availableCredit === null ? "확인" : availableCredit}</strong> : null}
        </Link>
        <Link aria-current={pathname === (signedIn ? "/account" : "/login") ? "page" : undefined} aria-label={signedIn ? "내 계정" : "로그인"} className="app-account-avatar" href={signedIn ? "/account" : "/login"}>
          <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" viewBox="0 0 24 24" width="20"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 2.5-6 7-6s7 2 7 6" /></svg>
        </Link>
      </div>
      <MobileNavigation navLabel="모바일 스튜디오 메뉴">{navigation}</MobileNavigation>
    </header>
  );
}
