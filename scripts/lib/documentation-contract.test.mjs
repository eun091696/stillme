import assert from "node:assert/strict";
import test from "node:test";

import {
  INTERNAL_REQUIRED_SECTIONS,
  README_REQUIRED_SECTIONS,
  checkRequiredSections,
  findDuplicateHeadings,
  findLinkIssues,
  isReadme,
  requiredSectionsFor,
  validateDocument,
} from "./documentation-contract.mjs";

test("requiredSectionsFor selects the public README contract only for the repo-root README.md", () => {
  assert.equal(isReadme("README.md"), true);
  assert.equal(isReadme("./README.md"), true);
  assert.equal(isReadme("docs/overview.md"), false);
  assert.deepEqual(requiredSectionsFor("README.md"), README_REQUIRED_SECTIONS);
  assert.deepEqual(requiredSectionsFor("CODEX.md"), INTERNAL_REQUIRED_SECTIONS);
});

test("requiredSectionsFor treats a nested README.md as an internal document, not the public README", () => {
  assert.equal(isReadme("docs/README.md"), false);
  assert.equal(isReadme(".codex/workflows/README.md"), false);
  assert.equal(isReadme("playbooks/sub/README.md"), false);
  assert.deepEqual(requiredSectionsFor("docs/README.md"), INTERNAL_REQUIRED_SECTIONS);
});

test("checkRequiredSections reports every missing required section", () => {
  const source = "# Doc\n\n## Overview\n\ncontent\n";
  const { missing, orderInvalid } = checkRequiredSections(source, INTERNAL_REQUIRED_SECTIONS);
  assert.deepEqual(missing, [
    "## Table of Contents",
    "## Goals",
    "## Requirements",
    "## Implementation",
    "## Checklist",
    "## Related Documents",
  ]);
  assert.equal(orderInvalid, false);
});

test("checkRequiredSections detects out-of-order sections", () => {
  const source = [
    "## Goals",
    "## Table of Contents",
    "## Overview",
    "## Requirements",
    "## Implementation",
    "## Checklist",
    "## Related Documents",
  ].join("\n\n");
  const { missing, orderInvalid } = checkRequiredSections(source, INTERNAL_REQUIRED_SECTIONS);
  assert.deepEqual(missing, []);
  assert.equal(orderInvalid, true);
});

test("checkRequiredSections passes when every section is present and ordered", () => {
  const source = INTERNAL_REQUIRED_SECTIONS.join("\n\ncontent\n\n");
  const { missing, orderInvalid } = checkRequiredSections(source, INTERNAL_REQUIRED_SECTIONS);
  assert.deepEqual(missing, []);
  assert.equal(orderInvalid, false);
});

test("README public contract is validated explicitly, not skipped", () => {
  // A README missing a required public section must fail, proving the
  // checker still enforces README's own contract rather than excluding it.
  const incompleteReadme = README_REQUIRED_SECTIONS.filter((s) => s !== "## 크레딧 처리").join(
    "\n\n content \n\n",
  );
  const { missing } = checkRequiredSections(incompleteReadme, README_REQUIRED_SECTIONS);
  assert.deepEqual(missing, ["## 크레딧 처리"]);

  const completeReadme = README_REQUIRED_SECTIONS.join("\n\n content \n\n");
  const { missing: noneMissing, orderInvalid } = checkRequiredSections(
    completeReadme,
    README_REQUIRED_SECTIONS,
  );
  assert.deepEqual(noneMissing, []);
  assert.equal(orderInvalid, false);
});

test("findDuplicateHeadings returns the unique set of repeated level-two headings", () => {
  const source = "## Overview\n\n## Goals\n\n## Overview\n\n## Goals\n\n## Checklist\n";
  assert.deepEqual(findDuplicateHeadings(source), ["Overview", "Goals"]);
});

test("findDuplicateHeadings returns an empty array when there are no repeats", () => {
  const source = "## Overview\n\n## Goals\n\n## Checklist\n";
  assert.deepEqual(findDuplicateHeadings(source), []);
});

test("findLinkIssues flags absolute links as forbidden", () => {
  const source = "See [docs](/docs/overview.md) for more.";
  const issues = findLinkIssues(source, () => true);
  assert.deepEqual(issues, [{ type: "absolute", target: "/docs/overview.md" }]);
});

test("findLinkIssues flags relative links that do not resolve", () => {
  const source = "See [docs](docs/missing.md) for more.";
  const issues = findLinkIssues(source, () => false);
  assert.deepEqual(issues, [{ type: "broken", target: "docs/missing.md" }]);
});

test("findLinkIssues ignores http(s) and in-page anchor links", () => {
  const source = "[external](https://example.com) and [anchor](#section)";
  const issues = findLinkIssues(source, () => false);
  assert.deepEqual(issues, []);
});

test("validateDocument aggregates missing section, duplicate heading and broken link errors", () => {
  const source = [
    "## Overview",
    "content",
    "## Overview",
    "[broken](missing.md)",
  ].join("\n\n");
  const errors = validateDocument("docs/example.md", source, {
    requiredSections: INTERNAL_REQUIRED_SECTIONS,
    resolveLink: () => false,
  });

  assert.ok(errors.includes("docs/example.md: duplicate level-two heading: Overview"));
  assert.ok(errors.includes("docs/example.md: missing ## Table of Contents"));
  assert.ok(errors.includes("docs/example.md: missing ## Goals"));
  assert.ok(errors.includes("docs/example.md: broken link: missing.md"));
});

test("validateDocument returns no errors for a fully compliant internal document", () => {
  const source = INTERNAL_REQUIRED_SECTIONS.join("\n\ncontent\n\n");
  const errors = validateDocument("docs/example.md", source, {
    requiredSections: INTERNAL_REQUIRED_SECTIONS,
    resolveLink: () => true,
  });
  assert.deepEqual(errors, []);
});

test("validateDocument returns no errors for a fully compliant public README", () => {
  const source = README_REQUIRED_SECTIONS.join("\n\ncontent\n\n");
  const errors = validateDocument("README.md", source, {
    requiredSections: README_REQUIRED_SECTIONS,
    resolveLink: () => true,
  });
  assert.deepEqual(errors, []);
});
