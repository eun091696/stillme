"use client";
/* eslint-disable @next/next/no-img-element */

import React, {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import type { PhotoServicePresetId } from "../photo-services";
import styles from "../ux.module.css";
import {
  generateImage,
  type GenerateImageState,
} from "./actions";
import { GENERATE_IMAGE_ERROR_MESSAGES } from "./error-messages";
import { FlowOptions, FlowSelection, HairUploadSummary, type FlowView } from "./flow-steps";
const INITIAL_GENERATE_IMAGE_STATE: GenerateImageState = {
  error: null,
  result: null,
};

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
const PROGRESS_MESSAGES = [
  "사진을 준비하고 있어요",
  "사진을 만들고 있어요",
  "마무리하고 있어요",
] as const;

type Candidate = NonNullable<GenerateImageState["result"]>["candidates"][number];

function getFile(
  event: ChangeEvent<HTMLInputElement> | DragEvent<HTMLLabelElement>,
) {
  return "dataTransfer" in event
    ? event.dataTransfer.files[0]
    : event.target.files?.[0];
}

type GenerationServiceContext = {
  presetId: PhotoServicePresetId;
  sampleImageSrc: string;
  requiresProfession: boolean;
  professionMaxLength: number;
  backgroundOptions: readonly { id: string; label: string }[];
  defaultBackgroundId: string;
  outfitOptions: readonly { id: string; label: string }[];
  defaultOutfitId: string;
  styleOptions: readonly { id: string; label: string }[];
  defaultProfession?: string;
  defaultStyleId?: string;
  flow?: FlowView;
};

export function GenerationSetupForm({ service }: { service: GenerationServiceContext }) {
  const downloadService = service.presetId === "resume-id"
    ? "id-photo"
    : service.presetId;
  const formRef = useRef<HTMLFormElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLElement>(null);
  const customizationRef = useRef<HTMLElement>(null);
  const profileOptionsRef = useRef<HTMLElement>(null);
  const focusTargetRef = useRef<"look" | "options" | null>(null);
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [selectedLookId, setSelectedLookId] = useState(service.flow?.selection?.choices[0]?.id ?? "");
  const [idOutfitId, setIdOutfitId] = useState("suit");
  const [hairStyleId, setHairStyleId] = useState("current");
  const [profileOutfitId, setProfileOutfitId] = useState("current");
  const [activeStep, setActiveStep] = useState(0);
  const [additionalRequest, setAdditionalRequest] = useState("");
  const [sharedBackgroundId, setSharedBackgroundId] = useState(service.defaultBackgroundId);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const [productionId, setProductionId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [state, action, pending] = useActionState(
    (previous: GenerateImageState, formData: FormData) => {
      formData.delete("sharedBackgroundStyle");
      if (sourceImage) {
        formData.set("sourceImage", sourceImage);
      }
      return generateImage(previous, formData);
    },
    INITIAL_GENERATE_IMAGE_STATE,
  );

  useEffect(() => {
    if (!pending) {
      setProgressIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setProgressIndex((current) =>
        Math.min(current + 1, PROGRESS_MESSAGES.length - 1),
      );
    }, 2_500);
    return () => window.clearInterval(interval);
  }, [pending]);

  useEffect(() => {
    if (!state.result) return;

    setProductionId(state.result.productionId);
    // Each production is a fresh paid batch; never merge candidates across productions.
    setCandidates(() => {
      return [...(state.result?.candidates ?? [])];
    });
  }, [state.result]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    },
    [],
  );

  function clearPreview() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreviewUrl(null);
  }

  function selectFile(file: File | undefined) {
    if (!file || !ALLOWED_IMAGE_TYPES.has(file.type)) {
      setLocalError("JPG, PNG, WEBP 형식의 사진을 선택해 주세요.");
      return;
    }
    if (file.size === 0 || file.size > MAX_SOURCE_IMAGE_BYTES) {
      setLocalError("10MB 이하의 사진을 선택해 주세요.");
      return;
    }

    clearPreview();
    const nextPreviewUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextPreviewUrl;
    setSourceImage(file);
    setPreviewUrl(nextPreviewUrl);
    setLocalError(null);
    setProductionId(null);
    setCandidates([]);
    setSelectedCandidateId(null);
  }

  function removeFile() {
    clearPreview();
    setSourceImage(null);
    setLocalError(null);
    setProductionId(null);
    setCandidates([]);
    setSelectedCandidateId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function focusStage(target: "look" | "options") {
    focusTargetRef.current = target;
    const step = target === "look" ? 0 : service.flow ? Math.max(0, service.flow.steps.indexOf("options")) : 1;
    setActiveStep(step);
  }

  useEffect(() => {
    if (!focusTargetRef.current) return;
    const target = focusTargetRef.current;
    focusTargetRef.current = null;
    const section = target === "look" ? optionsRef.current : service.flow?.steps[0] === "look" ? customizationRef.current : service.flow?.steps[0] === "upload" ? optionsRef.current : profileOptionsRef.current;
    if (!section) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    section.querySelector<HTMLElement>('input[type="radio"]:checked, input[type="radio"], select, textarea, input[type="file"]')?.focus();
  }, [activeStep, service.flow]);

  const selectedChoice = service.flow?.selection?.choices.find((choice) => choice.id === selectedLookId);
  const selectedBackgroundLabel = service.backgroundOptions.find((option) => option.id === sharedBackgroundId)?.label ?? "프로필 사진";
  const selectedCandidateIndex = Math.max(0, candidates.findIndex((candidate) => candidate.assetId === selectedCandidateId));
  const selectedCandidate = candidates[selectedCandidateIndex];
  const hasResult = sourceImage && productionId && candidates.length > 0;
  const displayedError =
    localError ??
    (state.error ? GENERATE_IMAGE_ERROR_MESSAGES[state.error] : null);
  const selectedHair = service.flow?.options.find((group) => group.field === "hairStyleId")?.choices.find((choice) => choice.id === hairStyleId);
  const hairInstruction = selectedHair?.instruction;
  const hairGuidance = hairStyleId === "current"
    ? "원본의 헤어스타일과 색상을 최대한 유지합니다."
    : `얼굴은 그대로 유지하고 ${selectedHair?.label ?? "선택한 헤어"} 스타일만 적용합니다.`;
  const combinedHairRequest = [hairInstruction, additionalRequest.trim()].filter(Boolean).join(" ");
  const stepCount = service.flow?.steps.length ?? 3;
  const candidateSlots = [1, 2, 3];
  const profileSamples: Record<string, string> = {
    "bright-studio": "/images/options/background/profile-bright-studio.webp",
    "natural-interior": "/images/options/background/profile-natural-interior.webp",
    cafe: "/images/options/background/profile-cafe.webp",
    outdoor: "/images/options/background/profile-outdoor.webp",
    auto: service.sampleImageSrc,
    white: "/images/options/background/business-white.webp",
    "light-gray": "/images/options/background/business-light-gray.webp",
    "dark-gray": "/images/options/background/business-dark-gray.webp",
    office: "/images/options/background/business-office.webp",
    studio: "/images/options/background/business-studio.webp",
  };
  const sharedBackgroundFields = !service.flow ? candidateSlots.map((slot) => <input key={slot} type="hidden" name={`candidateBackground${slot}`} value={sharedBackgroundId} />) : null;
  const profileStyle = !service.flow ? <section className={styles.setupStep} aria-labelledby="profile-style-title" ref={optionsRef}>
    <div className={styles.stepHeading}><span>1</span><div><h2 id="profile-style-title">스타일을 고르세요</h2><p>사진을 보고 분위기를 선택하세요. 모든 후보에 같은 배경이 적용됩니다.</p></div></div>
    {service.requiresProfession ? <div className={styles.serviceContextField}>
      <label htmlFor="profession">직업</label><input id="profession" name="profession" type="text" required={activeStep === 0} disabled={pending} maxLength={service.professionMaxLength} defaultValue={service.defaultProfession} placeholder="예: 의사, 건축가" />
      <fieldset className={styles.stylePicker}><legend>촬영 스타일</legend><div className={styles.styleChipGroup}>{service.styleOptions.map((option) => <label className={styles.styleChip} key={option.id}><input type="radio" name="style" value={option.id} defaultChecked={option.id === (service.defaultStyleId ?? "auto")} disabled={pending} /><span>{option.label}</span></label>)}</div></fieldset>
    </div> : null}
    <fieldset className={styles.profileBackgroundPicker}><legend>배경 분위기</legend><div className={styles.lookGrid}>{service.backgroundOptions.map((option) => <label className={styles.lookCard} key={option.id}>
      <input type="radio" name="sharedBackgroundStyle" checked={sharedBackgroundId === option.id} onChange={() => setSharedBackgroundId(option.id)} disabled={pending} value={option.id} />
      <img alt={`${option.label} 분위기 참고 사진`} src={profileSamples[option.id] ?? service.sampleImageSrc} width={800} height={1000} />
      <span className={styles.lookCardCopy}><strong>{option.label}</strong><small>배경 예시</small></span>
    </label>)}</div></fieldset>
    <p className={styles.mockDisclosure}>사진은 배경 분위기를 보여주는 예시 이미지이며 실제 생성 결과가 아닙니다.</p>
  </section> : null;
  const profileOptions = !service.flow ? <section className={styles.setupStep} aria-labelledby="profile-options-title" ref={profileOptionsRef}>
    <div className={styles.stepHeading}><span>2</span><div><h2 id="profile-options-title" tabIndex={-1}>추가 옵션</h2><p>필요할 때만 공통 요청을 입력하세요. 모든 후보에 동일하게 적용됩니다.</p></div></div>
    <label className={styles.simpleField} htmlFor="additionalRequest">추가 요청 (선택)
      <textarea id="additionalRequest" name="additionalRequest" maxLength={240} rows={3} disabled={pending} placeholder="모든 사진에 적용할 요청을 적어주세요." />
    </label>
  </section> : null;

  return (
    <>
      <form
        action={action}
        className={styles.setupFlow}
        onReset={(event) => event.preventDefault()}
        ref={formRef}
      >
        <ol className={styles.liveSteps} aria-label="현재 제작 단계">{Array.from({ length: stepCount }, (_, index) => <li key={index} aria-current={activeStep === index ? "step" : undefined}><span>{index + 1}</span>{service.flow?.steps[index] === "look" ? "Look" : service.flow?.steps[index] === "options" ? "옵션" : service.flow?.steps[index] === "upload" ? "사진 업로드" : ["스타일", "옵션", "사진 업로드"][index]}</li>)}</ol>
        <input name="presetId" type="hidden" value={service.presetId} />

        {service.flow?.profession ? <><input name="categoryId" type="hidden" value={service.flow.id} /><input name="profession" type="hidden" value={service.flow.profession} /></> : null}
        {service.flow?.id === "hair-designer-profile" ? <input name="hairStyleId" type="hidden" value={hairStyleId} /> : null}
        {!service.flow ? <><div hidden={activeStep !== 0}>{profileStyle}</div>{sharedBackgroundFields}<div hidden={activeStep !== 1}>{profileOptions}</div></> : null}
        {service.flow?.steps[0] === "look" ? <>
          <div hidden={activeStep !== 0}><FlowSelection disabled={pending} flow={service.flow} onSelect={setSelectedLookId} sectionRef={optionsRef} selectedId={selectedLookId} step={1} /></div>
          <div hidden={activeStep !== 1}><FlowOptions disabled={pending} flow={service.flow} sectionRef={customizationRef} hairStyleId={hairStyleId} onHairStyleChange={setHairStyleId} profileOutfitId={profileOutfitId} onProfileOutfitChange={setProfileOutfitId} idOutfitId={idOutfitId} onIdOutfitChange={setIdOutfitId} selectedId={selectedLookId} sourcePreviewUrl={previewUrl} step={2} />{service.flow.id === "hair-designer-profile" ? <p className={styles.hairPreservation}>{hairGuidance}</p> : null}</div>
        </> : null}


        <div hidden={activeStep !== (service.flow?.steps.indexOf("upload") ?? 2)}><section className={styles.setupStep} aria-labelledby="upload-step-title" ref={service.flow?.steps.length === 1 ? optionsRef : undefined}>
          <div className={styles.stepHeading}>
            <span>{service.flow ? service.flow.steps.indexOf("upload") + 1 : 3}</span>
            <div>
              <h2 id="upload-step-title" tabIndex={-1}>사진을 올려주세요</h2>
              <p>{service.presetId === "underwater-correction"
                  ? "보정할 물속 사진을 올려주세요. 인물이 없어도 됩니다."
                  : service.presetId === "character-avatar"
                    ? "얼굴과 옷, 양손과 양발이 보이는 전신 사진을 올려주세요."
                    : "얼굴이 선명하게 보이는 본인의 사진을 사용해 주세요."}</p>
            </div>
          </div>
          {service.flow?.options.length === 0 && service.flow.note ? <p className={styles.hairPreservation}>{service.flow.note}</p> : null}
          <div className={styles.uploadStage}>
            <div className={styles.uploadInputColumn}>
          <label
            className={styles.imageUploadZone}
            htmlFor="generationSourceImage"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              selectFile(getFile(event));
            }}
          >
            {previewUrl ? (
              <img alt="업로드한 사진 미리보기" src={previewUrl} />
            ) : (
              <span className={styles.uploadPlaceholder}>
                <span className={styles.uploadIcon} aria-hidden="true">↑</span>
                <strong>여기를 클릭하거나 사진을 끌어다 놓으세요</strong>
                <small>JPG, PNG, WEBP · 최대 10MB</small>
                <span className={styles.uploadButton}>사진 선택</span>
              </span>
            )}
            <input
              accept="image/jpeg,image/png,image/webp"
              disabled={pending}
              id="generationSourceImage"
              name="sourceImage"
              onChange={(event) => {
                selectFile(getFile(event));
                event.currentTarget.value = "";
              }}
              ref={fileInputRef}
              type="file"
            />
          </label>
          <aside className={styles.uploadGoodExample}>
            <strong>좋은 사진 예</strong>
            <img alt="업로드하기 좋은 사진의 구도 예시" height={1125} src={service.presetId === "underwater-correction" ? service.sampleImageSrc : service.presetId === "character-avatar" ? "/images/showcase/character-before.png" : "/images/mock/home/id-photo.webp"} width={900} />
            <p>{service.presetId === "underwater-correction" ? "보정할 장면과 피사체가 잘 보이는 원본" : service.presetId === "character-avatar" ? "얼굴과 양손, 양발까지 보이는 전신" : "얼굴과 머리 윤곽이 선명한 정면 사진"}</p>
            <small>업로드할 사진의 구도 예시</small>
          </aside>
          {sourceImage ? (
            <div className={styles.fileActions}>
              <button
                disabled={pending}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                사진 교체
              </button>
              <button disabled={pending} onClick={removeFile} type="button">
                사진 제거
              </button>
              <span>{sourceImage.name}</span>
            </div>
          ) : null}
            </div>
            {selectedChoice ? (
              <aside aria-label="선택한 스타일 요약" className={styles.uploadSelectionSummary}>
                {selectedChoice.sampleSrc ? <img alt="" src={selectedChoice.sampleSrc} /> : null}
                <div><small>선택한 스타일</small><strong>{selectedChoice.label}</strong><p>{selectedChoice.description ?? "선택한 분위기로 사진을 만듭니다."}</p>{service.flow?.id === "hair-designer-profile" ? <HairUploadSummary flow={service.flow} selectedLookId={selectedLookId} hairStyleId={hairStyleId} profileOutfitId={profileOutfitId} /> : null}</div>
                {selectedChoice.sampleKind === "mock" ? <span>스타일 예시 사진</span> : null}
                <button disabled={pending} onClick={() => focusStage("look")} type="button">스타일 다시 보기 ↗</button>
              </aside>
            ) : null}
            {!selectedChoice && service.presetId === "profile-photo" ? (
              <aside className={styles.uploadSelectionSummary}>
                <img alt="프로필 사진 스타일 예시" src={service.sampleImageSrc} />
                <div><small>선택한 배경 분위기</small><strong>{selectedBackgroundLabel}</strong><p>선택한 배경과 공통 요청을 모든 후보에 적용합니다.</p></div>
                <span>스타일 예시 사진</span>
                <button disabled={pending} onClick={() => focusStage("options")} type="button">옵션 다시 보기 ↗</button>
              </aside>
            ) : null}
          </div>
        </section>

        </div>
        {service.flow?.steps[0] === "upload" ? <div hidden={activeStep !== 1}><FlowOptions disabled={pending} flow={service.flow} idOutfitId={idOutfitId} onIdOutfitChange={setIdOutfitId} sectionRef={optionsRef} sourcePreviewUrl={previewUrl} step={2} /></div> : null}




        {service.flow?.id === "hair-designer-profile" ? <section hidden={activeStep !== 1} className={styles.additionalRequest} aria-labelledby="request-title"><h2 id="request-title">추가 요청 (선택)</h2><label htmlFor="hairAdditionalRequest">모든 사진에 적용할 요청</label><textarea id="hairAdditionalRequest" disabled={pending} maxLength={Math.max(0, 240 - (hairInstruction?.length ?? 0) - (hairInstruction ? 1 : 0))} value={additionalRequest} onChange={(event) => setAdditionalRequest(event.target.value)} rows={2} /><input type="hidden" name="additionalRequest" value={combinedHairRequest} /><p className={styles.requestGuidance}>{hairGuidance}</p></section> : null}

        <nav aria-label="제작 단계 이동" className={styles.flowNavigation}>
          {activeStep > 0 ? <button type="button" disabled={pending} onClick={() => setActiveStep((step) => step - 1)}>이전 단계</button> : null}
          {activeStep < stepCount - 1 ? <button type="button" disabled={pending || (service.flow?.steps[activeStep] === "upload" && !sourceImage)} onClick={() => { if (service.requiresProfession && !service.flow && activeStep === 0 && !formRef.current?.reportValidity()) return; setActiveStep((step) => step + 1); }}>다음 단계</button> : null}
        </nav>
        {displayedError ? (
          <p className="notice error" role="alert">
            {displayedError}
          </p>
        ) : null}

        <button
          aria-live="polite"
          className={styles.generateCta}
          hidden={activeStep !== stepCount - 1}
          disabled={!sourceImage || pending}
          type="submit"
        >
          {pending
            ? PROGRESS_MESSAGES[progressIndex]
            : service.flow?.mode === "enhance" ? "3장 보정하기 · 1 Credit" : "3장 생성하기 · 1 Credit"}
        </button>
        {activeStep === stepCount - 1 && !productionId ? (
          <>
            <p className={styles.creditHint}>
              1 Credit으로 후보 3장을 만듭니다. 검수를 통과하지 못한 사진은 자동으로 다시 만들어요.
            </p>
            <p className={styles.creditHint}>
              생성 이미지는 7일간 보관되며 이후 자동 삭제됩니다.
            </p>
          </>
        ) : null}
      </form>

      {hasResult && previewUrl ? (
        <section
          aria-labelledby="generation-result-title"
          aria-live="polite"
          className={styles.generationResult}
        >
          <div>
            <p className="eyebrow">YOUR PHOTOS · COMPLETED</p>
            <h2 id="generation-result-title">{service.flow?.mode === "enhance" ? "보정된 사진" : "완성된 사진"}</h2>
            <p>
              완성된 사진에서 마음에 드는 한 장을 선택해 저장하세요.
            </p>
          </div>
          <div className={styles.resultMediaGrid}>
            <div className={styles.originalResult}>
              <figure>
                <img alt="업로드한 원본 사진" src={previewUrl} />
                <figcaption>업로드한 원본</figcaption>
              </figure>
            </div>
            <div aria-label="저장할 사진 선택" className={styles.candidateGallery} role="radiogroup">
              {candidates.map((candidate, index) => (
                <figure className={`${styles.resultPhotoCard} ${selectedCandidate?.assetId === candidate.assetId ? styles.isSelected : ""}`} key={candidate.assetId}>
                  <label className={styles.resultPhotoPicker}>
                    <input
                      aria-label={`완성 사진 ${index + 1} 선택`}
                      checked={selectedCandidate?.assetId === candidate.assetId}
                      name="selectedCandidate"
                      onChange={() => setSelectedCandidateId(candidate.assetId)}
                      type="radio"
                      value={candidate.assetId}
                    />
                    <img alt={`완성된 사진 ${index + 1}`} src={`data:${candidate.image.mimeType};base64,${candidate.image.data}`} />
                    <span aria-hidden="true" className={styles.resultPhotoCheck}>✓</span>
                  </label>
                  <figcaption>완성 사진 {index + 1}</figcaption>
                </figure>
              ))}
            </div>
          </div>
          <div className={styles.resultActions}>
            {selectedCandidate ? (
              <a className={styles.resultSaveAction} href={`/api/assets/${selectedCandidate.assetId}/download?service=${downloadService}&candidate=${selectedCandidateIndex + 1}`}>
                선택한 사진 저장하기
              </a>
            ) : null}
            <button disabled={pending} onClick={removeFile} type="button">
              다른 사진 선택
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
