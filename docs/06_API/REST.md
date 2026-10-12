# REST API

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document is the canonical HTTP surface for planned `api-v1`. Paths describe the MVP contract and are not evidence that endpoints exist.

## Goals

- Give web, backend, QA, and operations stable resource semantics.
- Use HTTP methods and status codes consistently.
- Make pagination, validation, retries, and correlation predictable.
- Keep sensitive and financial operations server-authorized and replay-safe.

## Requirements

### Common Request Contract

- Base path is `/api/v1`; HTTPS is mandatory outside local development.
- Request and response JSON use UTF-8 `application/json`; errors use `application/problem+json`.
- Unknown request fields are rejected for mutation schemas unless explicitly documented as extensible.
- IDs are opaque UUIDs; clients never infer ownership or ordering from them.
- Timestamps are UTC RFC 3339 strings; money uses integer minor units plus ISO currency; credits use integer units.
- Clients send `Idempotency-Key` on listed unsafe operations and may send `X-Request-ID`; the server validates or replaces unsafe request IDs.
- Server responses include `X-Request-ID`; rate or availability responses include `Retry-After` when known.
- Authenticated/user-specific responses use `Cache-Control: private, no-store`.

### Collection Contract

- Cursor pagination defaults to 20 and allows at most 100 items.
- Responses include opaque `next_cursor` or `null`; clients do not construct cursors.
- Sort order is stable and includes a unique tie-breaker.
- Filters and expansions are explicit allowlists with bounded cardinality.

## Implementation

현재 구현된 payment HTTP surface는 versioned API 통합 전의
`POST /api/payments/orders`, `POST /api/payments/confirm`,
`POST /api/payments/refunds`, `POST /api/payments/reconcile`,
`POST /api/webhooks/toss`입니다. Payment endpoint는 authenticated user만
호출하며, provider 조회 결과와 저장된 주문을 정확히 대조한 경우에만 경제
효과를 반영합니다. Refund는 미사용 전액 환불만 자동 처리하고 reconciliation의
부분 취소·충돌은 `review_required`로 반환합니다.

### Success Shapes

Single resource:

```json
{
  "data": {
    "id": "opaque-uuid"
  },
  "meta": {
    "request_id": "opaque-request-id"
  }
}
```

Collection:

```json
{
  "data": [],
  "page": {
    "next_cursor": null,
    "limit": 20
  },
  "meta": {
    "request_id": "opaque-request-id"
  }
}
```

### Planned MVP Operations

| Method and path | Outcome | Auth | Idempotency | Success |
| --- | --- | --- | --- | --- |
| `GET /api/v1/me` | Minimum current-user profile | User | HTTP safe | `200` |
| `PATCH /api/v1/me` | Update approved profile fields | User | Required | `200` |
| `GET /api/v1/credits/balance` | Own computed balance | User | HTTP safe | `200` |
| `GET /api/v1/credits/transactions` | Own ledger history | User | HTTP safe | `200` |
| `POST /api/v1/orders` | Create server-priced order | User | Required | `201` |
| `POST /api/v1/payments/confirm` | Verify provider result and converge payment/credit state | User | Required | `200` |
| `GET /api/v1/payments/{payment_id}` | Own safe payment summary | User | HTTP safe | `200` |
| `POST /api/v1/generations` | Validate, reserve credit, create job | User | Required | `202` |
| `GET /api/v1/generations/{job_id}` | Own job status/result metadata | User | HTTP safe | `200` |
| `GET /api/v1/generations` | Own generation history | User | HTTP safe | `200` |
| `POST /api/v1/generations/{job_id}/retries` | Create authorized retry under original failure policy | User | Required | `202` |
| `POST /api/v1/assets/{asset_id}/download-authorizations` | Create owner-authorized exact-key GET grant, maximum 10 minutes | User | Required | `201` |
| `POST /api/webhooks/toss` | Receive provider event into durable inbox | Verified provider path | Provider receipt key | `202` or replayed `2xx` |

The API returns no raw storage key. Preview grants expire within 5 minutes, explicit
download grants within 10 minutes, and any future direct upload grant within 5 minutes.
Deletion revokes application access immediately and converges physical removal according
to [Storage](../03_Architecture/STORAGE.md).

### Method and Status Rules

- `GET` and `HEAD` never create domain or economic effects.
- `POST` creates a command or subordinate resource and requires idempotency when retry is plausible.
- `PATCH` applies a validated partial change with current-state/concurrency checks.
- `DELETE` is idempotent at the HTTP boundary but may enqueue a lifecycle operation.
- `201` includes the created representation or location; `202` means durably accepted, not completed.
- `204` has no body.
- Unsupported methods return `405` with `Allow`.

### Idempotency Behavior

| Situation | Response | Side effect |
| --- | --- | --- |
| Missing required key | `400 IDEMPOTENCY_KEY_REQUIRED` | None |
| Invalid key syntax | `400 IDEMPOTENCY_KEY_INVALID` | None |
| First valid request | Normal result | At most one domain command |
| Same key and fingerprint, completed | Original status/body plus `Idempotency-Replayed: true` | None added |
| Same key and fingerprint, processing | `409 REQUEST_IN_PROGRESS` with retry guidance | None added |
| Same key, different fingerprint | `409 IDEMPOTENCY_KEY_REUSED` | None |
| Ambiguous provider outcome | `202` or retryable problem linked to original operation | Reconcile; never mint a new economic operation |

General replay records remain available for at least 24 hours. Payment, refund, credit, and generation uniqueness is enforced by domain records for their required lifecycle regardless of replay-record expiry.

### Rate and Size Contract

Each endpoint declares body-size, page-size, actor, IP/risk, and cost limits before implementation. `429` never reveals another account and includes bounded recovery guidance. Generation and payment use stricter cost and abuse budgets than ordinary reads.

## Checklist

- [x] Base path, media types, identifiers, timestamps, money, cache, and correlation are defined.
- [x] Planned MVP operations map auth, idempotency, and success semantics.
- [x] Method, pagination, rate, size, and replay behavior are explicit.
- [x] Storage paths, signed access, retention, and deletion link to the canonical `storage-v1` contract.
- [ ] OpenAPI/schema artifacts and handlers implement `api-v1`.
- [ ] Contract and end-to-end tests verify every operation and error.

## Related Documents

- [API Architecture](../03_Architecture/API.md)
- [API Versioning](VERSIONING.md)
- [Error Codes](ERROR_CODES.md)
- [API Authorization](AUTHORIZATION.md)
- [Webhooks](WEBHOOKS.md)
- [Feature Stories](../02_Product/FEATURES.md)
- [Storage](../03_Architecture/STORAGE.md)
