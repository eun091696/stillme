import { describe, expect, it } from "vitest";

import {
  getAwsFaceEnvironment,
  getGoogleImageEnvironment,
  isAwsFaceValidationConfigured,
  isGenerationServiceConfigured,
  isR2StorageConfigured,
  isGenerationTestMode,
  isImageCreditBypassEnabled,
  usesLocalGenerationStorage,
} from "./config";

describe("isGenerationServiceConfigured", () => {
  it("requires every server-only generation credential", () => {
    expect(
      isGenerationServiceConfigured({
        GOOGLE_AI_API_KEY: "google",
        AWS_ACCESS_KEY_ID: "aws-access",
        AWS_SECRET_ACCESS_KEY: "aws-secret",
        AWS_REGION: "ap-northeast-2",
        R2_ACCESS_KEY_ID: "access",
        R2_ACCOUNT_ID: "a".repeat(32),
        R2_BUCKET: "bucket",
        R2_SECRET_ACCESS_KEY: "secret",
        SUPABASE_SERVICE_ROLE_KEY: "service",
      }),
    ).toBe(true);
  });

  it("fails closed without exposing which credential is absent", () => {
    expect(isGenerationServiceConfigured({})).toBe(false);
    expect(
      isGenerationServiceConfigured({
        GOOGLE_AI_API_KEY: "google",
        R2_ACCESS_KEY_ID: "access",
        R2_ACCOUNT_ID: "a".repeat(32),
        R2_BUCKET: "bucket",
        R2_SECRET_ACCESS_KEY: "secret",
      }),
    ).toBe(false);
  });

  it("uses private local storage only outside production when R2 is absent", () => {
    const development = {
      GOOGLE_AI_API_KEY: "google",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      AWS_ACCESS_KEY_ID: "aws-access",
      AWS_SECRET_ACCESS_KEY: "aws-secret",
      AWS_REGION: "ap-northeast-2",
      NODE_ENV: "development",
    };

    expect(isGenerationServiceConfigured(development)).toBe(true);
    expect(usesLocalGenerationStorage(development)).toBe(true);
    expect(
      isGenerationServiceConfigured({ ...development, NODE_ENV: "production" }),
    ).toBe(false);
  });

  it("rejects partial R2 configuration instead of silently falling back", () => {
    const environment = {
      GOOGLE_AI_API_KEY: "google",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      AWS_ACCESS_KEY_ID: "aws-access",
      AWS_SECRET_ACCESS_KEY: "aws-secret",
      AWS_REGION: "ap-northeast-2",
      NODE_ENV: "development",
      R2_BUCKET: "bucket",
    };

    expect(isR2StorageConfigured(environment)).toBe(false);
    expect(usesLocalGenerationStorage(environment)).toBe(false);
    expect(isGenerationServiceConfigured(environment)).toBe(false);
  });
});

describe("AWS face validation environment", () => {
  it("requires complete server-only credentials and a valid region", () => {
    const environment = {
      AWS_ACCESS_KEY_ID: "access",
      AWS_SECRET_ACCESS_KEY: "secret",
      AWS_REGION: "ap-northeast-2",
    };
    expect(isAwsFaceValidationConfigured(environment)).toBe(true);
    expect(getAwsFaceEnvironment(environment)).toEqual({
      region: "ap-northeast-2",
    });
    expect(isAwsFaceValidationConfigured({ AWS_REGION: "ap-northeast-2" }))
      .toBe(false);
    expect(() => getAwsFaceEnvironment({ AWS_REGION: "../unsafe" }))
      .toThrow("AWS_REGION");
  });
});

describe("isGenerationTestMode", () => {
  it("allows the explicit flag only outside production", () => {
    expect(isGenerationTestMode({ NODE_ENV: "development" })).toBe(true);
    expect(isGenerationTestMode({ GENERATION_TEST_MODE: "true", NODE_ENV: "development" })).toBe(true);
    expect(isGenerationTestMode({ GENERATION_TEST_MODE: "true", NODE_ENV: "test" })).toBe(true);
    expect(isGenerationTestMode({ GENERATION_TEST_MODE: "true", NODE_ENV: "production" })).toBe(false);
    expect(isGenerationTestMode({ GENERATION_TEST_MODE: "1", NODE_ENV: "test" })).toBe(false);
  });
});

describe("getGoogleImageEnvironment", () => {
  it("defaults to the Flash model and keeps the API key server-side", () => {
    expect(
      getGoogleImageEnvironment({ GOOGLE_AI_API_KEY: "server-key" }),
    ).toEqual({
      apiKey: "server-key",
      defaultModel: "flash",
      proModel: "pro",
      validationModel: "gemini-3.1-flash-lite",
    });
  });

  it("rejects provider ids outside the approved model pair", () => {
    expect(() =>
      getGoogleImageEnvironment({
        GOOGLE_IMAGE_DEFAULT_MODEL: "unknown-model",
      }),
    ).toThrow("GOOGLE_IMAGE_DEFAULT_MODEL");
  });

  it("accepts a server-owned validator model and rejects unsafe identifiers", () => {
    expect(getGoogleImageEnvironment({
      GOOGLE_IMAGE_VALIDATION_MODEL: "gemini-3.1-flash-lite",
    }).validationModel).toBe("gemini-3.1-flash-lite");
    expect(() => getGoogleImageEnvironment({
      GOOGLE_IMAGE_VALIDATION_MODEL: "../unsafe",
    })).toThrow("GOOGLE_IMAGE_VALIDATION_MODEL");
  });
});

describe("isImageCreditBypassEnabled", () => {
  it("allows an explicit non-production test bypass", () => {
    expect(
      isImageCreditBypassEnabled({
        NODE_ENV: "test",
        IMAGE_CREDIT_BYPASS: "true",
      }),
    ).toBe(true);
  });

  it("fails closed in production", () => {
    expect(
      isImageCreditBypassEnabled({
        NODE_ENV: "production",
        IMAGE_CREDIT_BYPASS: "true",
      }),
    ).toBe(false);
  });
});
