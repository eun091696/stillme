import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getPhotoService, PHOTO_SERVICES } from "@/app/photo-services";
import styles from "@/app/ux.module.css";
import { createClient } from "@/lib/supabase/server";

import { ImageGenerationForm } from "./form";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ preset?: string }> };

export default async function DevImageGenerationPage({ searchParams }: PageProps) {
  if (process.env.NODE_ENV !== "development") notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dev/image-generation");
  const { preset } = await searchParams;
  const initialPreset = preset && getPhotoService(preset) ? preset : PHOTO_SERVICES[0].presetId;

  return (
    <main className={styles.workspace} id="main-content" tabIndex={-1}>
      <header className={styles.workspaceHeader}><Link href="/">STILLME</Link><nav aria-label="작업 메뉴"><Link href="/generations">내 사진</Link><Link href="/account">내 계정</Link></nav></header>
      <section className={styles.optionsIntro}><p className="eyebrow">FINAL TOUCH</p><h1>마지막으로 원하는 부분이 있나요?</h1><p>추가 요청 없이 바로 생성해도 좋습니다.</p></section>
      <ImageGenerationForm initialPreset={initialPreset} />
    </main>
  );
}
