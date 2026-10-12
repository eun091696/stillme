# Error Codes

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document defines the stable `api-v1` error contract using RFC 9457 Problem Details. Human-readable text is guidance; clients branch only on HTTP status and stable `code`.

## Goals

- Give clients actionable, safe, machine-readable failures.
- Preserve HTTP semantics while expressing domain recovery.
- Correlate support and operations without exposing implementation details.
- Make retry behavior explicit.

## Requirements

### Problem Shape

Errors use `Content-Type: application/problem+json`.

```json
{
  "type": "https://api.ai-photo-studio.example/problems/credit-insufficient",
  "title": "Insufficient credit",
  "status": 409,
  "detail": "Purchase credits before starting this generation.",
  "instance": "urn:request:opaque-request-id",
  "code": "CREDIT_INSUFFICIENT",
  "request_id": "opaque-request-id",
  "retryable": false,
  "errors": [
    {
      "field": "prompt",
      "code": "REQUIRED"
    }
  ]
}
```

- `type`, `title`, `status`, `code`, `request_id`, and `retryable` are required.
- `detail`, `instance`, and `errors` are optional and never contain secrets, stack traces, SQL, provider bodies, raw prompts, payment details, signed URLs, or another user's existence.
- `errors` uses stable field paths and bounded codes; clients never parse `detail`.
- The HTTP status and body `status` match.
- Unexpected failures use a generic response while full redacted diagnostics stay server-side.

## Implementation

### Canonical Codes

| Code | HTTP | Retryable | Meaning |
| --- | ---: | --- | --- |
| `REQUEST_MALFORMED` | `400` | No | Invalid JSON, content type, encoding, or request syntax |
| `REQUEST_INVALID` | `422` | No | Schema or semantic validation failed |
| `IDEMPOTENCY_KEY_REQUIRED` | `400` | No | Required mutation key missing |
| `IDEMPOTENCY_KEY_INVALID` | `400` | No | Key is not approved UUID v4 syntax |
| `AUTH_REQUIRED` | `401` | No after re-auth | Missing, invalid, expired, or revoked identity |
| `AUTH_FORBIDDEN` | `403` | No | Actor is known but operation is not permitted |
| `RESOURCE_NOT_FOUND` | `404` | No | Resource absent or intentionally concealed from caller |
| `METHOD_NOT_ALLOWED` | `405` | No | Method unsupported; response includes `Allow` |
| `STATE_CONFLICT` | `409` | Inspect state | Resource state/version blocks the command |
| `IDEMPOTENCY_KEY_REUSED` | `409` | No | Same key used with a different fingerprint |
| `REQUEST_IN_PROGRESS` | `409` | Yes | Original keyed request is still processing |
| `CREDIT_INSUFFICIENT` | `409` | No until balance changes | Available credit cannot cover request |
| `PAYMENT_MISMATCH` | `409` | No | Actor, order, amount, currency, or provider result differs |
| `PAYMENT_NOT_CONFIRMED` | `422` | Conditional | Payment is not in a confirmable provider state |
| `GENERATION_REJECTED` | `422` | No without changed input | Input or policy rejects generation before work |
| `RATE_LIMITED` | `429` | Yes | Actor/risk/cost limit reached |
| `UPSTREAM_UNAVAILABLE` | `503` | Yes | Required provider unavailable |
| `UPSTREAM_TIMEOUT` | `504` | Reconcile first | Provider result is unknown or late |
| `INTERNAL_ERROR` | `500` | Conditional | Unexpected internal failure without exposed detail |

New codes are additive only when existing clients safely handle the associated HTTP status. Changing meaning, retry behavior, or status is a versioned contract change.

### Status Selection

- Use `401` for identity failure and include the appropriate authentication challenge when applicable.
- Use `403` for an authenticated actor who cannot perform a known operation.
- Use `404` instead of exposing whether another user's resource exists.
- Use `409` for current-state, concurrency, idempotency, and economic conflicts.
- Use `422` for well-formed requests rejected by validation or provider-state preconditions.
- Use `429`, `503`, or `504` with `Retry-After` when a safe retry time is known.

### Retry Rules

- Clients may automatically retry safe/idempotent HTTP methods after transport failure using bounded exponential backoff and jitter.
- Clients retry unsafe operations only with the original idempotency key and identical semantic request.
- `UPSTREAM_TIMEOUT` and ambiguous payment results require status/reconciliation before another provider command.
- Validation, authz, credit, and key-reuse failures are not blind-retryable.

### Official Evidence

- [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457.html)
- [RFC 9110 HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)

## Checklist

- [x] RFC 9457 shape and extension fields are defined.
- [x] Stable MVP codes map status, retry behavior, and safe meaning.
- [x] Cross-user concealment and prohibited error content are explicit.
- [x] Retry and provider-ambiguity behavior are defined.
- [ ] Problem schemas, localization, and mapping tests are implemented.
- [ ] Every endpoint contract test covers documented failures.

## Related Documents

- [REST API](REST.md)
- [API Versioning](VERSIONING.md)
- [API Authorization](AUTHORIZATION.md)
- [Webhooks](WEBHOOKS.md)
- [Logging](../03_Architecture/LOGGING.md)
- [Security Architecture](../03_Architecture/SECURITY.md)
