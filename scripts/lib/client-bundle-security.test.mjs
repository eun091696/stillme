import assert from "node:assert/strict";
import test from "node:test";

import {
  assertClientBundleSafe,
  findClientBundleViolations,
} from "./client-bundle-security.mjs";

test("accepts a client bundle without restricted server markers", () => {
  assert.doesNotThrow(() =>
    assertClientBundleSafe([
      {
        content: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        file: "public.js",
      },
    ]),
  );
});

test("detects every restricted marker without exposing credential values", () => {
  const violations = findClientBundleViolations([
    {
      content:
        "SUPABASE_SERVICE_ROLE_KEY APS_CLIENT_BUNDLE_CANARY_PAYMENT",
      file: "leaked.js",
    },
  ]);

  assert.deepEqual(violations, [
    { file: "leaked.js", marker: "SUPABASE_SERVICE_ROLE_KEY" },
    { file: "leaked.js", marker: "APS_CLIENT_BUNDLE_CANARY_" },
  ]);
  assert.throws(
    () =>
      assertClientBundleSafe([
        {
          content: "R2_SECRET_ACCESS_KEY",
          file: "leaked.js",
        },
      ]),
    /leaked\.js: R2_SECRET_ACCESS_KEY/u,
  );
});

test("fails closed when no built client files are available", () => {
  assert.throws(() => assertClientBundleSafe([]), /No client bundle files/u);
});
