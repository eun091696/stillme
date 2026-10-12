import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

import { requiredSectionsFor, validateDocument } from "./lib/documentation-contract.mjs";

const root = process.cwd();
const errors = [];

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : extname(path) === ".md" ? [path] : [];
  });
}

const files = [
  join(root, "README.md"),
  join(root, "MASTER_PLAN.md"),
  join(root, "CODEX.md"),
  join(root, "AGENTS.md"),
  join(root, "CHANGELOG.md"),
  ...markdownFiles(join(root, ".codex")),
  ...markdownFiles(join(root, "docs")),
  ...markdownFiles(join(root, "playbooks")),
];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  // README.md is the public-facing portfolio document (user-approved
  // Korean public format, commit main845837b) and is validated against its
  // own required-section contract. Every other Markdown file -- including
  // any nested README.md under .codex/, docs/, or playbooks/ -- keeps the
  // existing internal operating-doc contract. requiredSectionsFor expects a
  // repo-relative path so only the root README.md matches the public
  // contract. See scripts/lib/documentation-contract.mjs and
  // .codex/rules/documentation.md.
  const requiredSections = requiredSectionsFor(relative(root, file));
  const fileErrors = validateDocument(file, source, {
    requiredSections,
    resolveLink: (target) => existsSync(resolve(dirname(file), target)),
  });
  errors.push(...fileErrors);
}

const codex = readFileSync(join(root, "CODEX.md"), "utf8");
for (const contract of [
  "Mandatory Reading Order",
  "Task Router",
  "Workflow Loading",
  "Rule Loading",
  "Documentation Rules",
  "Validation Rules",
  "Git Rules",
  "Completion Report",
  "Development Philosophy",
]) {
  if (!codex.includes(contract)) errors.push(`CODEX.md: missing operating contract: ${contract}`);
}

const masterPlan = readFileSync(join(root, "MASTER_PLAN.md"), "utf8");
const phases = masterPlan.split(/^### Phase /m).slice(1);
if (!phases.length) errors.push("MASTER_PLAN.md: no roadmap phases found");
for (const [index, phase] of phases.entries()) {
  for (const field of [
    "**Goal:**",
    "**Scope:**",
    "**Dependencies:**",
    "**Deliverables:**",
    "**Acceptance Criteria:**",
    "**Checklist:**",
    "**Status:**",
    "**Estimated Priority:**",
    "**Estimated Complexity:**",
  ]) {
    if (!phase.includes(field)) errors.push(`MASTER_PLAN.md: phase ${index} missing ${field}`);
  }
}

for (const path of [
  ".codex/workflows/feature.md",
  ".codex/workflows/bugfix.md",
  ".codex/workflows/hotfix.md",
  ".codex/workflows/refactor.md",
  ".codex/workflows/migration.md",
  ".codex/workflows/documentation.md",
  ".codex/workflows/release.md",
  ".codex/workflows/review.md",
  ".codex/rules/coding.md",
  ".codex/rules/git.md",
  ".codex/rules/naming.md",
  ".codex/rules/testing.md",
  ".codex/rules/security.md",
  ".codex/rules/architecture.md",
  ".codex/rules/documentation.md",
  ".codex/rules/validation.md",
]) {
  if (!existsSync(join(root, path))) errors.push(`Missing Codex operating file: ${path}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Documentation validation passed: ${files.length} Markdown files.`);
