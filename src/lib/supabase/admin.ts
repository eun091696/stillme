import "server-only";

import { createClient } from "@supabase/supabase-js";

function requiredEnvironmentVariable(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createAdminClient() {
  return createClient(
    requiredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
