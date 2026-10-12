import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signedIn: true, redirect: vi.fn() }));
vi.mock("@/app/site-header", () => ({ SiteHeader: () => <header>STILLME</header> }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.signedIn ? { id: "test-user" } : null } }) } }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import ProfileCategoryHub from "./page";

vi.stubGlobal("React", React);

describe("profile category hub", () => {
  it("shows visual categories with direct Hair Designer entry", async () => {
    mocks.signedIn = true;
    const markup = renderToStaticMarkup(await ProfileCategoryHub());
    expect(markup).toContain("어떤 용도로 사용할 사진인지 선택하세요.");
    expect(markup).toContain('href="/generate/hair-designer-profile"');
    expect(markup).toContain('href="/generate/executive-profile"');
    expect(markup).toContain('href="/generate/lawyer-profile"');
    expect(markup).toContain('href="/generate/developer-profile"');
    expect(markup).toContain('href="/generate/creator-profile"');
    expect(markup).toContain('href="/generate/profile-photo"');
    expect(markup).toContain('href="/generate/id-photo"');
    expect(markup).toContain("실제 생성 결과가 아닙니다");
  });

  it("requires a session before rendering the hub", async () => {
    mocks.signedIn = false;
    mocks.redirect.mockImplementation(() => { throw new Error("REDIRECT"); });
    await expect(ProfileCategoryHub()).rejects.toThrow("REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/login?next=/generate/profile");
    mocks.redirect.mockReset();
  });
});
