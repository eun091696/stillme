import { gzipSync } from "node:zlib";

export const PERFORMANCE_BUDGET = Object.freeze({
  maximumRouteGzipBytes: 120 * 1024,
  maximumAssetGzipBytes: 64 * 1024,
  // Owner-approved provisional ceilings, not measured loading-speed targets.
  // Review these four routes on the next frontend/framework change or mobile measurement.
  routeGzipByteOverrides: Object.freeze({
    "/": 140 * 1024,
    "/generate": 140 * 1024,
    "/generate/[service]": 140 * 1024,
    "/dev/image-generation": 140 * 1024,
  }),
});

export function maximumRouteGzipBytesFor(route, budget = PERFORMANCE_BUDGET) {
  const overrides = budget.routeGzipByteOverrides ?? {};
  const limit = Object.hasOwn(overrides, route)
    ? overrides[route]
    : budget.maximumRouteGzipBytes;
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new Error(`Invalid route performance budget for ${route}`);
  }
  return limit;
}

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
    const maximumRouteGzipBytes = maximumRouteGzipBytesFor(route.route, budget);
    if (route.gzipBytes > maximumRouteGzipBytes) {
      violations.push(
        `${route.route} route gzip ${route.gzipBytes} > ${maximumRouteGzipBytes}`,
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
