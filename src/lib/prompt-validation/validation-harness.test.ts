import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildPrompt, PROMPT_PRESET_REGISTRY } from "@/lib/prompts";
import { PROMPT_MODULE_REGISTRY } from "@/lib/prompts/legacy";

import { buildValidationPair, buildValidationPrompt } from "./builder";
import { VALIDATION_CASES } from "./cases";
import { getValidationRule, VALIDATION_CASE_REGISTRY, VALIDATION_RULE_REGISTRY } from "./registry";
import { RUNTIME_EXCLUDED_RULE_IDS, VALIDATION_RULE_VARIANTS } from "./rule-variants";
import { evaluateValidationScorecard } from "./scorecard";
import type { ValidationCaseId } from "./types";

const knowledgeRoot = join(process.cwd(), "knowledge", "prompt-engine");
const knowledgeFiles = [
  "Work005/Work005-001/README.md",
  "Work005/Work005-001/prompt-analysis.md",
  "Work005/Work005-001/rule-taxonomy.md",
  "Work005/Work005-001/candidate-rules.json",
  "Work005/Work005-001/module-mapping.md",
  "Work005/Work005-001/research-log.md",
  "Work005/Work005-001/experiment-backlog.md",
  "Work005/Work005-002/실험계획서.md",
  "Work005/Work005-002/실험우선순위.md",
  "Work005/Work005-002/Rule검증계획.md",
  "Work005/Work005-002/실험목록.json",
  "Work005/Work005-002/Benchmark계획.md",
  "Work005/Work005-002/승인기준.md",
  "Work006/Work006-001/VALIDATION_GUIDE.md",
  "Work006/Work006-001/validation-cases.json",
  "Work006/Work006-001/benchmark-scorecard.md",
  "Work006/Work006-001/failure-patterns.md",
  "Work006/Work006-001/success-patterns.md",
  "Work006/Work006-001/validation-checklist.md",
] as const;

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function snapshotPair(caseId: ValidationCaseId) {
  const validationCase = VALIDATION_CASE_REGISTRY[caseId];
  const pair = buildValidationPair({
    caseId,
    presetId: validationCase.defaultPresetId,
    model: "flash",
    additionalRequest: "배경을 조금 더 밝게 해주세요",
  });
  return {
    changedVariable: pair.A.changedVariable,
    fixedVariables: pair.A.fixedVariables,
    A: {
      condition: pair.A.validationConditionId,
      ruleIds: pair.A.validationRuleIds,
      experimentModule: pair.A.moduleIds.find((id) => id.startsWith("validation.")),
      promptDifference: pair.A.prompt.split("\n").filter((line) => line.includes("Validation 실험") || line.startsWith("- ")),
    },
    B: {
      condition: pair.B.validationConditionId,
      ruleIds: pair.B.validationRuleIds,
      experimentModule: pair.B.moduleIds.find((id) => id.startsWith("validation.")),
      promptDifference: pair.B.prompt.split("\n").filter((line) => line.includes("Validation 실험") || line.startsWith("- ")),
    },
  };
}

describe("Work005 and Work006 source-of-truth", () => {
  it("keeps all 19 knowledge files available", () => {
    expect(knowledgeFiles).toHaveLength(19);
    for (const file of knowledgeFiles) expect(readFileSync(join(knowledgeRoot, file), "utf8").length).toBeGreaterThan(0);
  });

  it("parses the Work005 and Work006 JSON sources", () => {
    expect(() => JSON.parse(readFileSync(join(knowledgeRoot, knowledgeFiles[3]), "utf8"))).not.toThrow();
    expect(() => JSON.parse(readFileSync(join(knowledgeRoot, knowledgeFiles[10]), "utf8"))).not.toThrow();
    const cases = JSON.parse(readFileSync(join(knowledgeRoot, knowledgeFiles[14]), "utf8")) as { cases: unknown[] };
    expect(cases.cases).toHaveLength(10);
  });

  it("keeps Case and Candidate Rule metadata aligned with the research JSON", () => {
    const sourceCases = JSON.parse(readFileSync(join(knowledgeRoot, knowledgeFiles[14]), "utf8")) as {
      cases: Array<{
        id: string;
        name: string;
        purpose: string;
        ruleIds: string[];
        changedVariable: string;
        conditions: string[];
        fixedVariables: string[];
        benchmarkFocus: string[];
        passCondition: string;
        nextActionOnFailure: string;
      }>;
    };
    for (const sourceCase of sourceCases.cases) {
      const registered = VALIDATION_CASE_REGISTRY[sourceCase.id as ValidationCaseId];
      expect({
        name: registered.name,
        purpose: registered.purpose,
        ruleIds: registered.ruleIds,
        changedVariable: registered.changedVariable,
        conditions: registered.conditions.map((condition) => `${condition.id}: ${condition.label}`),
        fixedVariables: registered.fixedVariables,
        benchmarkFocus: registered.benchmarkFocus,
        passCondition: registered.passCondition,
        nextActionOnFailure: registered.nextActionOnFailure,
      }).toEqual({
        name: sourceCase.name,
        purpose: sourceCase.purpose,
        ruleIds: sourceCase.ruleIds,
        changedVariable: sourceCase.changedVariable,
        conditions: sourceCase.conditions,
        fixedVariables: sourceCase.fixedVariables,
        benchmarkFocus: sourceCase.benchmarkFocus,
        passCondition: sourceCase.passCondition,
        nextActionOnFailure: sourceCase.nextActionOnFailure,
      });
    }

    const sourceRules = JSON.parse(readFileSync(join(knowledgeRoot, knowledgeFiles[3]), "utf8")) as {
      rules: Array<{ id: string; module: string; validationStatus: string }>;
    };
    for (const registered of VALIDATION_RULE_VARIANTS) {
      const sourceRule = sourceRules.rules.find((rule) => rule.id === registered.ruleId);
      expect(sourceRule).toMatchObject({
        module: registered.moduleId,
        validationStatus: registered.status,
      });
    }
  });
});

describe("validation registries", () => {
  it("resolves CASE-001 through CASE-010 without duplicates", () => {
    const expected = Array.from({ length: 10 }, (_, index) => `CASE-${String(index + 1).padStart(3, "0")}`);
    const ids = VALIDATION_CASES.map((item) => item.caseId);
    expect(ids).toEqual(expected);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(VALIDATION_CASE_REGISTRY[id]).toBeDefined();
  });

  it("resolves every linked rule and excludes runtime-deferred rules", () => {
    for (const validationCase of VALIDATION_CASES) {
      for (const ruleId of validationCase.ruleIds) {
        expect(getValidationRule(ruleId).caseIds).toContain(validationCase.caseId);
      }
    }
    for (const ruleId of RUNTIME_EXCLUDED_RULE_IDS) expect(VALIDATION_RULE_REGISTRY[ruleId]).toBeUndefined();
  });

  it("does not register Candidate Rule IDs in production modules or presets", () => {
    for (const rule of VALIDATION_RULE_VARIANTS) expect(PROMPT_MODULE_REGISTRY[rule.ruleId]).toBeUndefined();
    const productionRuntimePromptIds = Object.values(PROMPT_PRESET_REGISTRY)
      .map((preset) => preset.runtimePromptId);
    expect(productionRuntimePromptIds.some((id) => id.startsWith("validation."))).toBe(false);
  });
});

describe("A/B validation builder", () => {
  it.each(VALIDATION_CASES)("builds both conditions for $caseId with one experiment slot", (validationCase) => {
    const pair = buildValidationPair({
      caseId: validationCase.caseId,
      presetId: validationCase.defaultPresetId,
      model: "flash",
      additionalRequest: "배경을 조금 더 밝게 해주세요",
    });
    expect(pair.A.validationConditionId).toBe("A");
    expect(pair.B.validationConditionId).toBe("B");
    expect(pair.A.changedVariable).toBe(validationCase.changedVariable);
    expect(pair.B.changedVariable).toBe(validationCase.changedVariable);
    expect(pair.A.presetId).toBe(pair.B.presetId);
    expect(pair.A.model).toBe(pair.B.model);
    expect(pair.A.additionalRequest).toBe(pair.B.additionalRequest);
    expect(pair.A.fixedVariablesHash).toBe(pair.B.fixedVariablesHash);
    const onlyA = pair.A.moduleIds.filter((id) => !pair.B.moduleIds.includes(id));
    const onlyB = pair.B.moduleIds.filter((id) => !pair.A.moduleIds.includes(id));
    expect(onlyA).toEqual([`validation.${validationCase.caseId.toLowerCase()}.condition-a`]);
    expect(onlyB).toEqual([`validation.${validationCase.caseId.toLowerCase()}.condition-b`]);
  });

  it("creates deterministic hashes and distinct condition hashes", () => {
    const input = { caseId: "CASE-003" as const, condition: "A" as const, presetId: "business-id", model: "flash" as const };
    expect(buildValidationPrompt(input).variantHash).toBe(buildValidationPrompt(input).variantHash);
    expect(buildValidationPrompt(input).variantHash).not.toBe(buildValidationPrompt({ ...input, condition: "B" }).variantHash);
  });

  it("keeps flash and pro separate in metadata", () => {
    const base = { caseId: "CASE-001" as const, condition: "A" as const, presetId: "business-id" };
    const flash = buildValidationPrompt({ ...base, model: "flash" });
    const pro = buildValidationPrompt({ ...base, model: "pro" });
    expect(flash.model).toBe("flash");
    expect(pro.model).toBe("pro");
    expect(flash.variantHash).not.toBe(pro.variantHash);
  });

  it("uses validation-owned prompt metadata instead of runtime prompt metadata", () => {
    const result = buildValidationPrompt({
      caseId: "CASE-001",
      condition: "A",
      presetId: "business-id",
      model: "flash",
    });
    expect(result).toMatchObject({
      validationPromptId: "prompt-validation.case-001",
      validationPromptVersion: "legacy-module-ab@1.0.0",
      presetId: "business-id",
    });
    expect(result).not.toHaveProperty("promptId");
    expect(result).not.toHaveProperty("promptVersion");
  });

  it("keeps validation metadata out of the production builder output", () => {
    expect(buildPrompt({ presetId: "business-profile", model: "flash" })).toMatchObject({
      promptId: "business-profile.business-profile",
      promptVersion: "2.4.0",
      presetId: "business-profile",
      model: "flash",
    });
    expect(buildPrompt({ presetId: "business-profile", model: "flash" }).modules)
      .not.toEqual(expect.arrayContaining([expect.stringMatching(/^validation\./u)]));
  });

  it("snapshots the required A/B cases", () => {
    expect(snapshotPair("CASE-003")).toMatchSnapshot("CASE-003 skin preservation");
    expect(snapshotPair("CASE-006")).toMatchSnapshot("CASE-006 source of truth");
    expect(snapshotPair("CASE-007")).toMatchSnapshot("CASE-007 edit boundary");
    expect(snapshotPair("CASE-008")).toMatchSnapshot("CASE-008 business profile");
  });
});

describe("production isolation and approval boundaries", () => {
  it("keeps validation inputs out of /generate and raw prompts out of generation metadata", () => {
    const generateAction = source("src/app/generate/actions.ts");
    expect(generateAction).not.toMatch(/validationCaseId|validationConditionId|variantHash/u);
    expect(generateAction).not.toMatch(/rawPrompt/u);
  });

  it("blocks the developer page outside development", () => {
    const page = source("src/app/dev/prompt-validation/page.tsx");
    expect(page).toContain('process.env.NODE_ENV !== "development"');
    expect(page).toContain("notFound()");
  });

  it("never turns a passing scorecard into approval", () => {
    const result = evaluateValidationScorecard({
      identity: 5,
      facialGeometry: 5,
      skin: 5,
      hair: 4,
      expression: 4,
      naturalness: 4,
      requestFulfillment: 4,
    });
    expect(result).toEqual({ result: "PASS", total: 31, approved: false });
    expect(VALIDATION_RULE_VARIANTS.every((rule) => rule.status === "candidate" || rule.status === "review")).toBe(true);
  });

  it("requires skin preservation 4 or higher for CASE-003 without approving a rule", () => {
    const base = {
      identity: 5,
      facialGeometry: 5,
      hair: 5,
      expression: 5,
      naturalness: 4,
      requestFulfillment: 4,
    } as const;
    expect(evaluateValidationScorecard({ ...base, skin: 3 }, "CASE-003"))
      .toEqual({ result: "FAIL", total: 31, approved: false });
    expect(evaluateValidationScorecard({ ...base, skin: 4 }, "CASE-003"))
      .toEqual({ result: "PASS", total: 32, approved: false });
  });
});
