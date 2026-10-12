const PROJECT_REF_PATTERN = /^[a-z]{20}$/;
const PUBLISHABLE_KEY_PREFIX = ["sb", "publishable", ""].join("_");
const MANAGED_VARIABLES = new Set([
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
]);

export function validateProjectRef(projectRef) {
  if (!PROJECT_REF_PATTERN.test(projectRef)) {
    throw new Error("Supabase project ref must contain exactly 20 lowercase letters.");
  }

  return projectRef;
}

export function selectPublishableKey(keys) {
  const publishableKeys = keys.filter(
    (key) =>
      key?.type === "publishable" &&
      typeof key.api_key === "string" &&
      key.api_key.startsWith(PUBLISHABLE_KEY_PREFIX),
  );

  if (publishableKeys.length !== 1) {
    throw new Error("Expected exactly one Supabase publishable key.");
  }

  return publishableKeys[0].api_key;
}

export function renderDevelopmentEnv(existingContent, projectRef, publishableKey) {
  validateProjectRef(projectRef);

  if (!publishableKey.startsWith(PUBLISHABLE_KEY_PREFIX)) {
    throw new Error("Refusing to write a non-publishable Supabase key.");
  }

  const retainedLines = existingContent
    .split(/\r?\n/)
    .filter((line) => {
      const match = line.match(/^([A-Z0-9_]+)=/);
      return !match || !MANAGED_VARIABLES.has(match[1]);
    });

  while (retainedLines.at(-1) === "") {
    retainedLines.pop();
  }

  const managedLines = [
    "# Managed by `npm run supabase:env:development`.",
    "NEXT_PUBLIC_APP_URL=http://localhost:3001",
    `NEXT_PUBLIC_SUPABASE_URL=https://${projectRef}.supabase.co`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
  ];

  return [...retainedLines, ...(retainedLines.length ? [""] : []), ...managedLines, ""].join(
    "\n",
  );
}

export function selectLocalSupabaseEnvironment(status) {
  const apiUrl = status?.API_URL;
  const publishableKey = status?.PUBLISHABLE_KEY;

  if (
    typeof apiUrl !== "string" ||
    !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(apiUrl)
  ) {
    throw new Error("Local Supabase API URL is missing or is not a loopback URL.");
  }

  if (
    typeof publishableKey !== "string" ||
    !publishableKey.startsWith(PUBLISHABLE_KEY_PREFIX)
  ) {
    throw new Error("Local Supabase publishable key is missing or invalid.");
  }

  return {
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
  };
}

export function selectLocalSupabaseTestEnvironment(status) {
  const publicEnvironment = selectLocalSupabaseEnvironment(status);
  const serviceRoleKey = status?.SERVICE_ROLE_KEY;

  if (
    typeof serviceRoleKey !== "string" ||
    serviceRoleKey.length < 20
  ) {
    throw new Error("Local Supabase service role key is missing or invalid.");
  }

  return {
    ...publicEnvironment,
    SUPABASE_TEST_SERVICE_ROLE_KEY: serviceRoleKey,
  };
}

export function selectLocalSupabaseE2EEnvironment(status) {
  const testEnvironment = selectLocalSupabaseTestEnvironment(status);
  const mailpitUrl = status?.MAILPIT_URL ?? status?.INBUCKET_URL;

  if (
    typeof mailpitUrl !== "string" ||
    !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(mailpitUrl)
  ) {
    throw new Error("Local Mailpit URL is missing or is not a loopback URL.");
  }

  return {
    ...testEnvironment,
    SUPABASE_SERVICE_ROLE_KEY:
      testEnvironment.SUPABASE_TEST_SERVICE_ROLE_KEY,
    SUPABASE_TEST_MAILPIT_URL: mailpitUrl,
  };
}
