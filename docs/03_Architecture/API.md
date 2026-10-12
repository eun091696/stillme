# API Architecture

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document defines the internal processing architecture for approved contract `api-v1`. Wire shapes are canonical in [REST API](../06_API/REST.md), version policy in [API Versioning](../06_API/VERSIONING.md), and errors in [Error Codes](../06_API/ERROR_CODES.md).

The repository currently contains no product API implementation. Approval defines future behavior; it is not runtime evidence.

## Goals

- Keep transport, identity, authorization, domain logic, persistence, and provider adapters separate.
- Make every mutation replay-safe, observable, and transactionally consistent.
- Apply one contract across Route Handlers, Server Actions, workers, and provider callbacks.
- Prevent browser and provider payloads from becoming trusted domain state directly.

## Requirements

### Governance

| Field | Contract |
| --- | --- |
| Decision ID | `API-001` |
| Contract version | `api-v1` |
| Status | `APPROVED` |
| Owner | Backend Engineer |
| Approver | CTO |
| Required reviewers | Frontend, Database, Security, QA, PM |
| Base path | `/api/v1` |
| Error media type | `application/problem+json` |
| Review trigger | Breaking wire change, new provider callback, new privileged action, or changed economic invariant |

### Entry-Point Rule

Every Route Handler and exported Server Action is treated as externally reachable. A worker or webhook is trusted only for the verified identity/mechanism assigned to that entry point.

## Implementation

### Request Pipeline

1. Establish or generate `request_id`.
2. Enforce method, content type, body size, origin/CSRF, and rate-limit policy.
3. Parse and schema-validate bounded input.
4. Verify caller identity or provider authenticity.
5. Authorize the operation, resource, current state, and requested fields.
6. Acquire and validate idempotency scope for unsafe replayable operations.
7. Execute one domain use case with transaction and concurrency invariants.
8. Persist domain state before emitting outbox/event facts.
9. Map domain result to the versioned response or Problem Details contract.
10. Emit redacted metrics/logs and finalize the idempotency outcome.

Middleware, Proxy, client UI, or route layout may optimize routing but never replaces steps 3–8.

### Layer Boundaries

| Layer | Owns | Must not own |
| --- | --- | --- |
| Transport | HTTP parsing, headers, status, serialization | Business or persistence decisions |
| Identity | Verified actor/provider context | Resource authorization by UI assumption |
| Authorization | Action/resource/field permission | Economic calculation |
| Application | Use-case orchestration and transaction boundary | Provider wire details |
| Domain | State machine, invariants, policy version | HTTP or database client |
| Repository | Persistence, lock/version, RLS context | User-visible errors |
| Provider adapter | Toss, Google AI, R2 translation/reconciliation | Direct customer balance mutation |
| Observability | Redacted facts and correlation | Raw secret, prompt, payment, or signed URL |

### Transaction and Concurrency

- Financial and credit effects commit atomically or converge through a persisted recovery state.
- Every order, payment, refund, credit grant/consume/restore, generation job, and provider receipt has a domain uniqueness constraint independent of response caching.
- Mutable state transitions use row locks, compare-and-set versioning, or equivalent database enforcement.
- External calls are never assumed to roll back with the database; ambiguous results enter reconciliation instead of blind retry.
- Domain events use an outbox or equivalent durable handoff when a post-commit consumer is required.

### Idempotency Architecture

- Unsafe retryable requests require `Idempotency-Key` with UUID v4 syntax.
- Scope is `(api_version, verified_actor_or_provider, operation, key)`.
- A canonical request fingerprint covers method, normalized path, relevant resource IDs, and validated semantic body.
- Same scope/key and same fingerprint replays the original terminal status/body.
- Same key with a different fingerprint returns a conflict and performs no action.
- A duplicate while processing returns an in-progress conflict with retry guidance.
- Transient or ambiguous provider outcomes remain attached to the original key and reconcile before another economic effect.
- Response replay storage may expire under data policy; permanent domain uniqueness does not.

### Official Evidence

- [RFC 9110 HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457.html)
- [Next.js 15 Route Handlers](https://nextjs.org/docs/15/app/getting-started/route-handlers-and-middleware)
- [Supabase Server Authentication](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Toss Payments Payment Flow](https://docs.tosspayments.com/guides/v2/get-started/payment-flow)

## Checklist

- [x] Entry-point processing order and layer ownership are explicit.
- [x] Transaction, external-call ambiguity, concurrency, and outbox rules are defined.
- [x] Idempotency scope, fingerprint, replay, conflict, and domain uniqueness are defined.
- [x] Browser/provider payloads require server validation before domain state.
- [ ] Route Handlers, domain services, repositories, and adapters implement the contract.
- [ ] Contract, concurrency, replay, and reconciliation tests pass.

## Related Documents

- [REST API](../06_API/REST.md)
- [API Versioning](../06_API/VERSIONING.md)
- [Error Codes](../06_API/ERROR_CODES.md)
- [API Authorization](../06_API/AUTHORIZATION.md)
- [Webhooks](../06_API/WEBHOOKS.md)
- [Security Architecture](SECURITY.md)
- [Test Strategy](../04_Engineering/TEST.md)
