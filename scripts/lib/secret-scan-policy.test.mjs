import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const configuration = readFileSync(new URL("../../.gitleaks.toml", import.meta.url), "utf8");
const workflowAllowance = configuration.match(
  /description = "Allow only the exact synthetic CI validation marker[^\n]*\n([\s\S]*?)(?=\n\s*\[\[|$)/,
)?.[1];

function workflowLineExpression() {
  assert.ok(workflowAllowance, "An explicit synthetic-only workflow allowance is required");
  const source = workflowAllowance.match(/regexes = \['''([^\n]+)'''\]/)?.[1];
  assert.ok(source, "The allowance requires one explicit whole-line expression");
  return new RegExp(source);
}

test("secret scan exempts only the exact synthetic workflow marker", () => {
  assert.match(workflowAllowance, /condition = "AND"/);
  assert.match(workflowAllowance, /paths = \['''\^\\\.github\/workflows\/ci\\\.yml\$'''\]/);
  const expression = workflowLineExpression();
  const prefix = ["sb", "publishable"].join("_") + "_";
  const marker = prefix + ["ci", "validation", "only"].join("_");
  assert.ok(expression.test(`      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${marker}`));
  assert.ok(!expression.test(`      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${prefix}synthetic_non_ci_value`));
  assert.ok(!expression.test(`      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${marker}_extra`));
  assert.ok(!expression.test(`      OTHER_KEY: ${marker}`));
});
