import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "server-only": fileURLToPath(
          new URL("./tests/stubs/server-only.ts", import.meta.url),
        ),
      },
    },
    test: {
      env: {
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
          env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
        NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      },
    },
  };
});
