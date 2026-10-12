import { createHash } from "node:crypto";

import { normalizeAdditionalRequest } from "@/lib/prompts";
import { getPromptModule } from "@/lib/prompts/legacy";

import { getValidationCase, getValidationRule } from "./registry";
import { getLegacyValidationModelGuidance, getLegacyValidationModuleIds } from "./legacy-preset-modules";
import type {
  ValidationCaseId,
  ValidationConditionId,
  ValidationPromptInput,
  ValidationPromptResult,
} from "./types";

export const VALIDATION_PROMPT_VERSION = "legacy-module-ab@1.0.0" as const;

const CATEGORY_BASELINES: Partial<Record<ValidationCaseId, readonly string[]>> = {
  "CASE-008": [
    "단정한 어두운색 정장과 흰색 셔츠를 적용하세요.",
    "밝은 회색의 중립적인 배경과 부드럽고 균일한 조명을 사용하세요.",
    "그림자는 낮고 자연스럽게 유지하세요.",
  ],
  "CASE-009": [
    "깔끔한 무지 흰색 셔츠와 밝은 청회색 배경을 적용하세요.",
    "부드럽고 균일한 조명과 낮고 자연스러운 그림자를 사용하세요.",
    "실제 나이와 원본 표정을 유지하세요.",
  ],
  "CASE-010": [
    "베이지 계열의 단정한 재킷과 따뜻한 회색 배경을 적용하세요.",
    "부드럽고 자연스러운 조명과 낮고 자연스러운 그림자를 사용하세요.",
    "원본 표정의 허용 범위 안에서 편안한 분위기를 유지하세요.",
  ],
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function renderModule(section: string, lines: readonly string[]) {
  return `[${section}]\n${lines.map((line) => `- ${line}`).join("\n")}`;
}

function validationLines(caseId: ValidationCaseId, condition: ValidationConditionId) {
  const baseline = CATEGORY_BASELINES[caseId];
  if (condition === "A") return baseline ?? [];
  const validationCase = getValidationCase(caseId);
  return [...(baseline ?? []), ...validationCase.ruleIds.flatMap((ruleId) => getValidationRule(ruleId).lines)];
}

export function buildValidationPrompt(input: ValidationPromptInput): ValidationPromptResult {
  const validationCase = getValidationCase(input.caseId);
  const allowedPresetIds: readonly string[] = validationCase.allowedPresetIds;
  if (!allowedPresetIds.includes(input.presetId)) {
    throw new Error(`${input.caseId} does not support preset: ${input.presetId}`);
  }

  const legacyModuleIds = getLegacyValidationModuleIds(input.presetId);
  const additionalRequest = normalizeAdditionalRequest(input.additionalRequest);
  const targetIds = new Set<string>(validationCase.replacedModuleIds);
  const firstTargetIndex = legacyModuleIds.findIndex((moduleId) => targetIds.has(moduleId));
  if (firstTargetIndex < 0) throw new Error(`${input.caseId} target module is absent from preset: ${input.presetId}`);

  const experimentModuleId = `validation.${input.caseId.toLowerCase()}.condition-${input.condition.toLowerCase()}`;
  const experimentLines = validationLines(input.caseId, input.condition);
  const moduleIds: string[] = [];
  const sections = [
    "[작업]\n선택한 프리셋의 규칙에 따라 업로드된 이미지를 편집하세요.",
    "[업로드 이미지]\n업로드된 이미지를 입력 자료로 사용하세요.",
  ];

  legacyModuleIds.forEach((moduleId, index) => {
    if (index === firstTargetIndex) {
      moduleIds.push(experimentModuleId);
      if (experimentLines.length > 0) sections.push(renderModule("Validation 실험 Rule", experimentLines));
    }
    if (targetIds.has(moduleId)) return;
    const promptModule = getPromptModule(moduleId);
    moduleIds.push(promptModule.id);
    sections.push(renderModule(promptModule.section, promptModule.lines));
  });

  const modelGuidance = getLegacyValidationModelGuidance();
  sections.push(renderModule("모델 지침", modelGuidance));
  if (additionalRequest) sections.push(renderModule("추가 요청", [additionalRequest]));

  const appliedRuleIds = input.condition === "B" ? [...validationCase.ruleIds] : [];
  const validationPromptId = `prompt-validation.${input.caseId.toLowerCase()}`;
  const fixedVariablesHash = digest({
    caseId: input.caseId,
    presetId: input.presetId,
    model: input.model,
    fixedVariables: validationCase.fixedVariables,
  });
  const variantHash = digest({
    caseId: input.caseId,
    conditionId: input.condition,
    presetId: input.presetId,
    model: input.model,
    validationPromptId,
    validationPromptVersion: VALIDATION_PROMPT_VERSION,
    moduleIds,
    ruleIds: appliedRuleIds,
  });

  return {
    prompt: sections.join("\n\n"),
    validationCaseId: input.caseId,
    validationConditionId: input.condition,
    validationRuleIds: appliedRuleIds,
    changedVariable: validationCase.changedVariable,
    fixedVariables: [...validationCase.fixedVariables],
    fixedVariablesHash,
    variantHash,
    validationPromptId,
    validationPromptVersion: VALIDATION_PROMPT_VERSION,
    presetId: input.presetId,
    moduleIds,
    model: input.model,
    additionalRequest,
  };
}

export function buildValidationPair(input: Omit<ValidationPromptInput, "condition">) {
  return {
    A: buildValidationPrompt({ ...input, condition: "A" }),
    B: buildValidationPrompt({ ...input, condition: "B" }),
  } as const;
}

export function diffValidationPrompts(left: string, right: string) {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  return {
    onlyA: leftLines.filter((line) => !rightLines.includes(line)),
    onlyB: rightLines.filter((line) => !leftLines.includes(line)),
  };
}
