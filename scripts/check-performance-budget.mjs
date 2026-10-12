import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertPerformanceBudget,
  measureAppPageBudgets,
  PERFORMANCE_BUDGET,
} from "./lib/performance-budget.mjs";

const buildDirectory = resolve(".next");
const manifest = JSON.parse(
  readFileSync(resolve(buildDirectory, "app-build-manifest.json"), "utf8"),
);
const routes = measureAppPageBudgets(manifest, (asset) =>
  readFileSync(resolve(buildDirectory, asset)),
);

let failure;
try {
  assertPerformanceBudget(routes);
} catch (error) {
  failure = error;
}

const largestRoute = routes.reduce((largest, route) =>
  route.gzipBytes > largest.gzipBytes ? route : largest,
);
const largestAsset = routes
  .flatMap((route) => route.assets)
  .reduce((largest, asset) =>
    asset.gzipBytes > largest.gzipBytes ? asset : largest,
  );

console.log(
  JSON.stringify(
    {
      status: failure ? "failed" : "passed",
      pages: routes.length,
      budgets: PERFORMANCE_BUDGET,
      largestRoute: {
        route: largestRoute.route,
        gzipBytes: largestRoute.gzipBytes,
        assetCount: largestRoute.assets.length,
        assets: [...largestRoute.assets]
          .sort((a, b) => b.gzipBytes - a.gzipBytes)
          .slice(0, 12)
          .map(({ file, gzipBytes }) => ({ file, gzipBytes })),
      },
      largestAsset: {
        file: largestAsset.file,
        gzipBytes: largestAsset.gzipBytes,
      },
    },
    null,
    2,
  ),
);

// Print only filenames and byte counts, then preserve the exact failing exit.
if (failure) throw failure;
