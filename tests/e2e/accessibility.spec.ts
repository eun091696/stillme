import { expect, test } from "@playwright/test";

const publicRoutes = [
  {
    path: "/",
    title: "STILLME | 사진은 달라져도, 여전히 나",
    heading: /사진 한 장으로\s*더 나은 당신을 만드세요\./,
  },
  {
    path: "/login",
    title: "STILLME | 로그인",
    heading: "계정으로 계속하기",
  },
  {
    path: "/signup",
    title: "STILLME | 회원가입",
    heading: "계정 만들기",
  },
  {
    path: "/forgot-password",
    title: "STILLME | 비밀번호 찾기",
    heading: "비밀번호 찾기",
  },
  {
    path: "/verify-email",
    title: "STILLME | 이메일 인증",
    heading: "이메일을 확인해 주세요",
  },
] as const;

function linearizeChannel(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: [number, number, number]) {
  return (
    0.2126 * linearizeChannel(rgb[0]) +
    0.7152 * linearizeChannel(rgb[1]) +
    0.0722 * linearizeChannel(rgb[2])
  );
}

function contrastRatio(
  foreground: [number, number, number],
  background: [number, number, number],
) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test("public pages expose one named main landmark and one descriptive heading", async ({
  page,
}) => {
  for (const route of publicRoutes) {
    await page.goto(route.path);

    await expect(page).toHaveTitle(route.title);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      route.heading,
    );
    await expect(page.locator("h1")).toHaveCount(1);
  }
});

test("skip navigation and client route changes move focus to main content", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: "본문으로 건너뛰기" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await page.goto("/");
  await page.getByRole("link", { name: "로그인", exact: true }).click();
  await expect(page.locator("#main-content")).toBeFocused();
});

test("authentication forms retain visible labels and keyboard order", async ({
  page,
}) => {
  await page.goto("/signup");

  const email = page.getByLabel("이메일");
  const password = page.getByLabel("비밀번호", { exact: true });
  const passwordConfirmation = page.getByLabel("비밀번호 확인", {
    exact: true,
  });
  const kakao = page.getByRole("button", { name: "카카오로 계속하기" });
  const google = page.getByRole("button", { name: "Google로 계속하기" });
  const submit = page.getByRole("button", { name: "회원가입" });
  const form = page.locator(".auth-form");

  await expect(email).toBeVisible();
  await expect(password).toHaveAttribute("aria-describedby", "password-help");
  await expect(passwordConfirmation).toBeVisible();
  await expect(page.getByText("네이버로 계속하기")).toHaveCount(0);
  await expect(page.locator('input[type="tel"]')).toHaveCount(0);

  const nav = page.locator(".app-nav a");

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "본문으로 건너뛰기" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".app-brand")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(nav.nth(0)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(nav.nth(1)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(nav.nth(2)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(nav.nth(3)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(nav.nth(4)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".app-credit-pill")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".app-account-avatar")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(kakao).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(google).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(email).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(password).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "비밀번호 보기" }).first(),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(passwordConfirmation).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "비밀번호 보기" }).nth(1),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("checkbox", { name: /이용약관/u }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    form.getByRole("link", { name: "이용약관", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("checkbox", { name: /개인정보처리방침/u }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    form.getByRole("link", { name: "개인정보처리방침", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();
});

test("primary action contrast and narrow viewport reflow meet the UI baseline", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");

  const colors = await page
    .getByRole("link", { name: "사진 만들기", exact: true })
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const parse = (value: string) => {
        const channels = value.match(/\d+/g)?.slice(0, 3).map(Number);
        if (!channels || channels.length !== 3) {
          throw new Error(`Unsupported color: ${value}`);
        }
        return channels as [number, number, number];
      };

      return {
        foreground: parse(style.color),
        background: parse(style.backgroundColor),
      };
    });

  expect(contrastRatio(colors.foreground, colors.background)).toBeGreaterThanOrEqual(
    4.5,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.goto("/signup");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("desktop category catalog renders a static, non-sticky grid without widening the page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const catalog = page.locator("#category-catalog");
  const cards = catalog.locator("a[id^='category-']");
  await expect(cards).toHaveCount(4);
  await expect(catalog).not.toHaveCSS("position", "sticky");
  for (const href of [
    "/generate/profile",
    "/generate/id-photo",
    "/generate/character-avatar",
    "/generate/underwater-correction",
  ]) {
    await expect(catalog.locator(`a[href="${href}"]`)).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("mobile category catalog reflows into a narrower grid without widening the page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const catalog = page.locator("#category-catalog");
  const cards = catalog.locator("a[id^='category-']");
  await expect(catalog.getByRole("heading", { name: "어떤 사진이 필요하세요?" })).toBeVisible();
  await expect(cards).toHaveCount(4);
  await expect(cards.first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("mobile menu closes from backdrop, Escape, and navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const menu = page.locator("details.mobile-nav");
  const trigger = menu.locator("summary");
  await expect(trigger).toHaveText("MENU");
  await trigger.click();
  await expect(menu).toHaveAttribute("open", "");

  await menu.getByRole("button", { name: "메뉴 닫기" }).click();
  await expect(menu).not.toHaveAttribute("open", "");

  await trigger.click();
  await page.locator("main").click({ position: { x: 20, y: 20 } });
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(trigger).toBeFocused();

  await trigger.click();
  await menu.getByRole("link", { name: "프로필 사진" }).click();
  await expect(menu).not.toHaveAttribute("open", "");
  // Navigation closes the menu and preserves the protected destination for login.
  await expect(page).toHaveURL(/\/login\?next=%2Fgenerate%2Fprofile$/u);
});

test("reduced motion keeps the category catalog links available", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const catalog = page.locator("#category-catalog");
  await expect(catalog.locator('a[href="/generate/profile"]')).toBeVisible();
  await expect(catalog.locator('a[href="/generate/id-photo"]')).toBeVisible();
  await expect(catalog.locator('a[href="/generate/character-avatar"]')).toBeVisible();
  await expect(catalog.locator('a[href="/generate/underwater-correction"]')).toBeVisible();
});
