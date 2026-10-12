import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { REQUIRED_POLICY_VERSION } from "../../src/lib/policies";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const mailpitUrl = process.env.SUPABASE_TEST_MAILPIT_URL;

if (!supabaseUrl || !serviceRoleKey || !mailpitUrl) {
  throw new Error(
    "Start local Supabase and run E2E through `npm run test:e2e`.",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = new Set<string>();

type MailpitSummary = {
  ID: string;
  To: Array<{ Address: string }>;
};

type MailpitList = {
  messages: MailpitSummary[];
};

type MailpitMessage = {
  HTML?: string;
  Text?: string;
};

async function createRecoveryUser() {
  const email = `e2e-recovery-${crypto.randomUUID()}@example.test`;
  const password = `Old-${crypto.randomUUID()}-9a`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { display_name: "E2E Recovery" },
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

function extractRecoveryUrl(message: MailpitMessage): string | null {
  const content = `${message.HTML ?? ""}\n${message.Text ?? ""}`.replaceAll(
    "&amp;",
    "&",
  );
  const urls = content.match(/https?:\/\/[^\s"'<>]+/gu) ?? [];
  return (
    urls.find(
      (url) =>
        url.includes("/auth/v1/verify") &&
        url.includes("type=recovery"),
    ) ?? null
  );
}

async function waitForRecoveryUrl(email: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const listResponse = await fetch(`${mailpitUrl}/api/v1/messages`);
    if (!listResponse.ok) throw new Error("Local Mailpit listing failed.");
    const list = (await listResponse.json()) as MailpitList;
    const summary = list.messages.find((message) =>
      message.To.some(({ Address }) => Address === email),
    );

    if (summary) {
      const messageResponse = await fetch(
        `${mailpitUrl}/api/v1/message/${encodeURIComponent(summary.ID)}`,
      );
      if (!messageResponse.ok) {
        throw new Error("Local Mailpit message lookup failed.");
      }
      const recoveryUrl = extractRecoveryUrl(
        (await messageResponse.json()) as MailpitMessage,
      );
      if (recoveryUrl) return recoveryUrl;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Local recovery email was not delivered.");
}

test.afterEach(async () => {
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
    createdUserIds.delete(userId);
  }
});

test("password recovery uses a one-time email and globally ends the recovery session", async ({
  page,
}) => {
  const user = await createRecoveryUser();
  const newPassword = `New-${crypto.randomUUID()}-9a`;

  await page.goto("/forgot-password");
  await page.getByLabel("이메일").fill(user.email);
  await page.getByRole("button", { name: "재설정 이메일 보내기" }).click();
  await expect(
    page.getByText("계정이 존재하면 비밀번호 재설정 이메일을 보냈습니다."),
  ).toBeVisible();

  const recoveryUrl = await waitForRecoveryUrl(user.email);
  await page.goto(recoveryUrl);
  await expect(page).toHaveURL(/\/reset-password$/u);
  await page.getByLabel("새 비밀번호", { exact: true }).fill(newPassword);
  await page.getByLabel("새 비밀번호 확인").fill(newPassword);
  await page.getByRole("button", { name: "비밀번호 변경" }).click();

  await expect(page).toHaveURL(/\/login\?message=/u);
  await expect(
    page.getByText("비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요."),
  ).toBeVisible();

  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount$/u);

  await page.getByLabel("이메일").fill(user.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/account$/u);

  await page.context().clearCookies();
  await page.goto(recoveryUrl);
  await expect(page).toHaveURL(/\/login\?error=/u);
  await expect(page.getByRole("heading", { name: "새 비밀번호 설정" })).toHaveCount(
    0,
  );
});

test("password reset request keeps account existence private", async ({
  page,
}) => {
  await page.goto("/forgot-password");
  await page
    .getByLabel("이메일")
    .fill(`absent-${crypto.randomUUID()}@example.test`);
  await page.getByRole("button", { name: "재설정 이메일 보내기" }).click();

  await expect(
    page.getByText("계정이 존재하면 비밀번호 재설정 이메일을 보냈습니다."),
  ).toBeVisible();
});
