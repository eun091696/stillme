import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import {
  isPhotoServicePresetId,
  PHOTO_SERVICES,
} from "@/app/photo-services";
import {
  buildCandidatePrompt,
  getBusinessProfileOutfitOptions,
  getBusinessProfileStyleOptions,
  getCandidateBackgroundOptions,
  getDefaultBusinessProfileOutfit,
  getDefaultCandidateBackground,
  getPromptPreset,
  normalizeAdditionalRequest,
} from "@/lib/prompts";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const PREVIEW_SLOTS = [1, 2, 3] as const;
type PageProps = {
  searchParams: Promise<{
    presetId?: string;
    model?: string;
    profession?: string;
    style?: string;
    additionalRequest?: string;
    candidateOutfit1?: string;
    candidateOutfit2?: string;
    candidateOutfit3?: string;
    candidateBackground1?: string;
    candidateBackground2?: string;
    candidateBackground3?: string;
    candidateRequest1?: string;
    candidateRequest2?: string;
    candidateRequest3?: string;
  }>;
};

export default async function PromptPreviewPage({ searchParams }: PageProps) {
  if (process.env.NODE_ENV !== "development") notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dev/prompt-preview");
  const params = await searchParams;
  const presetId = isPhotoServicePresetId(params.presetId)
    ? params.presetId
    : "resume-id";
  const model = params.model === "pro" ? "pro" : "flash";
  let results: ReturnType<typeof buildCandidatePrompt>[] = [];
  let additionalRequest: string | null = null;
  let error: string | null = null;
  try {
    results = PREVIEW_SLOTS.map((slot) =>
      buildCandidatePrompt({
        presetId,
        model,
        additionalRequest: params.additionalRequest,
        styleId: params.style,
        outfitId: params[`candidateOutfit${slot}` as keyof typeof params],
        backgroundId:
          params[`candidateBackground${slot}` as keyof typeof params],
        customRequest:
          params[`candidateRequest${slot}` as keyof typeof params],
        profession: params.profession,
      }),
    );
    additionalRequest = normalizeAdditionalRequest(params.additionalRequest);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "PROMPT_PREVIEW_FAILED";
  }
  return (
    <>
      <header><Link href="/">STILLME</Link></header>
      <main className="page-shell generation-shell" id="main-content" tabIndex={-1}>
        <section className="generation-create-card" aria-labelledby="prompt-preview-title">
          <p className="eyebrow">DEVELOPMENT ONLY · SERVER PREVIEW</p>
          <h1 id="prompt-preview-title">Prompt Engine Preview</h1>
          <form className="generation-form" method="get">
            <label htmlFor="presetId">Preset</label>
            <select defaultValue={presetId} id="presetId" name="presetId">
              {PHOTO_SERVICES.map((service) => {
                const preset = getPromptPreset(service.presetId);
                return (
                  <option key={service.presetId} value={service.presetId}>
                    {service.title} · {preset.runtimePromptId}
                  </option>
                );
              })}
            </select>
            <label htmlFor="model">Model</label>
            <select defaultValue={model} id="model" name="model">
              <option value="flash">flash</option>
              <option value="pro">pro</option>
            </select>
            <label htmlFor="additionalRequest">Additional request</label>
            <input id="additionalRequest" name="additionalRequest" maxLength={240} defaultValue={params.additionalRequest ?? ""} />
            {presetId === "business-profile" ? (
              <>
                <label htmlFor="profession">Profession</label>
                <input
                  defaultValue={params.profession ?? ""}
                  id="profession"
                  maxLength={80}
                  name="profession"
                  placeholder="예: 의사, 변호사, 개발자, 헤어디자이너"
                  required
                />
                <label htmlFor="style">Style</label>
                <select defaultValue={params.style ?? "auto"} id="style" name="style">
                  {getBusinessProfileStyleOptions().map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label} · {option.id}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            {PREVIEW_SLOTS.map((slot) => {
              const options = getCandidateBackgroundOptions(presetId);
              const outfitOptions = presetId === "business-profile"
                ? getBusinessProfileOutfitOptions()
                : [];
              const outfitName = `candidateOutfit${slot}` as const;
              const backgroundName = `candidateBackground${slot}` as const;
              const requestName = `candidateRequest${slot}` as const;
              return (
                <fieldset key={slot}>
                  <legend>사진 {slot}</legend>
                  {presetId === "business-profile" ? (
                    <>
                      <label htmlFor={outfitName}>의상</label>
                      <select
                        defaultValue={
                          params[outfitName] ??
                          getDefaultBusinessProfileOutfit().id
                        }
                        id={outfitName}
                        name={outfitName}
                      >
                        {outfitOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : null}
                  <label htmlFor={backgroundName}>배경</label>
                  <select
                    defaultValue={
                      params[backgroundName] ??
                      getDefaultCandidateBackground(presetId).id
                    }
                    id={backgroundName}
                    name={backgroundName}
                  >
                    {options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <label htmlFor={requestName}>개별 추가 요청</label>
                  <input
                    defaultValue={params[requestName] ?? ""}
                    id={requestName}
                    maxLength={240}
                    name={requestName}
                  />
                </fieldset>
              );
            })}
            <button type="submit">Build preview</button>
          </form>
          {error ? <p className="notice error" role="alert">{error}</p> : null}
          {results.length > 0 ? (
            <div className="notice success">
              <h2>Metadata</h2>
              <p>presetId: {results[0].presetId}</p>
              <p>runtimePromptId: {results[0].runtimePromptId}</p>
              <p>promptId: {results[0].promptId}</p>
              <p>promptVersion: {results[0].promptVersion}</p>
              <p>model: {results[0].model}</p>
              {results[0].profession ? <p>profession: {results[0].profession}</p> : null}
              {results[0].professionCategory ? <p>professionCategory: {results[0].professionCategory}</p> : null}
              {results[0].professionModuleId ? <p>professionModule: {results[0].professionModuleId}</p> : null}
              {results[0].styleId ? <p>styleId: {results[0].styleId}</p> : null}
              <p>styleModifier: {results[0].styleModifier ?? "없음"}</p>
              <h2>Runtime assembly</h2>
              <p>카테고리별 완성형 Prompt를 사용합니다. Legacy Module 조합은 적용하지 않습니다.</p>
              <h2>Additional request</h2>
              <p>{additionalRequest ?? "없음"}</p>
              {results.map((result, index) => (
                <section key={index}>
                  <h2>사진 {index + 1} 최종 Prompt</h2>
                  {result.candidateOutfitId ? <p>candidateOutfit: {result.candidateOutfitId}</p> : null}
                  <p>candidateBackground: {result.candidateBackgroundId}</p>
                  <pre style={{ whiteSpace: "pre-wrap" }}>{result.prompt}</pre>
                </section>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}
