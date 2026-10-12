# API Rule

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This rule applies the approved `api-v1` contract to every Route Handler, exported Server Action, worker command, and provider callback.

## Goals

- Preserve compatibility and HTTP semantics.
- Enforce authentication, authorization, validation, idempotency, and observability consistently.
- Prevent duplicate economic effects and unsafe provider retries.

## Requirements

- Use `/api/v1`, versioned schemas, stable error codes, and RFC 9457 Problem Details.
- Treat every request value and provider payload as untrusted.
- Verify identity/provider, resource, action, fields, and current state on the server.
- Require UUID v4 `Idempotency-Key` for documented unsafe retryable operations.
- Preserve domain uniqueness independently from replay-response storage.
- Return minimum DTOs and exclude secrets, raw prompts/images, payment details, and signed URLs from logs/errors.
- Update REST, versioning, errors, authorization, webhook, test, and release contracts in the same change.

## Implementation

Follow: request ID → transport/rate checks → schema validation → identity → authorization → idempotency → domain transaction → durable event/outbox → response mapping → redacted observability.

Provider ambiguity enters reconciliation. Never retry a financial or credit operation using a new idempotency identity merely because the client or server timed out.

## Checklist

- [ ] Method, path, auth, status, schema, limits, and owner are documented.
- [ ] Success and RFC 9457 failures have contract tests.
- [ ] Anonymous, owner, cross-user, invalid-state, and privileged cases are tested.
- [ ] Replay, changed payload, concurrency, timeout, and partial failure are tested.
- [ ] Version compatibility and rolling deployment are verified.
- [ ] Logs, metrics, errors, and fixtures contain no prohibited data.

## Related Documents

- [API Architecture](../../docs/03_Architecture/API.md)
- [REST API](../../docs/06_API/REST.md)
- [API Versioning](../../docs/06_API/VERSIONING.md)
- [Error Codes](../../docs/06_API/ERROR_CODES.md)
- [API Authorization](../../docs/06_API/AUTHORIZATION.md)
- [Webhooks](../../docs/06_API/WEBHOOKS.md)
