import type { Provider } from "@supabase/supabase-js";

export const SOCIAL_AUTH_PROVIDERS = [
  {
    id: "kakao",
    label: "카카오",
    provider: "kakao",
  },
  {
    id: "google",
    label: "Google",
    provider: "google",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  provider: Provider;
}>;

export type SocialAuthProviderId =
  (typeof SOCIAL_AUTH_PROVIDERS)[number]["id"];

export function socialAuthProvider(
  value: FormDataEntryValue | null,
): Provider | null {
  const requestedProvider = String(value ?? "");
  return (
    SOCIAL_AUTH_PROVIDERS.find(
      ({ id }) => id === requestedProvider,
    )?.provider ?? null
  );
}
