"use strict";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- The Next ESLint plugin requires a synchronous CommonJS adapter.
const { globSync: safeGlobSync } = require("tinyglobby");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Keep the adapter loadable by the pinned CommonJS Next ESLint plugin.
const { isAbsolute, resolve, relative, dirname } = require("node:path");
const MAX_PATTERN_LENGTH = 10_000;
const MAX_PATTERN_DEPTH = 64;
const MAX_PATTERNS = 128;
const ALLOWED_OPTIONS = new Set(["onlyDirectories", "cwd"]);

// This is deliberately not a general fast-glob implementation. The pinned
// Next.js ESLint plugin uses only globSync(pattern, { onlyDirectories: true }).
// Reject contract changes instead of silently weakening a future lint rule.
function globSync(patterns, options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Next ESLint glob options must be an object");
  }
  if (options.onlyDirectories !== true ||
      Object.keys(options).some((name) => !ALLOWED_OPTIONS.has(name))) {
    throw new TypeError("Unsupported Next ESLint directory-glob options");
  }
  if (options.cwd !== undefined && typeof options.cwd !== "string") {
    throw new TypeError("Next ESLint glob cwd must be a string");
  }
  const values = typeof patterns === "string" ? [patterns] : patterns;
  if (!Array.isArray(values) || !values.length || values.length > MAX_PATTERNS) {
    throw new TypeError("Next ESLint glob requires a bounded pattern list");
  }
  for (const pattern of values) {
    if (typeof pattern !== "string" || !pattern.length ||
        pattern.length > MAX_PATTERN_LENGTH) {
      throw new TypeError("Next ESLint glob pattern length is invalid");
    }
    let depth = 0;
    let escaped = false;
    for (const character of pattern) {
      if (escaped) { escaped = false; continue; }
      if (character === "\\") { escaped = true; continue; }
      if (character === "{" || character === "(" || character === "[") {
        depth += 1;
        if (depth > MAX_PATTERN_DEPTH) {
          throw new RangeError("Next ESLint glob nesting exceeds the safe limit");
        }
      } else if (character === "}" || character === ")" || character === "]") {
        depth = Math.max(0, depth - 1);
      }
    }
  }
  const absolutePatterns = values.filter((pattern) => !pattern.startsWith("!") && isAbsolute(pattern));
  const relativePatterns = values.filter((pattern) => !pattern.startsWith("!") && !isAbsolute(pattern));
  if (absolutePatterns.length && relativePatterns.length) {
    throw new TypeError("Mixed absolute and relative Next ESLint glob patterns are unsupported");
  }
  const absolute = absolutePatterns.length > 0;
  const cwd = options.cwd ?? process.cwd();
  // tinyglobby's outside-cwd traversal differs from fast-glob. Absolute Next
  // rootDir patterns therefore start at their shared static parent directory.
  const staticParents = absolutePatterns.map((pattern) => {
    const dynamicIndex = pattern.search(/[?*[{(]/);
    return dynamicIndex < 0 ? dirname(pattern) :
      (pattern.slice(0, pattern.lastIndexOf("/", dynamicIndex)) || "/");
  });
  let traversalCwd = staticParents[0] ?? cwd;
  for (const parent of staticParents) {
    while (parent !== traversalCwd && !parent.startsWith(`${traversalCwd}/`) && traversalCwd !== "/") {
      traversalCwd = dirname(traversalCwd);
    }
  }
  return safeGlobSync(values, {
    ...options,
    cwd: traversalCwd,
    onlyDirectories: true,
    onlyFiles: false,
    dot: false,
    expandDirectories: false,
    absolute,
  }).map((entry) => {
    let normalized = entry.length > 1 ? entry.replace(/\/+$/, "") : entry;
    if (!absolute && values.every((pattern) => pattern.startsWith("./"))) {
      normalized = `./${normalized}`;
    }
    if (values.every((pattern) => pattern.endsWith("/")) && normalized !== "/") {
      normalized += "/";
    }
    return normalized;
  }).filter((entry) => !values.some((pattern) => {
    // fast-glob does not include the traversal root for a trailing globstar.
    if (!pattern.endsWith("/**")) return false;
    const base = pattern.replace(/(?:\/\*\*)+$/, "");
    if (/[?*[{(]/.test(base)) return false;
    const candidate = absolute ? entry : resolve(cwd, entry);
    return relative(resolve(cwd, base), candidate) === "";
  }));
}

module.exports = { globSync };
