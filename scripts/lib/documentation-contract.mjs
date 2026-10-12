/**
 * Pure helpers for scripts/check-docs.mjs.
 *
 * Two required-section contracts coexist by design:
 *   - INTERNAL_REQUIRED_SECTIONS: canonical operating-doc shape (CODEX.md,
 *     MASTER_PLAN.md, AGENTS.md, CHANGELOG.md, .codex/**, docs/**, playbooks/**).
 *   - README_REQUIRED_SECTIONS: the public-facing Korean README shape
 *     approved by the user at commit main845837b. README.md is a portfolio
 *     artifact for outside readers, not an internal operating document, so
 *     it is validated against its own section contract instead of being
 *     excluded or skipped.
 *
 * See .codex/rules/documentation.md for the recorded decision.
 */

export const INTERNAL_REQUIRED_SECTIONS = [
  "## Table of Contents",
  "## Overview",
  "## Goals",
  "## Requirements",
  "## Implementation",
  "## Checklist",
  "## Related Documents",
];

export const README_REQUIRED_SECTIONS = [
  "## 주요 기능",
  "## 직접 담당한 개선",
  "## 백엔드 아키텍처",
  "## 이미지 생성과 검증 흐름",
  "## 서비스별 검증 전략",
  "## 제한된 재생성과 비용 통제",
  "## 검증 실패 처리",
  "## 크레딧 처리",
  "## 데이터베이스 구조",
  "## 이미지 저장과 다운로드",
  "## 오류 처리와 개인정보 보호",
  "## 프로젝트 구조",
  "## 로컬 실행",
  "## 저장소 검사 명령",
  "## 관련 문서",
];

/**
 * Returns the required-section list applicable to a given repo-relative
 * path. Only the repository root README.md uses the public contract;
 * every other Markdown file -- including any nested `.../README.md` under
 * .codex/, docs/, or playbooks/ -- keeps the existing internal
 * operating-doc contract unchanged.
 *
 * `relativePath` must be relative to the repository root (e.g. "README.md"
 * or "docs/00_HOME.md"), not an absolute filesystem path, so that only the
 * single root README is matched.
 */
export function requiredSectionsFor(relativePath) {
  return isReadme(relativePath) ? README_REQUIRED_SECTIONS : INTERNAL_REQUIRED_SECTIONS;
}

/**
 * True only for the repository root README.md. `relativePath` must be
 * relative to the repository root; a nested path such as "docs/README.md"
 * normalizes to something other than the exact string "README.md" and is
 * therefore treated as an internal document, not the public README.
 */
export function isReadme(relativePath) {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "") === "README.md";
}

/**
 * Finds level-two Markdown headings (`## ...`) that repeat in the source.
 * Returns the unique set of duplicated heading texts, or an empty array.
 */
export function findDuplicateHeadings(source) {
  const levelTwoHeadings = [...source.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
  const duplicates = levelTwoHeadings.filter((heading, index) => levelTwoHeadings.indexOf(heading) !== index);
  return [...new Set(duplicates)];
}

/**
 * Validates that every section in `requiredSections` is present in `source`
 * and appears in the given order. Returns an object describing missing
 * sections and whether ordering is invalid.
 */
export function checkRequiredSections(source, requiredSections) {
  const missing = [];
  let orderInvalid = false;
  let previous = -1;
  for (const section of requiredSections) {
    const index = source.indexOf(section);
    if (index < 0) missing.push(section);
    if (index >= 0 && index < previous) orderInvalid = true;
    previous = Math.max(previous, index);
  }
  return { missing, orderInvalid };
}

/**
 * Extracts relative Markdown links from `source` and reports absolute links
 * (forbidden) and relative links that do not resolve against `resolveLink`.
 * `resolveLink(target)` should return true when the target exists on disk.
 */
export function findLinkIssues(source, resolveLink) {
  const issues = [];
  for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || target.startsWith("http://") || target.startsWith("https://") || target.startsWith("#")) continue;
    if (target.startsWith("/")) {
      issues.push({ type: "absolute", target });
      continue;
    }
    if (!resolveLink(decodeURIComponent(target))) {
      issues.push({ type: "broken", target });
    }
  }
  return issues;
}

/**
 * Runs the full per-file documentation contract (duplicate headings,
 * required sections/order, link integrity) and returns an array of
 * human-readable error strings prefixed with `label`.
 */
export function validateDocument(label, source, { requiredSections, resolveLink }) {
  const errors = [];

  const duplicateHeadings = findDuplicateHeadings(source);
  if (duplicateHeadings.length) {
    errors.push(`${label}: duplicate level-two heading: ${duplicateHeadings.join(", ")}`);
  }

  const { missing, orderInvalid } = checkRequiredSections(source, requiredSections);
  for (const section of missing) {
    errors.push(`${label}: missing ${section}`);
  }
  if (orderInvalid) {
    errors.push(`${label}: section order is invalid`);
  }

  for (const issue of findLinkIssues(source, resolveLink)) {
    if (issue.type === "absolute") {
      errors.push(`${label}: absolute link is forbidden: ${issue.target}`);
    } else {
      errors.push(`${label}: broken link: ${issue.target}`);
    }
  }

  return errors;
}
