# System Context

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document defines actors, external systems, data flows, and trust boundaries for the planned AI Photo Studio MVP. It is an architecture contract, not evidence that the integrations are implemented.

## Goals

- Make every security boundary explicit before feature implementation.
- Keep identity, payments, credits, prompts, images, and secrets on appropriate trust levels.
- Give the threat model stable flow and boundary identifiers.
- Prevent browser or provider responses from becoming trusted domain facts without server verification.

## Requirements

### System State

The repository currently contains a Next.js 15 application scaffold and documentation. Supabase, R2, Toss Payments, Google AI, analytics, and administration are planned dependencies; no production integration or security validation is claimed.

### Actors

| Actor | Trust | Allowed capability |
| --- | --- | --- |
| Guest | Untrusted | Public pages, signup, login, password recovery |
| Authenticated user | Partially trusted | Own profile, orders, credits, generation jobs, assets |
| Support operator | Privileged | Approved customer-support views and audited actions only |
| Administrator | Highly privileged | Explicit RBAC capabilities with strong authentication and audit |
| Developer/CI | Privileged | Scoped deployment and migration operations |
| External provider | External trust | Contract-specific API or webhook behavior |
| Attacker/automation | Hostile | No authorized capability |

## Implementation

### Context

```text
[Guest / User Browser]
          |
          | TB-01 HTTPS, untrusted input and cookies
          v
[Next.js 15 on Vercel]
  Server Components / Route Handlers / future Server Actions
     |        |          |          |           |
     | TB-02  | TB-03    | TB-04    | TB-05     | TB-06
     v        v          v          v           v
[Supabase] [Google AI] [Cloudflare R2] [Toss Payments] [Telemetry]
 Auth/DB    generation    private assets  payment API    redacted events
     ^
     |
     | TB-07 verified callbacks / provider reconciliation
     |
[External provider callbacks]
```

### Trust Boundaries

| Boundary | Data crossing | Trust rule |
| --- | --- | --- |
| `TB-01` Browser ↔ Next.js | Input, cookies, UI responses | Treat all request values and client state as attacker-controlled |
| `TB-02` Next.js ↔ Supabase | Auth claims, queries, migrations | Per-request user context; service credentials isolated; RLS plus server authorization |
| `TB-03` Next.js/worker ↔ Google AI | Prompt, generation options, result | Server-only credential; allowlisted model/options; minimize user data |
| `TB-04` Next.js/worker ↔ R2 | Object bytes, keys, signed access | Private bucket; server authorizes ownership before narrow time-bound access |
| `TB-05` Next.js ↔ Toss | Order, amount, payment key, status | Server-owned order truth; verify provider response; idempotent economic effect |
| `TB-06` Application ↔ telemetry | IDs, status, metrics, logs | Bounded schema and redaction; never credentials, raw prompt, image, signed URL, or payment details |
| `TB-07` Provider callback ↔ Next.js | External event and identifiers | Authenticate or re-query provider, reject replay, persist before side effects |

### Core Data Flows

| Flow | Sequence | Security outcome |
| --- | --- | --- |
| `DF-01` Authentication | Browser → Next.js/Supabase Auth → session cookie → verified server identity | Client session display never replaces server identity verification |
| `DF-02` User data | Browser → Next.js → Supabase with actor context | Server ownership check and RLS both enforce isolation |
| `DF-03` Generation | User request → server validation/credit reservation → worker/provider → R2 → metadata/ledger | One authenticated job owns every state, asset, cost, and credit effect |
| `DF-04` Payment | Server order → browser provider UI → server verification → payment record/credit ledger | Browser/provider redirect alone cannot grant credits |
| `DF-05` Download | User request → server ownership/asset-state check → short-lived GET authorization | Bucket remains private and URL is treated as a bearer secret |
| `DF-06` Operations | Privileged actor → separately authorized action → immutable audit record | UI hiding alone never grants or denies privilege |

### Cache and Rendering Boundary

- Authenticated or session-refreshing responses are dynamic and must not be shared-cached.
- Responses that set or depend on session cookies use `Cache-Control: private, no-store`.
- Public static content must not embed user-specific data or server secrets.
- Every Route Handler and exported Server Action is treated as an externally reachable endpoint with its own authentication, authorization, validation, and rate-limit decision.

## Checklist

- [x] Actors, external systems, trust boundaries, and core data flows are identified.
- [x] Browser, service, provider, telemetry, and privileged-operation trust rules are explicit.
- [x] Current scaffold state is separated from planned architecture.
- [x] Authenticated response caching is treated as a cross-user disclosure risk.
- [ ] Implementation evidence confirms each boundary and flow.

## Related Documents

- [Architecture](ARCHITECTURE.md)
- [Security Architecture](SECURITY.md)
- [Threat Model](../09_Security/THREAT_MODEL.md)
- [Authentication Policy](../09_Security/AUTH_POLICY.md)
- [RLS Policy](../09_Security/RLS_POLICY.md)
- [Storage](STORAGE.md)
- [API Authorization](../06_API/AUTHORIZATION.md)
