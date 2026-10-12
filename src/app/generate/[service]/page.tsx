import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteHeader } from "@/app/site-header";
import { getPhotoServiceByRouteId } from "@/app/photo-services";
import { PROFESSION_MAX_LENGTH } from "@/lib/prompts/business-profile/profession";
import { getProfileCategory } from "@/lib/prompts/business-profile/category-config";
import { getCategoryFlow } from "@/lib/prompts/category-flow";
import { getBusinessProfileStyleOptions } from "@/lib/prompts/business-profile/style";
import {
  getBusinessProfileOutfitOptions,
  getCandidateBackgroundOptions,
  getDefaultBusinessProfileOutfit,
  getDefaultCandidateBackground,
} from "@/lib/prompts/candidate-options";
import { createClient } from "@/lib/supabase/server";

import styles from "../../ux.module.css";
import { GenerationSetupForm } from "../setup-form";

export const dynamic = "force-dynamic";

type ServiceGenerationPageProps = { params: Promise<{ service: string }> };

export async function generateMetadata({ params }: ServiceGenerationPageProps): Promise<Metadata> {
  const { service: routeId } = await params;
  const service = getPhotoServiceByRouteId(routeId);
  return { title: `STILLME | ${service?.title ?? "사진 만들기"}` };
}

export default async function ServiceGenerationPage({ params }: ServiceGenerationPageProps) {
  const { service: routeId } = await params;
  const service = getPhotoServiceByRouteId(routeId);
  if (!service) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/generate/${service.routeId}`);

  const backgroundOptions = getCandidateBackgroundOptions(service.presetId);
  const businessProfile = service.presetId === "business-profile";
  const category = getProfileCategory(service.routeId);
  const flow = getCategoryFlow(service.routeId);

  return (
    <>
      <SiteHeader />
      <main className={styles.workspace} id="main-content" tabIndex={-1}>
        <section className={`${styles.optionsIntro} ${styles.lookIntro} ${flow?.id === "id-photo" ? styles.compactIdIntro : ""}`}>
          <Link className={styles.backToServices} href="/generate">← 서비스 다시 선택</Link>
          <div className={styles.lookIntroContent}>
            <div><p className="eyebrow">{flow?.id === "id-photo" ? "증명사진" : `${service.englishTitle} · CREATE YOUR PHOTO`}</p><h1>{flow?.mode === "enhance" ? service.title : `${service.title} 만들기`}</h1><p>{service.description}</p></div>
            <div className={styles.lookIntroImage}><Image alt={`${service.title} 스타일 예시`} fill sizes="(max-width: 640px) 100vw, 42vw" src={service.imageSrc} />{service.sampleKind === "mock" ? <small>스타일 예시 사진</small> : null}</div>
          </div>
        </section>
        <GenerationSetupForm service={{
          presetId: service.presetId,
          sampleImageSrc: service.imageSrc,
          requiresProfession: service.requiresProfession,
          professionMaxLength: PROFESSION_MAX_LENGTH,
          backgroundOptions: backgroundOptions.map(({ id, label }) => ({ id, label })),
          defaultBackgroundId: getDefaultCandidateBackground(service.presetId).id,
          outfitOptions: businessProfile
            ? getBusinessProfileOutfitOptions().map(({ id, label }) => ({ id, label }))
            : [],
          defaultOutfitId: getDefaultBusinessProfileOutfit().id,
          styleOptions: businessProfile
            ? getBusinessProfileStyleOptions().map(({ id, label }) => ({ id, label }))
            : [],
          defaultProfession: service.defaultProfession,
          defaultStyleId: service.defaultStyleId,
          flow: flow ? {
            id: flow.id,
            mode: flow.mode,
            steps: flow.steps,
            selection: flow.selection ? { field: flow.selection.field, label: flow.selection.label, choices: flow.selection.choices.map(({ id, label, description, sampleSrc, sampleKind, components }) => ({ id, label, description, sampleSrc, sampleKind, components })) } : undefined,
            options: flow.options.map(({ field, label, choices }) => ({ field, label, choices: choices.map(({ id, label: choiceLabel, sampleSrc, sampleKind, swatch, instruction }) => ({ id, label: choiceLabel, sampleSrc, sampleKind, swatch, instruction })) })),
            note: flow.note,
            profession: category?.profession,
          } : undefined,
        }} />
      </main>
    </>
  );
}
