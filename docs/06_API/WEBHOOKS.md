# Webhooks

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document defines authenticated ingestion, durable receipt, idempotency, ordering, processing, reconciliation, and recovery for external callbacks. Provider payloads are untrusted until verified.

## Goals

- Prevent forged, replayed, duplicated, delayed, or reordered callbacks from changing domain state incorrectly.
- Acknowledge only durably accepted work.
- Separate provider receipt from economic processing.
- Make ambiguous and failed processing recoverable without duplicate effects.

## Requirements

### Provider Verification

- Use the exact verification mechanism documented for the contracted provider and event type.
- If a provider signs callbacks, verify the signature against raw bytes, expected algorithm/key, timestamp tolerance, endpoint/environment, and constant-time comparison before parsing side effects.
- Do not invent a signature header when a provider event type does not supply one.
- For Toss general-payment events without a supported signature, authenticate the server-to-provider query and compare the provider payment with the stored order, actor, amount, currency, payment key, and allowed status before any economic effect.
- Provider secret, signature, raw authorization header, payment detail, and full payload never enter general logs or analytics.

## Implementation

Toss `PAYMENT_STATUS_CHANGED`의 현재 handler는 `/api/webhooks/toss`입니다.
전송 ID와 bounded raw-body hash로 receipt를 식별하고, payload의 결제 키로
Toss API를 다시 조회한 뒤 주문 번호, 금액, 통화와 상태를 서버 주문과
대조합니다. 같은 전송 ID와 hash는 기존 결과를 반환하고, 같은 ID의 변경된
payload는 격리합니다. 경제 효과는 주문 단위 uniqueness도 별도로 강제합니다.

### Ingestion Sequence

1. Enforce HTTPS, method, content type, body size, endpoint/provider, environment, and rate limits.
2. Capture raw bytes only in bounded memory needed for verification.
3. Verify signature or provider-retrieval mechanism.
4. Parse a strict allowlisted schema.
5. Derive receipt identity from provider, environment, event/payment ID, event type/version, and payload hash.
6. Insert a unique durable inbox receipt with `received` state before acknowledging.
7. Return `202` for new durable receipt or safe `2xx` for an already accepted duplicate.
8. Process asynchronously through an idempotent domain handler.
9. Record `processed`, `ignored`, `retry_scheduled`, `reconciliation_required`, or `dead_lettered`.

### Receipt Contract

| Field | Purpose |
| --- | --- |
| Provider/environment | Prevent test/live and cross-provider collision |
| Provider event/payment ID | Primary deduplication identity |
| Event type/schema version | Adapter selection |
| Payload hash | Detect same ID with changed content |
| Received/occurred timestamps | Ordering and latency |
| Verification result/version | Evidence of authenticity mechanism |
| Processing state/attempt | Recovery control |
| Request/trace ID | Redacted correlation |
| Domain reference | Order/payment/job after verified mapping |

Raw payload storage is restricted, encrypted, access-audited, and subject to approved retention; store only minimum parsed fields when raw retention is unnecessary.

### Replay and Ordering

- Same receipt ID/hash returns prior acceptance and adds no effect.
- Same provider ID with a different hash is quarantined and alerted.
- State transitions validate current state and provider truth; arrival order never determines truth alone.
- Terminal local state is not regressed by an older event.
- Missing intermediate events trigger provider reconciliation.
- Economic handlers also enforce domain uniqueness, so inbox deduplication is not the only defense.

### Failure and Retry

- Verification/schema failures return non-success and create a redacted security metric without domain processing.
- A durable valid receipt receives success even if asynchronous processing later fails.
- Retry uses bounded exponential backoff and jitter with the same receipt/domain idempotency identity.
- Ambiguous provider results are queried before retrying a financial command.
- Exhausted processing goes to restricted dead letter with owner, alert, replay procedure, and audit.
- Manual replay references the original receipt and cannot edit the payload or mint a new economic identity.

### Response Rules

| Condition | Response |
| --- | --- |
| Verified and durably new | `202` |
| Verified duplicate already accepted | Stable `2xx` |
| Unsupported method/media type | `405`/`415` |
| Invalid authenticity | `401` or `400` per provider retry contract |
| Invalid schema/size | `400`/`413`/`422` |
| Inbox unavailable before persistence | `503` |

Provider-specific retry behavior is tested before choosing whether an invalid callback receives a retryable status.

### Official Evidence

- [Toss Payments Payment Flow](https://docs.tosspayments.com/guides/v2/get-started/payment-flow)
- [Toss Payments Quick Reference](https://docs.tosspayments.com/guides/v2/get-started/llms-quick-reference)
- [RFC 9110 HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)

## Checklist

- [x] Provider-specific authenticity and Toss re-query behavior are defined.
- [x] Durable inbox, identity, hash, state, acknowledgement, and async processing are defined.
- [x] Replay, changed payload, out-of-order, retry, reconciliation, dead letter, and manual replay are controlled.
- [x] Sensitive payload and retention boundaries are explicit.
- [x] Toss provider contract unit fixture와 durable receipt processor가 구현됐다.
- [x] 불일치, replay, 변경 payload와 provider timeout 검증이 통과한다.
- [ ] Out-of-order recovery와 정기 reconciliation test가 통과한다.

## Related Documents

- [REST API](REST.md)
- [API Architecture](../03_Architecture/API.md)
- [API Authorization](AUTHORIZATION.md)
- [Error Codes](ERROR_CODES.md)
- [Payments](../01_Business/PAYMENTS.md)
- [Threat Model](../09_Security/THREAT_MODEL.md)
- [Payment Failure Playbook](../../playbooks/PAYMENT_FAILURE.md)
