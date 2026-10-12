import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PROFILE_CATEGORIES } from "@/app/photo-services";
import { SiteHeader } from "@/app/site-header";
import { createClient } from "@/lib/supabase/server";

import styles from "./profile-hub.module.css";

export const metadata = { title: "STILLME | 프로필 카테고리" };
export const dynamic = "force-dynamic";

export default async function ProfileCategoryHub() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/generate/profile");

  return (
    <>
      <SiteHeader />
      <main className={styles.page} id="main-content" tabIndex={-1}>
        <div className={styles.intro}>
          <Link className={styles.back} href="/generate">← 서비스 선택</Link>
          <h1>프로필 사진</h1>
          <p>어떤 용도로 사용할 사진인지 선택하세요.</p>
        </div>
        <section aria-label="프로필 카테고리 선택" className={styles.grid}>
          {PROFILE_CATEGORIES.map((service) => (
            <Link
              aria-label={`${service.profileCategory?.label ?? service.title} 카테고리 선택`}
              className={styles.card}
              href={`/generate/${service.routeId}`}
              key={service.routeId}
            >
              <span className={styles.image}>
                <Image alt="" fill sizes="(max-width: 640px) 90vw, (max-width: 960px) 45vw, 30vw" src={service.imageSrc} />
              </span>
              <span className={styles.copy}>
                <strong>{service.profileCategory?.label ?? service.title}</strong>
                <small>{service.description}</small>
              </span>
            </Link>
          ))}
        </section>
        <p className={styles.disclosure}>사진은 스타일 선택을 돕는 예시이며 실제 생성 결과가 아닙니다.</p>
      </main>
    </>
  );
}
