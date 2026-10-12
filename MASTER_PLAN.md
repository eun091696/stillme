# AI Photo Studio Master Plan

## Table of Contents

- [개요](#overview)
- [목표](#goals)
- [요구사항](#requirements)
- [Roadmap](#implementation)
- [체크리스트](#checklist)
- [관련 문서](#related-documents)

## Overview

이 roadmap은 AI Photo Studio의 기준 실행 순서다. 제품 의도를 dependency 순서가 명확하고 독립적으로 검증 가능한 Milestone으로 변환한다. Status는 문서 존재 여부가 아니라 구현되고 검증된 evidence를 기준으로 한다.

## Goals

- Production-ready AI 이미지 생성 SaaS를 구축한다.
- 사용자 identity, payment, credit, image와 운영 data를 보호한다.
- 명확한 input과 Acceptance Criteria를 통해 Codex가 각 Phase를 실행할 수 있게 한다.
- Architecture, code, test, operations와 documentation을 동기화한다.

## Requirements

### Status 용어

| Status | 의미 |
| --- | --- |
| `NOT_STARTED` | 구현 evidence가 없다 |
| `IN_PROGRESS` | 작업이 존재하지만 Acceptance Criteria가 충족되지 않았다 |
| `BLOCKED` | 명시된 dependency 또는 authority 때문에 진행할 수 없다 |
| `READY_FOR_REVIEW` | 구현과 local validation이 완료됐다 |
| `COMPLETE` | Acceptance Criteria가 검증되고 변경이 merge됐다 |

### 실행 규칙

- Phase를 dependency 순서대로 실행한다.
- Phase 안에서는 dependency가 충족된 미완료 항목 중 우선순위가 가장 높은 Milestone을 선택한다.
- 문서만 작성하고 checklist를 완료 처리하지 않는다.
- Commit, Pull Request, test, migration 또는 production evidence link와 함께 status를 갱신한다.
- Autonomous continuation 전에 [CODEX.md](CODEX.md)를 load한다.

## Implementation

### Phase 0 — 저장소와 AI 운영 체계

**Goal:** 재현 가능한 저장소, governance model과 AI 개발 체계를 구축한다.

**Scope:** Next.js 기반, 문서 hierarchy, `.codex`, 역할, validation과 playbook.

**Dependencies:** 없음.

**Deliverables:**

- 저장소 구조와 환경변수 예시
- 핵심 governance 문서
- Rule, workflow, template, prompt, checklist와 memory
- 문서 link와 구조 validation

**Acceptance Criteria:**

- `npm run docs:check`, `npm run typecheck`, `npm run lint`, `npm run build`가 통과한다.
- `README.md`, `CODEX.md`, `MASTER_PLAN.md`, `AGENTS.md`, `docs/00_HOME.md`의 reading order와 ownership이 일치한다.
- Application behavior가 삭제되지 않는다.

**Checklist:**

- [x] Next.js, TypeScript, Tailwind CSS와 ESLint를 초기화한다.
- [x] 확장 가능한 documentation domain을 구축한다.
- [x] `.codex` 운영 체계와 playbook을 구축한다.
- [x] 자동 documentation validation을 추가한다.
- [x] 저장소 governance 변경을 review하고 merge한다.

**Evidence:** PR #1에서 governance-only review를 완료했다. `npm run docs:check`, `npm run typecheck`, `npm run lint`, `npm run build`, secret-pattern scan과 application-source diff 검사가 통과했으며 검토된 branch가 `main`에 merge됐다.

**Status:** `COMPLETE`
**Estimated Priority:** P0
**Estimated Complexity:** 보통

### Phase 1 — 제품 정의와 경험 Contract

**Goal:** MVP value proposition, user journey, feature boundary와 측정 가능한 outcome을 확정한다.

**Scope:** Target user, pricing 가설, MVP, authentication journey, generation journey, UI state와 analytics event.

**Dependencies:** Phase 0 완료.

**Deliverables:**

- Product와 business model
- MVP scope와 feature Acceptance Criteria
- User flow와 design system 기반
- KPI와 event taxonomy

**Acceptance Criteria:**

- 모든 MVP capability에 owner, user outcome, failure behavior와 측정 가능한 event가 있다.
- 포함 범위와 제외 범위가 명확하다.
- Product, pricing, credit와 payment 가정이 충돌하지 않는다.

**Checklist:**

- [x] Product vision과 target user를 문서화한다.
- [x] 초기 MVP scope와 feature 목록을 문서화한다.
- [x] Feature를 검증 가능한 user story와 Acceptance Criteria로 변환한다.
- [x] Pricing, credit consumption, refund와 payment policy를 승인한다.
- [x] Design system과 accessibility baseline을 승인한다.
- [x] KPI definition과 analytics event를 승인한다.

**Evidence:** `docs/02_Product/FEATURES.md`는 모든 현재 MVP capability를 accountable owner, failure behavior, privacy-aware measurement signal과 검증 가능한 Given/When/Then Acceptance Criteria에 연결한다. `docs/08_Release/MVP.md`와 `docs/02_Product/USER_FLOW.md`는 canonical story contract에 연결되며 documentation validation이 통과한다.

**Commercial Policy Progress:** 결정 가능한 pricing, credit ledger, payment와 refund contract를 `docs/01_Business/PRICING.md`, `CREDITS.md`, `PAYMENTS.md`에 문서화했다. 저장소 owner가 2026-07-26에 `commercial-v1`을 승인했고 `.codex/memory/decisions.md`에 `BIZ-001`로 기록했다.

**Recommendation Evidence:** 2026-07-25에 Google AI, Cloudflare R2, Toss Payments와 한국 전자상거래 법령의 공식 자료를 검토했다. Decision ID에는 evidence 기반 launch value와 cost sensitivity가 포함된다. 고객 환불 약관의 법률 검토는 release gate로 남아 있으며 완료로 표시하지 않는다.

**Experience Baseline Evidence:** `docs/02_Product/DESIGN_SYSTEM.md`와 `UI_GUIDE.md`는 승인된 `ui-v1` token, component state, responsive behavior와 WCAG 2.2 Level AA contract를 정의한다. `.codex/checklists/accessibility.md`와 `docs/04_Engineering/TEST.md`는 구현 evidence와 release gate를 정의하며 `UI-001`은 ownership과 표준 근거를 기록한다.

**Analytics Baseline Evidence:** 승인된 `analytics-v1`은 north-star metric, launch KPI target, minimum sample, canonical formula, trusted event schema, funnel window, dashboard quality state, privacy limit와 guardrail을 정의한다. 저장소 owner는 전체 scorecard와 가설의 한계를 보고받은 후 2026-07-26에 CEO와 PM을 대신해 `AN-001`을 승인했다. Documentation, type, lint, build, scope와 consistency 검사가 통과했으며 instrumentation 또는 production performance는 주장하지 않는다.

**Status:** `COMPLETE`
**Estimated Priority:** P0
**Estimated Complexity:** 보통

### Phase 2 — Architecture와 Security Baseline

**Goal:** Feature 구현 전에 system boundary와 타협할 수 없는 security control을 승인한다.

**Scope:** System context, runtime boundary, API contract, data model, RLS, storage, secret, logging과 monitoring.

**Dependencies:** Phase 1 product boundary 완료.

**Deliverables:**

- Architecture와 system context
- Database와 data model
- Threat model과 authentication policy
- API, storage, cache, logging과 monitoring 표준
- 중요한 선택의 Architecture Decision Record

**Acceptance Criteria:**

- Trust boundary와 data flow가 문서화돼 있다.
- 모든 user-owned table에 RLS policy와 test strategy가 있다.
- Payment, credit, generation과 webhook operation에 idempotency rule이 있다.
- Secret value가 client bundle이나 log로 전달되지 않는다.

**Checklist:**

- [x] 초기 architecture와 database model을 문서화한다.
- [x] Threat model과 security control을 승인한다.
- [x] API versioning, error, authorization과 idempotency contract를 정의한다.
- [x] Storage path, signed URL lifecycle, retention과 deletion을 정의한다.
- [x] SLO 기반 logging, metric, alert와 Runbook ownership을 정의한다.
- [x] Architecture decision과 unresolved risk를 기록한다.

**Security Baseline Evidence:** 승인된 `security-v1`은 actor, asset, 7개 trust boundary, 핵심 data flow, 우선순위가 지정된 threat 20개, control family 18개, authentication/session rule, default-deny RLS policy intent, secret lifecycle, privacy boundary, negative-test evidence와 risk-exception gate를 정의한다. 저장소 owner는 threat/control summary, 공식 evidence, residual-risk policy와 validation 결과를 보고받은 후 2026-07-26에 Security와 CTO를 대신해 `SEC-001`을 승인했다. 저장소는 아직 application scaffold 단계이므로 runtime control이나 production security posture는 주장하지 않는다.

**API Contract Evidence:** 승인된 `api-v1`은 `/api/v1` resource semantics, compatibility와 외부 사용자를 위한 90일 sunset, RFC 9457 error, server authorization, minimum DTO, UUID v4 idempotency key, semantic request fingerprint, replay/conflict behavior, durable webhook inbox, provider별 verification, out-of-order handling, reconciliation과 negative-test requirement를 정의한다. `API-001`은 IETF, Next.js, Supabase와 Toss의 공식 evidence를 기록한다. Endpoint 또는 provider integration 구현은 주장하지 않는다.

**Storage Lifecycle Evidence:** 승인된 `storage-v1`은 환경별로 분리된 private R2 bucket, server-generated immutable object key, 5분 preview/upload와 10분 download grant, content/checksum validation, staging/quarantine/orphan lifecycle, 즉시 logical denial, 24시간 physical deletion 목표, 법정 기록 분리, reconciliation, outage behavior와 negative-test requirement를 정의한다. `STO-001`은 Cloudflare와 현재 한국 법령 evidence를 기록한다. Bucket, schema, API, lifecycle rule, deletion job, backup, provider-copy control 또는 runtime test 구현은 주장하지 않는다.

**Observability Evidence:** 승인된 `observability-v1`은 customer/telemetry SLO 7개, good/eligible event semantics, 28일 error budget, release-pause policy, multiwindow burn-rate와 zero-tolerance guardrail alert, 제한된 structured logging과 trace correlation, telemetry retention, dashboard, severity/acknowledgement/escalation, role-based on-call, 담당자가 지정된 Runbook 10개, incident command와 negative-test/drill requirement를 정의한다. `OBS-001`은 Google SRE, OpenTelemetry와 W3C evidence를 기록한다. SDK, exporter, telemetry store, query, dashboard, alert, paging roster, drill 또는 production SLO 결과는 주장하지 않는다.

**Decision and Risk Evidence:** `.codex/memory/decisions.md`는 승인된 architecture decision과 `PLAT-001` implementation-entry risk register를 기록한다. 남아 있는 remote environment, recovery, CI, operational control과 production evidence gap은 숨겨진 가정이 아니라 명시적인 Phase 3 또는 release gate다. Phase 2 review와 implementation-entry validation은 PR #10의 merge commit `896eaa3`로 `main`에 반영됐다.

**Status:** `COMPLETE`
**Estimated Priority:** P0
**Estimated Complexity:** 높음

### Phase 3 — Identity와 Platform 기반

**Goal:** 모든 제품 feature가 사용하는 안전한 platform 기반을 구현한다.

**Scope:** Supabase environment, schema migration, authentication, profile, RLS, configuration과 CI.

**Dependencies:** 승인된 Phase 2 architecture와 security baseline.

**Deliverables:**

- 재현 가능한 Supabase migration
- Email authentication과 session handling
- Protected route와 profile model
- RLS policy와 automated test
- CI quality gate

**Acceptance Criteria:**

- Signup, verification, login, reset, logout과 session expiry가 end-to-end로 동작한다.
- 사용자는 다른 사용자의 data를 읽거나 변경할 수 없다.
- Version이 관리되는 configuration으로 새 environment를 생성할 수 있다.
- CI가 lint, type, test, build, migration 또는 documentation 실패를 차단한다.

**Checklist:**

- [x] 재현 가능한 local Supabase project를 구성한다.
- [x] Hosted development Supabase project를 구성한다.
- [x] 초기 profile migration과 deterministic seed strategy를 구현한다.
- [x] Email signup, login, logout, protected account route와 basic profile을 구현한다.
- [x] Email verification recovery, password reset과 session-expiry UX를 구현한다.
- [x] Owner-only profile RLS policy를 구현하고 test한다.
- [x] CI validation과 secret scanning을 추가한다.
- [ ] Hosted staging Supabase project를 quota 또는 비용 승인 후 구성한다. (`BLOCKED`)
- [x] Recovery와 account support procedure를 구현하고 문서화한다.

**Evidence:** `supabase/config.toml`, migration `20260726000100_create_profiles.sql`과 `seed.sql`로 local database를 다시 만들 수 있다. Hosted development project `qqdhooymswnqhabydmna`와 Seoul region은 `supabase/environments.json`에서 version 관리되며 `npm run supabase:env:development`가 linked project를 검증하고 publishable key만 권한 `0600`의 ignored `.env.local`에 기록한다. 원격 migration `20260726000100`은 local migration과 일치한다. Application은 request별 Supabase SSR client, 검증된 server user, `middleware.ts`, Server Action, email confirmation callback과 server에서 보호하는 `/account` page를 사용한다. `/verify-email`, `/forgot-password`, recovery 전용 `/reset-password`와 만료 세션 안내가 구현됐고 비밀번호 변경 후 global sign-out을 수행한다. Callback은 PKCE code와 custom token-hash template을 모두 처리하며 고정된 내부 경로만 허용한다. Validation unit test 17개, pgTAP schema/RLS test 10개와 실제 local Auth integration test 3개가 통과한다. `npm run auth:support:case`는 email, password, cookie와 token을 받지 않는 `auth-support-v1` case record를 생성하며 `RB-AUTH-001` signup/login playbook은 read-only 진단, self-service 완화와 privileged escalation boundary를 정의한다. In-app browser에서 login recovery link, verification/resend form, password-reset request form과 recovery session 없는 reset 접근 차단을 확인했다. GitHub Actions run `30323885431`에서 Quality, Database/Auth와 full-history Gitleaks secret scan이 모두 통과했다. Hosted email delivery와 만료·replay token E2E evidence는 아직 release gate로 남는다.

**Blocked Milestone:** Hosted staging Supabase project 구성은 organization owner의 Free plan active project 2개 제한 때문에 `BLOCKED`다. 별도 비용 승인, 기존 project pause 또는 quota 확보 전까지 재시도하지 않으며, 단일 hosted development project로 구현 가능한 Milestone은 계속 진행한다.

**Status:** `IN_PROGRESS`
**Estimated Priority:** P0
**Estimated Complexity:** 높음

### Phase 4 — AI 생성과 Storage

**Goal:** 신뢰할 수 있고 관측 가능하며 비용이 통제되는 이미지 생성 pipeline을 제공한다.

**Scope:** Prompt validation, model adapter, generation job, retry, post-processing, R2, history와 download.

**Dependencies:** Phase 3 identity와 data 기반 구현 완료. Hosted staging environment는 외부 Free plan quota로 `BLOCKED`이며 이 Phase의 local·development 구현을 차단하지 않는다.

**Deliverables:**

- Version이 관리되는 model과 prompt adapter
- Generation job state machine
- R2 upload와 signed download flow
- Quality와 safety 검사
- Generation history와 failure recovery

**Acceptance Criteria:**

- 모든 request에 안정적인 job ID와 관측 가능한 state transition이 있다.
- Retry가 중복 charge 또는 asset을 만들 수 없다.
- 실패한 작업을 복구할 수 있으며 credit이 영구적으로 소비되지 않는다.
- 생성 asset은 기본적으로 private이고 승인된 사용자만 download할 수 있다.
- Quality, latency, success rate와 estimated cost를 측정할 수 있다.

**Checklist:**

- [x] Generation request validation을 구현한다.
- [x] Model adapter와 version tracking을 구현한다.
- [x] Job state machine과 retry policy를 구현한다.
- [ ] R2 storage와 signed URL을 구현한다. (`BLOCKED`: live bucket evidence)
- [x] Post-processing과 quality control을 구현한다.
- [x] History, download와 failure state를 구현한다.
- [x] Integration과 end-to-end test를 추가한다.

**Evidence:** `src/lib/generation/validation.ts`는 prompt를 trim하고 길이·control character·승인된 style·aspect ratio·unknown field를 검증하며, provider 또는 moderation adapter가 연결될 비동기 policy boundary를 제공한다. 오류에는 원문 prompt를 포함하지 않는다. `src/lib/generation/model.ts`와 `google-adapter.ts`는 승인된 provider model, adapter와 prompt-template version을 결과에 고정하고 Google AI image generation boundary를 injected transport로 격리한다. Provider 오류와 잘못된 image payload는 bounded error로 변환하며 API key와 provider body를 노출하지 않는다. Migration `20260728000100_create_generation_jobs.sql`은 사용자별 idempotency identity, version metadata, durable state, attempt limit, retry schedule, immutable request와 owner-only read RLS를 구현한다. Database trigger와 `job-state.ts`는 같은 transition과 bounded error-code contract를 적용한다. `src/lib/storage`는 server-generated immutable original key, private R2 upload, size·MIME·SHA-256 verification과 최대 10분 exact-object download presign contract를 구현했다. Migration `20260728000200_create_assets.sql`은 generation owner와 일치하는 immutable storage identity, verified metadata, lifecycle transition, owner-only available read와 immediate logical deletion을 구현한다. `image-quality.ts`는 PNG structure·CRC·inflate, dimension/pixel bound, requested aspect ratio, metadata와 animation exclusion, checksum과 versioned quality evidence를 검증한다. `/generations`는 owner-scoped 최신 20개 job과 available asset만 표시하고 queued·processing·failed·cancelled·empty state를 구분하며, download Server Action은 RLS로 owner를 재검증한 뒤 exact-object 10분 R2 grant만 생성한다. Local Supabase integration은 owner와 cross-user의 generation·asset RLS를 실제 Data API로 검증하고, Playwright E2E는 anonymous 보호, login, empty state, 상태·bounded failure 표시, cross-user 비노출, R2 미구성 download failure와 logout을 Chromium에서 실행한다. Unit 및 pgTAP test는 request validation, provider mapping, state transition, retry exhaustion, direct mutation denial, cross-user isolation, idempotency uniqueness와 storage key·credential·payload·expiry·asset lifecycle·image quality·history presentation 경계를 검증한다.

**Blocked Milestone:** 실제 private R2 bucket upload, `HEAD` verification과 presigned download evidence는 Cloudflare account/bucket 및 최소 권한 S3 credential이 제공되기 전까지 `BLOCKED`다. Local adapter, schema와 다음 credential-independent Milestone은 계속 진행한다.

**Status:** `IN_PROGRESS`
**Estimated Priority:** P0
**Estimated Complexity:** 매우 높음

### Phase 5 — Credit과 Payment

**Goal:** 검증된 payment를 기반으로 audit 가능하고 idempotent한 credit economy를 운영한다.

**Scope:** Credit ledger, reservation, consumption, refund, Toss Payments, webhook과 reconciliation.

**Dependencies:** Phase 4 generation cost semantics와 Phase 3 identity·database 완료.

**Deliverables:**

- Append-only credit transaction ledger
- Atomic reservation, charge와 refund operation
- Toss payment initiation과 server verification
- 서명이 검증되고 idempotent한 webhook processing
- Reconciliation과 support tooling

**Acceptance Criteria:**

- Balance는 audit 가능한 transaction에서 계산한다.
- 중복 request와 webhook이 credit 또는 charge를 이중 반영할 수 없다.
- Generation failure가 reserved credit을 atomic하게 복구한다.
- Payment와 refund state를 Toss와 reconciliation할 수 있다.
- Security와 financial event log에 민감한 payment data를 포함하지 않는다.

**Checklist:**

- [x] Credit과 refund policy를 승인한다.
- [x] Ledger schema와 invariant를 구현한다.
- [x] Generation credit reservation과 settlement를 구현한다.
- [x] Toss payment와 webhook verification을 구현한다.
- [x] Refund와 reconciliation을 구현한다.
- [x] Concurrency, idempotency와 failure test를 추가한다.

**Evidence:** `commercial-v1`의 `CREDIT-001`–`CREDIT-005`와 payment refund 제품 동작은 저장소 소유자가 승인했으며 고객 공개 약관과 자동 부분 환불 활성화는 법률 검토 전까지 분리된다. Migration `20260728000300_create_credit_ledger.sql`은 account, append-only ledger, security-invoker balance view, owner-read RLS, server-only mutation, stable idempotency와 reference uniqueness를 구현한다. Account row lock과 insert trigger는 동시 debit의 음수 잔액을 차단하고, generation restore는 원 소비 전체를 한 번만 복구하며 누적 payment reversal은 원 purchase grant를 초과할 수 없다. Migration `20260728000400_create_credit_reservations.sql`은 queued generation에 대한 atomic reservation, available balance, succeeded-only settlement, terminal failure·cancel release와 server-only idempotent RPC를 구현한다. Retryable failure는 예약을 유지하고 성공 settlement만 `generation_consume` 원장 거래를 정확히 한 번 생성한다. Migration `20260728000500_create_toss_payments.sql`과 `/api/payments/orders`, `/api/payments/confirm`, `/api/webhooks/toss`는 서버 가격 주문, Toss 승인·재조회 검증, hash-only payment identity, 원장과 결제의 atomic 지급, webhook receipt/hash 이중 멱등성을 구현한다. Migration `20260728000600_create_payment_refunds.sql`과 `/api/payments/refunds`, `/api/payments/reconcile`은 provider 취소 전 credit reservation, 7일·미사용 full-refund gate, 원 구매 grant reversal, ambiguous outcome 보존과 provider snapshot reconciliation을 구현한다. 부분 환불은 법률 검토 전까지 자동화하지 않고 review 대상으로 분리한다. Unit, pgTAP과 local Data API integration test는 amount 방향·상한, balance, reservation lifecycle, payment/refund/webhook duplicate와 mismatch, reconciliation repair/review, manual dual approval, immutable mutation, insufficient balance, owner/cross-user/anonymous access와 사용자 삭제 cascade를 검증한다. 실제 병렬 Data API test는 동일 주문·승인·환불·reconciliation 요청이 각각 단일 경제 효과로 수렴하고, 환불 예약과 생성 예약의 경합에서 한 요청만 성공하며 available balance가 음수가 되지 않음을 검증한다. Toss client failure test는 timeout·network failure를 bounded code로 정규화하고 비정상 provider error와 중복 cancellation transaction identity를 거부해 secret과 원장 무결성을 보호한다.

**Status:** `COMPLETE`
**Estimated Priority:** P0
**Estimated Complexity:** 매우 높음

### Phase 6 — Administration과 고객 운영

**Goal:** 승인된 operator가 control을 우회하지 않고 고객을 지원할 수 있게 한다.

**Scope:** Admin RBAC, user lookup, payment와 generation lookup, credit adjustment, notice와 audit log.

**Dependencies:** Phase 3–5 완료.

**Deliverables:**

- Admin role과 authorization model
- 운영 dashboard
- Audit되는 support action
- Customer support와 incident playbook

**Acceptance Criteria:**

- Admin access를 별도로 authorize하고 전체 과정을 audit한다.
- Credit adjustment에 reason, actor, target과 immutable transaction이 필요하다.
- Support가 불필요한 personal data를 노출하지 않고 request를 추적할 수 있다.
- 위험한 action에는 confirmation과 문서화된 rollback이 필요하다.

**Checklist:**

- [x] Admin role과 approval boundary를 정의한다.
- [x] Protected admin interface를 구현한다.
- [x] User, payment, credit과 generation lookup을 구현한다.
- [x] Audit되는 corrective action을 구현한다.
- [x] Privacy와 least privilege를 검증한다.
- [x] 대표 incident를 대상으로 playbook을 훈련한다.

**Evidence:** Migration `20260728000700_create_operator_rbac.sql`은 이메일·profile metadata와 분리된 Admin·Support role, explicit permission mapping, `aal2` authorization, 24시간 idempotent role-change request, 독립된 요청자·승인자, 마지막 Admin 보호와 immutable audit event를 구현한다. 모든 operator table은 direct Data API access를 거부하며 pgTAP은 MFA, 최소 권한, anonymous·ordinary-user denial, idempotency fingerprint, dual control, expiry, grant·revoke와 audit evidence를 검증한다. 실제 operator identity와 bootstrap assignment는 저장소에 포함하지 않으며 환경별 승인 migration 전까지 admin access는 기본 거부된다. `/admin` dynamic Server Component는 verified user와 MFA-gated `operator.read`를 server에서 다시 확인하고 authorization 부재·실패를 404로 처리한다. Middleware, fail-closed authorization unit test와 Chromium E2E는 anonymous login return path, ordinary-user denial과 운영 UI 비노출을 검증한다. Migration `20260728000800_create_operator_lookup.sql`과 운영 화면은 UUID 기반 user·payment·credit·generation 최소 조회 DTO를 제공하며 domain별 permission과 idempotent audit event를 강제한다. Email, generation prompt와 payment key는 lookup 결과에서 제외되고 최근 목록은 10개로 제한되며 pgTAP과 unit test가 MFA, 최소 권한, 민감 필드 비노출과 audit replay를 검증한다. Migration `20260730000100_create_operator_credit_adjustments.sql`은 MFA Support·Admin 요청, ±150 credit 한도, bounded reason과 case reference, 24시간 만료, 독립 Admin 승인과 append-only `manual_adjustment` ledger transaction을 하나의 database boundary로 구현한다. 승인 replay는 같은 ledger entry로 수렴하고 음수 잔액은 거부되며 rollback은 원 거래를 수정하지 않는 반대 방향의 새 dual-control 요청으로 검증된다. 운영 조회는 고객 UUID를 URL query에 기록하지 않는 Server Action POST로 전환됐고 database 응답은 client serialization 전에 explicit minimum DTO로 검증·재구성된다. Privacy/least-privilege regression은 Support·Admin permission 집합, operator raw table 접근 차단, anonymous RPC 차단, audit 위조 차단, RPC 반환 schema와 `security definer`의 고정 `search_path`를 검증한다. 단위 test는 예상하지 않은 email, prompt, payment key, provider payload와 malformed field가 client state로 전달되지 않음을 증명한다. `RB-PAY-001` local incident drill은 provider cancellation 불일치를 합성 data로 재현하고 safe case가 단일 reconciliation·ledger reversal로 복구되는지, 사용 가능한 Credit이 generation에 예약된 case가 mutation 없이 `review_required`로 격리되는지 검증한다. Drill evidence는 bounded allowlist만 출력하고 합성 사용자는 종료 후 cascade cleanup된다.

**Status:** `READY_FOR_REVIEW`
**Estimated Priority:** P1
**Estimated Complexity:** 높음

### Phase 7 — Quality, Security와 Reliability

**Goal:** Platform이 release 품질과 operational readiness 기준을 충족함을 증명한다.

**Scope:** Automated test, performance, accessibility, threat validation, backup, observability와 incident exercise.

**Dependencies:** Phase 3–6의 feature 완료.

**Deliverables:**

- Unit, integration과 end-to-end test suite
- Security와 privacy review
- Performance와 cost baseline
- Dashboard, alert와 backup restore evidence
- Incident와 rollback exercise

**Acceptance Criteria:**

- Critical user journey가 production-like environment에서 통과한다.
- 해결되지 않은 critical 또는 high-severity security finding이 없다.
- Backup restore와 deployment rollback을 실제로 증명한다.
- SLO, alert와 Runbook이 연결되고 owner가 지정돼 있다.
- Accessibility와 performance budget이 통과한다.

**Checklist:**

- [x] Automated test matrix를 완료한다.
- [x] Threat와 privacy review를 완료한다.
- [x] Accessibility audit을 완료한다.
- [x] Performance와 AI cost baseline을 수립한다.
- [ ] Backup restore와 data retention을 검증한다.
- [ ] Incident와 deployment rollback exercise를 실행한다.

**Evidence:** Current automated matrix는 identity/profile, generation/history,
credit/payment/refund, Admin/support와 repository gate를 unit, pgTAP,
integration, browser와 operational drill에 연결한다. Local Mailpit browser
E2E는 password recovery email, PKCE callback, password 변경, global sign-out,
새 password login, one-time link replay 거부와 account-enumeration-safe 응답을
검증한다. CI Database/Auth job은 DB 247개, Data API integration, Chromium
browser suite와 `RB-PAY-001` payment reconciliation incident drill을
필수화한다. `npm run test:all`은 실행 중인 local Supabase에서 전체 matrix를
재현한다. Hosted email, live AI/R2/Toss, synthetic MFA Admin positive browser
flow와 accessibility는 각 후속 또는 external release gate로 명시돼 있다.
Phase 7 security review의 첫 slice는 cookie-authenticated payment POST에
exact same-origin, JSON media type와 16 KiB body limit를 강제하고 protected
response에 `private, no-store`와 browser security header를 적용했다. Unit과
browser negative test가 cross-origin, anonymous, oversized request와 cache
boundary를 검증한다. Next.js/PostCSS/Sharp/JS-YAML은 안전 patch로 고정됐고
production dependency audit는 0건이다. ESLint가 사용하는
`brace-expansion@1.1.18`의 OOM 방어 backport는 별도 회귀 test로 검증한다.
`SEC-REV-2026-07-31` threat/privacy engineering review는 현재 구현 경계의
critical/high finding 3건을 닫았다. Page response는 request별 nonce,
production `strict-dynamic`과 broad unsafe exception 없는 enforced CSP를
사용한다. Payment와 Toss webhook body는 전체 적재 전에 streaming byte
limit과 exact JSON media type을 검증한다. CI는 synthetic server-only canary와
restricted marker가 production client bundle에 없음을 검사한다. 현재 구현
범위에 미해결 critical/high finding 또는 security exception은 없다.
Distributed abuse control, live R2/model evidence, production HSTS·deployment
identity와 법률/privacy approval은 Medium residual 또는 external Phase 8
release gate로 유지하며 production 검증으로 주장하지 않는다.
현재 구현된 public/auth/account/history/Admin 화면의 accessibility audit은
route별 title과 단일 H1/main landmark, skip navigation, client route focus,
form label/help 연결, keyboard 순서, primary action 4.5:1 contrast와 320 CSS
px reflow를 Chromium 11개 E2E와 실제 1440/320px browser rendering으로
검증했다. 제품 기본 focus indicator와 44px primary control도 유지된다.
VoiceOver/NVDA 수동 확인과 아직 구현되지 않은 payment/generation interactive
UI는 해당 기능 release 전 별도 gate로 남는다.

Performance baseline은 production App Router page별 gzip JS/CSS 120 KiB,
개별 asset 64 KiB budget을 적용한다. 현재 최대 route는 `/admin` 108,332
bytes, 최대 asset은 54,228 bytes로 통과하며 `npm run validate`와 GitHub
Quality job이 regression을 차단한다. AI cost baseline
`google-ai-2026-07-30`은 Gemini 3.1 Flash Image Standard 1K output
`$0.067`, 최대 계획 input 4,000 tokens, 성공 생성 budget `$0.070`을 integer
microusd estimator와 unit test로 검증한다. 기존 `PRICE-002` 45% margin
가정은 최신 provider 가격에서 약 13%로 하락해 production 판매 전 재승인이
필요하다. Hosted p50/p95 latency와 실제 usage export는 production-like
환경이 없으므로 Phase 9 gate로 남는다.

**Status:** `IN_PROGRESS`
**Estimated Priority:** P0
**Estimated Complexity:** 높음

### Phase 8 — Production Release

**Goal:** 명시적인 approval, rollback, monitoring과 support ownership을 갖추고 안전하게 출시한다.

**Scope:** Production configuration, migration, deployment, smoke test, release note, monitoring과 support.

**Dependencies:** Phase 7 완료.

**Deliverables:**

- 승인된 release candidate
- Production deployment와 migration
- Release note와 version history
- Monitoring과 support coverage
- Post-launch review

**Acceptance Criteria:**

- PM, CTO, QA, Security와 DevOps가 release checklist를 승인한다.
- Production smoke test와 data 검사가 통과한다.
- Rollback target과 decision owner가 명확하다.
- Customer-impact monitoring이 활성화돼 있다.
- Post-launch finding을 roadmap 작업으로 전환한다.

**Checklist:**

- [ ] Release scope를 freeze하고 승인한다.
- [ ] Production configuration과 secret을 검증한다.
- [ ] Migration을 적용하고 검증한다.
- [ ] Deploy하고 smoke test를 실행한다.
- [ ] Release note를 게시한다.
- [ ] Launch를 monitoring하고 post-launch review를 완료한다.

**Status:** `NOT_STARTED`
**Estimated Priority:** P0
**Estimated Complexity:** 높음

### Phase 9 — Scale과 지속적인 개선

**Goal:** Evidence를 기반으로 retention, unit economics, team throughput과 platform resilience를 개선한다.

**Scope:** Analytics, experimentation, model evaluation, cost optimization, team scaling과 architecture evolution.

**Dependencies:** Phase 8 production evidence 확보.

**Deliverables:**

- 신뢰할 수 있는 product와 business dashboard
- Experiment governance
- Model evaluation과 routing framework
- Capacity와 cost plan
- 분기별 architecture와 roadmap review

**Acceptance Criteria:**

- KPI definition이 source event와 reconciliation 결과에 일치한다.
- Experiment가 privacy를 보호하고 stopping criteria를 가진다.
- Model 변경이 quality, safety, latency와 cost gate를 통과한다.
- Scaling decision을 evidence와 rollback condition과 함께 기록한다.

**Checklist:**

- [ ] Event quality와 funnel reporting을 검증한다.
- [ ] Experiment review process를 구축한다.
- [ ] Model evaluation과 cost reporting을 자동화한다.
- [ ] SLO, capacity와 architecture를 분기마다 review한다.
- [ ] Documentation ownership과 stale content를 review한다.

**Status:** `NOT_STARTED`
**Estimated Priority:** P1
**Estimated Complexity:** 지속적

## Checklist

- [ ] Dependency가 충족된 Milestone 하나만 선택한다.
- [ ] Workflow, rule, checklist, owner와 canonical document를 load한다.
- [ ] 구현 전에 필요한 evidence를 정의한다.
- [ ] 하나의 coherent Milestone만 구현한다.
- [ ] 모든 Acceptance Criteria를 검증한다.
- [ ] 검증 가능한 evidence가 있을 때만 Phase status를 갱신한다.
- [ ] Dependency를 건너뛰지 않고 blocker를 보고한다.

## Related Documents

- [Codex Operating Contract](CODEX.md)
- [AI Company 역할](AGENTS.md)
- [문서 Home](docs/00_HOME.md)
- [Product Roadmap](docs/01_Business/ROADMAP.md)
- [Release Checklist](docs/04_Engineering/RELEASE.md)
