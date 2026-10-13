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

async function createTestUser() {
  const email = `e2e-generate-${crypto.randomUUID()}@example.test`;
  const password = `Test-${crypto.randomUUID()}-9a`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { display_name: "E2E Generate" },
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

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto("/login?next=/generate");
  await page.getByLabel("이메일").fill(user.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "로그인" }).click();
  // Do not accidentally accept /login?next=/generate while login is still pending.
  await expect(page).toHaveURL((url) => url.pathname === "/generate" && url.search === "");
  await expect(page.getByRole("link", { name: "내 계정", exact: true })).toBeVisible();
}

test.afterEach(async () => {
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
    createdUserIds.delete(userId);
  }
});

test("generate flow is authenticated and selects a service only once", async ({
  page,
}) => {
  await page.goto("/generate");
  await expect(page).toHaveURL(/\/login\?next=(?:%2F|\/)generate$/u);

  const user = await createTestUser();
  await login(page, user);

  await expect(
    page.getByRole("heading", { name: "어떤 사진이 필요하세요?" }),
  ).toBeVisible();
  const serviceHeadingSize = await page.getByRole("heading", {
    name: "어떤 사진이 필요하세요?",
  }).evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(serviceHeadingSize).toBeLessThanOrEqual(80);
  const serviceRoutes = [
    ["증명사진", "/generate/id-photo"],
    ["비즈니스 프로필", "/generate/business-profile"],
    ["일반 프로필", "/generate/profile"],
  ] as const;
  for (const [service, route] of serviceRoutes) {
    const card = page.getByRole("main").locator(`a[href="${route}"]`);
    await expect(card.getByRole("heading", { name: service, exact: true }))
      .toBeVisible();
    await expect(card).toHaveAttribute("href", route);
  }
  const serviceCard = page.getByRole("main").locator('a[href="/generate/id-photo"]');
  await expect(serviceCard.getByText(/^이 사진 만들기/u)).toBeVisible();
  const serviceCardStyle = await serviceCard.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      backgroundColor: style.backgroundColor,
      borderRadius: Number.parseFloat(style.borderRadius),
      width: rect.width,
      height: rect.height,
    };
  });
  expect(serviceCardStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(serviceCardStyle.borderRadius).toBeGreaterThanOrEqual(4);
  expect(serviceCardStyle.borderRadius).toBeLessThanOrEqual(12);
  expect(serviceCardStyle.width).toBeGreaterThanOrEqual(44);
  expect(serviceCardStyle.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByText("프리다이빙", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /여권사진/u })).toHaveCount(0);

  await serviceCard.click();
  // Keep the exact destination contract; allow bounded CI time for server navigation.
  await expect(page).toHaveURL(/\/generate\/id-photo$/u, { timeout: 15_000 });
  await expect(page.locator('input[name="presetId"]')).toHaveValue("resume-id");

  const servicePageHeadingSize = await page.getByRole("heading", {
    name: "증명사진 만들기",
  }).evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(servicePageHeadingSize).toBeLessThanOrEqual(84);

  // Current approved contract: id-photo is a 2-step flow (업로드 → 옵션), not per-slot options.
  const liveSteps = page.getByRole("list", { name: "현재 제작 단계" });
  const stepItems = liveSteps.getByRole("listitem");
  await expect(stepItems).toHaveCount(2);
  await expect(stepItems.nth(0)).toHaveText(/1\s*사진 업로드/u);
  await expect(stepItems.nth(1)).toHaveText(/2\s*옵션/u);
  await expect(liveSteps.locator('li[aria-current="step"]')).toHaveText(/사진 업로드/u);

  for (const headingName of ["사진을 올려주세요"]) {
    const heading = page.getByRole("heading", { name: headingName, exact: true });
    const section = heading.locator("xpath=ancestor::section");
    const alignment = await section.evaluate((element, title) => {
      const headingElement = [...element.querySelectorAll("h2")]
        .find((candidate) => candidate.textContent?.trim() === title);
      const numberElement = element.querySelector(":scope > div:first-child > span");
      if (!headingElement || !numberElement) throw new Error("Missing step heading");
      const headingRect = headingElement.getBoundingClientRect();
      const numberRect = numberElement.getBoundingClientRect();
      return Math.abs(
        (headingRect.top + headingRect.height / 2) -
        (numberRect.top + numberRect.height / 2),
      );
    }, headingName);
    expect(alignment).toBeLessThanOrEqual(6);
  }

  // Upload gates progression: next step must stay disabled (and keep a 44px tap target) until a photo is present.
  const nextStepButton = page.getByRole("button", { name: "다음 단계" });
  await expect(nextStepButton).toBeDisabled();
  const nextStepHeight = await nextStepButton.evaluate((element) => element.getBoundingClientRect().height);
  expect(nextStepHeight).toBeGreaterThanOrEqual(44);

  const idSourceInput = page.locator('input[name="sourceImage"]');
  await idSourceInput.setInputFiles({
    name: "id-source.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+3MxZ5wAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(page.getByAltText("업로드한 사진 미리보기")).toBeVisible();
  await expect(nextStepButton).toBeEnabled();
  await nextStepButton.click();

  await expect(liveSteps.locator('li[aria-current="step"]')).toHaveText(/옵션/u);
  for (const headingName of ["증명사진 옵션"]) {
    const heading = page.getByRole("heading", { name: headingName, exact: true });
    const section = heading.locator("xpath=ancestor::section");
    const alignment = await section.evaluate((element, title) => {
      const headingElement = [...element.querySelectorAll("h2")]
        .find((candidate) => candidate.textContent?.trim() === title);
      const numberElement = element.querySelector(":scope > div:first-child > span");
      if (!headingElement || !numberElement) throw new Error("Missing step heading");
      const headingRect = headingElement.getBoundingClientRect();
      const numberRect = numberElement.getBoundingClientRect();
      return Math.abs(
        (headingRect.top + headingRect.height / 2) -
        (numberRect.top + numberRect.height / 2),
      );
    }, headingName);
    expect(alignment).toBeLessThanOrEqual(6);
  }

  // idBackgroundId/idOutfitId/idTieId radiogroups replace the old per-slot background selects.
  const backgroundGroup = page.getByRole("group", { name: "배경", exact: true });
  const outfitGroup = page.getByRole("group", { name: "의상", exact: true });
  await expect(backgroundGroup.getByRole("radio", { name: "화이트" })).toBeChecked();
  await expect(outfitGroup.getByRole("radio", { name: "단정한 정장" })).toBeChecked();
  await expect(page.getByRole("group", { name: "넥타이 · 정장 선택 시" })).toBeVisible();

  // Current compact design uses .45rem, not the former 12px grid.
  // Check the actual spacing contract instead of dropping the layout guard.
  const optionGridSpacing = await backgroundGroup.locator("div").first()
    .evaluate((element) => ({
      gap: Number.parseFloat(getComputedStyle(element).columnGap),
      rootFontSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    }));
  expect(optionGridSpacing.gap).toBeCloseTo(optionGridSpacing.rootFontSize * 0.45, 1);
  const setupSpacing = await page.locator("form")
    .filter({ has: page.locator('input[name="presetId"]') })
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).rowGap));
  expect(setupSpacing).toBeGreaterThanOrEqual(10);

  // Changing outfit away from "suit" removes the tie group entirely (not just hides it) - a real conditional-field behavior to protect.
  await outfitGroup.getByRole("radio", { name: "셔츠 / 블라우스" }).click();
  await expect(page.getByRole("group", { name: "넥타이 · 정장 선택 시" })).toHaveCount(0);
  await backgroundGroup.getByRole("radio", { name: "라이트 그레이" }).click();

  // These radios are React-controlled; a native form reset must not revert the user's selection.
  await page.locator("form")
    .filter({ has: page.locator('input[name="presetId"]') })
    .evaluate((form) => {
      (form as HTMLFormElement).reset();
    });
  await expect(backgroundGroup.getByRole("radio", { name: "라이트 그레이" })).toBeChecked();
  await expect(outfitGroup.getByRole("radio", { name: "셔츠 / 블라우스" })).toBeChecked();
  await expect(page.getByAltText("업로드한 사진 미리보기")).toBeVisible();

  // id-photo has no free-text common request field; the current equivalent guidance is the flow note, and additionalRequest must stay absent (not silently invented).
  await expect(page.getByText(
    "머리 모양과 가르마는 원본 그대로 유지합니다. 공식 여권 규격 보장 서비스가 아닙니다.",
    { exact: true },
  )).toBeVisible();
  await expect(page.locator("#additionalRequest")).toHaveCount(0);

  const generateButton = page.getByRole("button", {
    name: "3장 생성하기 · 1 Credit",
  });
  await expect(generateButton).toBeEnabled();
  const generateButtonStyle = await generateButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      marginTop: Number.parseFloat(style.marginTop),
      height: element.getBoundingClientRect().height,
      backgroundColor: style.backgroundColor,
    };
  });
  expect(generateButtonStyle.marginTop).toBeGreaterThanOrEqual(2);
  expect(generateButtonStyle.height).toBeGreaterThanOrEqual(44);
  expect(generateButtonStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");

  await page.goto("/generate/business-profile");
  await expect(page.locator('input[name="presetId"]')).toHaveValue("business-profile");
  const profession = page.getByRole("textbox", { name: "직업", exact: true });
  await expect(profession).toBeVisible();
  await expect(profession).toHaveAttribute(
    "placeholder",
    "예: 의사, 건축가",
  );
  await profession.fill("개발자");
  const styleLabels = [
    "추천",
    "자연스러운",
    "세련된",
    "몽환적인",
    "모던",
    "고급스러운",
  ];
  const shootingStyle = page.getByRole("group", { name: "촬영 스타일", exact: true });
  for (const label of styleLabels) {
    await expect(shootingStyle.getByRole("radio", { name: label, exact: true }))
      .toBeVisible();
  }
  await expect(shootingStyle.getByRole("radio", { name: "추천", exact: true }))
    .toBeChecked();
  await shootingStyle.getByText("몽환적인", { exact: true }).click();
  await expect(shootingStyle.getByRole("radio", { name: "몽환적인", exact: true }))
    .toBeChecked();
  const sharedBackground = page.getByRole("group", { name: "배경 분위기", exact: true });
  await sharedBackground.getByText("오피스", { exact: true }).click();
  for (const slot of [1, 2, 3]) {
    await expect(page.locator(`input[name="candidateBackground${slot}"]`))
      .toHaveValue("office");
    await expect(page.locator(`select[name="candidateOutfit${slot}"]`))
      .toHaveCount(0);
    await expect(page.locator(`textarea[name="candidateRequest${slot}"]`))
      .toHaveCount(0);
  }

  // Current profile flow is style -> common options -> upload.
  const profileSteps = page.getByRole("list", { name: "현재 제작 단계" });
  await expect(profileSteps.getByRole("listitem")).toHaveCount(3);
  await page.getByRole("button", { name: "다음 단계" }).click();
  await expect(profileSteps.locator('li[aria-current="step"]')).toHaveText(/옵션/u);
  await page.getByLabel("추가 요청 (선택)", { exact: true })
    .fill("전체 후보의 표정을 자연스럽게 만들어 주세요.");
  await page.getByRole("button", { name: "다음 단계" }).click();
  await expect(profileSteps.locator('li[aria-current="step"]')).toHaveText(/사진 업로드/u);
  await expect(page.getByRole("button", { name: "3장 생성하기 · 1 Credit" })).toBeDisabled();

  const sourceInput = page.locator('input[name="sourceImage"]');
  await sourceInput.setInputFiles({
    name: "business-profile.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+3MxZ5wAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(page.getByRole("button", { name: "3장 생성하기 · 1 Credit" })).toBeEnabled();

  await page.locator("form")
    .filter({ has: page.locator("#additionalRequest") })
    .evaluate((form) => {
      (form as HTMLFormElement).reset();
    });

  await expect(page.getByAltText("업로드한 사진 미리보기")).toBeVisible();
  await expect(page.locator('textarea[name="additionalRequest"]'))
    .toHaveValue("전체 후보의 표정을 자연스럽게 만들어 주세요.");
  for (const slot of [1, 2, 3]) {
    await expect(page.locator(`input[name="candidateBackground${slot}"]`)).toHaveValue("office");
  }
  await page.getByRole("button", { name: "이전 단계" }).click();
  await expect(page.getByLabel("추가 요청 (선택)", { exact: true }))
    .toHaveValue("전체 후보의 표정을 자연스럽게 만들어 주세요.");
  await page.getByRole("button", { name: "이전 단계" }).click();
  await expect(profession).toHaveValue("개발자");
  await expect(shootingStyle.getByRole("radio", { name: "몽환적인", exact: true }))
    .toBeChecked();
  await expect(sharedBackground.locator('input[value="office"]')).toBeChecked();
  await expect(page).toHaveURL(/\/generate\/business-profile$/u);
  await expect(
    page.getByRole("navigation", { name: "스튜디오 메뉴" })
      .getByRole("link", { name: "프로필 사진", exact: true }),
  ).toHaveAttribute("aria-current", "location");
});

test("generate flow previews, replaces, removes, and validates uploads", async ({
  page,
}) => {
  const user = await createTestUser();
  await login(page, user);
  await page.getByRole("main").locator('a[href="/generate/id-photo"]').click();
  await expect(page).toHaveURL(/\/generate\/id-photo$/u);

  const input = page.locator('input[name="sourceImage"]');
  await input.setInputFiles({
    name: "portrait.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+3MxZ5wAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(page.getByAltText("업로드한 사진 미리보기")).toBeVisible();
  const nextStep = page.getByRole("button", { name: "다음 단계" });
  await expect(nextStep).toBeEnabled();

  const originalPreviewSrc = await page.getByAltText("업로드한 사진 미리보기").getAttribute("src");
  if (!originalPreviewSrc) throw new Error("Missing original upload preview");
  await input.setInputFiles({
    name: "portrait-replaced.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+3MxZ5wAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  // The input is deliberately cleared after selection to allow selecting the same file again.
  await expect(page.getByText("portrait-replaced.png", { exact: true })).toBeVisible();
  await expect(page.getByAltText("업로드한 사진 미리보기")).not.toHaveAttribute("src", originalPreviewSrc);
  await expect(page.getByAltText("업로드한 사진 미리보기")).toBeVisible();
  await expect(nextStep).toBeEnabled();

  await page.getByRole("button", { name: "사진 제거" }).click();
  await expect(page.getByAltText("업로드한 사진 미리보기")).toHaveCount(0);
  await expect(nextStep).toBeDisabled();

  await input.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(
    page.getByText("JPG, PNG, WEBP 형식의 사진을 선택해 주세요."),
  ).toBeVisible();
});
