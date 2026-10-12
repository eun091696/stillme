# Threat Model

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document is the canonical adversarial model for proposed baseline `security-v1`. It uses STRIDE prompts across the boundaries in [System Context](../03_Architecture/SYSTEM_CONTEXT.md) and maps every material threat to the control catalog in [Security Architecture](../03_Architecture/SECURITY.md).

The current repository is an application scaffold. This threat model approves neither production readiness nor implemented controls.

## Goals

- Identify how identity, data, payments, credits, images, AI, and operations can fail under attack.
- Prioritize threats by business impact and realistic exposure.
- Assign preventive, detective, and recovery controls with owners.
- Make implementation and release evidence mandatory.

## Requirements

### Governance

| Field | Contract |
| --- | --- |
| Model ID | `TM-001` |
| Version | `security-v1` |
| Status | `APPROVED` |
| Owner | Security Engineer |
| Approver | CTO and repository owner |
| Reviewers | Backend, Frontend, Database, AI Engineer, DevOps, QA, PM |
| Method | STRIDE plus abuse, privacy, financial-integrity, and supply-chain analysis |
| Scope | Planned MVP and future privileged support boundary |
| Out of scope | Provider internal infrastructure except merchant/customer shared-responsibility controls |

### Protected Assets

| Class | Assets | Required property |
| --- | --- | --- |
| `RESTRICTED` | Passwords, access/refresh tokens, Supabase secret/service keys, R2 credentials, Toss secret, AI provider key, signing material | Never exposed to browser, logs, analytics, repository, or support |
| `CONFIDENTIAL` | Email, profile, prompt, images, generation history, payment metadata, credit ledger, support evidence | Authorized purpose and least-privilege access only |
| `INTEGRITY_CRITICAL` | Orders, payment status, ledger entries, generation state, ownership, roles, policy versions | Authenticated, atomic, auditable, replay-safe change |
| `INTERNAL` | Redacted logs, analytics, configuration metadata, model/cost telemetry | Controlled access and retention |
| `PUBLIC` | Marketing content, published plan names and prices | Integrity and availability |

### Risk Method

Likelihood and impact are scored from `1` to `4`. Inherent score is likelihood × impact.

| Score | Severity | Required treatment |
| ---: | --- | --- |
| `12–16` | Critical | Prevent release until verified mitigation |
| `8–11` | High | Prevent release or require explicit time-bound Security/CTO exception |
| `4–7` | Medium | Mitigate before affected capability release or document accepted residual risk |
| `1–3` | Low | Track and review on change |

## Implementation

### Security Assumptions

- TLS is available at managed provider edges, but application authorization remains our responsibility.
- Browser input, identifiers, redirects, cookies, headers, event order, and client-visible provider results are untrusted.
- External providers can be unavailable, delayed, duplicated, compromised, or inconsistent.
- Service credentials bypass normal user boundaries and are critical blast-radius multipliers.
- User-generated prompts and images may be malicious, sensitive, illegal, or designed to exploit downstream processors.
- A valid user may attack other users, financial invariants, provider cost, or privileged workflows.

### Threat Register

| ID | STRIDE/category | Threat and affected boundary | Inherent | Required controls | Owner | Residual acceptance target |
| --- | --- | --- | ---: | --- | --- | --- |
| `THR-001` | Spoofing | Stolen, tampered, stale, or cached session impersonates a user across `TB-01`/`TB-02` | 16 | `CTL-IAM-01`, `CTL-APP-03`, `CTL-LOG-01` | Backend | Low after server verification, safe caching, session tests |
| `THR-002` | Elevation/disclosure | IDOR or missing RLS exposes another user's profile, job, image, payment, or ledger row | 16 | `CTL-IAM-02`, `CTL-DB-01` | Backend, Database | Low with two independent verified enforcement layers |
| `THR-003` | Elevation | Service-role key reaches browser or user-scoped client and bypasses RLS | 16 | `CTL-DB-02`, `CTL-SEC-01` | Backend, DevOps | Low after bundle/secret scans and isolated clients |
| `THR-004` | Tampering | Client changes product, amount, currency, actor, or provider result to obtain value | 16 | `CTL-PAY-01`, `CTL-CRD-01` | Backend | Low after server catalog, provider verification, reconciliation |
| `THR-005` | Tampering/replay | Duplicate, concurrent, delayed, or out-of-order payment/generation callbacks create duplicate credit or assets | 16 | `CTL-PAY-01`, `CTL-CRD-01`, `CTL-LOG-01` | Backend, Database | Low with stable idempotency and invariant tests |
| `THR-006` | Tampering | Credit balance overwrite, race, manual abuse, or failed restoration causes financial loss | 16 | `CTL-CRD-01`, `CTL-OPS-01` | Backend, Database | Low with immutable ledger, atomicity, reconciliation |
| `THR-007` | Disclosure | Public bucket, predictable key, weak owner check, leaked signed URL, or unsafe referrer exposes images | 16 | `CTL-STO-01`, `CTL-LOG-01` | Backend, DevOps | Low after private-bucket and cross-user tests |
| `THR-008` | Tampering/execution | Malformed or polyglot image, type spoofing, oversized body, or object overwrite attacks processing/storage | 12 | `CTL-STO-02`, `CTL-APP-01` | Backend | Low after decode, size, checksum, key, and isolation checks |
| `THR-009` | Information disclosure | Secret, token, raw prompt, image, signed URL, PII, or payment data enters log/analytics/error/client bundle | 16 | `CTL-SEC-01`, `CTL-LOG-01`, `CTL-PRV-01` | Security, DevOps | Low after schema, redaction, bundle, and scanning gates |
| `THR-010` | Tampering/disclosure | XSS or unsafe rendering steals sessions or changes privileged requests | 12 | `CTL-APP-01`, `CTL-APP-02` | Frontend | Low after encoding, CSP, dependency, and browser tests |
| `THR-011` | Spoofing/tampering | CSRF or cross-origin request performs state-changing action under a cookie session | 12 | `CTL-APP-03`, `CTL-IAM-01` | Backend, Frontend | Low after origin/token/SameSite tests |
| `THR-012` | Denial/cost abuse | Automated signup, login, generation, download, or payment attempts exhaust service/provider budget | 12 | `CTL-ABU-01`, `CTL-AI-01`, `CTL-OPS-01` | Backend, DevOps | Medium with bounded cost and graceful throttling |
| `THR-013` | AI abuse/privacy | Prompt attacks, prohibited content, sensitive prompt transfer, unsafe output, or unbounded retries cause harm | 12 | `CTL-AI-01`, `CTL-PRV-01` | AI Engineer, Security | Medium after policy, moderation, evaluation, and appeal design |
| `THR-014` | Elevation/repudiation | Admin/support privilege escalation or unaudited manual action alters customer or financial data | 16 | `CTL-IAM-02`, `CTL-IAM-03`, `CTL-LOG-01` | Security, Backend | Low after separate RBAC, MFA, dual control, immutable audit |
| `THR-015` | Repudiation | Missing, mutable, or sensitive audit logs prevent payment, credit, admin, or incident reconstruction | 12 | `CTL-LOG-01`, `CTL-OPS-01` | DevOps, Database | Low after integrity, access, retention, and drill evidence |
| `THR-016` | Disclosure/availability | Account enumeration, brute force, reset abuse, or verification-token leakage compromises auth | 12 | `CTL-IAM-01`, `CTL-ABU-01`, `CTL-LOG-01` | Backend, Security | Low after generic responses, token lifecycle, throttling |
| `THR-017` | Disclosure | Shared ISR/CDN cache stores `Set-Cookie` or user response and authenticates/discloses across users | 16 | `CTL-IAM-01`, `CTL-APP-02` | Frontend, DevOps | Low after dynamic/no-store configuration tests |
| `THR-018` | Supply chain | Compromised dependency, build step, CI token, or deployment identity injects code or steals secrets | 16 | `CTL-SDL-01`, `CTL-SEC-01` | CTO, DevOps | Medium after protected CI, review, scans, provenance |
| `THR-019` | Privacy | Excessive retention, missing deletion, unsafe exports, or broad support access violates user rights | 12 | `CTL-PRV-01`, `CTL-IAM-02`, `CTL-LOG-01` | Security, Database | Medium until retention/deletion policy is approved and tested |
| `THR-020` | Availability/integrity | Provider outage, timeout, ambiguous result, or retry corrupts job/payment/credit state | 12 | `CTL-PAY-01`, `CTL-CRD-01`, `CTL-AI-01`, `CTL-OPS-01` | Backend, DevOps | Medium with state machines, reconciliation, Runbooks |

### Abuse Cases

Security and QA must test at least:

- substitute another user's UUID in every read and write;
- reuse expired/revoked sessions and authentication callbacks;
- replay and concurrently submit identical payment, refund, generation, and restoration requests;
- alter price, currency, credit amount, model, asset key, redirect, and state;
- submit oversized, malformed, script-bearing, or misleading content;
- force provider timeout after external success but before local commit;
- crawl signed URLs, histories, and sequential identifiers;
- trigger rate limits from one actor, many sessions, and distributed sources;
- inject secrets, HTML, control characters, and log-forging content into every text input;
- exercise admin/support actions without role, MFA, approval, or audit.

### Verification Matrix

| Boundary | Required evidence before release |
| --- | --- |
| Authentication/session | Signup/login/reset/logout/session expiry/revocation, fixation, cache, CSRF, enumeration tests |
| Authorization/RLS | Anonymous, owner, other user, privileged role for every operation and user-owned object |
| Payment/credit | Amount/order/actor tamper, duplicate, concurrency, timeout, provider ambiguity, refund, reconciliation |
| AI/generation | Input policy, cost cap, retry cap, provider failure, output validation, credit restoration |
| Storage | Private access, cross-user denial, signed URL expiry/key/method, upload validation, deletion |
| Secrets/logging | Repository/history/build/bundle scan, redaction fixtures, rotation and containment exercise |
| Privileged operations | MFA, RBAC, approval, audit immutability, session revocation, least-privilege review |
| Supply chain | Lockfile, dependency scan, protected deployment identity, least-privilege CI secret review |

### 구현 증적 — Phase 7 보안 경계와 공급망

- Cookie 인증을 사용하는 payment POST endpoint는 동일 origin, JSON media
  type과 16 KiB body limit를 공통 server boundary에서 검증한다. Browser E2E는
  cross-origin 요청 거부, anonymous same-origin 요청의 인증 거부와 oversized
  body 거부를 검증한다.
- 보호 route와 payment API는 `private, no-store`를 사용한다. 전역 응답은
  `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`와 제한적 `Permissions-Policy`를 적용하며 browser
  E2E가 이를 검증한다.
- Next.js는 `15.5.22`, PostCSS는 `8.5.25`, Sharp는 `0.35.3`, JS-YAML은
  `4.3.0`으로 고정했다. Production dependency audit는 finding 0건이다.
- ESLint 9 dependency graph에 필요한 `brace-expansion@1.1.18`은
  `maxLength` OOM 방어 backport를 포함한다. 회귀 test가 누적 출력 한도를
  검증한다. npm advisory `GHSA-mh99-v99m-4gvg`의 현재 범위가 모든 이전
  major를 `<=5.0.7`로 표시해 full development audit에는 이 patched
  backport가 계속 표시된다. Breaking `eslint@4` downgrade를 제안하는
  `npm audit fix --force`는 금지하며 upstream metadata 또는 ESLint ecosystem
  전환 시 제거한다.

### 2026-07-31 Threat와 Privacy Engineering Review

Review `SEC-REV-2026-07-31`은 현재 `main`에 노출된 identity, generation
history, payment/refund, operator, database/RLS, build와 local runtime
경계를 `THR-001`–`THR-020` 및 `CTL-*`에 다시 연결했다.

| Finding | Severity | 처리와 evidence |
| --- | --- | --- |
| `SEC-FIND-001` — enforced CSP 부재 | High | Request별 unpredictable nonce, production `strict-dynamic`, `frame-ancestors 'none'`, `base-uri 'none'`, `object-src 'none'`을 구현했다. Production policy는 `unsafe-inline`과 `unsafe-eval`을 거부하며 unit/browser test가 header와 Next.js script nonce를 검증한다. |
| `SEC-FIND-002` — body limit 전 전체 JSON stream 적재 가능 | High | Payment JSON과 Toss webhook을 `Content-Length` 선검증 및 streaming byte limit로 전환했다. Exact JSON media type, invalid UTF-8, length 누락 oversized body와 malformed body를 자동 검증한다. |
| `SEC-FIND-003` — server credential client bundle regression | High | CI production build에 synthetic server-only canary를 주입하고 `.next/static`에서 canary와 restricted environment marker가 없음을 fail-closed 검사한다. Full-history Gitleaks는 별도로 유지한다. |

검토 범위에서 미해결 critical/high finding이나 승인되지 않은 security exception은
없다. 이는 local·CI 구현 범위의 engineering review 결과이며 production
verification 주장이 아니다. 다음 residual risk는 기능 노출 또는 release 전에
별도 gate를 통과해야 한다.

- `THR-007` live R2 private bucket·signed access evidence는 account credential
  부재로 `BLOCKED`이며 R2-backed production download를 허용하지 않는다.
- `THR-012` distributed rate limit, hosted Auth abuse setting과 provider budget
  alert는 production-like environment에서 검증할 Medium residual risk다.
- `THR-013` live model moderation/provider data-use evidence는 generation
  execution endpoint 공개 전 gate다.
- `THR-018` production deployment identity와 CI secret scope review,
  `THR-019` 법률·subprocessor·notice approval는 Phase 8 release gate다.
- HSTS는 HTTPS production domain이 확정된 뒤 활성화하고 preload를 자동
  선택하지 않는다.

### Risk Acceptance

Exceptions include threat/control IDs, business need, residual likelihood/impact, compensating control, evidence, owner, Security and CTO approvers, expiry, and removal plan. Critical residual risk cannot be accepted for production. A high-risk exception expires within 30 days.

### Official Evidence

- [OWASP Threat Modeling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html)
- [Next.js 15 Data Security](https://nextjs.org/docs/15/app/guides/data-security)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Cloudflare R2 Presigned URL Security](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Toss Payments Payment Verification Flow](https://docs.tosspayments.com/guides/v2/get-started/payment-flow)

## Checklist

- [x] Assets, actors, assumptions, boundaries, threats, and abuse cases are defined.
- [x] Every threat has severity, controls, owner, and residual target.
- [x] Identity, authorization, payments, credits, AI, storage, privacy, operations, and supply chain are covered.
- [x] Verification and risk-acceptance gates are explicit.
- [x] Security Engineer, CTO, and repository owner approve `security-v1`.
- [ ] Required mitigations are implemented and verified in a production-like environment.

## Related Documents

- [System Context](../03_Architecture/SYSTEM_CONTEXT.md)
- [Security Architecture](../03_Architecture/SECURITY.md)
- [Authentication Policy](AUTH_POLICY.md)
- [Secrets Management](SECRETS.md)
- [RLS Policy](RLS_POLICY.md)
- [Privacy](PRIVACY.md)
- [Security Checklist](../../.codex/checklists/security.md)
- [Test Strategy](../04_Engineering/TEST.md)
- [Incident Management](../07_Operations/INCIDENT.md)
