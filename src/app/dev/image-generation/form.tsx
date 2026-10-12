"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useActionState, useEffect, useState, type ChangeEvent, type DragEvent } from "react";

import { loadGenerationDraft } from "@/app/generate/draft";
import { getPhotoService } from "@/app/photo-services";
import styles from "@/app/ux.module.css";

import { generateWithPromptEngine, type ImageGenerationState } from "./actions";

const INITIAL_STATE: ImageGenerationState = { error: null, result: null };

function getFile(event: ChangeEvent<HTMLInputElement> | DragEvent<HTMLLabelElement>) {
  return "dataTransfer" in event ? event.dataTransfer.files[0] : event.target.files?.[0];
}

export function ImageGenerationForm({ initialPreset }: { initialPreset: string }) {
  const [selectedPreset, setSelectedPreset] = useState(initialPreset);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(true);
  const [state, action, pending] = useActionState(async (previous: ImageGenerationState, formData: FormData) => {
    if (file) formData.set("sourceImage", file);
    return generateWithPromptEngine(previous, formData);
  }, INITIAL_STATE);

  useEffect(() => {
    let active = true;
    loadGenerationDraft().then((draft) => {
      if (!active || !draft || !getPhotoService(draft.presetId)) return;
      setSelectedPreset(draft.presetId);
      setFile(draft.sourceImage);
      setPreviewUrl(URL.createObjectURL(draft.sourceImage));
    }).catch(() => undefined).finally(() => { if (active) setDraftLoading(false); });
    return () => { active = false; };
  }, []);

  function selectFile(nextFile: File | undefined) {
    if (!nextFile || !["image/jpeg", "image/png", "image/webp"].includes(nextFile.type) || nextFile.size > 10 * 1024 * 1024) return;
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  }

  const service = getPhotoService(selectedPreset) ?? getPhotoService(initialPreset);

  return (
    <>
      <form action={action} className={styles.optionsForm}>
        <div className={styles.selectionSummary}>
          {service ? <><img alt="" src={service.imageSrc} /><div><span>선택한 서비스</span><strong>{service.title}</strong><p>{service.description}</p></div></> : null}
          <Link href="/generate">변경</Link>
        </div>

        <section className={styles.optionsPreview} aria-labelledby="source-preview-title">
          <div><span className={styles.stepNumber}>✓</span><div><h2 id="source-preview-title">업로드한 사진</h2><p>선택한 사진으로 작업을 진행합니다.</p></div></div>
          <label className={styles.compactUploadZone} htmlFor="sourceImage" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectFile(getFile(event)); }}>
            {previewUrl ? <img alt="업로드한 사진 미리보기" src={previewUrl} /> : <span>{draftLoading ? "사진을 불러오는 중…" : "사진을 다시 선택해 주세요"}</span>}
            <input accept="image/jpeg,image/png,image/webp" id="sourceImage" name="sourceImage" onChange={(event) => selectFile(getFile(event))} type="file" />
          </label>
        </section>

        <section className={styles.additionalRequest} aria-labelledby="request-title">
          <div><span className={styles.stepNumber}>3</span><div><h2 id="request-title">추가 요청</h2><p>원하는 변경이 있을 때만 작성해 주세요.</p></div><small>선택</small></div>
          <textarea id="additionalRequest" maxLength={240} name="additionalRequest" placeholder="예: 정장을 검정으로, 미소를 조금 더 자연스럽게, 배경을 흰색으로" rows={4} />
        </section>

        <input name="presetId" type="hidden" value={selectedPreset} />
        <input name="model" type="hidden" value="flash" />
        <input name="resolution" type="hidden" value="2K" />
        <button className={styles.generateCta} disabled={pending || !file || !selectedPreset} type="submit">{pending ? "사진을 완성하는 중…" : "사진 생성하기"}</button>
      </form>
      {state.error ? <p className="notice error" role="alert">사진을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.</p> : null}
      {state.result ? <section className={styles.generationResult} aria-live="polite"><div><p className="eyebrow">COMPLETED</p><h2>사진이 완성되었습니다.</h2></div><img alt="생성된 사진" src={`data:${state.result.image.mimeType};base64,${state.result.image.data}`} /></section> : null}
    </>
  );
}
