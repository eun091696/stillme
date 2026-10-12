"use client";
/* eslint-disable @next/next/no-img-element */

import React, { type RefObject } from "react";
import type { CategoryFlow } from "@/lib/prompts/category-flow";
import styles from "../ux.module.css";

export type FlowView = Pick<CategoryFlow, "id" | "mode" | "steps" | "selection" | "options" | "note"> & { profession?: string };

type Common = { flow: FlowView; disabled: boolean; step: number; sectionRef?: RefObject<HTMLElement | null> };

export function FlowSelection({ flow, disabled, step, sectionRef, selectedId, onSelect }: Common & { selectedId: string; onSelect: (id: string) => void }) {
  if (!flow.selection) return null;
  return (
    <section aria-labelledby="look-step-title" className={styles.setupStep} ref={sectionRef}>
      <div className={styles.stepHeading}>
        <span>{step}</span>
        <div><h2 id="look-step-title" tabIndex={-1}>{flow.selection.label}</h2><p>사진을 보고 원하는 분위기를 고르세요.</p></div>
      </div>
      <div className={styles.lookGrid}>
        {flow.selection.choices.map((choice) => (
          <label className={styles.lookCard} key={choice.id}>
            <input checked={selectedId === choice.id} disabled={disabled} name={flow.selection?.field} onChange={() => onSelect(choice.id)} type="radio" value={choice.id} />
            {choice.sampleSrc ? <img alt={`${choice.label} 스타일 예시`} height={1000} src={choice.sampleSrc} width={800} /> : null}
            <span className={styles.lookCardCopy}><strong>{choice.label}</strong><small>{choice.description}</small></span>
          </label>
        ))}
      </div>
      {flow.selection.choices.some((choice) => choice.sampleKind === "mock") ? <p className={styles.mockDisclosure}>사진은 스타일 예시이며 실제 생성 결과가 아닙니다.</p> : null}
    </section>
  );
}

const ID_BACKGROUNDS = new Set(["white", "light-gray"]);

// Option photos are generated per combination so every thumbnail shows exactly the selected value.
export function idOptionImage(backgroundId: string, outfitId: string, tieId: string, sourcePreviewUrl?: string | null) {
  const background = ID_BACKGROUNDS.has(backgroundId) ? backgroundId : "white";
  if (outfitId === "keep-original") return sourcePreviewUrl ?? `/images/options/id/${background}-shirt.webp`;
  if (outfitId === "shirt") return `/images/options/id/${background}-shirt.webp`;
  return `/images/options/id/${background}-suit-${tieId === "dark" ? "tie" : "notie"}.webp`;
}

export function characterOptionImage(styleId: string | undefined, outfitId: string, backgroundId: string) {
  const style = styleId === "pixel-art" || styleId === "clay" ? styleId : "block-figure";
  return `/images/options/character/${style}-${outfitId === "neutral" ? "neutral" : "original"}-${backgroundId === "original" ? "original" : "studio"}.webp`;
}

export function FlowOptions({ flow, disabled, step, sectionRef, idOutfitId, onIdOutfitChange, selectedId, sourcePreviewUrl, hairStyleId = "current", onHairStyleChange, profileOutfitId = "current", onProfileOutfitChange }: Common & { hairStyleId?: string; onHairStyleChange?: (id: string) => void; profileOutfitId?: string; onProfileOutfitChange?: (id: string) => void; idOutfitId: string; onIdOutfitChange: (id: string) => void; selectedId?: string; sourcePreviewUrl?: string | null }) {
  const [idBackgroundId, setIdBackgroundId] = React.useState("white");
  const [idTieId, setIdTieId] = React.useState("none");
  const [characterOutfitId, setCharacterOutfitId] = React.useState("original");
  const [characterBackgroundId, setCharacterBackgroundId] = React.useState("studio");
  if (flow.options.length === 0) return null;
  const isId = flow.id === "id-photo";
  const isCharacter = flow.id === "character-avatar";
  const selectedLook = flow.selection?.choices.find((choice) => choice.id === selectedId);
  const choiceLabel = (field: string, id: string) => flow.options.find((group) => group.field === field)?.choices.find((choice) => choice.id === id)?.label ?? "";
  const previewSrc = isId
    ? idOptionImage(idBackgroundId, idOutfitId, idTieId, sourcePreviewUrl)
    : isCharacter
      ? characterOptionImage(selectedId, characterOutfitId, characterBackgroundId)
      : selectedLook?.sampleSrc ?? null;
  const previewTitle = isId
    ? [choiceLabel("idBackgroundId", idBackgroundId), choiceLabel("idOutfitId", idOutfitId), idOutfitId === "suit" ? choiceLabel("idTieId", idTieId) : null].filter(Boolean).join(" · ")
    : isCharacter
      ? [selectedLook?.label, choiceLabel("characterOutfitId", characterOutfitId), choiceLabel("characterBackgroundId", characterBackgroundId)].filter(Boolean).join(" · ")
      : `선택한 Look · ${selectedLook?.label}`;
  const selectedValue = (field: string) => {
    if (field === "hairStyleId") return hairStyleId;
    if (field === "profileOutfitId") return profileOutfitId;
    if (field === "idOutfitId") return idOutfitId;
    if (field === "idBackgroundId") return idBackgroundId;
    if (field === "idTieId") return idTieId;
    if (field === "characterOutfitId") return characterOutfitId;
    if (field === "characterBackgroundId") return characterBackgroundId;
    return undefined;
  };
  const onChoice = (field: string, id: string) => {
    if (field === "hairStyleId") onHairStyleChange?.(id);
    else if (field === "profileOutfitId") onProfileOutfitChange?.(id);
    else if (field === "idOutfitId") onIdOutfitChange(id);
    else if (field === "idBackgroundId") setIdBackgroundId(id);
    else if (field === "idTieId") setIdTieId(id);
    else if (field === "characterOutfitId") setCharacterOutfitId(id);
    else if (field === "characterBackgroundId") setCharacterBackgroundId(id);
  };
  const thumbnail = (field: string, choice: FlowView["options"][number]["choices"][number]) => {
    if (field === "idBackgroundId") return idOptionImage(choice.id, idOutfitId === "keep-original" ? "suit" : idOutfitId, idTieId);
    if (field === "idOutfitId") return idOptionImage(idBackgroundId, choice.id, idTieId, sourcePreviewUrl);
    if (field === "idTieId") return idOptionImage(idBackgroundId, "suit", choice.id);
    if (field === "characterOutfitId") return characterOptionImage(selectedId, choice.id, characterBackgroundId);
    if (field === "characterBackgroundId") return characterOptionImage(selectedId, characterOutfitId, choice.id);
    return choice.sampleSrc;
  };
  return (
    <section aria-labelledby="flow-options-title" className={styles.setupStep} ref={sectionRef}>
      <div className={styles.stepHeading}>
        <span>{step}</span>
        <div><h2 id="flow-options-title" tabIndex={-1}>{isId ? "증명사진 옵션" : "필요한 옵션만 선택하세요"}</h2><p>{isId ? "배경과 의상을 고르세요. 정장에는 넥타이를 선택할 수 있어요." : "선택한 스타일을 확인하고 필요한 옵션만 바꿔주세요."}</p></div>
      </div>
      <div className={isId ? styles.idOptionLayout : previewSrc ? `${styles.customizationLayout} ${isCharacter ? styles.characterOptionLayout : ""}` : styles.simpleOptionLayout}>
        {previewSrc ? (
          <figure className={isId ? styles.idOptionPreview : styles.selectedLookPreview}>
            <img alt={isId ? `선택한 증명사진 옵션 예시: ${previewTitle}` : `${previewTitle} 예시`} height={1000} src={previewSrc} width={800} />
            <figcaption><strong>{isId ? "선택한 옵션 예시" : previewTitle}</strong><span>{isId ? previewTitle : "예시 이미지"}</span></figcaption>
          </figure>
        ) : null}
        <div className={styles.visualOptionGroups}>
          {selectedLook?.components ? <div className={styles.lookIncludedOptions}><strong>Look 촬영 설정</strong><dl>{([ ["배경", selectedLook.components.background], ["조명", selectedLook.components.lighting], ["포즈", selectedLook.components.pose], ["구도", selectedLook.components.composition] ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div> : selectedLook && !isCharacter ? <div className={styles.lookIncludedOptions}><strong>선택한 스타일</strong><p>{selectedLook.description}</p></div> : null}
          {flow.note ? <p className={styles.hairPreservation}>{flow.note}</p> : null}
          {flow.options.map((group) => group.field === "idTieId" && idOutfitId !== "suit" ? null : (
            <fieldset className={`${styles.outfitPicker} ${group.field === "hairStyleId" ? styles.hairOptionPicker : group.field.startsWith("character") ? styles.characterOptionPicker : ""}`} key={group.field}>
              <legend>{group.label}</legend>
              <div className={styles.outfitGrid}>
                {group.choices.map((choice) => {
                  const src = thumbnail(group.field, choice);
                  return (
                    <label className={styles.outfitCard} key={choice.id}>
                      <input checked={selectedValue(group.field) === choice.id} disabled={disabled} name={group.field === "hairStyleId" ? undefined : group.field} onChange={() => onChoice(group.field, choice.id)} type="radio" value={choice.id} />
                      {src ? <img alt={`${choice.label} 선택 예시`} height={1000} src={src} width={800} /> : <span aria-hidden="true" className={styles.outfitDefault} style={{ backgroundColor: choice.swatch ?? "#eeece6" }} />}
                      <span>{choice.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <p className={styles.mockDisclosure}>{isId ? "옵션 사진은 선택한 배경·의상·넥타이를 보여주는 예시 이미지이며 실제 생성 결과가 아닙니다. 원본 의상 유지는 올린 사진을 기준으로 합니다." : "옵션 사진은 선택을 돕는 예시 이미지이며 실제 생성 결과가 아닙니다."}</p>
        </div>
      </div>
    </section>
  );
}

export function HairUploadSummary({ flow, selectedLookId, hairStyleId, profileOutfitId }: { flow: FlowView; selectedLookId: string; hairStyleId: string; profileOutfitId: string }) {
  const look = flow.selection?.choices.find((choice) => choice.id === selectedLookId);
  const hair = flow.options.find((group) => group.field === "hairStyleId")?.choices.find((choice) => choice.id === hairStyleId);
  const outfit = flow.options.find((group) => group.field === "profileOutfitId")?.choices.find((choice) => choice.id === profileOutfitId);
  return <div aria-label="선택한 스타일 요약"><p><strong>Look</strong> · {look?.label ?? "선택 없음"}</p><p><strong>헤어</strong> · {hair?.label ?? "선택 없음"}</p><p><strong>의상</strong> · {outfit?.label ?? "선택 없음"}</p></div>;
}
