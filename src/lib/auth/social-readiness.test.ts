import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({
  getSupabaseConfig: () => ({
    publishableKey: "public-test-key",
    url: "https://project.example.test",
  }),
}));

import { socialProviderIsEnabled } from "./social-readiness";

describe("socialProviderIsEnabled", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the provider state from public Auth settings", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ external: { google: true, kakao: false } }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(socialProviderIsEnabled("google")).resolves.toBe(true);
    await expect(socialProviderIsEnabled("kakao")).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.example.test/auth/v1/settings",
      {
        cache: "no-store",
        headers: { apikey: "public-test-key" },
      },
    );
  });

  it("fails open when settings cannot be checked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(socialProviderIsEnabled("google")).resolves.toBeNull();
  });
});
