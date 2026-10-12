import assert from "node:assert/strict";
import test from "node:test";
import {
  renderDevelopmentEnv,
  selectLocalSupabaseE2EEnvironment,
  selectLocalSupabaseEnvironment,
  selectLocalSupabaseTestEnvironment,
  selectPublishableKey,
  validateProjectRef,
} from "./supabase-development.mjs";

const publishableKey = (suffix) => ["sb", "publishable", suffix].join("_");
const secretKey = (suffix) => ["sb", "secret", suffix].join("_");

test("validates the configured Supabase project ref", () => {
  assert.equal(validateProjectRef("qqdhooymswnqhabydmna"), "qqdhooymswnqhabydmna");
  assert.throws(() => validateProjectRef("invalid-project-ref"));
});

test("selects only the publishable Supabase key", () => {
  const key = selectPublishableKey([
    { name: "anon", type: "legacy", api_key: "legacy-anon" },
    { name: "default", type: "secret", api_key: secretKey("private") },
    { name: "default", type: "publishable", api_key: publishableKey("public") },
  ]);

  assert.equal(key, publishableKey("public"));
});

test("rejects secret and ambiguous key responses", () => {
  assert.throws(() =>
    selectPublishableKey([{ name: "default", type: "secret", api_key: secretKey("private") }]),
  );
  assert.throws(() =>
    selectPublishableKey([
      { name: "first", type: "publishable", api_key: publishableKey("first") },
      { name: "second", type: "publishable", api_key: publishableKey("second") },
    ]),
  );
});

test("updates managed values and preserves unrelated local variables", () => {
  const rendered = renderDevelopmentEnv(
    [
      "UNRELATED_SERVER_VALUE=keep-me",
      "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=old-value",
      "",
    ].join("\n"),
    "qqdhooymswnqhabydmna",
    publishableKey("public"),
  );

  assert.match(rendered, /UNRELATED_SERVER_VALUE=keep-me/);
  assert.match(rendered, /NEXT_PUBLIC_APP_URL=http:\/\/localhost:3001/);
  assert.match(rendered, /NEXT_PUBLIC_SUPABASE_URL=https:\/\/qqdhooymswnqhabydmna\.supabase\.co/);
  assert.match(
    rendered,
    new RegExp(`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishableKey("public")}`),
  );
  assert.doesNotMatch(rendered, /old-value/);
});

test("accepts only a loopback Supabase environment for integration tests", () => {
  assert.deepEqual(
    selectLocalSupabaseEnvironment({
      API_URL: "http://127.0.0.1:54321",
      PUBLISHABLE_KEY: publishableKey("local"),
      SECRET_KEY: secretKey("must-not-be-selected"),
    }),
    {
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey("local"),
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    },
  );

  assert.throws(() =>
    selectLocalSupabaseEnvironment({
      API_URL: "https://production.example.com",
      PUBLISHABLE_KEY: publishableKey("remote"),
    }),
  );
});

test("selects a local-only secret for integration and E2E setup", () => {
  const serviceRoleKey = "local-test-service-role-key";
  const selected = selectLocalSupabaseTestEnvironment({
    API_URL: "http://localhost:54321",
    PUBLISHABLE_KEY: publishableKey("local"),
    SERVICE_ROLE_KEY: serviceRoleKey,
  });

  assert.deepEqual(selected, {
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey("local"),
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    SUPABASE_TEST_SERVICE_ROLE_KEY: serviceRoleKey,
  });
  assert.throws(() =>
    selectLocalSupabaseTestEnvironment({
      API_URL: "http://localhost:54321",
      PUBLISHABLE_KEY: publishableKey("local"),
      SERVICE_ROLE_KEY: "too-short",
    }),
  );
});

test("adds only a loopback Mailpit endpoint for browser recovery tests", () => {
  assert.deepEqual(
    selectLocalSupabaseE2EEnvironment({
      API_URL: "http://localhost:54321",
      MAILPIT_URL: "http://127.0.0.1:54324",
      PUBLISHABLE_KEY: publishableKey("local"),
      SERVICE_ROLE_KEY: "local-test-service-role-key",
    }),
    {
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey("local"),
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SERVICE_ROLE_KEY: "local-test-service-role-key",
      SUPABASE_TEST_MAILPIT_URL: "http://127.0.0.1:54324",
      SUPABASE_TEST_SERVICE_ROLE_KEY: "local-test-service-role-key",
    },
  );

  assert.throws(() =>
    selectLocalSupabaseE2EEnvironment({
      API_URL: "http://localhost:54321",
      MAILPIT_URL: "https://mail.example.com",
      PUBLISHABLE_KEY: publishableKey("local"),
      SERVICE_ROLE_KEY: "local-test-service-role-key",
    }),
  );
});
