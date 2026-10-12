import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  adminDeleteUser: vi.fn(),
  adminFrom: vi.fn(),
  adminRpc: vi.fn(),
  deleteStoredAsset: vi.fn(),
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  socialProviderIsEnabled: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithOAuth: mocks.signInWithOAuth,
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      getUser: mocks.getUser,
      signOut: mocks.signOut,
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { deleteUser: mocks.adminDeleteUser } },
    from: mocks.adminFrom,
    rpc: mocks.adminRpc,
  }),
}));
vi.mock("@/lib/storage/asset-deletion", () => ({
  deleteStoredAsset: mocks.deleteStoredAsset,
}));
vi.mock("@/lib/auth/social-readiness", () => ({
  socialProviderIsEnabled: mocks.socialProviderIsEnabled,
}));

import { deleteAccount, login, loginWithSocialProvider, signup } from "./actions";

function socialForm(provider: string, next = "/generate/id-photo") {
  const formData = new FormData();
  formData.set("provider", provider);
  formData.set("next", next);
  return formData;
}

function emailForm(
  fields: Record<string, string>,
) {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

describe("social authentication action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: "https://provider.example.test/authorize" },
      error: null,
    });
    mocks.socialProviderIsEnabled.mockResolvedValue(true);
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    mocks.signUp.mockResolvedValue({
      data: {
        session: null,
        user: { id: "11111111-1111-4111-8111-111111111111" },
      },
      error: null,
    });
    mocks.adminRpc.mockResolvedValue({ data: null, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it("starts Kakao OAuth with only the used email and nickname scopes", async () => {
    await expect(
      loginWithSocialProvider(socialForm("kakao")),
    ).rejects.toThrow("REDIRECT:https://provider.example.test/authorize");

    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "kakao",
      options: {
        redirectTo:
          "http://localhost:3001/auth/confirm?next=%2Fgenerate%2Fid-photo",
        queryParams: {
          scope: "account_email profile_nickname",
        },
        skipBrowserRedirect: true,
      },
    });

    const oauthOptions = mocks.signInWithOAuth.mock.calls[0]?.[0]?.options;
    expect(`scope=${encodeURIComponent(oauthOptions.queryParams.scope)}`).toBe(
      "scope=account_email%20profile_nickname",
    );
  });

  it("keeps Google OAuth options unchanged", async () => {
    await expect(
      loginWithSocialProvider(socialForm("google")),
    ).rejects.toThrow("REDIRECT:https://provider.example.test/authorize");

    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo:
          "http://localhost:3001/auth/confirm?next=%2Fgenerate%2Fid-photo",
        skipBrowserRedirect: true,
      },
    });
  });

  it("rejects Naver without contacting Supabase Auth", async () => {
    await expect(
      loginWithSocialProvider(socialForm("naver")),
    ).rejects.toThrow("REDIRECT:/login?error=");
    const redirectUrl = new URL(
      String(mocks.redirect.mock.calls[0]?.[0]),
      "http://localhost:3001",
    );
    expect(redirectUrl.searchParams.get("error")).toBe(
      "지원하지 않는 로그인 방식입니다.",
    );
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("keeps users on the login page when the provider is disabled", async () => {
    mocks.socialProviderIsEnabled.mockResolvedValueOnce(false);

    await expect(
      loginWithSocialProvider(socialForm("kakao")),
    ).rejects.toThrow("REDIRECT:/login?error=");

    const redirectUrl = new URL(
      String(mocks.redirect.mock.calls[0]?.[0]),
      "http://localhost:3001",
    );
    expect(redirectUrl.searchParams.get("error")).toBe(
      "소셜 로그인 설정이 아직 완료되지 않았습니다. 관리자에게 문의해 주세요.",
    );
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("replaces unsafe callback destinations with the authenticated home", async () => {
    await expect(
      loginWithSocialProvider(
        socialForm("google", "https://attacker.example/path"),
      ),
    ).rejects.toThrow("REDIRECT:https://provider.example.test/authorize");

    expect(mocks.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          redirectTo: "http://localhost:3001/auth/confirm?next=%2Fgenerate",
        }),
      }),
    );
  });

  it("does not expose raw provider configuration errors", async () => {
    mocks.signInWithOAuth.mockResolvedValueOnce({
      data: { url: null },
      error: { message: "client_secret=must-not-leak" },
    });

    await expect(
      loginWithSocialProvider(socialForm("kakao")),
    ).rejects.toThrow("REDIRECT:/login?error=");
    expect(String(mocks.redirect.mock.calls[0]?.[0])).not.toContain(
      "must-not-leak",
    );
  });
});

describe("email authentication actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    mocks.signUp.mockResolvedValue({
      data: {
        session: null,
        user: { id: "11111111-1111-4111-8111-111111111111" },
      },
      error: null,
    });
    mocks.adminRpc.mockResolvedValue({ data: null, error: null });
  });

  it("keeps confirmation-link signup and requires matching passwords", async () => {
    const formData = emailForm({
      email: "person@example.com",
      password: "password123",
      confirmPassword: "password123",
      privacyAccepted: "on",
      termsAccepted: "on",
    });

    await expect(signup(formData)).rejects.toThrow(
      "REDIRECT:/verify-email?message=",
    );
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "password123",
      options: {
        emailRedirectTo:
          "http://localhost:3001/auth/confirm?next=/generate",
      },
    });

    await expect(
      signup(emailForm({
        email: "person@example.com",
        password: "password123",
        confirmPassword: "different123",
        privacyAccepted: "on",
        termsAccepted: "on",
      })),
    ).rejects.toThrow("REDIRECT:/signup?error=");
    expect(mocks.signUp).toHaveBeenCalledTimes(1);
  });

  it("does not create an email account without both required policy consents", async () => {
    await expect(signup(emailForm({
      email: "person@example.com",
      password: "password123",
      confirmPassword: "password123",
      termsAccepted: "on",
    }))).rejects.toThrow("REDIRECT:/signup?error=");
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("distinguishes email confirmation from generic credential failure", async () => {
    mocks.signInWithPassword.mockResolvedValueOnce({
      error: { code: "email_not_confirmed" },
    });

    await expect(login(emailForm({
      email: "person@example.com",
      password: "password123",
      next: "/generate",
    }))).rejects.toThrow("REDIRECT:/login?error=");
    const confirmationRedirect = new URL(
      String(mocks.redirect.mock.calls[0]?.[0]),
      "http://localhost:3001",
    );
    expect(confirmationRedirect.searchParams.get("error")).toBe(
      "이메일 인증 후 로그인해 주세요.",
    );

    vi.clearAllMocks();
    mocks.signInWithPassword.mockResolvedValueOnce({
      error: { code: "invalid_credentials" },
    });
    await expect(login(emailForm({
      email: "person@example.com",
      password: "password123",
      next: "/generate",
    }))).rejects.toThrow("REDIRECT:/login?error=");
    const credentialRedirect = new URL(
      String(mocks.redirect.mock.calls[0]?.[0]),
      "http://localhost:3001",
    );
    expect(credentialRedirect.searchParams.get("error")).toBe(
      "이메일 또는 비밀번호를 확인해 주세요.",
    );
  });
});

describe("account deletion action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const user = { id: "11111111-1111-4111-8111-111111111111" };
    mocks.getUser.mockResolvedValue({ data: { user } });
    mocks.adminDeleteUser.mockResolvedValue({ error: null });
    mocks.adminRpc.mockResolvedValue({ data: null, error: null });
    mocks.deleteStoredAsset.mockResolvedValue("deleted");
    mocks.signOut.mockResolvedValue({ error: null });

    let assetQueryCount = 0;
    mocks.adminFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      if (table === "generation_jobs") {
        const query = {
          eq: vi.fn(),
          in: vi.fn(),
          limit: vi.fn(async () => ({ data: [], error: null })),
          select: vi.fn(),
        };
        query.select.mockReturnValue(query);
        query.eq.mockReturnValue(query);
        query.in.mockReturnValue(query);
        return query;
      }
      assetQueryCount += 1;
      const result = assetQueryCount === 1
        ? { data: [{ id: "33333333-3333-4333-8333-333333333333" }], error: null }
        : { count: 0, error: null };
      const query = {
        eq: vi.fn(),
        neq: vi.fn(async () => result),
        select: vi.fn(),
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      return query;
    });
  });

  it("deletes owned objects before deleting the Auth user", async () => {
    const formData = new FormData();
    formData.set("confirmation", "탈퇴");

    await expect(deleteAccount(formData)).rejects.toThrow("REDIRECT:/");
    expect(mocks.deleteStoredAsset).toHaveBeenCalledWith(
      "33333333-3333-4333-8333-333333333333",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(mocks.adminDeleteUser).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(mocks.adminRpc).toHaveBeenCalledWith(
      "prepare_account_deletion",
      { target_user_id: "11111111-1111-4111-8111-111111111111" },
    );
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(
      mocks.deleteStoredAsset.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.adminDeleteUser.mock.invocationCallOrder[0]);
  });

  it("requires the explicit Korean confirmation", async () => {
    const formData = new FormData();
    formData.set("confirmation", "delete");

    await expect(deleteAccount(formData)).rejects.toThrow(
      "REDIRECT:/account?error=",
    );
    expect(mocks.adminFrom).not.toHaveBeenCalled();
  });
});
