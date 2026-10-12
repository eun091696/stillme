import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Start local Supabase and run E2E through `npm run test:e2e`.",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = new Set<string>();

async function createUserWithoutConsent() {
  const email = `e2e-consent-${crypto.randomUUID()}@example.test`;
  const password = `Test-${crypto.randomUUID()}-9a`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });
  if (error) throw error;
  createdUserIds.add(data.user.id);
  return { email, password };
}

test.afterEach(async () => {
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
    createdUserIds.delete(userId);
  }
});

test("required policies use inline independent accordions and preserve the next redirect", async ({
  page,
}) => {
  const user = await createUserWithoutConsent();
  await page.goto("/login?next=/generate");
  await page.getByLabel("이메일").fill(user.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/consent\?next=(?:%2F|\/)generate$/u);

  const initialUrl = page.url();
  const termsCheckbox = page.getByRole("checkbox", {
    name: "이용약관에 동의합니다. (필수)",
  });
  const privacyCheckbox = page.getByRole("checkbox", {
    name: "개인정보처리방침에 동의합니다. (필수)",
  });
  const continueButton = page.getByRole("button", {
    name: "동의하고 계속하기",
  });
  const termsToggle = page.locator(
    'button[aria-controls="terms-policy-content"]',
  );
  const privacyToggle = page.locator(
    'button[aria-controls="privacy-policy-content"]',
  );

  await expect(continueButton).toBeDisabled();
  const alignment = await termsCheckbox.evaluate((checkbox) => {
    const label = checkbox.closest("label");
    const text = label?.querySelector("span");
    if (!text) throw new Error("Consent label text is missing");
    const checkboxRect = checkbox.getBoundingClientRect();
    const textRect = text.getBoundingClientRect();
    return Math.abs(
      checkboxRect.top + checkboxRect.height / 2 -
      (textRect.top + textRect.height / 2),
    );
  });
  expect(alignment).toBeLessThanOrEqual(2);

  await termsToggle.click();
  await privacyToggle.click();
  await expect(termsToggle).toHaveAttribute("aria-expanded", "true");
  await expect(privacyToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#terms-policy-content")).toBeVisible();
  await expect(page.locator("#privacy-policy-content")).toBeVisible();
  expect(page.url()).toBe(initialUrl);

  await page.getByText("이용약관에 동의합니다. (필수)", { exact: true }).click();
  await page.getByText("개인정보처리방침에 동의합니다. (필수)", {
    exact: true,
  }).click();
  await expect(termsCheckbox).toBeChecked();
  await expect(privacyCheckbox).toBeChecked();
  await expect(continueButton).toBeEnabled();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(mobileOverflow).toBeLessThanOrEqual(1);
  await expect(termsCheckbox).toBeChecked();
  await expect(privacyCheckbox).toBeChecked();

  await continueButton.click();
  await expect(page).toHaveURL(/\/generate$/u);
});
