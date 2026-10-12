import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  grantNewUserPromotion: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/credits/new-user-promotion", () => ({
  grantNewUserPromotion: mocks.grantNewUserPromotion,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      getUser: mocks.getUser,
      verifyOtp: mocks.verifyOtp,
    },
    from: mocks.from,
  }),
}));

import { GET } from "./route";

describe("shared authentication callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.verifyOtp.mockResolvedValue({ error: null });
    mocks.getUser.mockResolvedValue({
      data: { user: {
        id: "11111111-1111-4111-8111-111111111111",
        created_at: "2026-09-23T01:00:00.000Z",
        email_confirmed_at: "2026-09-23T01:01:00.000Z",
      } },
    });
    mocks.grantNewUserPromotion.mockResolvedValue({ granted: true });
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: async () => ({
            data: [{ policy_type: "terms" }, { policy_type: "privacy" }],
            error: null,
          }),
        }),
      }),
    });
  });

  it("exchanges an OAuth code and preserves an approved destination", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3001/auth/confirm?code=oauth-code&next=/credits",
      ),
    );

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(mocks.grantNewUserPromotion).toHaveBeenCalledTimes(1);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/credits",
    );
  });

  it("keeps the email confirmation token link flow", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3001/auth/confirm?token_hash=email-token&type=signup&next=/generate",
      ),
    );

    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: "email-token",
      type: "signup",
    });
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/generate",
    );
  });

  it("lets a verified recovery session reset its password before consent", async () => {
    mocks.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      }),
    });
    const response = await GET(
      new NextRequest(
        "http://localhost:3001/auth/confirm?token_hash=recovery-token&type=recovery",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/reset-password",
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("sends a first-time OAuth user without current consent to the consent step", async () => {
    mocks.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      }),
    });
    const response = await GET(
      new NextRequest(
        "http://localhost:3001/auth/confirm?code=oauth-code&next=/credits",
      ),
    );
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/consent?next=%2Fcredits",
    );
  });

  it("returns OAuth cancellation to login without exposing provider details", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3001/auth/confirm?error=access_denied&error_description=raw-provider-error",
      ),
    );

    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/login?error=");
    expect(location).not.toContain("raw-provider-error");
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
