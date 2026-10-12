import { describe, expect, it, vi } from "vitest";

import {
  authorizeOperator,
  OPERATOR_CONSOLE_PERMISSION,
} from "./authorization";

describe("operator authorization", () => {
  it("requires a verified user before checking permission", async () => {
    const hasPermission = vi.fn(async () => true);

    await expect(
      authorizeOperator({
        getVerifiedUser: async () => null,
        hasPermission,
      }),
    ).resolves.toEqual({ status: "unauthenticated" });
    expect(hasPermission).not.toHaveBeenCalled();
  });

  it("fails closed when permission is missing or unavailable", async () => {
    await expect(
      authorizeOperator({
        getVerifiedUser: async () => ({ id: "operator-id" }),
        hasPermission: async () => false,
      }),
    ).resolves.toEqual({ status: "forbidden" });

    await expect(
      authorizeOperator({
        getVerifiedUser: async () => ({ id: "operator-id" }),
        hasPermission: async () => {
          throw new Error("authorization service unavailable");
        },
      }),
    ).resolves.toEqual({ status: "forbidden" });
  });

  it("authorizes only the explicit console permission", async () => {
    const hasPermission = vi.fn(async () => true);

    await expect(
      authorizeOperator({
        getVerifiedUser: async () => ({ id: "operator-id" }),
        hasPermission,
      }),
    ).resolves.toEqual({
      status: "authorized",
      userId: "operator-id",
    });
    expect(hasPermission).toHaveBeenCalledWith(OPERATOR_CONSOLE_PERMISSION);
  });
});
