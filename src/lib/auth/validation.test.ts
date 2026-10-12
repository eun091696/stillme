import { describe, expect, it } from "vitest";
import {
  validateAuthFields,
  validateDisplayName,
  validateEmail,
  validateNewPassword,
} from "./validation";

function form(fields: Record<string, string>) {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

describe("validateAuthFields", () => {
  it("normalizes a valid login", () => {
    expect(
      validateAuthFields(
        form({ email: "  USER@example.com ", password: "password123" }),
      ),
    ).toEqual({
      data: { email: "user@example.com", password: "password123" },
      ok: true,
    });
  });

  it("rejects invalid email and short password", () => {
    const result = validateAuthFields(
      form({ email: "invalid", password: "short" }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(2);
    }
  });

  it("requires a bounded display name during signup", () => {
    const result = validateAuthFields(
      form({
        displayName: " ",
        email: "user@example.com",
        password: "password123",
      }),
      { requireDisplayName: true },
    );

    expect(result.ok).toBe(false);
  });

  it("requires matching passwords when signup confirmation is enabled", () => {
    const result = validateAuthFields(
      form({
        email: "user@example.com",
        password: "password123",
        confirmPassword: "different123",
      }),
      { requirePasswordConfirmation: true },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("비밀번호 확인이 일치하지 않습니다.");
    }
  });
});

describe("validateDisplayName", () => {
  it("trims a valid display name", () => {
    expect(validateDisplayName("  Studio User ")).toEqual({
      displayName: "Studio User",
    });
  });

  it("rejects an empty display name", () => {
    expect(validateDisplayName("   ")).toHaveProperty("error");
  });
});

describe("recovery validation", () => {
  it("normalizes a recovery email", () => {
    expect(validateEmail("  USER@example.com ")).toEqual({
      email: "user@example.com",
    });
    expect(validateEmail("invalid")).toHaveProperty("error");
  });

  it("accepts only matching bounded passwords", () => {
    expect(validateNewPassword("new-password-123", "new-password-123")).toEqual({
      password: "new-password-123",
    });
    expect(validateNewPassword("short", "short")).toHaveProperty("error");
    expect(validateNewPassword("new-password-123", "different-password")).toHaveProperty(
      "error",
    );
  });
});
