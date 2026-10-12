import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";

const root = process.cwd();

const catalogs = {
  ".codex/rules": [
    "architecture", "backend", "frontend", "coding", "database", "git", "naming", "security", "testing",
    "deployment", "documentation", "typescript", "react", "nextjs", "supabase",
    "tailwind", "api", "ai", "performance", "logging", "monitoring", "validation",
  ],
  ".codex/workflows": [
    "feature", "bugfix", "hotfix", "release", "refactor", "migration",
    "documentation", "review",
  ],
  ".codex/templates": [
    "api", "component", "page", "hook", "service", "repository", "migration",
    "test", "feature",
  ],
  ".codex/prompts": [
    "architect", "backend", "frontend", "designer", "qa", "reviewer", "security",
    "devops", "product",
  ],
  ".codex/checklists": [
    "feature", "release", "deployment", "security", "database", "performance",
    "accessibility",
  ],
  ".codex/memory": ["project", "glossary", "decisions", "architecture", "roadmap"],
};

const docs = {
  "docs/01_Business/COMPETITOR_ANALYSIS.md": ["Competitor Analysis", "경쟁 제품과 대체 수단을 비교해 제품 포지셔닝을 관리합니다."],
  "docs/01_Business/KPI.md": ["Business KPI", "성장, 수익, 유지율을 측정하는 핵심 사업 지표를 정의합니다."],
  "docs/02_Product/DESIGN_SYSTEM.md": ["Design System", "디자인 토큰, 컴포넌트 상태, 접근성 기준을 관리합니다."],
  "docs/04_Engineering/AI_WORKFLOW.md": ["AI Development Workflow", "Codex 작업의 분류, 실행, 검증, 인계 절차를 정의합니다."],
  "docs/05_AI/IMAGE_POST_PROCESSING.md": ["Image Post Processing", "생성 이미지의 리사이즈, 최적화, 썸네일, 메타데이터 처리 기준을 정의합니다."],
  "docs/05_AI/MODEL_EVALUATION.md": ["Model Evaluation", "AI 모델의 품질, 비용, 지연 시간, 안전성을 비교하는 평가 체계를 정의합니다."],
  "docs/06_API/VERSIONING.md": ["API Versioning", "호환성을 유지하는 API 버전과 폐기 정책을 정의합니다."],
  "docs/07_Operations/MONITORING.md": ["Operations Monitoring", "운영 알림, 온콜, 에스컬레이션 기준을 정의합니다."],
  "docs/09_Security/THREAT_MODEL.md": ["Threat Model", "자산, 신뢰 경계, 공격 경로와 완화책을 관리합니다."],
  "docs/09_Security/AUTH_POLICY.md": ["Authentication Policy", "사용자와 관리자 인증 수명주기 정책을 정의합니다."],
  "docs/09_Security/SECRETS.md": ["Secrets Management", "비밀 값 생성, 저장, 회전, 폐기 정책을 정의합니다."],
  "docs/09_Security/RLS_POLICY.md": ["RLS Policy", "Supabase Row Level Security의 기본 거부 및 검증 규칙을 정의합니다."],
  "docs/09_Security/PRIVACY.md": ["Privacy", "개인정보와 생성 데이터의 수집, 처리, 권리 대응 원칙을 정의합니다."],
  "docs/10_Data/RETENTION.md": ["Data Retention", "데이터 유형별 보존 기간과 삭제 승인 정책을 정의합니다."],
  "docs/10_Data/BACKUP_POLICY.md": ["Data Backup Policy", "데이터 계층별 백업 주기와 복구 목표를 정의합니다."],
  "docs/10_Data/SCHEMA_HISTORY.md": ["Schema History", "DB 스키마 변경 이력과 호환성 영향을 기록합니다."],
  "docs/10_Data/MIGRATIONS.md": ["Database Migrations", "무중단 마이그레이션, 검증, 롤백 절차를 정의합니다."],
  "docs/11_Analytics/EVENTS.md": ["Analytics Events", "이벤트 명명, 속성, 개인정보 제한과 소유권을 정의합니다."],
  "docs/11_Analytics/FUNNEL.md": ["Product Funnel", "가입부터 유료 생성까지의 전환 퍼널을 정의합니다."],
  "docs/11_Analytics/DASHBOARD.md": ["Analytics Dashboard", "역할별 대시보드와 데이터 신뢰도 표시 기준을 정의합니다."],
  "docs/11_Analytics/METRICS.md": ["Product Metrics", "제품 지표의 계산식, 차원, 갱신 주기와 책임자를 정의합니다."],
  "docs/agents/AI_Engineer.md": ["AI Engineer Agent", "AI 모델, 프롬프트, 품질, 비용 최적화를 담당합니다."],
  "docs/agents/Database.md": ["Database Agent", "스키마, 쿼리, RLS, 마이그레이션과 백업을 담당합니다."],
  "docs/agents/Security.md": ["Security Agent", "위협 모델, 인증 정책, 비밀 값과 보안 검토를 담당합니다."],
  "docs/agents/Marketing.md": ["Marketing Agent", "포지셔닝, 캠페인, 획득 채널과 메시지를 담당합니다."],
  "docs/agents/Support.md": ["Support Agent", "고객 문의, 장애 공지, 피드백 분류와 지식 기반을 담당합니다."],
};

const playbooks = {
  "playbooks/SIGNUP_FAILURE.md": ["Signup Failure", "회원가입 실패를 진단하고 사용자 영향을 완화합니다."],
  "playbooks/LOGIN_FAILURE.md": ["Login Failure", "로그인 실패와 세션 장애를 진단합니다."],
  "playbooks/AI_GENERATION_FAILURE.md": ["AI Generation Failure", "AI 생성 실패, 크레딧 복구, 재처리를 수행합니다."],
  "playbooks/PAYMENT_FAILURE.md": ["Payment Failure", "결제 승인·검증·크레딧 반영 실패를 처리합니다."],
  "playbooks/SUPABASE_OUTAGE.md": ["Supabase Outage", "Supabase 장애 시 읽기·쓰기 영향과 복구를 관리합니다."],
  "playbooks/CLOUDFLARE_OUTAGE.md": ["Cloudflare Outage", "Cloudflare 서비스 장애의 영향을 격리합니다."],
  "playbooks/R2_OUTAGE.md": ["R2 Outage", "이미지 저장 및 다운로드 장애를 처리합니다."],
  "playbooks/DEPLOYMENT_ROLLBACK.md": ["Deployment Rollback", "실패한 배포를 검증된 버전으로 되돌립니다."],
  "playbooks/API_OUTAGE.md": ["API Outage", "API 오류율과 지연 시간 급증을 완화합니다."],
  "playbooks/DATABASE_OUTAGE.md": ["Database Outage", "DB 연결, 정합성, 성능 장애를 처리합니다."],
  "playbooks/REDIS_OUTAGE.md": ["Redis Outage", "Redis 도입 이후 캐시·큐 장애에 대비한 절차를 정의합니다."],
};

const special = {
  "CHANGELOG.md": ["Changelog", "저장소 전체의 사용자·개발자 영향 변경을 버전별로 기록합니다."],
  "docs/00_HOME.md": ["Documentation Home", "모든 회사 문서의 단일 진입점과 소유권 지도를 제공합니다."],
};

const rulePractices = {
  architecture: "도메인 경계를 명시하고 의존 방향을 UI → application → domain → infrastructure 순서로 유지합니다.",
  coding: "작은 책임, 명시적 타입, 검증된 경계, 처리된 오류와 테스트 가능한 부작용을 요구합니다.",
  backend: "입력 검증, 인증·인가, 도메인 처리, 영속화, 응답 변환을 분리하고 멱등성을 명시합니다.",
  frontend: "Server Component를 기본으로 사용하고 접근성, 반응형, 로딩·빈 상태·오류 상태를 함께 구현합니다.",
  database: "UUID, 외래 키, 인덱스, RLS, 감사 필드와 무중단 마이그레이션 계획을 요구합니다.",
  git: "관련 없는 변경을 보존하고 작은 커밋, 안전한 브랜치, 검증된 Push와 추적 가능한 Pull Request를 사용합니다.",
  naming: "도메인 용어집과 계층별 casing 규칙을 사용하고 이름 변경 시 모든 참조를 갱신합니다.",
  security: "기본 거부, 최소 권한, 서버 검증, 비밀 값 격리, 위협 모델 검토를 적용합니다.",
  testing: "도메인 단위 테스트, 경계 통합 테스트, 핵심 사용자 흐름 E2E와 회귀 테스트를 계층화합니다.",
  deployment: "스테이징 검증, 승인, 마이그레이션 순서, 상태 확인, 롤백 기준을 배포 전에 확정합니다.",
  documentation: "코드와 같은 Pull Request에서 소유자, 계약, 예외, 검증 결과와 상대 링크를 갱신합니다.",
  typescript: "strict mode를 유지하고 any, non-null assertion, 암시적 타입 단언을 경계에서 제한합니다.",
  react: "순수 렌더링, 단방향 데이터 흐름, 안정적인 key, 최소 Effect와 컴포넌트 책임 분리를 적용합니다.",
  nextjs: "App Router, Server Actions·Route Handlers 경계, 캐시 정책, 메타데이터와 오류 경계를 명시합니다.",
  supabase: "서버 클라이언트와 브라우저 클라이언트를 분리하고 모든 사용자 테이블에 검증된 RLS를 적용합니다.",
  tailwind: "디자인 토큰과 공용 컴포넌트를 우선하며 임의 값과 중복 클래스는 반복 패턴으로 승격합니다.",
  api: "버전, 인증, 스키마, 오류 코드, 멱등성, rate limit, 관측성 필드를 계약으로 관리합니다.",
  ai: "모델·프롬프트 버전, 안전 필터, 비용 한도, 재시도, 품질 평가와 크레딧 보상을 추적합니다.",
  performance: "예산을 설정하고 측정 근거 없이 최적화하지 않으며 서버·클라이언트·이미지 비용을 분리합니다.",
  logging: "구조화 로그와 요청 ID를 사용하고 비밀 값, 결제 정보, 개인정보, 원문 프롬프트를 제외합니다.",
  monitoring: "SLO 기반 지표, 사용자 영향 알림, 소유자, Runbook과 오탐 검토 주기를 연결합니다.",
  validation: "각 수용 기준에 직접 증거를 연결하고 문서, 타입, 린트, 빌드, 관련 테스트와 외부 상태를 검증합니다.",
};

const workflowSteps = {
  feature: "요구사항 → 설계 영향 → 구현 → 테스트 → 문서 → 리뷰 → 점진 배포",
  bugfix: "재현 → 영향 범위 → 원인 → 회귀 테스트 → 최소 수정 → 검증 → 회고",
  hotfix: "심각도 확인 → 승인 → 최소 패치 → 집중 검증 → 배포 → 모니터링 → 후속 정식 수정",
  release: "범위 동결 → 품질 게이트 → 마이그레이션 → 승인 → 배포 → 검증 → 릴리스 노트",
  refactor: "불변 동작 정의 → 특성 테스트 → 작은 변경 → 성능·기능 비교 → 문서 갱신",
  migration: "호환 단계 설계 → 백업 → 확장 → 데이터 이관 → 검증 → 전환 → 축소",
  documentation: "소유권 확인 → 원문 보존 → 이동·통합 → 링크 갱신 → 자동 검사 → 리뷰",
  review: "요구사항 → 안정성 → 보안 → 데이터 → 테스트 → 운영 → 문서 순으로 검토",
};

function titleFrom(path) {
  return basename(path, ".md")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function toc() {
  return `## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)`;
}

function standard({ title, overview, goals, requirements, implementation, checklist, related }) {
  return `# ${title}

${toc()}

## Overview

${overview}

## Goals

${goals}

## Requirements

${requirements}

## Implementation

${implementation}

## Checklist

${checklist}

## Related Documents

${related}
`;
}

function linkToHome(path) {
  if (path.startsWith("docs/")) {
    return relative(dirname(join(root, path)), join(root, "docs/00_HOME.md")).replaceAll("\\", "/") || "00_HOME.md";
  }
  return relative(dirname(join(root, path)), join(root, "README.md")).replaceAll("\\", "/") || "README.md";
}

function defaultDocument(path, title, overview) {
  const home = linkToHome(path);
  const isPlaybook = path.startsWith("playbooks/");
  return standard({
    title,
    overview,
    goals: isPlaybook
      ? "- 사용자 영향을 최소화합니다.\n- 안전하게 복구하고 재발 방지 근거를 남깁니다."
      : "- 팀 간 판단 기준을 통일합니다.\n- 구현과 운영 상태를 문서와 일치시킵니다.",
    requirements: isPlaybook
      ? "- 요청 ID, 사용자 영향, 시작 시각을 기록합니다.\n- 승인 없는 데이터 수정이나 파괴적 명령을 실행하지 않습니다."
      : "- 책임 Agent와 검토 Agent를 지정합니다.\n- 변경은 관련 코드, 테스트, 문서와 함께 검토합니다.",
    implementation: isPlaybook
      ? "1. 영향 범위와 심각도를 확인합니다.\n2. 최근 변경과 의존 서비스 상태를 확인합니다.\n3. 가장 안전한 완화책을 적용합니다.\n4. 복구와 데이터 정합성을 검증합니다.\n5. 타임라인과 후속 조치를 기록합니다."
      : "구체적인 정책, 계약, 예외와 승인 절차는 이 문서에서 버전 관리합니다.",
    checklist: "- [ ] 소유자가 내용을 검토했다.\n- [ ] 구현 또는 운영 상태와 일치한다.\n- [ ] 관련 테스트와 모니터링을 확인했다.",
    related: `- [${basename(home, ".md")}](${home})`,
  });
}

function sections(source) {
  const result = {};
  let current = "";
  for (const line of source.split("\n")) {
    const match = line.match(/^## (.+)$/);
    if (match) {
      current = match[1];
      result[current] = [];
    } else if (current) {
      result[current].push(line);
    }
  }
  return Object.fromEntries(Object.entries(result).map(([key, lines]) => [key, lines.join("\n").trim()]));
}

function normalize(path) {
  const absolute = join(root, path);
  const source = readFileSync(absolute, "utf8").trim();
  const parsed = sections(source);
  const title = source.match(/^# (.+)$/m)?.[1] ?? titleFrom(path);
  const overview = parsed.Overview || `${title}의 기준과 현재 결정을 관리합니다.`;
  const implementation = parsed.Implementation || parsed.Details || "세부 내용은 담당 Agent가 구현과 함께 갱신합니다.";
  const checklist = parsed.Checklist || "- [ ] 책임 Agent가 검토했다.\n- [ ] 구현 상태와 일치한다.";
  const related = parsed["Related Documents"] || `- [${basename(linkToHome(path), ".md")}](${linkToHome(path)})`;
  writeFileSync(absolute, standard({
    title,
    overview,
    goals: parsed.Goals || "- 안정성과 유지보수성을 우선합니다.\n- 팀 간 계약과 책임을 명확히 합니다.",
    requirements: parsed.Requirements || "- 기존 기능과 문서 내용을 보존합니다.\n- 변경 시 관련 문서와 검증 결과를 함께 갱신합니다.",
    implementation,
    checklist,
    related,
  }), "utf8");
}

for (const [directory, names] of Object.entries(catalogs)) {
  for (const name of names) {
    const path = `${directory}/${name}.md`;
    const title = titleFrom(path);
    const type = directory.split("/").at(-1);
    const overview = `${title} ${type}는 AI Photo Studio 팀의 반복 가능한 개발 기준을 제공합니다.`;
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    let implementation = "입력, 기대 출력, 제약, 검증 방법과 에스컬레이션 경계를 명시합니다.";
    let checklist = "- [ ] 범위와 소유자가 명확하다.\n- [ ] 보안·데이터·운영 영향을 검토했다.\n- [ ] 자동 검증과 수동 검증을 완료했다.";
    if (directory.endsWith("/rules")) implementation = rulePractices[name];
    if (directory.endsWith("/workflows")) implementation = workflowSteps[name].split(" → ").map((step, index) => `${index + 1}. ${step}`).join("\n");
    if (directory.endsWith("/templates")) implementation = `템플릿은 ${title}의 목적, 입력, 출력, 오류·예외, 보안 고려사항, 테스트, 관측성, 관련 문서 필드를 포함합니다.`;
    if (directory.endsWith("/prompts")) implementation = `${title} 역할은 제공된 근거를 우선하고 가정을 표시하며, 권한 밖의 변경을 만들지 않고 결과와 검증 근거를 함께 반환합니다.`;
    if (directory.endsWith("/checklists")) {
      implementation = `${title} 작업의 승인 게이트로 사용하며 미충족 항목은 담당자와 예외 승인 근거를 기록합니다.`;
      checklist = "- [ ] 요구사항과 완료 기준이 연결됐다.\n- [ ] 실패·롤백·보안 시나리오를 확인했다.\n- [ ] 코드, 테스트, 문서, 관측성을 검증했다.\n- [ ] 책임자와 승인자가 기록됐다.";
    }
    if (directory.endsWith("/memory")) implementation = `${title}의 현재 상태, 날짜, 근거 링크, 결정자, 영향 범위와 재검토 조건을 append-only 방식으로 기록합니다.`;
    writeFileSync(target, standard({
      title,
      overview,
      goals: "- 반복 작업의 판단 편차를 줄입니다.\n- 안정성, 추적성, 검증 가능성을 유지합니다.",
      requirements: "- 기존 기능과 공개 계약을 보존합니다.\n- 예외는 담당자, 만료 조건, 후속 작업과 함께 기록합니다.",
      implementation,
      checklist,
      related: `- [CODEX](${relative(dirname(target), join(root, "CODEX.md")).replaceAll("\\", "/")})`,
    }), "utf8");
  }
}

for (const collection of [docs, playbooks, special]) {
  for (const [path, [title, overview]] of Object.entries(collection)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    if (!existsSync(target)) writeFileSync(target, defaultDocument(path, title, overview), "utf8");
  }
}

const homePath = join(root, "docs/00_HOME.md");
if (!existsSync(homePath)) writeFileSync(homePath, standard({
  title: "Documentation Home",
  overview: "비즈니스, 제품, 아키텍처, 엔지니어링, AI, API, 운영, 보안, 데이터, 분석 문서의 단일 진입점입니다.",
  goals: "- 수천 개 문서로 확장 가능한 소유권 경계를 유지합니다.\n- 코드와 운영 상태를 추적 가능한 문서 계약으로 연결합니다.",
  requirements: "- 모든 링크는 상대경로를 사용합니다.\n- 각 문서는 책임자, 구현 기준, 검증 체크리스트를 포함합니다.",
  implementation: `| 영역 | 시작 문서 | 책임 |
| --- | --- | --- |
| Business | [PRODUCT](01_Business/PRODUCT.md) | CEO |
| Product | [FEATURES](02_Product/FEATURES.md) | PM |
| Architecture | [ARCHITECTURE](03_Architecture/ARCHITECTURE.md) | CTO |
| Engineering | [CODING_STANDARD](04_Engineering/CODING_STANDARD.md) | CTO, QA |
| AI | [MODELS](05_AI/MODELS.md) | AI Engineer |
| API | [REST](06_API/REST.md) | Backend |
| Operations | [RUNBOOK](07_Operations/RUNBOOK.md) | DevOps |
| Release | [MVP](08_Release/MVP.md) | PM, QA |
| Security | [THREAT_MODEL](09_Security/THREAT_MODEL.md) | Security |
| Data | [MIGRATIONS](10_Data/MIGRATIONS.md) | Database |
| Analytics | [EVENTS](11_Analytics/EVENTS.md) | PM, Marketing |
| Agents | [CEO](agents/CEO.md) | 전체 |`,
  checklist: "- [ ] 새 문서가 올바른 영역에 배치됐다.\n- [ ] 소유자와 검토자가 지정됐다.\n- [ ] 자동 링크 검사를 통과했다.",
  related: "- [README](../README.md)\n- [MASTER PLAN](../MASTER_PLAN.md)\n- [AGENTS](../AGENTS.md)\n- [CODEX](../CODEX.md)",
}), "utf8");

function markdownFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : extname(path) === ".md" ? [path] : [];
  });
}

const roots = [".codex", "docs", "playbooks"];
const rootMarkdown = ["README.md", "MASTER_PLAN.md", "CODEX.md", "AGENTS.md", "CHANGELOG.md"];
for (const path of rootMarkdown) {
  if (!existsSync(join(root, path))) {
    writeFileSync(join(root, path), defaultDocument(path, titleFrom(path), `${titleFrom(path)}의 저장소 기준을 관리합니다.`), "utf8");
  }
}

for (const path of [
  ...rootMarkdown,
  ...roots.flatMap((directory) => markdownFiles(join(root, directory)).map((file) => relative(root, file))),
]) {
  normalize(path);
}

for (const directory of ["tests", "playbooks"]) {
  mkdirSync(join(root, directory), { recursive: true });
}

const license = join(root, "LICENSE");
if (!existsSync(license)) {
  writeFileSync(license, `Copyright (c) 2026 AI Photo Studio\n\nAll rights reserved.\n`, "utf8");
}
