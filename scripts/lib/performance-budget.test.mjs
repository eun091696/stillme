import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPerformanceBudget,
  measureAppPageBudgets,
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
