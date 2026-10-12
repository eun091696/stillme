import type { Provider } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

type AuthSettings = {
  external?: Record<string, unknown>;
};

export async function socialProviderIsEnabled(
  provider: Provider,
): Promise<boolean | null> {
  const { publishableKey, url } = getSupabaseConfig();

  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      cache: "no-store",
      headers: {
        apikey: publishableKey,
      },
    });

    if (!response.ok) return null;

    const settings = (await response.json()) as AuthSettings;
    const enabled = settings.external?.[provider];
    return typeof enabled === "boolean" ? enabled : null;
  } catch {
    // A temporary settings request failure must not disable a configured provider.
    return null;
  }
}
