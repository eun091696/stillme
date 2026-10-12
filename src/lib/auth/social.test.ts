import { describe, expect, it } from "vitest";
import { SOCIAL_AUTH_PROVIDERS, socialAuthProvider } from "./social";

describe("social authentication providers", () => {
  it("maps only the approved Kakao and Google provider identifiers", () => {
    expect(SOCIAL_AUTH_PROVIDERS.map(({ id }) => id)).toEqual([
      "kakao",
      "google",
    ]);
    expect(socialAuthProvider("kakao")).toBe("kakao");
    expect(socialAuthProvider("google")).toBe("google");
  });

  it("rejects missing or unapproved providers", () => {
    expect(socialAuthProvider(null)).toBeNull();
    expect(socialAuthProvider("naver")).toBeNull();
    expect(socialAuthProvider("custom:attacker")).toBeNull();
  });
});
