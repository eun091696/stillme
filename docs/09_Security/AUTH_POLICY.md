# Authentication Policy

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document defines the `security-v1` identity, session, recovery, and privileged-authentication contract for Supabase Auth with Next.js App Router. It does not claim that authentication is implemented.

## Goals

- Verify identity at every sensitive server boundary.
- Prevent enumeration, token leakage, session confusion, and cross-user caching.
- Separate authentication, session management, and authorization.
- Require stronger controls for privileged roles.

## Requirements

### Identity Contract

- MVP supports email/password with mandatory email verification before protected product actions.
- Server code uses a per-request Supabase client and verifies identity with validated claims or a fresh Auth-server lookup.
- An object returned from unverified session storage is not authorization evidence.
- Client navigation guards and hidden controls are usability only; Route Handlers, exported Server Actions, data access, and RLS enforce security independently.
- Authorization uses stable server-owned user and role identifiers, not email, client metadata, URL parameters, or mutable profile fields.

### Session Contract

- Use the supported Supabase SSR cookie and PKCE flow for Next.js.
- Apply `Secure` in non-local HTTPS environments, an appropriate `SameSite` policy, path/domain minimization, and provider-recommended token rotation.
- Do not put access, refresh, verification, recovery, or authorization tokens in application logs, analytics, error reports, or long-lived URLs.
- Authenticated and token-refreshing responses are dynamic with `Cache-Control: private, no-store`; they must not use shared ISR/CDN caching.
- Logout, password reset, account disablement, role change, suspected compromise, and administrative revocation have explicit session invalidation behavior.

### Failure and Recovery

- Signup, login, reset, and resend responses do not reveal whether an account exists beyond approved product behavior.
- Apply actor/IP/risk-based throttling without allowing an attacker to permanently lock out a victim.
- Recovery and verification tokens are single-purpose, time-bound, replay-resistant, and invalidated after successful use.
- Redirect destinations use an allowlist and cannot be supplied as arbitrary external URLs.
- Sensitive account change requires recent authentication; privileged change requires MFA and audit.

## Implementation

### Server Entry-Point Sequence

1. Parse bounded input and cookies/authorization header.
2. Establish a per-request auth client.
3. Verify identity; reject missing, expired, invalid, or revoked context.
4. Load server-owned role and resource context when needed.
5. Authorize the exact operation and current resource state.
6. Execute the domain action through RLS-protected or separately justified service access.
7. Return a minimum DTO and record a redacted security event.

### Privileged Roles

- Admin and support identities are separate explicit roles with no privilege derived from email domain.
- MFA is mandatory before any production privileged action.
- Privileged sessions have shorter inactivity and absolute limits than user sessions.
- Credit, refund, data export, impersonation, role, and deletion actions require reason and immutable audit; high-impact actions require dual control.
- Impersonation, if ever added, is time-bound, visibly indicated, read-only by default, and cannot reveal credentials or secrets.

### Required Tests

| Area | Negative evidence |
| --- | --- |
| Session | Missing, expired, malformed, revoked, wrong-environment, and replayed token |
| Cache | No authenticated body or `Set-Cookie` shared between two users |
| Entry point | Direct access to nested route, Route Handler, and exported Server Action |
| Recovery | Enumeration, expired/replayed token, open redirect, resend abuse |
| CSRF | Cross-site unsafe request, disallowed Origin, cookie-only forged action |
| Role | User attempts admin/support action; stale role claim after revocation |

### Implemented Evidence — Identity Foundation 1

- `src/middleware.ts` refreshes Supabase SSR cookies only on auth/account routes.
- Server Actions and `/account` call `auth.getUser()` before protected work.
- Login failures use a generic user-facing message and return paths accept only
  internal absolute paths.
- Local integration tests execute signup, profile creation/update, logout,
  re-login, and anonymous protected-route denial.

This evidence covers only the first local identity slice for `THR-001`,
`THR-002`, `THR-003`, and part of `THR-016`/`THR-017`. Hosted verification,
recovery, expiry/revocation, abuse controls, cache isolation, CSRF, and
production configuration remain required.

### Implemented Evidence — Operator RBAC Foundation

Migration `20260728000700_create_operator_rbac.sql`은 이메일·profile metadata와
분리된 Admin·Support assignment, server-owned permission mapping과
`operator_has_permission` RPC를 구현합니다. Production privileged check는
`aal2`를 요구합니다. Role grant·revoke는 서로 다른 MFA Admin의 요청과 승인,
24시간 expiry, idempotency key와 immutable audit event를 한 transaction에서
강제하며 마지막 active Admin 회수를 거부합니다. 실제 Admin bootstrap과
production MFA enrollment evidence는 후속 운영 승인이 필요합니다.
`/admin`은 middleware redirect와 Server Component 재검증을 함께 사용합니다.
Verified user만 MFA-gated `operator.read` permission을 확인할 수 있고
permission 부재·RPC failure는 모두 404로 fail closed합니다.

### 구현 증적 — Recovery와 request boundary

- Local Mailpit browser E2E는 recovery email, PKCE callback, password 변경,
  global sign-out, 새 password login, one-time link replay 거부와
  account-enumeration-safe reset 응답을 검증한다.
- Cookie 인증을 사용하는 payment POST endpoint는 exact same-origin과 JSON
  body limit를 인증 전에 검증한다. Cross-origin 요청은 `403`, oversized
  요청은 `413`, same-origin anonymous 요청은 `401`로 분리된다.
- `/account`, `/admin`, `/generations`와 payment API는
  `Cache-Control: private, no-store`를 적용하고 browser E2E로 검증한다.

Hosted email delivery, production cookie 설정, abuse throttling과 실제 session
revocation 운영 증적은 여전히 release 전에 필요하다.

### Official Evidence

- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [Next.js 15 Data Security](https://nextjs.org/docs/15/app/guides/data-security)
- [Supabase SSR Client Guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase Auth `getUser`](https://supabase.com/docs/reference/javascript/auth-getuser)
- [Supabase SSR Advanced Guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)

## Checklist

- [x] Server identity verification and authorization are separate.
- [x] SSR cookie, PKCE, cache, recovery, redirect, and revocation rules are defined.
- [x] Client guards are not treated as a security boundary.
- [x] Privileged authentication and audit requirements are explicit.
- [ ] Auth flows and negative tests are implemented.
- [ ] Production session configuration and revocation are verified.
- [x] Local signup, login, logout, protected route, and profile flow are tested.
- [x] Operator role permission과 dual-control approval boundary가 local database에서 검증됐다.

## Related Documents

- [Product Authentication](../02_Product/AUTH.md)
- [System Context](../03_Architecture/SYSTEM_CONTEXT.md)
- [Security Architecture](../03_Architecture/SECURITY.md)
- [Threat Model](THREAT_MODEL.md)
- [RLS Policy](RLS_POLICY.md)
- [API Authorization](../06_API/AUTHORIZATION.md)
- [Secrets Management](SECRETS.md)
