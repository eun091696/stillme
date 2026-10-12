import { gzipSync } from "node:zlib";

export const PERFORMANCE_BUDGET = Object.freeze({
  maximumRouteGzipBytes: 120 * 1024,
  maximumAssetGzipBytes: 64 * 1024,
});

function isAppPage(route) {
  return route === "/page" || route.endsWith("/page");
}

function publicRoute(route) {
  if (route === "/page") {
    return "/";
  }

  return route.slice(0, -"/page".length);
}

export function measureAppPageBudgets(manifest, readAsset) {
  if (!manifest || typeof manifest !== "object" || !manifest.pages) {
    throw new Error("Invalid Next.js app build manifest");
  }

  const routes = Object.entries(manifest.pages)
    .filter(([route]) => isAppPage(route))
    .map(([route, files]) => {
      if (!Array.isArray(files)) {
        throw new Error(`Invalid asset list for ${route}`);
      }

      const assets = [...new Set(files)]
        .filter((file) => file.endsWith(".js") || file.endsWith(".css"))
        .map((file) => {
          const bytes = readAsset(file);
          const gzipBytes = gzipSync(bytes, { level: 9 }).byteLength;
          return { file, rawBytes: bytes.byteLength, gzipBytes };
        });

      return {
        route: publicRoute(route),
        rawBytes: assets.reduce((total, asset) => total + asset.rawBytes, 0),
        gzipBytes: assets.reduce(
          (total, asset) => total + asset.gzipBytes,
          0,
        ),
        assets,
      };
    });

  if (routes.length === 0) {
    throw new Error("No app pages found in Next.js build manifest");
  }

  return routes;
}

export function assertPerformanceBudget(
  routes,
  budget = PERFORMANCE_BUDGET,
) {
  const violations = [];

  for (const route of routes) {
    if (route.gzipBytes > budget.maximumRouteGzipBytes) {
      violations.push(
        `${route.route} route gzip ${route.gzipBytes} > ${budget.maximumRouteGzipBytes}`,
      );
    }

    for (const asset of route.assets) {
      if (asset.gzipBytes > budget.maximumAssetGzipBytes) {
        violations.push(
          `${asset.file} gzip ${asset.gzipBytes} > ${budget.maximumAssetGzipBytes}`,
        );
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(`Performance budget exceeded:\n${violations.join("\n")}`);
  }
}
