import type { GenerationModelKey } from "@/lib/generation/model";
import type { PromptPresetId } from "@/lib/prompts";

export type ValidationCaseId = `CASE-${string}`;
export type ValidationConditionId = "A" | "B";
export type ValidationRuleId = `CARAT-R${string}`;
export type ValidationRuleStatus = "candidate" | "review";
export type ValidationPromptVersion = `legacy-module-ab@${number}.${number}.${number}`;

export type ValidationCondition = {
  id: ValidationConditionId;
  label: string;
};

export type ValidationCase = {
  caseId: ValidationCaseId;
  name: string;
  purpose: string;
  ruleIds: readonly ValidationRuleId[];
  changedVariable: string;
  conditions: readonly [ValidationCondition, ValidationCondition];
  fixedVariables: readonly string[];
  experimentConditions: string;
  benchmarkFocus: readonly ValidationScoreKey[];
  passCondition: string;
  nextActionOnFailure: string;
  defaultPresetId: PromptPresetId;
  allowedPresetIds: readonly PromptPresetId[];
  replacedModuleIds: readonly string[];
};

export type ValidationRuleVariant = {
  ruleId: ValidationRuleId;
  name: string;
  status: ValidationRuleStatus;
  moduleId: string;
  lines: readonly string[];
  sourceWork: "Work005-001";
  caseIds: readonly ValidationCaseId[];
};

export type ValidationPromptInput = {
  caseId: ValidationCaseId;
  condition: ValidationConditionId;
  presetId: PromptPresetId;
  model: GenerationModelKey;
  additionalRequest?: string;
};

export type ValidationPromptResult = {
  prompt: string;
  validationCaseId: ValidationCaseId;
  validationConditionId: ValidationConditionId;
  validationRuleIds: ValidationRuleId[];
  changedVariable: string;
  fixedVariables: string[];
  fixedVariablesHash: string;
  variantHash: string;
  validationPromptId: string;
  validationPromptVersion: ValidationPromptVersion;
  presetId: PromptPresetId;
  moduleIds: string[];
  model: GenerationModelKey;
  additionalRequest: string | null;
};

export type ValidationScoreKey =
  | "identity"
  | "facialGeometry"
  | "skin"
  | "hair"
  | "expression"
  | "naturalness"
  | "requestFulfillment";

export type ValidationScores = Record<ValidationScoreKey, number>;
export type ValidationScoreResult = {
  result: "PASS" | "FAIL";
  total: number;
  approved: false;
};
