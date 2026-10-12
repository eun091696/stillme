import Link from "next/link";
import { notFound } from "next/navigation";

import {
  buildValidationPair,
  diffValidationPrompts,
  getValidationRule,
  VALIDATION_CASES,
  VALIDATION_CASE_REGISTRY,
  VALIDATION_SCORE_LABELS,
  type ValidationCaseId,
} from "@/lib/prompt-validation";

import { ValidationGenerationPanel } from "./generation-panel";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    caseId?: string;
    presetId?: string;
    model?: string;
    additionalRequest?: string;
  }>;
};

export default async function PromptValidationPage({ searchParams }: PageProps) {
  if (process.env.NODE_ENV !== "development") notFound();

  const params = await searchParams;
  const selectedCase = VALIDATION_CASE_REGISTRY[params.caseId as ValidationCaseId] ?? VALIDATION_CASES[0];
  const allowedPresetIds: readonly string[] = selectedCase.allowedPresetIds;
  const presetId = allowedPresetIds.includes(params.presetId ?? "")
    ? params.presetId!
    : selectedCase.defaultPresetId;
  const model = params.model === "pro" ? "pro" : "flash";
  const pair = buildValidationPair({
    caseId: selectedCase.caseId,
    presetId,
    model,
    additionalRequest: params.additionalRequest,
  });
  const difference = diffValidationPrompts(pair.A.prompt, pair.B.prompt);
  const rules = selectedCase.ruleIds.map(getValidationRule);

  return (
    <>
      <header><Link href="/">STILLME</Link></header>
      <main className="page-shell generation-shell" id="main-content" tabIndex={-1}>
        <section className="generation-create-card" aria-labelledby="validation-title">
          <p className="eyebrow">DEVELOPMENT ONLY · PROVIDER CALLS REQUIRE EXPLICIT ACTION</p>
          <h1 id="validation-title">Nano Banana Prompt Validation Harness</h1>
          <p>운영 Prompt와 분리된 Candidate Rule의 A/B Prompt를 비교하고, 명시적으로 요청할 때만 이미지를 생성합니다.</p>

          <form className="generation-form" method="get">
            <label htmlFor="caseId">Validation Case</label>
            <select defaultValue={selectedCase.caseId} id="caseId" name="caseId">
              {VALIDATION_CASES.map((item) => (
                <option key={item.caseId} value={item.caseId}>{item.caseId} · {item.name}</option>
              ))}
            </select>

            <label htmlFor="presetId">기준 Preset</label>
            <select defaultValue={presetId} id="presetId" name="presetId">
              {selectedCase.allowedPresetIds.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>

            <label htmlFor="model">모델 Metadata</label>
            <select defaultValue={model} id="model" name="model">
              <option value="flash">Flash</option>
              <option value="pro">Pro</option>
            </select>

            <label htmlFor="additionalRequest">동일하게 고정할 추가 요청</label>
            <input
              defaultValue={params.additionalRequest ?? ""}
              id="additionalRequest"
              maxLength={240}
              name="additionalRequest"
            />
            <button type="submit">A/B Prompt 만들기</button>
          </form>

          <ValidationGenerationPanel
            additionalRequest={params.additionalRequest ?? ""}
            caseId={selectedCase.caseId}
            model={model}
            presetId={presetId}
          />

          <div className="notice success">
            <h2>{selectedCase.caseId} · {selectedCase.name}</h2>
            <p><strong>목적:</strong> {selectedCase.purpose}</p>
            <p><strong>변경 변수:</strong> {selectedCase.changedVariable}</p>
            <p><strong>고정 변수:</strong> {selectedCase.fixedVariables.join(", ")}</p>
            <p><strong>실험 조건:</strong> {selectedCase.experimentConditions}</p>
            <p><strong>평가 초점:</strong> {selectedCase.benchmarkFocus.join(", ")}</p>
            <p><strong>Pass:</strong> {selectedCase.passCondition}</p>
            <p><strong>실패 시:</strong> {selectedCase.nextActionOnFailure}</p>
            <h3>연결 Candidate Rule</h3>
            <ul>{rules.map((rule) => <li key={rule.ruleId}>{rule.ruleId} · {rule.name} · {rule.status}</li>)}</ul>
          </div>

          <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            {([pair.A, pair.B] as const).map((result) => (
              <article className="notice" key={result.validationConditionId}>
                <h2>조건 {result.validationConditionId}</h2>
                <p>{selectedCase.conditions.find((item) => item.id === result.validationConditionId)?.label}</p>
                <dl>
                  <dt>ruleIds</dt><dd>{result.validationRuleIds.join(", ") || "없음"}</dd>
                  <dt>validationPromptId / version</dt><dd>{result.validationPromptId} / {result.validationPromptVersion}</dd>
                  <dt>model</dt><dd>{result.model}</dd>
                  <dt>fixedVariablesHash</dt><dd style={{ overflowWrap: "anywhere" }}>{result.fixedVariablesHash}</dd>
                  <dt>variantHash</dt><dd style={{ overflowWrap: "anywhere" }}>{result.variantHash}</dd>
                </dl>
                <h3>최종 Module 순서</h3>
                <ol>{result.moduleIds.map((id) => <li key={id}>{id}</li>)}</ol>
                <h3>최종 Prompt</h3>
                <pre style={{ maxHeight: "36rem", overflow: "auto", whiteSpace: "pre-wrap" }}>{result.prompt}</pre>
              </article>
            ))}
          </div>

          <section className="notice">
            <h2>A/B Prompt 차이</h2>
            <h3>A에만 존재</h3>
            <pre style={{ whiteSpace: "pre-wrap" }}>{difference.onlyA.join("\n") || "없음"}</pre>
            <h3>B에만 존재</h3>
            <pre style={{ whiteSpace: "pre-wrap" }}>{difference.onlyB.join("\n") || "없음"}</pre>
          </section>

          <section className="notice">
            <h2>수동 Scorecard</h2>
            <p>각 항목은 1~5점입니다. 총점 31점 이상, 동일인과 얼굴 구조가 각각 5점이면 Pass입니다.</p>
            <p><strong>Pass는 Approved Rule을 의미하지 않으며 운영 Prompt에 자동 반영되지 않습니다.</strong></p>
            <table>
              <thead><tr><th>항목</th><th>조건 A</th><th>조건 B</th></tr></thead>
              <tbody>
                {Object.entries(VALIDATION_SCORE_LABELS).map(([key, label]) => (
                  <tr key={key}><th>{label}</th><td>__/5</td><td>__/5</td></tr>
                ))}
                <tr><th>총점</th><td>__/35</td><td>__/35</td></tr>
              </tbody>
            </table>
          </section>
        </section>
      </main>
    </>
  );
}
