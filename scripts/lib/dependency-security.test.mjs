import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const expandBraces = require("brace-expansion");

test("bounds legacy brace expansion output with the security backport", () => {
  const maximumLength = 10_000;
  const expansions = expandBraces("{a,b}".repeat(200), {
    max: 100_000,
    maxLength: maximumLength,
  });
  const expandedLength = expansions.reduce(
    (total, expansion) => total + expansion.length,
    0,
  );

  assert.ok(expansions.length > 0);
  assert.ok(expandedLength <= maximumLength);
});
