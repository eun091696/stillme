# Testing Strategy

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

이 문서는 AI Photo Studio의 단위, 통합, E2E, 접근성 및 릴리스 검증 계층을 정의합니다. 사용자 스토리의 인수 기준과 `ui-v1` 접근성 계약을 실행 가능한 증거로 연결합니다.

## Goals

- 요구사항별 성공·실패·권한 동작에 직접 증거를 제공합니다.
- 빠른 단위 검사와 실제 사용자 흐름 검사를 계층화합니다.
- 기능 회귀와 접근성 회귀를 동일한 품질 문제로 취급합니다.

## Requirements

- 모든 구현 PR은 관련 Story ID와 인수 기준을 테스트에 연결합니다.
- 인증, 결제, 크레딧과 사용자 소유 데이터에는 실패·중복·권한 시나리오가 필요합니다.
- 보안 관련 PR은 영향을 받는 `THR-*`와 `CTL-*` ID 및 부정 테스트 증거를 연결합니다.
- UI 변경은 WCAG 2.2 Level AA 자동·수동 증거를 포함합니다.
- flaky test를 무시하거나 무조건 재시도해 성공으로 숨기지 않습니다.

## Implementation

### Test Layers

| Layer | Scope | Required examples |
| --- | --- | --- |
| Unit | 순수 domain, validation, formatting, component state | credit calculation, prompt validation, button/input states |
| Integration | API·database·provider boundary | auth, RLS, payment idempotency, generation failure restoration |
| E2E | 실제 핵심 사용자 흐름 | signup, purchase, generate, history, download |
| Contract | API·event·schema compatibility | error shape, authorization, webhook replay |
| Accessibility | semantics, keyboard, focus, contrast, assistive technology | form error, dialog, async generation status |

### Accessibility Validation

- 정적 검사로 semantic HTML, accessible name, label, ARIA 오류를 확인합니다.
- component test로 keyboard, focus-visible, disabled/loading/error 상태를 확인합니다.
- E2E에서 signup, payment, generation과 history의 keyboard-only happy/failure path를 실행합니다.
- 수동 검사는 VoiceOver + Safari 또는 NVDA + Firefox/Chrome 중 하나를 포함합니다.
- light/dark theme, 200% text zoom, 400% browser zoom, 320 CSS px reflow와 reduced motion을 확인합니다.
- 자세한 release gate는 [Accessibility Checklist](../../.codex/checklists/accessibility.md)를 따릅니다.

### Security Validation

| Layer | Required security evidence |
| --- | --- |
| Static | Secret/dependency/client-bundle scan, unsafe API and configuration review |
| Unit | Input bounds, authorization decisions, state invariants, redaction, safe error mapping |
| Integration | Session verification, RLS matrix, provider verification, idempotency, concurrency, signed access |
| E2E | Cross-user denial, auth recovery, CSRF, payment tamper, generation failure restore, download ownership |
| Operational | Security headers, cache isolation, rate limits, alerts, rotation, reconciliation, containment |

- 사용자 소유 리소스는 anonymous, owner, other user, forged owner, expired session, privileged and service actor를 모두 검사합니다.
- 결제·크레딧·생성은 duplicate, replay, concurrent, timeout, provider ambiguity와 partial commit을 검사합니다.
- 인증 응답이나 `Set-Cookie`가 ISR/CDN/shared cache를 통해 다른 사용자에게 전달되지 않는지 검사합니다.
- 로그·분석·오류·빌드·브라우저 bundle에 비밀, 토큰, 원문 prompt, image, signed URL, 결제 정보가 없는지 fixture로 검사합니다.
- 자세한 threat/control 매핑과 release gate는 [Security Checklist](../../.codex/checklists/security.md)를 따릅니다.

### API Contract Validation

- 현재와 직전 호환 client fixture로 request, success, Problem Details, header와 enum을 검증합니다.
- 모든 endpoint는 method, content type, schema, size, authentication, authorization, state와 rate-limit failure를 검사합니다.
- unsafe operation은 missing/invalid key, same-key replay, processing duplicate, changed fingerprint, concurrency와 provider ambiguity를 검사합니다.
- payment, credit, generation과 webhook은 inbox/domain uniqueness, out-of-order event, partial commit, reconciliation과 manual replay를 검사합니다.
- `401`, `403`과 cross-user `404`가 존재 여부나 내부 정보를 노출하지 않는지 확인합니다.
- webhook authenticity는 provider별 raw fixture와 server re-query fixture를 사용하며 실제 secret을 테스트 데이터로 사용하지 않습니다.

### Storage Lifecycle Validation

- bucket/IAM fixture는 환경 격리, private access, 최소 권한, public/custom-domain 비활성화를 검사합니다.
- key generator는 UUID, allowlisted derivative/type, PII·prompt·filename·traversal 거부와 동시 생성 충돌을 검사합니다.
- signed access는 anonymous, owner, other user, deleted state, exact method/key/header, 5/10분 TTL, expiry, tamper, CORS, cache와 referrer를 검사합니다.
- upload는 MIME spoof, malformed/polyglot, 25 MiB 초과, 8192px 초과, checksum mismatch, partial body, duplicate write와 database commit failure를 검사합니다.
- lifecycle test는 staging 24시간, quarantine 7일, parent/derivative 동시 삭제, orphan 탐지, logical denial, R2 absence와 idempotent retry를 검증합니다.
- outage/reconciliation test는 object-only, metadata-only, checksum mismatch, provider timeout, overdue deletion과 credit reservation 복구를 검사합니다.
- 모든 fixture는 synthetic bytes와 opaque IDs만 사용하며 실제 user content, URL, credential 또는 prompt를 증거에 남기지 않습니다.

### Observability Validation

- typed log/event fixture는 필수 field, schema version, severity, bounded code와 W3C trace correlation을 검사합니다.
- prohibited-field test는 secret/token/cookie/header/body, email/IP, prompt/image, signed URL, payment key, SQL, provider body와 raw exception을 거부합니다.
- SLI fixture는 eligible/good/excluded/late/missing/duplicate event를 재생해 canonical numerator, denominator, target와 error budget을 검증합니다.
- alert test는 14.4× `1h/5m`, 6× `6h/30m`, slow-burn ticket, low-traffic synthetic, zero-tolerance guardrail과 false-green missing data를 검사합니다.
- notification test는 primary/secondary delivery, acknowledgement, escalation, deduplication, silence expiry, payload redaction과 Runbook link를 검사합니다.
- exporter/storage outage는 domain commit을 중복·rollback하지 않고 bounded drop/buffer와 monitoring-blind alert를 남겨야 합니다.
- staging drill은 SEV0/SEV1, payment-credit, provider, database, storage deletion, rollback과 telemetry outage를 synthetic data로 수행합니다.

### Evidence Contract

테스트 증거는 명령, 결과, 환경, Story ID 또는 threat/control ID, 검증한 acceptance criterion과 알려진 gap을 기록합니다. UI 변경은 mobile·desktop screenshot과 수동 접근성 결과를 포함합니다.

### CI Baseline

```bash
npm run docs:check
npm run typecheck
npm run lint
npm run build
```

Identity foundation은 다음 runnable test를 추가합니다.

```bash
npm run test
npm run test:db
npm run test:integration
npm run test:e2e
npm run incident:drill:payment
```

`test:db`, `test:integration`과 `test:e2e`는 실행 중인 local Supabase를
요구합니다. Test runner는 local 상태에서 publishable key와 test 전용 service-role
credential을 process 환경으로만 전달하고 Chromium을 실행합니다. 현재 unit,
Node, pgTAP, Auth·generation·payment integration과 generation history browser
E2E가 CI 필수 검사입니다. Payment integration은 동일 요청 8개의 병렬 실행과
refund/generation reservation 경합을 실제 Data API에서 실행하며 단일 원장 효과,
단일 reconciliation 결과와 음수가 아닌 available balance를 검증합니다. Provider
failure unit fixture는 timeout·network exception, 비정상 error code와 중복
cancellation identity가 bounded failure로 거부되는지 확인합니다. Semantic image
validator unit fixture는 AWS `CompareFaces` 입력과 점수 정규화, Google skin JSON
schema, server-owned threshold, provider failure fail-closed와 최초 batch 최대 5회
generation 호출을 검증합니다. E2E fixture는
synthetic user와 metadata를 생성하고 종료 시 삭제하며 credential, token,
signed URL 또는 실제 사용자 content를 출력하지 않습니다.
Admin browser E2E는 anonymous login return path와 일반 인증 사용자의 404
기본 거부를 검증합니다. Authorized rendering은 synthetic Admin bootstrap과
MFA browser fixture가 추가되기 전까지 authorization unit·pgTAP과 production
build로 검증합니다.

Accessibility browser E2E는 현재 구현된 public/auth 화면의 route별 title,
단일 H1/main landmark, skip navigation, client route focus, visible form
label/help, keyboard 순서, primary action contrast와 320 CSS px reflow를
검증합니다. 1440px와 320px 실제 browser rendering에서 horizontal overflow가
없음을 확인했습니다. VoiceOver/NVDA와 향후 payment/generation interactive
control은 해당 기능 release gate입니다.

Password recovery E2E는 local Mailpit에서 실제 one-time recovery message를
가져와 PKCE callback, password 변경, global sign-out, 새 password login,
사용된 link replay 거부와 존재하지 않는 계정의 generic response를 검증합니다.
Test runner는 Supabase와 Mailpit의 loopback URL만 허용하며 email action URL,
token과 service credential을 출력하지 않습니다.

`RB-PAY-001` drill은 provider cancellation 불일치를 합성 data로 재현해 안전한
case의 단일 ledger reversal과 replay convergence, Credit reservation이 있는
case의 `review_required` 격리를 검증하고 합성 data를 삭제합니다. CI의
Database/Auth job은 DB, integration, browser와 이 incident drill을 모두
필수로 실행합니다. Local 전체 matrix는 Supabase를 시작한 뒤 다음 command로
실행합니다.

```bash
npm run test:all
```

`npm run validate`는 production build 후 `npm run performance:check`를 실행해
App Router page별 gzip JS/CSS 120 KiB와 개별 asset 64 KiB budget을
검증합니다. AI cost unit test는 versioned microusd rate로 최대 계획 input,
1K image, 추가 text/image와 10,000건 volume projection을 검증합니다.
`npm run security:bundle-check`는 production client JS/CSS에서 server
credential marker와 CI synthetic canary가 발견되면 실패합니다. Security
browser test는 request별 nonce CSP, production unsafe exception 부재,
Next.js script nonce, same-origin과 streaming request limit을 검증합니다.

### Current Automated Matrix

| Capability | Unit/contract | DB/RLS | Integration | Browser/operational | Remaining gate |
| --- | --- | --- | --- | --- | --- |
| Identity/profile | Validation, redirect, middleware | Profile owner isolation | Signup, login, profile, logout | Recovery email, replay, global sign-out | Hosted delivery와 MFA operator fixture |
| Generation/history | Service mapping, upload/additional validation, adapter payload, semantic identity/skin gate, bounded replacement, technical quality | Job metadata, asset, owner RLS | Owner/cross-user history와 state transition | Protected create flow, upload preview, history와 bounded states | Live validator/provider와 R2 |
| Credit/payment/refund | Ledger, reservation, Toss mapping | Invariant, replay, refund | Concurrency와 reconciliation | Payment incident drill | Toss sandbox/production-like E2E |
| Admin/support | Authorization, lookup DTO, correction | RBAC, lookup, audit, least privilege | Domain RPC matrix | Anonymous/ordinary denial | Synthetic MFA Admin positive E2E |
| Repository gate | Docs, type, lint, build, bundle/cost budget | Migration replay | Local Supabase wrappers | Chromium, accessibility와 secret scan | 수동 screen reader와 production operations |

## Checklist

- [x] 테스트 계층과 책임 범위가 정의됐다.
- [x] 핵심 MVP E2E와 접근성 검증 matrix가 정의됐다.
- [x] `security-v1` 위협·통제별 부정 테스트와 운영 검증 matrix가 정의됐다.
- [x] `api-v1` 호환성, 오류, 인가, 멱등성, webhook과 reconciliation 검증 matrix가 정의됐다.
- [x] `storage-v1` key, signed access, content validation, lifecycle, deletion과 outage 검증 matrix가 정의됐다.
- [x] `observability-v1` schema, SLI, error budget, alert, notification, Runbook과 incident 검증 matrix가 정의됐다.
- [x] 증거 계약과 현재 CI baseline이 명시됐다.
- [x] identity unit, local Auth integration, profiles RLS 도구를 구현했다.
- [x] generation history local integration과 browser E2E를 구현했다.
- [x] Password recovery·replay browser E2E와 payment incident drill을 CI에
      포함했다.
- [x] 현재 구현된 핵심 화면의 browser E2E와 accessibility regression을
      구현한다.
- [x] 현재 local에서 실행 가능한 모든 테스트 계층을 CI 필수 gate로 연결했다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Feature Stories](../02_Product/FEATURES.md)
- [Design System](../02_Product/DESIGN_SYSTEM.md)
- [UI Guide](../02_Product/UI_GUIDE.md)
- [Accessibility Checklist](../../.codex/checklists/accessibility.md)
- [Security Checklist](../../.codex/checklists/security.md)
- [Threat Model](../09_Security/THREAT_MODEL.md)
- [Security Architecture](../03_Architecture/SECURITY.md)
- [API Architecture](../03_Architecture/API.md)
- [REST API](../06_API/REST.md)
- [Webhooks](../06_API/WEBHOOKS.md)
- [Storage Architecture](../03_Architecture/STORAGE.md)
- [Data Retention](../10_Data/RETENTION.md)
- [Storage Checklist](../../.codex/checklists/storage.md)
- [Logging Architecture](../03_Architecture/LOGGING.md)
- [Monitoring Architecture](../03_Architecture/MONITORING.md)
- [Observability Checklist](../../.codex/checklists/observability.md)
