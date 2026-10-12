import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { REQUIRED_POLICY_VERSION } from "../../src/lib/policies";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  throw new Error(
    "Start local Supabase and run E2E through `npm run test:e2e`.",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = new Set<string>();

async function createOrdinaryUser() {
  const email = `e2e-admin-denied-${crypto.randomUUID()}@example.test`;
  const password = `Test-${crypto.randomUUID()}-9a`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { display_name: "E2E Admin Denied" },
  });
  if (error) throw error;
  const { error: consentError } = await admin.rpc(
    "record_required_policy_consents",
    {
      target_policy_version: REQUIRED_POLICY_VERSION,
      target_user_id: data.user.id,
    },
  );
  if (consentError) throw consentError;
  createdUserIds.add(data.user.id);
  return { email, password };
}

async function loginForAdmin(
  page: Page,
  user: { email: string; password: string },
) {
  await page.goto("/login?next=/admin");
  await page.getByLabel("이메일").fill(user.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "로그인" }).click();
}

test.afterEach(async () => {
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
    createdUserIds.delete(userId);
  }
});

test("anonymous and ordinary users cannot enter the operator console", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/u);

  const ordinaryUser = await createOrdinaryUser();
  await loginForAdmin(page, ordinaryUser);

  await expect(page).toHaveURL(/\/admin$/u);
  await expect(
    page.getByRole("heading", { name: "This page could not be found." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "운영 콘솔" })).toHaveCount(0);
});
