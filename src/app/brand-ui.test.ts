import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const source = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");

describe("STILLME UI brand contract", () => {
  it("uses STILLME across customer-facing app copy and metadata", () => {
    const customerFiles = [
      "src/app/layout.tsx",
      "src/app/page.tsx",
      "src/app/app-header.tsx",
      "src/app/login/page.tsx",
      "src/app/signup/page.tsx",
      "src/app/forgot-password/page.tsx",
      "src/app/reset-password/page.tsx",
      "src/app/verify-email/page.tsx",
      "src/app/generate/page.tsx",
      "src/app/generate/[service]/page.tsx",
      "src/app/generations/page.tsx",
      "src/app/account/page.tsx",
      "src/app/credits/page.tsx",
    ];

    const customerUi = customerFiles.map(source).join("\n");
    expect(customerUi).toContain("STILLME");
    expect(customerUi).not.toMatch(/AI PHOTO STUDIO|AI Photo Studio|AI Image Studio/u);
  });

  it("shows the compact studio hierarchy instead of a long marketing landing", () => {
    const home = source("src/app/page.tsx");
    const generate = source("src/app/generate/page.tsx");

    expect(home).toContain('className={styles.studioHero}');
    expect(home).toContain('className={styles.studioServiceGrid}');
    expect(home).toContain('className={styles.studioPopularGrid}');
    expect(home).toContain("category-catalog");
    expect(home).toContain("사진 한 장으로");
    expect(home).toContain("당신의 새로운 모습.");
    expect(home).not.toContain("AI가 만들어주는");
    expect(home).not.toContain("당신의 세로운 모습");
    expect(home).toContain("<StudioServiceIcon routeId=");
    expect(home).toContain('className={styles.studioHeroImage}');
    expect(home).toContain('className={styles.studioHeroCaption}');
    expect(home).toContain("<SiteHeader />");
    expect(source("src/app/site-header.tsx")).toContain('select("available_balance")');
    expect(source("src/app/app-header.tsx")).toContain("사용 가능 크레딧");
    for (const file of ["src/app/generate/page.tsx", "src/app/generate/[service]/page.tsx", "src/app/generations/page.tsx", "src/app/credits/page.tsx", "src/app/account/page.tsx", "src/app/auth-page-shell.tsx", "src/app/policy-page.tsx", "src/app/forgot-password/page.tsx", "src/app/reset-password/page.tsx"]) {
      expect(source(file), file).toContain("<SiteHeader />");
    }
    expect(home).not.toContain("MarketingHeader");
    expect(home).not.toContain("<ServiceShowcase");
    expect(home).not.toContain("landingHero");
    expect(generate).toContain("어떤 사진이");
    expect(generate).toContain("원본 특징 확인");
    expect(generate).toContain("서비스별 품질 검사");
  });

  it("keeps the shared header sticky and provides a reduced-motion path", () => {
    const globalCss = source("src/app/globals.css");
    const editorialCss = source("src/app/ux.module.css");

    expect(globalCss).toMatch(/\.app-header[\s\S]*?position:\s*sticky/u);
    expect(`${globalCss}\n${editorialCss}`).toContain("prefers-reduced-motion: reduce");
  });

  it("keeps the service showcase horizontally scrollable across viewports", () => {
    const showcase = source("src/app/service-showcase.tsx");
    const services = source("src/app/photo-services.ts");
    const editorialCss = source("src/app/ux.module.css");

    expect(showcase).toContain("data-service-carousel");
    expect(showcase).toContain("showcaseScrollCue");
    expect(showcase).toContain("여섯 가지 사진");
    expect(showcase).toContain("service.imageSrc");
    expect(services).toContain('imageSrc: "/images/mock/home/id-photo.webp"');
    expect(services).toContain('imageSrc: "/images/mock/home/executive.webp"');
    expect(services).toContain('imageSrc: "/images/mock/home/profile.webp"');
    expect(services).toContain('imageSrc: "/images/mock/home/underwater-portrait.webp"');
    expect(services).toContain('PROFILE_CATEGORIES as PROFILE_CATEGORY_CONFIGS');
    expect(services).toContain('routeId: category.id');
    expect(services).toContain('presetId: category.presetId');
    expect(services).toContain('defaultProfession: category.profession');
    expect(services).toContain('sampleKind: "mock"');
    expect(services).toContain('imageSrc: category.looks[0].sampleSrc');
    expect(showcase).toContain('실제 생성 결과가 아닙니다.');
    expect(services).not.toContain("placeholder.svg");
    expect(showcase).not.toMatch(/wheel|preventDefault/u);
    expect(editorialCss).toMatch(/\.showcaseCarousel[^}]*overflow-x:\s*auto/u);
    expect(editorialCss).toMatch(/\.showcaseCarousel[^}]*scroll-snap-type:\s*x mandatory/u);
    expect(editorialCss).toMatch(/\.showcaseCard[^}]*scroll-snap-align:\s*start/u);
    expect(editorialCss).toMatch(/\.showcaseCard[^}]*flex:\s*0 0 min\(76vw, 72rem\)/u);
    expect(editorialCss).not.toMatch(/\.showcaseFrame[\s\S]*?position:\s*sticky/u);
    expect(editorialCss).toMatch(/\.showcaseImageFrame[^}]*aspect-ratio:\s*3\s*\/\s*2/u);
    expect(editorialCss).toMatch(/\.showcaseImageFrame img[^}]*object-fit:\s*contain/u);
    expect(editorialCss).toMatch(/\.serviceEditorialItem \.resultChoiceImage[^}]*aspect-ratio:\s*3\s*\/\s*2/u);
    expect(editorialCss).toMatch(/\.serviceEditorialItem \.resultChoiceImage img[^}]*object-fit:\s*contain/u);
  });

  it("keeps the shared category cards responsive and the result comparison intact", () => {
    const css = source("src/app/ux.module.css");
    const form = source("src/app/generate/setup-form.tsx");
    const globalCss = source("src/app/globals.css");
    expect(css).toContain(".studioServiceGrid { display: grid");
    expect(css).toContain(".studioPopularGrid { display: grid");
    expect(css).toContain("@media (max-width: 48rem) { .studioServiceGrid");
    expect(css).toContain(".studioHeroImage { height: 100% !important");
    expect(css).toContain(".customizationLayout { align-items: start; display: grid");
    expect(css).toContain(".uploadStage { display: grid");
    expect(css).toContain("@media (max-width: 40rem)");
    expect(css).toContain(".studioPopularGrid { gap: .6rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }");
    expect(css).toContain(".lookGrid, .lookGrid:has(> :nth-child(3):last-child) { gap: .65rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }");
    expect(css).toContain(".resultMediaGrid { gap: 1rem; grid-template-columns: 1fr; }");
    expect(globalCss).toContain("@media (min-width: 52.01rem) and (max-width: 72rem)");
    expect(form).toContain('service.flow?.steps[0] === "look"');
    expect(form).toContain('service.flow?.steps[0] === "upload"');
    expect(form).toContain("업로드한 원본");
    expect(form).toContain('role="radiogroup"');
    expect(form).toContain("선택한 사진 저장하기");
    expect(form).not.toMatch(/00 \/ 원본|0[1-5] \/ 후보/u);
    expect(form).toContain("선택한 스타일 요약");
    expect(form).toContain("uploadSelectionSummary");
    expect(form).toContain("좋은 사진 예");
    expect(form).toContain("profileBackgroundPicker");
    expect(form).toContain('name={`candidateBackground${slot}`}');
    expect(form).not.toContain('name={`candidateRequest${slot}`}');
    expect(form.indexOf('aria-labelledby="profile-style-title"')).toBeLessThan(form.indexOf('aria-labelledby="upload-step-title"'));
    expect(source("src/app/generate/[service]/page.tsx")).toContain("sampleImageSrc: service.imageSrc");
  });

  it("shows generation progress once and styles result downloads as actions", () => {
    const generationForm = source("src/app/generate/setup-form.tsx");
    const generationPage = source("src/app/generate/[service]/page.tsx");
    const editorialCss = source("src/app/ux.module.css");

    expect(generationForm.match(/PROGRESS_MESSAGES\[progressIndex\]/gu)).toHaveLength(1);
    expect(generationForm).toContain('defaultValue={service.defaultProfession}');
    expect(generationForm).toContain('service.defaultStyleId ?? "auto"');
    expect(generationForm).toContain('FlowSelection');
    expect(generationForm).toContain('FlowOptions');
    const flowSteps = source("src/app/generate/flow-steps.tsx");
    expect(flowSteps).toContain('name={flow.selection?.field}');
    expect(flowSteps).toContain('name={group.field === "hairStyleId" ? undefined : group.field}');
    expect(generationPage).toContain('presetId: service.presetId');
    expect(generationPage).toContain('defaultProfession: service.defaultProfession');
    expect(generationPage).toContain('defaultStyleId: service.defaultStyleId');
    expect(generationForm).toContain('aria-live="polite"');
    expect(editorialCss).toMatch(/\.candidateGallery\s*\{[^}]*gap:/u);
    expect(editorialCss).toContain(".resultPhotoPicker:has(input:checked) .resultPhotoCheck");
    expect(editorialCss).toContain(".resultSaveAction { align-items: center");
  });

  it("publishes shared policy routes and links them from signup, credits, and footer", () => {
    const footer = source("src/app/site-footer.tsx");
    const layout = source("src/app/layout.tsx");
    const signup = source("src/app/signup/page.tsx");
    const credits = source("src/app/credits/page.tsx");
    const policyPage = source("src/app/policy-page.tsx");
    const policies = [
      "src/app/privacy/page.tsx",
      "src/app/terms/page.tsx",
      "src/app/refund-policy/page.tsx",
      "src/app/service-guide/page.tsx",
    ].map(source).join("\n");

    for (const route of ["/privacy", "/terms", "/refund-policy", "/service-guide"]) {
      expect(footer).toContain(route);
    }
    expect(layout).toContain("<SiteFooter />");
    expect(signup).toContain('name="termsAccepted"');
    expect(signup).toContain('name="privacyAccepted"');
    expect(credits).toContain('href="/refund-policy"');
    expect(policies).toContain("<PolicyPage");
    expect(policyPage).toContain("2026");
  });

  it("keeps consent choices inline and shows shared policies in independent accordions", () => {
    const consentPage = source("src/app/consent/page.tsx");
    const consentForm = source("src/app/consent/consent-form.tsx");
    const globalCss = source("src/app/globals.css");
    const terms = source("src/app/terms/page.tsx");
    const privacy = source("src/app/privacy/page.tsx");

    expect(consentPage).toContain("<ConsentForm");
    expect(consentForm).toContain('aria-expanded={open}');
    expect(consentForm).toContain('aria-controls={panelId}');
    expect(consentForm).toContain("setTermsOpen");
    expect(consentForm).toContain("setPrivacyOpen");
    expect(consentForm).not.toMatch(/href=["']\/(terms|privacy)/u);
    expect(consentForm).toContain("!termsAccepted || !privacyAccepted");
    expect(terms).toContain("<TermsPolicyContent />");
    expect(privacy).toContain("<PrivacyPolicyContent />");
    expect(globalCss).toMatch(/\.policy-consent-check\s*\{[^}]*align-items:\s*center/u);
    expect(globalCss).toMatch(/\.consent-policy-panel\s*\{[^}]*grid-template-rows:\s*0fr/u);
    expect(globalCss).toMatch(/\.consent-policy-panel\[data-open="true"\]\s*\{[^}]*grid-template-rows:\s*1fr/u);
  });
});
