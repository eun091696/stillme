import {
  DEFAULT_GENERATION_MODEL_KEY,
  generationModelKeyFromProviderId,
  type GenerationModelKey,
  GENERATION_MODEL_PROVIDER_IDS,
} from "./model";

const REQUIRED_GENERATION_ENVIRONMENT = [
  "GOOGLE_AI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const AWS_FACE_ENVIRONMENT = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REGION",
] as const;

const R2_ENVIRONMENT = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

function hasValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isAwsFaceValidationConfigured(
  environment: Record<string, string | undefined> = process.env,
) {
  return AWS_FACE_ENVIRONMENT.every((name) => hasValue(environment[name]));
}

export function getAwsFaceEnvironment(
  environment: Record<string, string | undefined> = process.env,
) {
  const region = environment.AWS_REGION?.trim() ?? "";
  if (!/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/u.test(region)) {
    throw new Error("AWS_REGION is invalid");
  }
  return { region };
}

export function isR2StorageConfigured(
  environment: Record<string, string | undefined> = process.env,
) {
  return R2_ENVIRONMENT.every((name) => hasValue(environment[name]));
}

export function usesLocalGenerationStorage(
  environment: Record<string, string | undefined> = process.env,
) {
  const configuredCount = R2_ENVIRONMENT.filter((name) =>
    hasValue(environment[name]),
  ).length;

  return environment.NODE_ENV !== "production" && configuredCount === 0;
}

export type GoogleImageEnvironment = {
  apiKey: string;
  defaultModel: GenerationModelKey;
  proModel: GenerationModelKey;
  validationModel: string;
};

export function getGoogleImageEnvironment(
  environment: Record<string, string | undefined> = process.env,
): GoogleImageEnvironment {
  const apiKey = environment.GOOGLE_AI_API_KEY?.trim() ?? "";
  const configuredDefault = environment.GOOGLE_IMAGE_DEFAULT_MODEL?.trim();
  const configuredPro = environment.GOOGLE_IMAGE_PRO_MODEL?.trim();
  const validationModel =
    environment.GOOGLE_IMAGE_VALIDATION_MODEL?.trim() ||
    "gemini-3.1-flash-lite";
  const defaultModel = configuredDefault
    ? generationModelKeyFromProviderId(configuredDefault)
    : DEFAULT_GENERATION_MODEL_KEY;
  const proModel = configuredPro
    ? generationModelKeyFromProviderId(configuredPro)
    : "pro";

  if (!defaultModel || defaultModel !== "flash") {
    throw new Error(
      `GOOGLE_IMAGE_DEFAULT_MODEL must be ${GENERATION_MODEL_PROVIDER_IDS.flash}`,
    );
  }

  if (!proModel || proModel !== "pro") {
    throw new Error(
      `GOOGLE_IMAGE_PRO_MODEL must be ${GENERATION_MODEL_PROVIDER_IDS.pro}`,
    );
  }

  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/u.test(validationModel)) {
    throw new Error("GOOGLE_IMAGE_VALIDATION_MODEL is invalid");
  }

  return { apiKey, defaultModel, proModel, validationModel };
}

export function isGenerationServiceConfigured(
  environment: Record<string, string | undefined> = process.env,
) {
  const generationConfigured = REQUIRED_GENERATION_ENVIRONMENT.every((name) =>
    hasValue(environment[name]),
  );

  return (
    generationConfigured &&
    isAwsFaceValidationConfigured(environment) &&
    (isR2StorageConfigured(environment) || usesLocalGenerationStorage(environment))
  );
}

export function isGenerationTestMode(
  environment: Record<string, string | undefined> = process.env,
) {
  return (
    environment.NODE_ENV === "development" ||
    (environment.GENERATION_TEST_MODE === "true" &&
      environment.NODE_ENV !== "production")
  );
}

/** Credit bypass is server-only and fails closed in production. */
export function isImageCreditBypassEnabled(
  environment: Record<string, string | undefined> = process.env,
) {
  return (
    environment.NODE_ENV !== "production" &&
    environment.IMAGE_CREDIT_BYPASS === "true"
  );
}
