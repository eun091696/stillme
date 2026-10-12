import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { SiteHeader } from "../site-header";
import { PHOTO_SERVICES } from "../photo-services";
import styles from "../ux.module.css";

export const metadata = { title: "STILLME | 사진 만들기" };
export const dynamic = "force-dynamic";

export default async function GeneratePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/generate");

  return (
    <>
      <SiteHeader />
      <main className={styles.workspace} id="main-content" tabIndex={-1}>
        <section className={styles.workspaceIntro}>
          <p className={styles.sectionLabel}>사진 만들기</p>
          <h1>어떤 사진이 필요하세요?</h1>
          <p>사진을 보고 원하는 서비스를 고르세요. 업로드와 옵션 선택은 다음 화면에서 이어집니다.</p>
          <ul className={styles.workspaceAssurance} aria-label="생성 품질 안내">
            <li>첫 결과 3장</li>
            <li>원본 특징 확인</li>
            <li>서비스별 품질 검사</li>
          </ul>
        </section>
        <section aria-label="사진 서비스 선택" className={styles.serviceSelection}>
          <div className={styles.categoryCatalogGrid}>
            {PHOTO_SERVICES.filter((service) => service.catalogFeatured).map((service, index) => (
              <Link className={styles.categoryCatalogCard} href={service.routeId === "profile-photo" ? "/generate/profile" : `/generate/${service.routeId}`} key={service.routeId}>
                <span className={styles.categoryCatalogImage}>
                  <Image
                    alt={`${service.title} 예시`}
                    fill
                    quality={100}
                    sizes="(max-width: 832px) calc(100vw - 2rem), 50vw"
                    src={service.imageSrc}
                  />
                </span>
                <span className={styles.categoryCatalogBody}>
                  <small>0{index + 1} · {service.englishTitle}</small>
                  <h2 className={styles.resultChoiceTitle}>{service.title}</h2>
                  <p className={styles.resultChoiceDescription}>{service.description}</p>
                  {service.sampleKind === "mock" ? <small>스타일 예시 사진 · 실제 생성 결과가 아닙니다</small> : null}
                  <span className={styles.categoryCatalogCta}>이 사진 만들기 <span aria-hidden="true">↗</span></span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
