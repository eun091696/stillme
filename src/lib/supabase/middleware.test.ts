import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { hasSupabaseAuthCookie, isProtectedPath } from "./middleware";

describe("hasSupabaseAuthCookie", () => {
  it("detects only Supabase auth cookies", () => {
    const authenticatedRequest = new NextRequest("http://localhost/account", {
      headers: { cookie: "sb-local-auth-token=expired" },
    });
    const unrelatedRequest = new NextRequest("http://localhost/account", {
      headers: { cookie: "theme=dark" },
    });

    expect(hasSupabaseAuthCookie(authenticatedRequest)).toBe(true);
    expect(hasSupabaseAuthCookie(unrelatedRequest)).toBe(false);
  });
});

describe("isProtectedPath", () => {
  it("protects account, admin, and generation route trees", () => {
    expect(isProtectedPath("/account")).toBe(true);
    expect(isProtectedPath("/admin")).toBe(true);
    expect(isProtectedPath("/admin/users")).toBe(true);
    expect(isProtectedPath("/generate")).toBe(true);
    expect(isProtectedPath("/credits")).toBe(true);
    expect(isProtectedPath("/generations")).toBe(true);
    expect(isProtectedPath("/consent")).toBe(true);
    expect(isProtectedPath("/login")).toBe(false);
  });
});
