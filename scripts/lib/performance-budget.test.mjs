import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPerformanceBudget,
  measureAppPageBudgets,
  maximumRouteGzipBytesFor,
  PERFORMANCE_BUDGET,
} from "./performance-budget.mjs";

test("measures unique JS and CSS assets for App Router pages", () => {
  const assets = new Map([
    ["static/shared.js", Buffer.from("shared")],
    ["static/page.js", Buffer.from("page")],
    ["static/page.css", Buffer.from("style")],
  ]);
  const routes = measureAppPageBudgets(
    {
      pages: {
        "/page": [
          "static/shared.js",
          "static/shared.js",
          "static/page.js",
          "static/page.css",
        ],
        "/api/route": ["static/shared.js"],
      },
    },
    (file) => assets.get(file),
  );

  assert.equal(routes.length, 1);
  assert.equal(routes[0].route, "/");
  assert.equal(routes[0].assets.length, 3);
  assert.equal(routes[0].rawBytes, 15);
});

test("fails when a route or individual asset exceeds its budget", () => {
  const routes = [
    {
      route: "/",
      gzipBytes: 101,
      assets: [{ file: "large.js", gzipBytes: 61 }],
    },
  ];

  assert.throws(
    () =>
      assertPerformanceBudget(routes, {
        maximumRouteGzipBytes: 100,
        maximumAssetGzipBytes: 60,
      }),
    /Performance budget exceeded/u,
  );
});

test("rejects an invalid or empty build manifest", () => {
  assert.throws(
    () => measureAppPageBudgets({}, () => Buffer.alloc(0)),
    /Invalid Next.js app build manifest/u,
  );
  assert.throws(
    () => measureAppPageBudgets({ pages: {} }, () => Buffer.alloc(0)),
    /No app pages found/u,
  );
});

function routeFixture(route, gzipBytes) {
  return { route, gzipBytes, assets: [{ file: "small.js", gzipBytes: 1024 }] };
}

test("only the four approved routes receive a 140 KiB provisional ceiling", () => {
  const approved = ["/", "/generate", "/generate/[service]", "/dev/image-generation"];
  assert.deepEqual(Object.keys(PERFORMANCE_BUDGET.routeGzipByteOverrides), approved);
  assert.equal(Object.isFrozen(PERFORMANCE_BUDGET.routeGzipByteOverrides), true);
  for (const route of approved) {
    assert.equal(maximumRouteGzipBytesFor(route), 140 * 1024);
    assert.doesNotThrow(() => assertPerformanceBudget([routeFixture(route, 140 * 1024)]));
    assert.throws(() => assertPerformanceBudget([routeFixture(route, 140 * 1024 + 1)]), /Performance budget exceeded/u);
  }
});

test("all unlisted routes retain the 120 KiB limit without prefix exceptions", () => {
  for (const route of ["/login", "/account", "/new-page", "/generate/another-page", "/dev/another-page"]) {
    assert.equal(maximumRouteGzipBytesFor(route), 120 * 1024);
    assert.doesNotThrow(() => assertPerformanceBudget([routeFixture(route, 120 * 1024)]));
    assert.throws(() => assertPerformanceBudget([routeFixture(route, 120 * 1024 + 1)]), /Performance budget exceeded/u);
  }
});

test("an approved route still fails if any individual asset exceeds 64 KiB", () => {
  assert.throws(() => assertPerformanceBudget([{
    route: "/generate/[service]",
    gzipBytes: 65 * 1024,
    assets: [{ file: "oversized.js", gzipBytes: 64 * 1024 + 1 }],
  }]), /oversized\.js gzip 65537 > 65536/u);
});

test("invalid override values fail closed", () => {
  for (const value of [NaN, 0, -1, Infinity, "143360"]) {
    assert.throws(() => maximumRouteGzipBytesFor("/", {
      maximumRouteGzipBytes: 120 * 1024,
      routeGzipByteOverrides: { "/": value },
    }), /Invalid route performance budget/u);
  }
});
