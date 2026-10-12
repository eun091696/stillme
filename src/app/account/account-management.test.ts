import { describe, expect, it } from "vitest";

import { isDeletionConfirmation } from "./account-management";

describe("account deletion confirmation", () => {
  it("enables deletion only for the exact confirmation text", () => {
    expect(isDeletionConfirmation("탈퇴")).toBe(true);
    expect(isDeletionConfirmation(" 탈퇴")).toBe(false);
    expect(isDeletionConfirmation("탈퇴 ")).toBe(false);
    expect(isDeletionConfirmation("회원탈퇴")).toBe(false);
    expect(isDeletionConfirmation("")).toBe(false);
  });
});
