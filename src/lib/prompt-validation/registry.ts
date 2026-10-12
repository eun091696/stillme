import { VALIDATION_CASES } from "./cases";
import { VALIDATION_RULE_VARIANTS } from "./rule-variants";
import type { ValidationCaseId, ValidationRuleId } from "./types";

export const VALIDATION_CASE_REGISTRY = Object.freeze(
  Object.fromEntries(VALIDATION_CASES.map((item) => [item.caseId, item])) as Record<ValidationCaseId, (typeof VALIDATION_CASES)[number]>,
);

export const VALIDATION_RULE_REGISTRY = Object.freeze(
  Object.fromEntries(VALIDATION_RULE_VARIANTS.map((item) => [item.ruleId, item])) as Record<ValidationRuleId, (typeof VALIDATION_RULE_VARIANTS)[number]>,
);

export function getValidationCase(caseId: ValidationCaseId) {
  const validationCase = VALIDATION_CASE_REGISTRY[caseId];
  if (!validationCase) throw new Error(`Unknown validation case: ${caseId}`);
  return validationCase;
}

export function getValidationRule(ruleId: ValidationRuleId) {
  const rule = VALIDATION_RULE_REGISTRY[ruleId];
  if (!rule) throw new Error(`Unknown validation rule: ${ruleId}`);
  return rule;
}
