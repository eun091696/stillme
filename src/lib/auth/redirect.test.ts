import { describe, expect, it } from "vitest";
import {
  AUTHENTICATED_HOME_PATH,
  safeAuthCallbackPath,
} from "./redirect";

describe("safeAuthCallbackPath", () => {
  it("allows only known authentication callback destinations", () => {
    expect(safeAuthCallbackPath("/account")).toBe("/account");
    expect(safeAuthCallbackPath("/generate")).toBe("/generate");
    expect(safeAuthCallbackPath("/generations")).toBe("/generations");
    expect(safeAuthCallbackPath("/reset-password")).toBe("/reset-password");
    expect(safeAuthCallbackPath("/credits")).toBe("/credits");
    expect(safeAuthCallbackPath("/admin")).toBe("/admin");
    expect(safeAuthCallbackPath("/generate/id-photo")).toBe(
      "/generate/id-photo",
    );
    expect(safeAuthCallbackPath("/generate/underwater-correction")).toBe(
      "/generate/underwater-correction",
    );
    expect(safeAuthCallbackPath("/generate/character-avatar")).toBe(
      "/generate/character-avatar",
    );
    expect(safeAuthCallbackPath("https://attacker.example")).toBe(
      AUTHENTICATED_HOME_PATH,
    );
    expect(safeAuthCallbackPath("//attacker.example")).toBe(
      AUTHENTICATED_HOME_PATH,
    );
    expect(safeAuthCallbackPath("/unknown")).toBe(AUTHENTICATED_HOME_PATH);
  });
});
