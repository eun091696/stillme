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
  assert.deepEqual(report.budgets, {
    maximumRouteGzipBytes: 120 * 1024,
    maximumAssetGzipBytes: 64 * 1024,
    routeGzipByteOverrides: {
      "/": 140 * 1024,
      "/generate": 140 * 1024,
      "/generate/[service]": 140 * 1024,
      "/dev/image-generation": 140 * 1024,
    },
  });
  assert.equal(report.largestRoute.maximumGzipBytes, 140 * 1024);
  assert.equal(report.largestRoute.assets[0].file, "fixture.js");
  assert.equal(JSON.stringify(report).includes(marker), false);
});

test("performance CLI prints bounded metadata before retaining the unchanged failing budget", () => {
  const bytes = Buffer.concat([randomBytes(150 * 1024), Buffer.from(marker)]);
  const { result, report } = runFixture(bytes);
  assert.equal(result.status, 1);
  assert.equal(report.status, "failed");
  assert.equal(report.largestRoute.route, "/");
  assert.ok(report.largestRoute.gzipBytes > report.largestRoute.maximumGzipBytes);
  assert.equal(report.largestRoute.assets[0].file, "fixture.js");
  assert.match(result.stderr, /Performance budget exceeded/u);
  assert.equal(JSON.stringify(report).includes(marker), false);
  assert.equal(result.stderr.includes(marker), false);
});

test("CLI applies the named route ceiling while retaining limits for new routes", () => {
  const directory = mkdtempSync(join(tmpdir(), "stillme-route-budget-"));
  try {
    mkdirSync(join(directory, ".next"));
    const assets = ["a.js", "b.js", "c.css"];
    for (const asset of assets) writeFileSync(join(directory, ".next", asset), randomBytes(45 * 1024));
    for (const [route, expectedStatus, expectedLimit] of [
      ["/generate/[service]/page", 0, 140 * 1024],
      ["/new-page/page", 1, 120 * 1024],
    ]) {
      writeFileSync(join(directory, ".next", "app-build-manifest.json"), JSON.stringify({ pages: { [route]: assets } }));
      const result = spawnSync(process.execPath, [script], { cwd: directory, encoding: "utf8" });
      const report = JSON.parse(result.stdout);
      assert.equal(result.status, expectedStatus);
      assert.equal(report.largestRoute.maximumGzipBytes, expectedLimit);
      assert.ok(report.largestRoute.gzipBytes > 120 * 1024 && report.largestRoute.gzipBytes < 140 * 1024);
      assert.ok(report.largestAsset.gzipBytes < 64 * 1024);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
