import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../check-performance-budget.mjs", import.meta.url));
const marker = "ASSET_BODY_MUST_NOT_APPEAR_IN_REPORT";

function runFixture(bytes) {
  const directory = mkdtempSync(join(tmpdir(), "stillme-performance-"));
  try {
    mkdirSync(join(directory, ".next"));
    writeFileSync(join(directory, ".next", "fixture.js"), bytes);
    writeFileSync(join(directory, ".next", "app-build-manifest.json"), JSON.stringify({
      pages: { "/page": ["fixture.js"] },
    }));
    const result = spawnSync(process.execPath, [script], { cwd: directory, encoding: "utf8" });
    return { result, report: JSON.parse(result.stdout) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("performance CLI reports only asset metadata and preserves a passing exit", () => {
  const { result, report } = runFixture(Buffer.from(marker));
  assert.equal(result.status, 0);
  assert.equal(report.status, "passed");
  assert.deepEqual(report.budgets, { maximumRouteGzipBytes: 120 * 1024, maximumAssetGzipBytes: 64 * 1024 });
  assert.equal(report.largestRoute.assets[0].file, "fixture.js");
  assert.equal(JSON.stringify(report).includes(marker), false);
});

test("performance CLI prints bounded metadata before retaining the unchanged failing budget", () => {
  const bytes = Buffer.concat([randomBytes(150 * 1024), Buffer.from(marker)]);
  const { result, report } = runFixture(bytes);
  assert.equal(result.status, 1);
  assert.equal(report.status, "failed");
  assert.equal(report.largestRoute.route, "/");
  assert.ok(report.largestRoute.gzipBytes > report.budgets.maximumRouteGzipBytes);
  assert.equal(report.largestRoute.assets[0].file, "fixture.js");
  assert.match(result.stderr, /Performance budget exceeded/u);
  assert.equal(JSON.stringify(report).includes(marker), false);
  assert.equal(result.stderr.includes(marker), false);
});
