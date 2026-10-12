import Link from "next/link";

const links = [
  ["이용약관", "/terms"],
  ["개인정보처리방침", "/privacy"],
  ["취소 및 환불 정책", "/refund-policy"],
  ["서비스 이용안내", "/service-guide"],
] as const;

function supportEmail() {
  const value = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value) ? value : null;
}

export function SiteFooter() {
  const email = supportEmail();
  return (
    <footer className="site-footer">
      <Link className="site-footer-brand" href="/">STILLME</Link>
      <nav aria-label="정책 및 이용안내">
        {links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
        {email ? <a href={`mailto:${email}`}>고객문의</a> : null}
      </nav>
      <p>Different photo. Still you.</p>
    </footer>
  );
}
