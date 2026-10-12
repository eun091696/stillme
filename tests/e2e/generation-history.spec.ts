import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { REQUIRED_POLICY_VERSION } from "../../src/lib/policies";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  throw new Error(
    "Start local Supabase and run E2E through `npm run test:e2e`.",
  );
}

const localSupabaseUrl = supabaseUrl;
const localServiceRoleKey = serviceRoleKey;
const admin = createClient(localSupabaseUrl, localServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = new Set<string>();

async function createTestUser(label: string) {
  const nonce = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  const email = `e2e-${label}-${nonce}@example.test`;
  const password = `Test-${crypto.randomUUID()}-9a`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { display_name: `E2E ${label}` },
  });

  if (error) {
    throw error;
  }
  const { error: consentError } = await admin.rpc(
    "record_required_policy_consents",
    {
      target_policy_version: REQUIRED_POLICY_VERSION,
      target_user_id: data.user.id,
    },
  );
  if (consentError) throw consentError;

  createdUserIds.add(data.user.id);
  return { email, id: data.user.id, password };
}

async function seedJob(
  client: SupabaseClient,
  userId: string,
  options: {
    prompt: string;
    status: "failed" | "processing" | "succeeded";
  },
) {
  const jobId = crypto.randomUUID();
  const { error } = await client.from("generation_jobs").insert({
    id: jobId,
    user_id: userId,
    idempotency_key: crypto.randomUUID(),
    prompt: options.prompt,
    style: "photographic",
    aspect_ratio: "1:1",
    model_id: "imagen-3",
    provider_model: "imagen-3.0-generate-002",
    adapter_version: "google-v1",
    prompt_template_version: "prompt-v1",
    status: options.status,
    attempt_count: options.status === "processing" ? 1 : 0,
    last_error_code:
      options.status === "failed" ? "PROVIDER_UNAVAILABLE" : null,
  });

  if (error) {
    throw error;
  }

  return jobId;
}

async function seedAvailableAsset(
  client: SupabaseClient,
  userId: string,
  jobId: string,
) {
  const assetId = crypto.randomUUID();
  const { error } = await client.from("assets").insert({
    id: assetId,
    generation_job_id: jobId,
    user_id: userId,
    storage_key: `users/${userId}/generation-jobs/${jobId}/assets/${assetId}/original.png`,
    status: "available",
    mime_type: "image/png",
    checksum_sha256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    byte_size: 68,
    width: 1,
    height: 1,
  });

  if (error) {
    throw error;
  }
}

async function login(
  page: Page,
  user: { email: string; password: string },
) {
  await page.goto("/login?next=/generations");
  await page.getByLabel("이메일").fill(user.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/generations$/u);
}

test.afterEach(async () => {
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      throw error;
    }
    createdUserIds.delete(userId);
  }
});

test("home actions follow authentication state and default login opens generation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "로그인", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("banner").getByRole("link", { name: "내 계정", exact: true }),
  ).toHaveCount(0);

  const user = await createTestUser("home-actions");
  await page.goto("/login");
  await page.getByLabel("이메일").fill(user.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/generate$/u);
  await expect(
    page.getByRole("heading", { name: "어떤 사진이 필요하세요?" }),
  ).toBeVisible();
  await expect(page.getByRole("main").locator('a[href="/generate/id-photo"]')).toBeVisible();
  const studioNav = page.getByRole("navigation", { name: "스튜디오 메뉴" });
  await expect(
    studioNav.getByRole("link", { name: "내 사진", exact: true }),
  ).toHaveAttribute("href", "/generations");

  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "로그인", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("banner").getByRole("link", { name: "내 계정", exact: true })).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: "사진 만들기", exact: true }),
  ).toHaveAttribute("href", "/generate");
});

test("HIST-001 protects history, renders an empty state, and logs out", async ({
  page,
}) => {
  await page.goto("/generations");
  await expect(page).toHaveURL(/\/login\?next=%2Fgenerations$/u);

  const user = await createTestUser("empty");
  await login(page, user);
  await expect(
    page.getByRole("heading", { name: "아직 생성한 이미지가 없습니다." }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "스튜디오 메뉴" })
      .getByRole("link", { name: "내 사진" }),
  ).toHaveAttribute("aria-current", "page");

  const accountLink = page.getByRole("banner").getByRole("link", { name: "내 계정", exact: true });
  await accountLink.click();
  await expect(accountLink).toHaveAttribute("aria-current", "page");
  const logoutButton = page.getByRole("button", { name: "로그아웃" }).first();
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();
  await expect(page).toHaveURL(/\/login$/u);

  await page.goto("/generations");
  await expect(page).toHaveURL(/\/login\?next=%2Fgenerations$/u);
});

test("PAY-001 protects the Credit store and renders the server catalog", async ({
  page,
}) => {
  await page.goto("/credits");
  await expect(page).toHaveURL(/\/login\?next=%2Fcredits$/u);

  const user = await createTestUser("credits");
  await login(page, user);
  const creditLink = page.getByRole("banner").getByRole("link", {
    name: /^(사용 가능 크레딧 \d+개|크레딧 확인)$/u,
  });
  await creditLink.click();
  await expect(page).toHaveURL(/\/credits$/u);
  await expect(
    page.getByRole("heading", { name: /필요한 만큼,\s*간결하게/u }),
  ).toBeVisible();
  await expect(
    creditLink,
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "구매하기" })).toHaveCount(3);
});

test("GEN-002 and HIST-001 show bounded states without cross-user data", async ({
  page,
}) => {
  const owner = await createTestUser("owner");
  const other = await createTestUser("other");
  const ownerPrompt = "id-photo.resume-id";
  const otherPrompt = `타 사용자 비공개 이력 ${crypto.randomUUID()}`;

  await seedJob(admin, owner.id, {
    prompt: ownerPrompt,
    status: "processing",
  });
  await seedJob(admin, owner.id, {
    prompt: "business-profile",
    status: "failed",
  });
  const succeededJobId = await seedJob(admin, owner.id, {
    prompt: "profile-photo",
    status: "succeeded",
  });
  await seedAvailableAsset(admin, owner.id, succeededJobId);
  await seedJob(admin, other.id, {
    prompt: otherPrompt,
    status: "succeeded",
  });

  await login(page, owner);

  await expect(page.getByRole("heading", { name: "증명사진" })).toBeVisible();
  await expect(page.getByText("생성 중")).toBeVisible();
  await expect(
    page.getByText("이미지 생성 서비스에 일시적인 문제가 발생했습니다."),
  ).toBeVisible();
  await expect(page.getByText(otherPrompt)).toHaveCount(0);
  await expect(page.getByRole("list", { name: "최근 생성 이력" })).toBeVisible();
  await expect(page.getByAltText("프로필 사진 후보 1")).toHaveAttribute(
    "src",
    /\/api\/assets\/.+\/download\?preview=1/u,
  );
  await expect(page.getByRole("link", { name: "다시 만들기" })).toHaveAttribute(
    "href",
    "/generate/business-profile",
  );
  await expect(
    page.getByRole("main").getByRole("link", { name: "내 계정" }),
  ).toHaveCount(0);

  const archiveTitle = page.getByRole("heading", { name: "사진 보관함" });
  await expect(archiveTitle).toBeVisible();
  expect(
    await archiveTitle.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    ),
  ).toBeLessThanOrEqual(56);
  const galleryGap = await page.locator(".generation-gallery")
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).columnGap));
  // Approved compact archive uses a .75rem gap; keep its spacing and check the 44px download target separately.
  expect(galleryGap).toBeGreaterThanOrEqual(12);
  const downloadLink = page.getByRole("link", { name: "사진 1 다운로드" });
  const downloadStyle = await downloadLink.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderRadius: Number.parseFloat(style.borderRadius),
      height: element.getBoundingClientRect().height,
    };
  });
  expect(downloadStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(downloadStyle.borderRadius).toBeGreaterThanOrEqual(4);
  expect(downloadStyle.borderRadius).toBeLessThanOrEqual(8);
  expect(downloadStyle.height).toBeGreaterThanOrEqual(44);
  await downloadLink.click();
  await expect(page).toHaveURL(/\/generations\?error=download_unavailable$/u);
  await expect(
    page.getByRole("alert").filter({
      hasText: "다운로드를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    }),
  ).toBeVisible();
});
