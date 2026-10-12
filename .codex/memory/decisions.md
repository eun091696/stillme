# Decisions

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

Decisions memory는 AI Photo Studio 팀의 반복 가능한 개발 기준을 제공합니다.

## Goals

- 반복 작업의 판단 편차를 줄입니다.
- 안정성, 추적성, 검증 가능성을 유지합니다.

## Requirements

- 기존 기능과 공개 계약을 보존합니다.
- 예외는 담당자, 만료 조건, 후속 작업과 함께 기록합니다.

## Implementation

Decisions의 현재 상태, 날짜, 근거 링크, 결정자, 영향 범위와 재검토 조건을 append-only 방식으로 기록합니다.

### 2026-07-25 — BIZ-001 Commercial Policy Approval Gate

**Status:** `PROPOSED`

**Owner:** CEO

**Reviewers:** PM, CTO, Backend, Security, QA

**Context:** MVP는 선불 크레딧 구매, AI 이미지 생성과 실패 복구를 요구하지만 승인된 가격 숫자, 생성별 소비량, 만료 조건과 고객 환불 약관이 저장소에 없습니다. 제공자 원가, 결제 수수료, 법률·회계 검토 근거도 아직 기록되지 않았습니다.

**Decision:** 구현 안전성에 필요한 서버 기준 상품 카탈로그, 불변 크레딧 원장, 멱등 결제·환불 상태 모델은 제안 기준으로 문서화합니다. 상업적 숫자와 고객 환불 조건은 [Pricing](../../docs/01_Business/PRICING.md), [Credits](../../docs/01_Business/CREDITS.md), [Payments](../../docs/01_Business/PAYMENTS.md)의 Decision ID가 CEO와 필요한 reviewer에게 승인될 때까지 활성화하지 않습니다.

**Impact:** Backend와 Frontend는 승인 전 임의 SKU, 가격, 무료 지급량, 소비량, 만료 또는 환불 계산식을 하드코딩할 수 없습니다. 결제 기능 개발은 상태·보안 설계까지 가능하지만 운영 카탈로그와 고객 약관 활성화는 차단됩니다.

**Revisit Trigger:** 모델별 단위 원가, R2·결제·지원 비용, 출시 마진 하한과 법률 검토 결과가 준비되거나 CEO가 Decision ID별 값을 승인할 때 재검토합니다.

#### Evidence Update — 2026-07-25

공식 공급자와 법령 근거를 검토해 Decision ID별 출시 권고값을 각 정책 문서에 추가했습니다.

| Evidence | Verified fact | Source |
| --- | --- | --- |
| Google Gemini API pricing | Gemini 2.5 Flash Image standard output `$0.039/image`; Gemini 3 Pro Image standard 1K/2K `$0.134`, 4K `$0.24` | `https://ai.google.dev/gemini-api/docs/pricing` |
| Cloudflare R2 pricing | Standard storage `$0.015/GB-month`, Class A `$4.50/million`, Class B `$0.36/million`, direct egress free | `https://developers.cloudflare.com/r2/pricing/` |
| Toss Payments fees | General domestic card fee 3.4%, fee VAT 10% separate; contract-specific terms may vary | `https://www.tosspayments.com/about/fee` |
| Korean E-Commerce Act Article 17 | Contract mismatch withdrawal window includes three months from supply or 30 days from awareness | `https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1022341977` |
| Korean E-Commerce Act Article 18 | Valid digital-content withdrawal refund is due within three business days from withdrawal | `https://law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1027063343` |

**Recommendation Status:** `OWNER_APPROVED_LEGAL_REVIEW_REQUIRED`

The recommendation uses a conservative USD/KRW stress rate rather than claiming a live exchange rate. The repository owner approved the commercial values on 2026-07-26 by instructing Codex to continue after the recommendation and approval boundary were reported. Customer refund terms still require legal review before publication or production activation.

#### Approval Record — 2026-07-26

**Approver:** Repository owner

**Approved scope:** `PRICE-001`–`PRICE-004`, `CREDIT-001`–`CREDIT-005`, and the product-policy baseline for `PAYMENT-001`–`PAYMENT-005`.

**Approval evidence:** User instruction `Continue` following the reported launch values, official-source evidence, and explicit statement that CEO and legal approval were the remaining boundary.

**Excluded claim:** No legal professional review, Toss merchant-contract review, production activation, or customer-terms publication is claimed.

### 2026-07-26 — UI-001 Design System and Accessibility Baseline

**Status:** `APPROVED`

**Owner:** Designer

**Reviewers:** PM, Frontend, QA

**Context:** 기존 문서는 mobile-first, light/dark theme와 일부 component 이름만 포함했고 색상 토큰, component state, keyboard contract, responsive behavior와 검증 가능한 접근성 기준이 없었습니다.

**Decision:** `ui-v1`은 WCAG 2.2 Level AA를 최소 기준으로 사용합니다. 의미 기반 light/dark color tokens, 4px spacing scale, typography, 44px 기본 control, 24×24px 최소 pointer target, 2px visible focus, responsive DOM order, reduced motion, form error와 async status contract를 승인합니다.

**Evidence:** W3C는 최신 WCAG 버전 사용을 권장하며 WCAG 2.2는 2023-10-05 Recommendation으로 게시됐습니다. Level AA target minimum은 24×24 CSS px이며 non-text UI contrast는 3:1 이상입니다. 접근성 근거는 다음 공식 자료를 사용했습니다.

- `https://www.w3.org/TR/WCAG22/`
- `https://www.w3.org/WAI/standards-guidelines/wcag/`
- `https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum`
- `https://www.w3.org/WAI/WCAG22/understanding/non-text-contrast.html`
- `https://www.w3.org/WAI/ARIA/apg/patterns/`

**Approval:** 저장소 소유자가 `Continue MASTER_PLAN` 실행을 승인했고 Designer·CTO 역할로 기준의 일관성과 구현 가능성을 검토했습니다.

**Impact:** 새 UI는 [Design System](../../docs/02_Product/DESIGN_SYSTEM.md)과 [UI Guide](../../docs/02_Product/UI_GUIDE.md)를 따라야 합니다. 문서 승인은 실제 화면의 WCAG 준수를 증명하지 않으며 구현 PR은 자동·수동 검증 증거를 제공해야 합니다.

**Revisit Trigger:** WCAG 기준 변경, 새 theme, token breaking change, custom widget 도입 또는 접근성 회귀 발생 시 새 version과 migration note로 재검토합니다.

### 2026-07-26 — AN-001 KPI and Analytics Baseline

**Status:** `APPROVED`

**Owner:** CEO

**Operational Owner:** PM

**Reviewers:** CTO, Marketing, Backend, Database, Security, QA

**Context:** MVP user stories name measurement signals, but the repository did not define a north-star metric, stable formulas, event schemas, cohort windows, sample gates, dashboard quality states, or privacy-limited analytics properties. Implementing against those placeholders would allow client events, denominator drift, duplicate outcomes, or sensitive content to become business truth.

**Proposal:** Adopt `analytics-v1` as the launch measurement contract. Weekly value-realizing creators is the north star. Activation, time to first image, download, retention, paid conversion, reliability, payment, contribution, credit integrity, and data quality use canonical metric IDs. Business outcomes use trusted server or verified provider facts; low samples, incomplete windows, stale data, and failed reconciliation cannot be published as healthy.

**Target Policy:** Initial targets are internal launch hypotheses, not external benchmarks. Each target has a qualified sample and window. The first four complete weeks establish the north-star baseline, and targets are revisited after 30 days of qualified production data or a material product change.

**Privacy Boundary:** Analytics prohibits credentials, direct identifiers, full prompts, image content, signed URLs, payment details, tokens, free-form errors, request bodies, and sensitive small segments. Approval does not authorize collection until access, retention, consent where applicable, prohibited-field tests, and security review are implemented.

**Impact:** Future instrumentation, transformations, experiments, dashboards, and KPI decisions must use [Business KPI](../../docs/01_Business/KPI.md), [Analytics Events](../../docs/11_Analytics/EVENTS.md), [Product Metrics](../../docs/11_Analytics/METRICS.md), [Product Funnel](../../docs/11_Analytics/FUNNEL.md), and [Analytics Dashboard](../../docs/11_Analytics/DASHBOARD.md).

**Approval Record:** The repository owner approved `analytics-v1` for CEO and PM on 2026-07-26 by instructing Codex to continue after the complete target scorecard, internal-hypothesis limitation, validation evidence, and explicit approval boundary were reported. CTO review confirmed that the definitions are internally traceable and implementable as contracts.

**Excluded Claim:** No analytics vendor, event producer, consent mechanism, retention policy implementation, data pipeline, transformation, dashboard, production baseline, or achieved KPI is claimed. Each remains subject to the affected engineering, data, security, privacy, and QA gates.

**Revisit Trigger:** Thirty days of qualified production data, KPI sample failure, event schema break, pricing or funnel change, privacy finding, metric integrity incident, or target change.

### 2026-07-26 — SEC-001 Threat Model and Security Control Baseline

**Status:** `APPROVED`

**Owner:** Security Engineer

**Approver:** CTO and repository owner

**Reviewers:** Backend, Frontend, Database, AI Engineer, DevOps, QA, PM

**Context:** The repository identified Supabase, Vercel, Cloudflare R2, Toss Payments, Google AI, user prompts/images, payments, credits, and future privileged operations but security documents contained no actionable trust boundaries, risk register, control IDs, negative-test matrix, exception policy, or distinction between design and verified implementation.

**Proposal:** Adopt `security-v1` and threat model `TM-001`. Use STRIDE plus abuse, privacy, financial-integrity, and supply-chain analysis. Require server identity and authorization at every sensitive entry point, default-deny RLS and explicit grants, isolated bypass credentials, immutable economic state, private object storage, privacy-limited telemetry, bounded AI cost, secret lifecycle controls, security headers, negative tests, incident readiness, and time-bound risk exceptions.

**Risk Position:** Critical residual risk cannot ship. High residual risk requires written Security and CTO approval, compensating control, containment plan, named owner, and expiry within 30 days. Documentation approval leaves every runtime control in `REQUIRED` state until implementation and production-like evidence move it to `VERIFIED`.

**Official Evidence:**

- `https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html`
- `https://nextjs.org/docs/15/app/guides/data-security`
- `https://nextjs.org/docs/app/guides/authentication`
- `https://supabase.com/docs/guides/database/postgres/row-level-security`
- `https://supabase.com/docs/guides/api/securing-your-api`
- `https://supabase.com/docs/guides/auth/server-side/creating-a-client`
- `https://developers.cloudflare.com/r2/api/s3/presigned-urls/`
- `https://docs.tosspayments.com/guides/v2/get-started/payment-flow`

**Approval Record:** The repository owner approved `security-v1` for Security and CTO on 2026-07-26 by instructing Codex to continue after the complete threat/control summary, official-source evidence, validation results, residual-risk policy, and explicit approval boundary were reported. CTO review confirmed internal traceability across trust boundaries, threats, controls, negative tests, and release gates.

**Excluded Claim:** No production launch, legal/privacy compliance, retention period, exact API/webhook contract, signed URL TTL, authentication, RLS migration, security header, rate limit, secret inventory, provider configuration, monitoring, incident exercise, or implemented control is approved as complete. Runtime controls remain `REQUIRED` until production-like evidence marks them `VERIFIED`.

**Impact:** Future architecture, feature, migration, provider, data, and release work must map affected `THR-*` and `CTL-*` identifiers and supply the evidence required by the [Security Checklist](../checklists/security.md).

**Revisit Trigger:** New trust boundary, provider, privileged role, sensitive data, exposed endpoint, critical/high incident, material framework/provider guidance change, or accepted-risk expiry.

### 2026-07-26 — API-001 Versioned API and Idempotency Contract

**Status:** `APPROVED`

**Owner:** Backend Engineer

**Approver:** CTO

**Reviewers:** Frontend, Database, Security, QA, PM

**Context:** The repository listed unversioned endpoint ideas and one-line rules but did not define compatible evolution, success/error shapes, authorization inputs, replay behavior, request fingerprints, provider callback authenticity, durable receipt, ordering, or reconciliation. Implementing payments, credits, or generation without these contracts could create cross-user disclosure and duplicate economic effects.

**Decision:** Adopt `api-v1` under `/api/v1`. Use HTTP semantics, RFC 9457 `application/problem+json`, stable error codes, minimum DTOs, cursor pagination, server identity/resource/state authorization, UUID v4 `Idempotency-Key`, canonical semantic fingerprints, exact terminal replay, changed-payload conflict, processing conflict, and domain uniqueness independent of response-cache expiry.

**Webhook Decision:** Persist a unique verified inbox receipt before acknowledgement, process asynchronously and idempotently, reject or quarantine changed replay, and reconcile delayed/out-of-order or ambiguous provider state. Do not invent a signature where a provider event type does not offer one; Toss payment truth is re-queried and compared with the stored actor, order, amount, currency, key, and allowed status before economic effect.

**Compatibility:** Breaking request, response, enum, authorization, economic, or idempotency semantics require a new major API or an explicit migration. Externally consumed stable versions receive at least 90 days of sunset after a successor, except documented urgent security containment.

**Official Evidence:**

- `https://www.rfc-editor.org/rfc/rfc9110.html`
- `https://www.rfc-editor.org/rfc/rfc9457.html`
- `https://nextjs.org/docs/15/app/getting-started/route-handlers-and-middleware`
- `https://supabase.com/docs/guides/auth/server-side/creating-a-client`
- `https://docs.tosspayments.com/guides/v2/get-started/payment-flow`
- `https://docs.tosspayments.com/guides/v2/get-started/llms-quick-reference`

**Impact:** Future API and provider integration work must follow [API Architecture](../../docs/03_Architecture/API.md), [REST](../../docs/06_API/REST.md), [Versioning](../../docs/06_API/VERSIONING.md), [Errors](../../docs/06_API/ERROR_CODES.md), [Authorization](../../docs/06_API/AUTHORIZATION.md), and [Webhooks](../../docs/06_API/WEBHOOKS.md).

**Excluded Claim:** No endpoint, schema artifact, database record, RLS policy, provider adapter, webhook inbox, rate limit, or API test is implemented. Exact storage paths/signed URL TTL and data retention remain owned by later milestones.

**Revisit Trigger:** First API implementation, breaking consumer need, new provider callback, changed Toss contract, new privileged action, economic invariant change, or security incident.

### 2026-07-26 — STO-001 Private Object Lifecycle and Deletion Contract

**Status:** `APPROVED`

**Owners:** Backend Engineer and DevOps Engineer

**Approvers:** CTO and Security Engineer

**Reviewers:** AI Engineer, Database Engineer, QA, PM, Document Writer

**Context:** The repository named Cloudflare R2 and generic `users/generated/thumbnails` paths but did not isolate environments, prevent key collisions or PII leakage, define signing TTLs, distinguish active/staging/quarantine data, couple derivatives to parents, or specify logical denial, physical deletion, reconciliation, and outage behavior.

**Decision:** Adopt `storage-v1` with separate private and quarantine buckets per environment. Generate immutable keys from validated UUIDs; never accept a client key or put PII, prompts, filenames, payment data, or free text in a key. Database metadata owns actor, job, asset state, checksum, size, dimensions, retention class, and deletion state.

**Access Decision:** Use exact-operation/object grants only after server ownership and state authorization. Preview `GET` and direct `PUT` grants expire within 5 minutes; explicit download `GET` grants expire within 10 minutes. Browser `HEAD`/`DELETE`, bucket listing, public customer-content buckets, `r2.dev`, and custom-domain object delivery are prohibited. URLs are reusable bearer credentials until expiry and are excluded from logs, analytics, errors, support, and referrers.

**Lifecycle Decision:** Active assets persist while the owner retains history; derivatives never outlive parents. Staging and incomplete multipart data expire after 24 hours, quarantine after 7 days unless an approved hold applies, and orphan objects are detected within 24 hours and deleted within the next 24 hours. Deletion denies application access immediately and targets verified physical R2 removal within 24 hours.

**Retention Decision:** Prompt/image content is deleted independently from restricted transaction evidence. Current Korean e-commerce periods—contract/withdrawal and payment/supply 5 years, complaints/disputes 3 years, display/advertising 6 months—are implementation inputs requiring legal review, not a compliance claim. Log, analytics, backup, provider-copy, notice, and subprocessor periods remain owned by later approval gates.

**Official Evidence:**

- `https://developers.cloudflare.com/r2/api/s3/presigned-urls/`
- `https://developers.cloudflare.com/r2/buckets/object-lifecycles/`
- `https://developers.cloudflare.com/r2/objects/`
- `https://developers.cloudflare.com/r2/reference/consistency/`
- `https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=63460`
- `https://www.law.go.kr/LSW/lsInfoP.do?ancNo=21312&ancYd=20260120&efYd=20260721&lsiSeq=282793`
- `https://www.privacy.go.kr/front/contents/cntntsView.do?contsNo=277`

**Impact:** Future storage, generation, API, schema, privacy, testing, and operations work must follow [Storage Architecture](../../docs/03_Architecture/STORAGE.md), [Data Retention](../../docs/10_Data/RETENTION.md), the [Storage Rule](../rules/storage.md), and [Storage Checklist](../checklists/storage.md).

**Excluded Claim:** No R2 bucket, credential, CORS/lifecycle rule, object, schema, signed URL endpoint, validation pipeline, deletion/reconciliation job, provider-copy control, backup, alert, incident exercise, legal approval, or production evidence exists.

**Revisit Trigger:** First R2 implementation, direct user upload, public sharing, new media type/provider/region, retention or legal change, deletion miss, security incident, or backup design.

### 2026-07-26 — OBS-001 SLO and Operational Observability Contract

**Status:** `APPROVED`

**Owner:** DevOps Engineer

**Approver:** CTO

**Reviewers:** Backend, Frontend, AI Engineer, Database, Security, QA, PM

**Context:** Logging, monitoring, observability, incident, and Runbook documents were placeholders. They did not define eligible/good events, SLO windows/targets, error budgets, missing-data behavior, bounded telemetry schemas, correlation, retention, burn-rate alerts, severity, acknowledgement, escalation, on-call coverage, or playbook ownership.

**Decision:** Adopt `observability-v1` with seven internal launch SLOs for core API availability/latency, generation success/latency, payment-credit convergence, deletion completion, and telemetry freshness. Measure customer-visible outcomes with explicit eligibility and missing-data states over rolling 28 days; retain the approved 7-day generation KPI as a diagnostic view rather than silently redefining it.

**Error-Budget Decision:** Use error budget `1 - target`. Review risk at 25% remaining and pause risky changes at exhaustion. Page when both 1 hour/5 minute windows burn at 14.4× or both 6 hour/30 minute windows burn at 6×; ticket slower sustained burn. Security disclosure, duplicate/missing financial effect, prohibited telemetry, unauthorized storage, silent durable-work loss, and false-green missing data bypass the budget as zero-tolerance guardrails.

**Telemetry Decision:** Use versioned structured logs with W3C/OpenTelemetry trace correlation, bounded attributes, typed error/reason codes, 100% redacted critical/error/audit records, initial 10% healthy trace sampling, and fail-visible bounded exporter behavior. Prohibit credentials, headers/bodies, direct identifiers, prompts/images, signed URLs, payment details, SQL/provider payloads, raw exceptions, and domain identifiers in metric labels.

**Retention Decision:** Retain application/infrastructure logs 30 days, traces 7 days, security/audit events 180 days, redacted SEV0/SEV1 incident evidence 1 year after closure, raw operational metrics 90 days, and daily SLO/error-budget reports 13 months. Analytics and backup retention remain separate unresolved gates.

**Operations Decision:** Map critical surfaces to primary/secondary roles; require an access-controlled human roster before production. Use `SEV0`–`SEV3` acknowledgement/escalation objectives. Register all ten existing playbooks with stable Runbook IDs, owners, reviewers, quarterly review, and pre-launch drill requirements.

**Official Evidence:**

- `https://sre.google/sre-book/service-level-objectives/`
- `https://sre.google/workbook/alerting-on-slos/`
- `https://sre.google/sre-book/service-best-practices/`
- `https://opentelemetry.io/docs/specs/otel/logs/data-model/`
- `https://opentelemetry.io/docs/specs/otel/logs/`
- `https://opentelemetry.io/docs/specs/otel/metrics/data-model/`
- `https://opentelemetry.io/docs/specs/semconv/http/http-spans/`
- `https://www.w3.org/TR/trace-context/`

**Impact:** Future APIs, workers, providers, deployments, releases, alerts, and incident response must follow [Logging Architecture](../../docs/03_Architecture/LOGGING.md), [Monitoring Architecture](../../docs/03_Architecture/MONITORING.md), [Observability](../../docs/07_Operations/OBSERVABILITY.md), [Operations Monitoring](../../docs/07_Operations/MONITORING.md), [Operations Runbook](../../docs/07_Operations/RUNBOOK.md), and the [Observability Checklist](../checklists/observability.md).

**Excluded Claim:** No logging/tracing SDK, typed schema, exporter/collector, backend, access policy, query, recording rule, SLO calculation, dashboard, alert, paging provider, human roster, Runbook command, drill, incident tool, staffing level, achieved target, or production evidence exists.

**Revisit Trigger:** First telemetry implementation/vendor selection, 30 days of qualified production evidence, SLO or KPI change, new critical journey/provider, page fatigue, telemetry privacy/cost finding, missed incident, or staffing model change.

### 2026-07-26 — PLAT-001 Phase 2 Implementation Entry and Risk Register

**Status:** `APPROVED`

**Owner:** CTO

**Reviewers:** Backend, Frontend, Database, Security, QA, DevOps

**Context:** Phase 2 contracts are sufficient to begin a narrow identity foundation,
but documentation approval is not runtime evidence. The implementation entry must
name the gaps that remain outside the first local milestone.

**Decision:** Begin Phase 3 with only local Supabase, the profiles migration,
email/password signup and login, logout, a protected account route, basic profile
editing, owner-only RLS, and runnable tests. This does not authorize additional
governance expansion or unrelated feature work.

**Unresolved Risks:**

| Risk | Owner | Required gate |
| --- | --- | --- |
| No hosted development or staging Supabase project is linked | DevOps | Isolated hosted environments and migration dry run |
| Local auth auto-confirms email; hosted verification and recovery are unverified | Backend, QA | Verification, resend, reset, expiry, and replay E2E |
| Only profile RLS exists; later user-owned tables remain unimplemented | Database, Security | Migration-local policy and negative tests per table |
| CI, secret scanning, security headers, rate limits, and telemetry are not implemented | DevOps, Security | Phase 3 CI and production-like security gates |
| Local browser access is blocked in the current automation environment | QA | Human or CI browser E2E on an allowed localhost/staging surface |

**Impact:** Phase 2 is ready for review, and Phase 3 is in progress. None of the
listed gaps may be represented as complete or production-ready.

**Revisit Trigger:** Hosted environment setup, auth recovery implementation, new
user-owned table, CI/security-control implementation, or browser E2E availability.

## Checklist

- [x] 범위와 소유자가 명확하다.
- [x] 보안·데이터·운영 영향을 검토했다.
- [x] 저장소 소유자가 상업적 Decision ID를 제품 정책으로 승인했다.
- [x] 승인 결과가 관련 정책과 로드맵에 동기화됐다.
- [ ] 고객 환불 약관이 법률 검토를 통과했다.
- [x] `ui-v1` 디자인 시스템과 접근성 기준이 승인됐다.
- [ ] 실제 UI 구현이 `ui-v1` 자동·수동 접근성 검사를 통과했다.
- [x] `analytics-v1` KPI, 이벤트, 퍼널과 대시보드 계약이 승인 가능한 제안으로 문서화됐다.
- [x] 저장소 소유자가 CEO와 PM을 대신해 `analytics-v1`을 승인했다.
- [ ] 분석 이벤트, 변환, 품질 검사와 대시보드가 구현·검증됐다.
- [x] `security-v1` threat, control, authentication, RLS, secret, privacy와 test 계약이 승인 가능한 제안으로 문서화됐다.
- [x] Security Engineer, CTO와 저장소 소유자가 `security-v1`을 승인했다.
- [ ] 필수 security control이 구현되고 production-like 환경에서 검증됐다.
- [x] `api-v1` version, REST, error, authorization, idempotency와 webhook 계약이 승인됐다.
- [ ] API schema, handler, inbox, idempotency store와 contract test가 구현됐다.
- [x] `storage-v1` bucket, key, signed access, validation, retention, deletion과 outage 계약이 승인됐다.
- [ ] R2 configuration, schema, API, lifecycle/deletion/reconciliation job과 test가 구현됐다.
- [x] `observability-v1` SLO, log, metric, trace, alert, on-call, Runbook과 incident 계약이 승인됐다.
- [ ] Telemetry, SLI/query, dashboard, alert, paging roster, Runbook command와 drill이 구현·검증됐다.
- [x] Phase 2 implementation-entry decisions and unresolved risks are recorded.

## Related Documents

- [CODEX](../../CODEX.md)
- [Pricing](../../docs/01_Business/PRICING.md)
- [Credits](../../docs/01_Business/CREDITS.md)
- [Payments](../../docs/01_Business/PAYMENTS.md)
- [Design System](../../docs/02_Product/DESIGN_SYSTEM.md)
- [UI Guide](../../docs/02_Product/UI_GUIDE.md)
- [Business KPI](../../docs/01_Business/KPI.md)
- [Analytics Events](../../docs/11_Analytics/EVENTS.md)
- [Product Metrics](../../docs/11_Analytics/METRICS.md)
- [Threat Model](../../docs/09_Security/THREAT_MODEL.md)
- [Security Architecture](../../docs/03_Architecture/SECURITY.md)
- [Security Checklist](../checklists/security.md)
- [API Architecture](../../docs/03_Architecture/API.md)
- [REST API](../../docs/06_API/REST.md)
- [Webhooks](../../docs/06_API/WEBHOOKS.md)
- [Storage Architecture](../../docs/03_Architecture/STORAGE.md)
- [Data Retention](../../docs/10_Data/RETENTION.md)
- [Storage Checklist](../checklists/storage.md)
- [Logging Architecture](../../docs/03_Architecture/LOGGING.md)
- [Monitoring Architecture](../../docs/03_Architecture/MONITORING.md)
- [Observability](../../docs/07_Operations/OBSERVABILITY.md)
- [Observability Checklist](../checklists/observability.md)
- [Master Plan](../../MASTER_PLAN.md)
