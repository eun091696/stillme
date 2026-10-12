import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
import { AppHeader } from "./app-header";

vi.stubGlobal("React", React);

describe("shared customer header", () => {
  it("shows the supplied available balance and account link", () => {
    const markup = renderToStaticMarkup(<AppHeader availableCredit={2} signedIn />);
    expect(markup).toContain("사용 가능 크레딧 2개");
    expect(markup).toContain("<strong>2</strong>");
    expect(markup).toContain('href="/account"');
  });

  it("does not mistake a failed balance lookup for zero", () => {
    const markup = renderToStaticMarkup(<AppHeader availableCredit={null} signedIn />);
    expect(markup).toContain("크레딧 확인");
    expect(markup).not.toContain("사용 가능 크레딧 0개");
  });

  it("keeps the same navigation for guests without inventing a balance", () => {
    const guest = renderToStaticMarkup(<AppHeader availableCredit={null} signedIn={false} />);
    const signed = renderToStaticMarkup(<AppHeader availableCredit={2} signedIn />);
    expect(guest).toContain('class="app-header"');
    expect(guest).toContain('aria-label="로그인"');
    expect(guest).not.toContain("사용 가능 크레딧");
    for (const label of ["프로필 사진", "증명사진", "캐릭터 사진", "사진 보정", "내 사진"]) {
      expect(guest).toContain(label);
      expect(signed).toContain(label);
    }
    expect(guest).toContain('href="/generate/profile"');
    expect(guest).not.toContain('href="/generate/profile-photo"');
    expect(guest).not.toContain('href="/generate/hair-designer-profile"');
  });
});
