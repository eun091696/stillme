"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { evaluateValidationScorecard, VALIDATION_SCORE_LABELS } from "@/lib/prompt-validation/scorecard";
import type { ValidationGenerationResult, ValidationGenerationScope } from "@/lib/prompt-validation/generation";
import type { ValidationCaseId, ValidationScores } from "@/lib/prompt-validation/types";

import { generateValidationImages } from "./actions";
import styles from "./validation.module.css";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

const ERROR_MESSAGES: Record<string, string> = {
  DEV_ONLY: "개발 환경에서만 실행할 수 있습니다.",
  FILE_EXTENSION_MISMATCH: "파일 확장자와 이미지 형식이 일치하지 않습니다.",
  FILE_SIGNATURE_MISMATCH: "이미지 파일의 실제 형식을 확인할 수 없습니다.",
  GENERATION_FAILED: "이미지 생성에 실패했습니다.",
  IMAGE_CREDIT_BYPASS_REQUIRED: "개발용 Credit bypass 설정이 필요합니다.",
  INVALID_FILE_SIZE: "이미지는 10MB 이하의 파일이어야 합니다.",
  INVALID_VALIDATION_REQUEST: "Validation 요청 설정을 확인해 주세요.",
  PROVIDER_ACCESS_DENIED: "Google API 권한이나 결제 설정을 확인해 주세요.",
  PROVIDER_AUTHENTICATION_FAILED: "Google API 인증 설정을 확인해 주세요.",
  PROVIDER_CONFIGURATION_MISSING: "Google 이미지 생성 환경 설정이 필요합니다.",
  PROVIDER_INVALID_REQUEST: "Google 이미지 요청 형식을 확인해 주세요.",
  PROVIDER_MODEL_NOT_FOUND: "Google 이미지 모델 설정을 확인해 주세요.",
  PROVIDER_RATE_LIMITED: "호출 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.",
  PROVIDER_REJECTED: "이미지 생성 정책에 따라 처리할 수 없습니다.",
  PROVIDER_RESPONSE_INVALID: "생성 결과 이미지를 확인하지 못했습니다.",
  PROVIDER_UNAVAILABLE: "Google 이미지 서비스가 일시적으로 불안정합니다.",
  UNSUPPORTED_FILE_TYPE: "JPG, PNG, WEBP 이미지만 사용할 수 있습니다.",
};

type Props = {
  caseId: ValidationCaseId;
  presetId: string;
  model: "flash" | "pro";
  additionalRequest: string;
};

function resultKey(result: Pick<ValidationGenerationResult, "conditionId" | "repeat">) {
  return `${result.conditionId}-${result.repeat}`;
}

function mergeResults(current: ValidationGenerationResult[], incoming: ValidationGenerationResult[]) {
  const merged = new Map(current.map((result) => [resultKey(result), result]));
  for (const result of incoming) merged.set(resultKey(result), result);
  return [...merged.values()].sort((left, right) => resultKey(left).localeCompare(resultKey(right)));
}

function extensionForMime(mimeType: string) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
}

function Scorecard({ result }: { result: ValidationGenerationResult }) {
  const [scores, setScores] = useState<Partial<ValidationScores>>({});
  if (result.status === "failure") return <p className={styles.inconclusive}>생성 실패 · 평가 Inconclusive</p>;
  const complete = Object.keys(VALIDATION_SCORE_LABELS).every((key) => typeof scores[key as keyof ValidationScores] === "number");
  const evaluation = complete ? evaluateValidationScorecard(scores as ValidationScores, result.caseId) : null;
  return (
    <fieldset className={styles.scorecard}>
      <legend>수동 Scorecard</legend>
      {Object.entries(VALIDATION_SCORE_LABELS).map(([key, label]) => (
        <label key={key}>{label}<select aria-label={`${result.conditionId}-${result.repeat} ${label}`} defaultValue="" onChange={(event) => setScores((current) => ({ ...current, [key]: Number(event.target.value) }))}>
          <option disabled value="">미평가</option>
          {[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}</option>)}
        </select></label>
      ))}
      <p>{evaluation ? `${evaluation.total}/35 · ${evaluation.result}` : "모든 항목을 평가해 주세요."}</p>
      <small>Pass는 Rule 승인이나 Runtime 반영을 의미하지 않습니다.</small>
    </fieldset>
  );
}

function ResultCard({ result }: { result: ValidationGenerationResult }) {
  return (
    <article className={styles.resultCard}>
      <h4>조건 {result.conditionId}-{result.repeat}</h4>
      {result.status === "success" ? (
        <>
          <img alt={`조건 ${result.conditionId} ${result.repeat}회 생성 결과`} src={`data:${result.image.mimeType};base64,${result.image.data}`} />
          <a download={`${result.caseId}-${result.conditionId}-${result.repeat}.${extensionForMime(result.image.mimeType)}`} href={`data:${result.image.mimeType};base64,${result.image.data}`}>결과 다운로드</a>
          <p>{result.providerModel} · {(result.durationMs / 1000).toFixed(1)}초</p>
        </>
      ) : <p className={styles.error}>{ERROR_MESSAGES[result.errorCode] ?? "이미지 생성에 실패했습니다."}</p>}
      <dl>
        <dt>caseId</dt><dd>{result.caseId}</dd>
        <dt>conditionId</dt><dd>{result.conditionId}</dd>
        <dt>validationPromptId</dt><dd>{result.validationPromptId}</dd>
        <dt>validationPromptVersion</dt><dd>{result.validationPromptVersion}</dd>
        <dt>repeat</dt><dd>{result.repeat}</dd>
        <dt>model</dt><dd>{result.model}</dd>
        <dt>variantHash</dt><dd>{result.variantHash}</dd>
        <dt>ruleIds</dt><dd>{result.ruleIds.join(", ") || "없음"}</dd>
      </dl>
      <Scorecard result={result} />
    </article>
  );
}

export function ValidationGenerationPanel({ caseId, presetId, model, additionalRequest }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [repeatCount, setRepeatCount] = useState<1 | 2>(2);
  const [results, setResults] = useState<ValidationGenerationResult[]>([]);
  const [pendingScope, setPendingScope] = useState<ValidationGenerationScope | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function selectFile(nextFile: File | undefined) {
    if (!nextFile) return;
    if (!ALLOWED_TYPES.includes(nextFile.type) || nextFile.size === 0 || nextFile.size > MAX_BYTES) {
      setError("JPG, PNG, WEBP 형식의 10MB 이하 이미지를 선택해 주세요.");
      return;
    }
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setResults([]);
    setError(null);
  }

  function removeFile() {
    setFile(null);
    setPreviewUrl(null);
    setResults([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function generate(scope: ValidationGenerationScope) {
    if (!file || pendingScope) return;
    setPendingScope(scope);
    setError(null);
    const formData = new FormData();
    formData.set("caseId", caseId);
    formData.set("presetId", presetId);
    formData.set("model", model);
    formData.set("additionalRequest", additionalRequest);
    formData.set("scope", scope);
    formData.set("repeatCount", String(repeatCount));
    formData.set("sourceImage", file);
    try {
      const response = await generateValidationImages(formData);
      if (response.error) setError(ERROR_MESSAGES[response.error] ?? "Validation 생성 요청을 처리하지 못했습니다.");
      if (response.results.length > 0) setResults((current) => mergeResults(current, response.results));
    } catch {
      setError("Validation 생성 요청을 처리하지 못했습니다.");
    } finally {
      setPendingScope(null);
    }
  }

  const conditionA = results.filter((result) => result.conditionId === "A");
  const conditionB = results.filter((result) => result.conditionId === "B");
  return (
    <section className={styles.panel} aria-labelledby="manual-generation-title">
      <div className={styles.heading}>
        <p className="eyebrow">MANUAL IMAGE VALIDATION · PAID PROVIDER CALL</p>
        <h2 id="manual-generation-title">동일 원본으로 A/B 이미지 비교</h2>
        <p>생성 버튼을 누를 때만 실제 Nano Banana 호출과 비용이 발생합니다.</p>
      </div>

      <div className={styles.controls}>
        <label className={styles.dropzone} htmlFor="validation-source-image">
          {previewUrl ? <img alt="업로드한 원본 사진 미리보기" src={previewUrl} /> : <span><strong>원본 사진을 업로드하세요</strong><small>JPG, PNG, WEBP · 최대 10MB</small></span>}
          <input accept="image/jpeg,image/png,image/webp" id="validation-source-image" onChange={(event: ChangeEvent<HTMLInputElement>) => selectFile(event.target.files?.[0])} ref={inputRef} type="file" />
        </label>
        <div className={styles.fileActions}>
          <button onClick={() => inputRef.current?.click()} type="button">{file ? "사진 교체" : "사진 선택"}</button>
          <button disabled={!file} onClick={removeFile} type="button">사진 제거</button>
          <label>반복 횟수<select onChange={(event) => { setRepeatCount(Number(event.target.value) as 1 | 2); setResults([]); }} value={repeatCount}><option value={1}>1회</option><option value={2}>2회</option></select></label>
        </div>
      </div>

      <div className={styles.executionContract}>
        <span>{caseId}</span><span>{presetId}</span><span>{model === "flash" ? "Nano Banana 2" : "Nano Banana Pro"}</span><span>1K</span><span>4:5</span>
      </div>
      <div className={styles.actions}>
        <button disabled={!file || pendingScope !== null} onClick={() => generate("A")} type="button">조건 A 생성</button>
        <button disabled={!file || pendingScope !== null} onClick={() => generate("B")} type="button">조건 B 생성</button>
        <button disabled={!file || pendingScope !== null} onClick={() => generate("AB")} type="button">A/B 전체 생성</button>
      </div>
      {pendingScope ? <p className={styles.progress} role="status">조건 {pendingScope} 생성 중 · 자동 재시도하지 않습니다.</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <div className={styles.comparison}>
        <section><h3>원본</h3>{previewUrl ? <img alt="A/B 비교 원본" src={previewUrl} /> : <p>사진을 선택해 주세요.</p>}</section>
        <section><h3>조건 A</h3>{conditionA.length ? conditionA.map((result) => <ResultCard key={resultKey(result)} result={result} />) : <p>아직 생성하지 않았습니다.</p>}</section>
        <section><h3>조건 B</h3>{conditionB.length ? conditionB.map((result) => <ResultCard key={resultKey(result)} result={result} />) : <p>아직 생성하지 않았습니다.</p>}</section>
      </div>
    </section>
  );
}
