import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { globSync } = require("../../vendor/next-eslint-glob/index.cjs");

function withDirectories(run) {
  const cwd = mkdtempSync(join(tmpdir(), "stillme-eslint-glob-"));
  try {
    for (const name of ["apps/photo", "apps/admin", "apps/.hidden", "packages/ui"])
      mkdirSync(join(cwd, name), { recursive: true });
    writeFileSync(join(cwd, "apps/file.ts"), "export {};\n");
    run(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

const scan = (patterns, cwd) => globSync(patterns, { onlyDirectories: true, cwd }).sort();

test("preserves Next rootDir directory, glob, brace, array and negative patterns", () => {
  withDirectories((cwd) => {
    assert.deepEqual(scan("apps", cwd), ["apps"]);
    assert.deepEqual(scan("apps/", cwd), ["apps/"]);
    assert.deepEqual(scan("./apps/*", cwd), ["./apps/admin", "./apps/photo"]);
    assert.deepEqual(scan("apps/**", cwd), ["apps/admin", "apps/photo"]);
    assert.deepEqual(scan("+(apps|packages)/*", cwd), ["apps/admin", "apps/photo", "packages/ui"]);
    assert.deepEqual(scan("apps/*", cwd), ["apps/admin", "apps/photo"]);
    assert.deepEqual(scan("{apps,packages}/*", cwd), ["apps/admin", "apps/photo", "packages/ui"]);
    assert.deepEqual(scan(["apps/*", "packages/*"], cwd), ["apps/admin", "apps/photo", "packages/ui"]);
    assert.deepEqual(scan(["apps/*", "!apps/admin"], cwd), ["apps/photo"]);
    assert.deepEqual(scan("apps/file.ts", cwd), []);
    assert.deepEqual(scan("absent/*", cwd), []);
    assert.deepEqual(scan(`${cwd}/apps/*`, cwd), [`${cwd}/apps/admin`, `${cwd}/apps/photo`]);
  });
});

test("the installed Next plugin resolves string and array rootDir settings", () => {
  const { getRootDirs } = require("@next/eslint-plugin-next/dist/utils/get-root-dirs.js");
  withDirectories((cwd) => {
    assert.deepEqual(getRootDirs({ cwd, settings: {} }), [cwd]);
    assert.deepEqual(getRootDirs({ cwd, settings: { next: { rootDir: `${cwd}/apps/*` } } }).sort(),
      [`${cwd}/apps/admin`, `${cwd}/apps/photo`]);
    assert.deepEqual(getRootDirs({ cwd, settings: { next: {
      rootDir: [`${cwd}/apps/*`, `${cwd}/packages/*`],
    } } }).sort(), [`${cwd}/apps/admin`, `${cwd}/apps/photo`, `${cwd}/packages/ui`]);
  });
});

test("rejects excessive nesting and length before glob parsing", () => {
  const options = { onlyDirectories: true };
  for (const [open, close] of [["{", "}"], ["(", ")"], ["[", "]"]]) {
    assert.throws(() => globSync(open.repeat(65) + "a" + close.repeat(65), options),
      /nesting exceeds/);
  }
  assert.throws(() => globSync("a".repeat(10_001), options), /length is invalid/);
  assert.throws(() => globSync(Array(129).fill("apps/*"), options), /bounded pattern list/);
});

test("fails closed on an unsupported future Next glob contract", () => {
  assert.throws(() => globSync("apps/*", {}), /Unsupported/);
  assert.throws(() => globSync("apps/*", { onlyDirectories: true, dot: true }), /Unsupported/);
  assert.throws(() => globSync("apps/*", { onlyDirectories: true, cwd: 1 }), /cwd must/);
  assert.throws(() => globSync(null, { onlyDirectories: true }), /bounded pattern list/);
  assert.throws(() => globSync([null], { onlyDirectories: true }), /length is invalid/);
});
