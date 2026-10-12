import Image from "next/image";
import Link from "next/link";

import { SiteHeader } from "@/app/site-header";
import { PHOTO_SERVICES } from "@/app/photo-services";
import styles from "./ux.module.css";

export const dynamic = "force-dynamic";

const PRIMARY_ROUTES = ["profile-photo", "id-photo", "character-avatar", "underwater-correction"] as const;
const PRIMARY_SERVICES = PRIMARY_ROUTES.map((routeId) => ({ ...PHOTO_SERVICES.find((service) => service.routeId === routeId)!, routeId }));
const HOME_SERVICE_DESCRIPTIONS: Record<(typeof PRIMARY_ROUTES)[number], string> = {
  "profile-photo": "자연스럽고 활용도 높은 프로필",
  "id-photo": "이력서에 어울리는 단정한 사진",
  "character-avatar": "특징을 살린 캐릭터 스타일",
  "underwater-correction": "물속 사진의 색감과 빛 복원",
};
const POPULAR = [
  { routeId: "hair-designer-profile", label: "헤어디자이너" },
  { routeId: "executive-profile", label: "CEO · 임원" },
  { routeId: "id-photo", label: "취업사진" },
  { routeId: "lawyer-profile", label: "변호사" },
  { routeId: "developer-profile", label: "개발자" },
  { routeId: "underwater-correction", label: "프리다이빙" },
] as const;

function StudioServiceIcon({ routeId }: { routeId: (typeof PRIMARY_ROUTES)[number] }) {
  const shared = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.8 };
  if (routeId === "id-photo") return <svg aria-hidden="true" viewBox="0 0 40 40" {...shared}><rect x="7" y="7" width="26" height="26" rx="3" /><circle cx="20" cy="17" r="4" /><path d="M12 29c1-5 4-7 8-7s7 2 8 7" /></svg>;
  if (routeId === "character-avatar") return <svg aria-hidden="true" viewBox="0 0 40 40" {...shared}><rect x="8" y="12" width="24" height="21" rx="6" /><path d="M14 12V8h12v4M15 23h.01M25 23h.01M16 28c2 2 6 2 8 0" /></svg>;
  if (routeId === "underwater-correction") return <svg aria-hidden="true" viewBox="0 0 40 40" {...shared}><path d="M20 5c-5 7-11 14-11 21a11 11 0 0 0 22 0c0-7-6-14-11-21Z" /><path d="M14 26c0 3 2 5 5 6M24 18l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 40 40" {...shared}><circle cx="20" cy="15" r="6" /><path d="M9 34c0-8 4-12 11-12s11 4 11 12M8 14V8h6M26 8h6v6" /></svg>;
}

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className={styles.studioHome} id="main-content" tabIndex={-1}>
        <section aria-labelledby="home-title" className={styles.studioHero}>
          <Image alt="" className={styles.studioHeroImage} fill priority sizes="(max-width: 640px) 100vw, 100vw" src="/brand/stillme-home-hero-illustration.webp" />
          <div className={styles.studioHeroCopy}>
            <h1 id="home-title">사진 한 장으로<br />더 나은 당신을 만드세요.</h1>
            <p>당신의 새로운 모습.</p>
            <Link className={styles.studioPrimaryAction} href="/generate">사진 만들기 <span aria-hidden="true">→</span></Link>
          </div>
          <span className={styles.studioHeroCaption}>연출 사진 · 실제 생성 결과 아님</span>
        </section>

        <section aria-labelledby="category-catalog-title" className={styles.studioSection} id="category-catalog">
          <div className={styles.studioSectionHeading}>
            <div><h2 id="category-catalog-title">어떤 사진이 필요하세요?</h2></div>
            <Link href="/generate">모든 서비스 보기 <span aria-hidden="true">↗</span></Link>
          </div>
          <div className={styles.studioServiceGrid}>
            {PRIMARY_SERVICES.map((service) => (
              <Link aria-label={`${service.title} 카테고리 선택`} className={styles.studioServiceCard} href={service.routeId === "profile-photo" ? "/generate/profile" : `/generate/${service.routeId}`} id={`category-${service.routeId}`} key={service.routeId}>
                <span className={styles.studioServiceIcon}><StudioServiceIcon routeId={service.routeId} /></span>
                <span className={styles.studioServiceCopy}>
                  <strong>{service.routeId === "profile-photo" ? "프로필 사진" : service.title}</strong>
                  <small>{HOME_SERVICE_DESCRIPTIONS[service.routeId]}</small>
                </span>
                <span aria-hidden="true" className={styles.studioCardArrow}>→</span>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="popular-title" className={styles.studioSection}>
          <div className={styles.studioSectionHeading}>
            <div><h2 id="popular-title">인기 카테고리</h2><p>사진은 스타일 예시이며 실제 생성 결과가 아닙니다.</p></div>
          </div>
          <div className={styles.studioPopularGrid}>
            {POPULAR.map((item) => {
              const service = PHOTO_SERVICES.find((entry) => entry.routeId === item.routeId)!;
              return (
                <Link className={styles.studioPopularCard} href={`/generate/${item.routeId}`} key={item.label}>
                  <span className={styles.studioPopularImage}><Image alt="" fill sizes="(max-width: 640px) 45vw, (max-width: 1024px) 32vw, 16vw" src={service.imageSrc} /></span>
                  <span className={styles.studioPopularCopy}><strong>{item.label}</strong></span>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
