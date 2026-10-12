# Security Architecture

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document is the control catalog for proposed baseline `security-v1`. The [Threat Model](../09_Security/THREAT_MODEL.md) owns risks; this document owns mandatory control families and verification outcomes.

## Goals

- Apply default deny, least privilege, defense in depth, and server-side trust.
- Protect identity, user data, prompts, assets, payments, credits, providers, and operations.
- Make security requirements traceable to tests and release gates.
- Distinguish approved design from implemented and verified control.

## Requirements

### Governance

| Field | Contract |
| --- | --- |
| Decision ID | `SEC-001` |
| Version | `security-v1` |
| Status | `APPROVED` |
| Owner | Security Engineer |
| Approver | CTO and repository owner |
| Required reviewers | Backend, Frontend, Database, AI Engineer, DevOps, QA |
| Verification target | OWASP ASVS Level 2-informed MVP baseline plus provider-specific controls |
| Review trigger | New trust boundary, privileged role, provider, sensitive data, critical incident, or material architecture change |

### Control State

| State | Meaning |
| --- | --- |
| `REQUIRED` | Approved design requirement without implementation claim |
| `IMPLEMENTED` | Code/configuration exists but full verification is incomplete |
| `VERIFIED` | Named automated and manual evidence passes in a production-like environment |
| `EXCEPTION` | Time-bound risk acceptance has owner, compensating control, expiry, and approval |

All controls below are `REQUIRED` unless a later evidence record says otherwise.

## Implementation

### Control Catalog

| Control ID | Requirement | Verification evidence |
| --- | --- | --- |
| `CTL-IAM-01` | Verify identity at every sensitive server entry point; never authorize from client UI or an unverified session object | Route/action tests with missing, expired, tampered, and revoked sessions |
| `CTL-IAM-02` | Centralize resource authorization and return only minimum DTO fields | Cross-user and role matrix tests |
| `CTL-IAM-03` | Require verified email for protected MVP actions and MFA for future privileged operators | Auth E2E and admin negative tests |
| `CTL-DB-01` | Enable RLS and explicit privileges on every exposed user-owned table, view, and function | Migration inspection plus positive/negative RLS tests |
| `CTL-DB-02` | Isolate service-role/bypass clients to named server jobs with smallest scope and no user-session mixing | Bundle scan, configuration review, service-path tests |
| `CTL-APP-01` | Validate request shape, size, enum, ownership, state transition, and business invariant on the server | Unit, integration, fuzz/boundary tests |
| `CTL-APP-02` | Encode untrusted output and deploy reviewed CSP and browser security headers | Header scan and XSS test cases |
| `CTL-APP-03` | Protect cookie-authenticated state changes from cross-site requests and validate allowed origins where applicable | CSRF/origin negative tests |
| `CTL-ABU-01` | Rate-limit authentication, generation, payment, download, and recovery by actor and risk signal | Burst, distributed-abuse, lockout, and cost-cap tests |
| `CTL-PAY-01` | Create orders from a server catalog and verify actor, order, amount, currency, provider state, and replay before economic effect | Tamper, replay, duplicate, partial-failure, reconciliation tests |
| `CTL-CRD-01` | Use an immutable credit ledger, atomic invariants, stable idempotency keys, and exactly-once economic outcomes | Concurrency and invariant tests |
| `CTL-STO-01` | Keep R2 private; authorize ownership before narrow operation/object/expiry access; treat signed URLs as bearer secrets | Cross-user, expiry, key-tamper, referrer/log-leak tests |
| `CTL-STO-02` | Validate content type, size, checksum, decode result, and safe generated object key before accepting content | Malformed, oversized, polyglot, and overwrite tests |
| `CTL-AI-01` | Apply prompt limits, safety policy, provider allowlists, output validation, retry caps, and per-user cost budgets | Abuse corpus, policy, retry, and budget tests |
| `CTL-SEC-01` | Keep secrets server-only, environment-separated, least-privileged, inventoried, rotated, and absent from repository/build/logs | Secret scan, client-bundle scan, rotation exercise |
| `CTL-LOG-01` | Record security-relevant facts with request/actor/resource IDs and bounded reason codes; exclude prohibited data | Schema/redaction tests and audit review |
| `CTL-OPS-01` | Alert on guardrails, preserve incident evidence, and provide containment, key rotation, reconciliation, and recovery procedures | Alert drill and incident exercise |
| `CTL-SDL-01` | Pin and review dependencies; require lint, type, build, secret, dependency, security, and documentation gates | CI evidence and dependency review |
| `CTL-PRV-01` | Minimize collection, define purpose/access/retention/deletion, and complete required privacy review before production | Data inventory and deletion/retention tests |

### Mandatory Security Headers

Production responses must define an environment-tested policy for:

- Content Security Policy without broad unsafe exceptions;
- `Strict-Transport-Security` after HTTPS/domain readiness;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy` that prevents signed URL and sensitive query leakage;
- a restrictive `Permissions-Policy`;
- frame protection through CSP `frame-ancestors`;
- explicit cache control for authentication and user-specific responses.

Exact directives depend on provider integrations and must be tested before enforcement.

### 구현된 Phase 7 control slice

| Control | 상태 | Evidence |
| --- | --- | --- |
| `CTL-APP-01` | `IMPLEMENTED` | Payment POST와 Toss webhook의 exact JSON media type, `Content-Length` 선검증, streaming byte limit, malformed UTF-8와 unit/browser boundary test |
| `CTL-APP-02` | `IMPLEMENTED` | Request별 nonce와 `strict-dynamic`을 사용하는 enforced CSP, Referrer, MIME sniffing, frame, permission header, private response cache와 browser E2E |
| `CTL-APP-03` | `IMPLEMENTED` | Cookie-authenticated payment endpoint의 exact same-origin POST 검증과 cross-origin E2E |
| `CTL-SEC-01` | `IMPLEMENTED` | Full-history secret scan과 production client bundle의 restricted server marker/canary scan |
| `CTL-SDL-01` | `IMPLEMENTED` | Next.js/PostCSS/Sharp/JS-YAML patch, 운영·개발 audit 0건, legacy brace-expansion OOM backport 및 Next ESLint glob adapter 회귀 test |

Production domain의 HSTS, provider environment evidence와 전체 control
verification이 남아 있으므로 위 항목은 `VERIFIED`가 아니다.

### 공개 전 의존성 보완 계약

- 공식 패치가 없는 `braces`는 suppress/ignore하지 않는다. 유일한 소비자인 Next ESLint plugin의 `fast-glob`을 `vendor/next-eslint-glob` 로컬 adapter와 고정된 `tinyglobby@0.2.17`로 교체하여 `braces`/`micromatch` 의존성 경로를 제거한다.
- Adapter는 동기 디렉터리 glob, 기본/절대 `rootDir`, Next의 문자열·배열 설정을 검증하며, 길이·중첩·패턴 수를 제한하고 미지원 option은 fail closed한다. Next 규칙이나 전체 audit gate를 제거하지 않는다. Next/ESLint 업데이트 시 실제 plugin integration 및 glob 회귀 test를 다시 실행한다.
- 공개 전에 전체 branch/tag/PR refs와 모든 reachable commit을 동기화·검사한다. 실제 API key, token, private key 및 개인정보는 commit/보고/log/artifact에 포함하지 않는다. 실제 Supabase publishable key도 저장소 예외로 허용하지 않으며, CI 예외는 정확한 가짜 검증 marker 한 개만 허용한다. 이 경계는 `secret-scan-policy.test.mjs`로 회귀 검증한다. 검출 시 마스킹된 위치만 보고하고 공개를 차단한다.
- 운영·개발 audit, 문서·타입·린트·단위·DB/Auth·E2E·build·client bundle 검증과 전체 이력 검사가 모두 통과한 변경만 병합·공개한다.

### Release Gates

- No unresolved critical or high inherent risk may ship without verified mitigation.
- A residual high risk requires written Security and CTO acceptance, compensating control, owner, expiry no longer than 30 days, and rollback/containment plan.
- Critical authorization, payment, credit, secret, asset, and session controls require automated negative tests.
- Production secrets, RLS, provider credentials, CORS/origins, security headers, rate limits, alerts, backup, and incident procedures require environment evidence.
- Documentation approval alone never changes a control from `REQUIRED` to `VERIFIED`.

### Official Evidence

- [OWASP Threat Modeling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html)
- [Next.js 15 Data Security](https://nextjs.org/docs/15/app/guides/data-security)
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase API Security](https://supabase.com/docs/guides/api/securing-your-api)
- [Cloudflare R2 Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Toss Payments Payment Flow](https://docs.tosspayments.com/guides/v2/get-started/payment-flow)

## Checklist

- [x] Control families map to identity, data, application, abuse, payment, credit, storage, AI, secrets, logging, operations, SDLC, and privacy.
- [x] Every control has required verification evidence.
- [x] Design approval and verified implementation are separate states.
- [x] Security headers and risk-exception gates are explicit.
- [x] Repository owner and Security/CTO roles approve `security-v1`.
- [ ] Every required control has implementation and production-like verification evidence.

## Related Documents

- [System Context](SYSTEM_CONTEXT.md)
- [Threat Model](../09_Security/THREAT_MODEL.md)
- [Authentication Policy](../09_Security/AUTH_POLICY.md)
- [Secrets Management](../09_Security/SECRETS.md)
- [RLS Policy](../09_Security/RLS_POLICY.md)
- [Privacy](../09_Security/PRIVACY.md)
- [Security Checklist](../../.codex/checklists/security.md)
- [Test Strategy](../04_Engineering/TEST.md)
