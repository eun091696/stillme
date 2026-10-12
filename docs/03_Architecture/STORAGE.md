# Storage Architecture

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document is the canonical `storage-v1` contract for planned Cloudflare R2 object storage. It defines private bucket boundaries, object key grammar, signed access, validation, lifecycle, retention, deletion, and reconciliation. It does not claim that any bucket, credential, lifecycle rule, API, job, or test exists.

## Goals

- Keep every prompt-derived image private and owner-authorized.
- Make object state deterministic under retry, concurrency, and provider failure.
- Minimize data while preserving the approved generation history experience.
- Make deletion timely, idempotent, auditable, and testable.

## Requirements

### Governance

| Field | Contract |
| --- | --- |
| Decision ID | `STO-001` |
| Version | `storage-v1` |
| Status | `APPROVED` |
| Owners | Backend Engineer, DevOps Engineer |
| Approvers | CTO, Security Engineer |
| Reviewers | AI Engineer, Database Engineer, QA, PM, Document Writer |
| Threat/control scope | `THR-007`, `THR-008`, `THR-009`, `THR-019`; `CTL-STO-01`, `CTL-STO-02`, `CTL-PRV-01` |
| Review trigger | Provider/region change, new upload type, public sharing, retention change, security incident, or legal requirement |

All controls are design requirements until implementation and production-like evidence satisfy the [Storage Checklist](../../.codex/checklists/storage.md).

### Bucket and Credential Boundaries

| Bucket class | Naming contract | Access |
| --- | --- | --- |
| Private assets | `ai-photo-studio-{environment}-private` | Application/worker credentials scoped to required object operations |
| Quarantine | `ai-photo-studio-{environment}-quarantine` | Security/worker only; no user signing path |

- Development, staging, and production use separate buckets and credentials; environment is not selected from client input.
- Customer content has no public bucket, `r2.dev` exposure, or custom-domain origin.
- The browser never receives an R2 credential or list permission.
- Signing credentials are server-only, environment-scoped, inventoried, and independently revocable.

### Object Key Grammar

R2 is flat object storage; `/` is a prefix delimiter rather than a directory boundary. The server generates every lowercase key from validated database UUIDs:

```text
users/{user_id}/generation-jobs/{job_id}/assets/{asset_id}/original.{ext}
users/{user_id}/generation-jobs/{job_id}/assets/{asset_id}/derivatives/{derivative_type}/{derivative_id}.{ext}
users/{user_id}/staging/generation-jobs/{job_id}/attempts/{attempt_id}/{object_id}.{ext}
quarantine/{yyyy}/{mm}/{dd}/{object_id}.{ext}
```

- Allowed extensions are derived from decoded content: `png`, `jpg`, or `webp`.
- `derivative_type` is a server allowlist such as `thumbnail_256` or `preview_1024`.
- Keys never contain email, display name, prompt, original filename, payment data, sequential ID, `..`, encoded separator, or user-controlled free text.
- Keys are immutable and never reused. Create uses conditional/unique semantics; replacement allocates a new asset or derivative ID.
- Database metadata is the authority for owner, job, state, checksum, content type, size, dimensions, retention class, and deletion state. Clients never submit or infer a storage key.

### Signed Access Matrix

| Purpose | R2 operation | Maximum TTL | Additional contract |
| --- | --- | --- | --- |
| Browser preview | `GET` | 5 minutes | Owner + `available` state; safe inline type; private/no-store |
| Explicit download | `GET` | 10 minutes | Fresh owner check; attachment filename generated separately from key |
| Direct upload when approved | `PUT` | 5 minutes | Exact staging key, content type and checksum headers; one object only |
| Metadata check | `HEAD` | Server only | No browser grant |
| Delete | `DELETE` | Server only | Lifecycle job; never delegated to browser |

- A presigned URL is a bearer credential and may be reused until it expires; the system does not describe it as one-time.
- Signing requires verified identity, asset ownership, allowed state, exact operation, exact object key, and bounded TTL.
- URLs, signatures, query strings, prompts, and image bytes are excluded from logs, analytics, errors, support tools, and referrers.
- Authorization responses use `Cache-Control: private, no-store` and a restrictive referrer policy. CORS allowlists production origins, exact methods, and required headers only.
- Existing signed URLs cannot be centrally revoked as a session; urgent containment deletes/blocks the object or revokes the scoped credential. Short TTL limits exposure.

## Implementation

### Write and Publish State Machine

```text
allocated → uploading → validating → available
                    ↘ rejected → quarantined/deleting → deleted
                    ↘ failed → deleting → deleted
```

1. Create owner/job/asset identifiers and the expected immutable key in the database.
2. Upload through a server boundary or narrow `PUT` authorization.
3. Enforce a 25 MiB object limit for MVP image assets, allowlisted type, decoded type/dimensions up to 8192×8192, and SHA-256 checksum.
4. Verify object metadata and checksum after write; `Content-Type` alone is never trusted.
5. Publish `available` only after object and database metadata agree.
6. A failed database commit, checksum mismatch, or abandoned attempt remains inaccessible and enters idempotent cleanup/reconciliation.

### Lifecycle and Retention

| Object class | Accessible period | Cleanup objective |
| --- | --- | --- |
| Active original | While asset is active and owner account is active | User/account deletion or approved retention event |
| Derivative/thumbnail | Never longer than parent | Delete with parent |
| Staging/failed upload | Never user-readable | Expire after 24 hours; orphan scan verifies cleanup |
| Incomplete multipart upload | Never user-readable | Abort after 24 hours |
| Quarantine | Security only | Delete after 7 days unless incident/legal hold |
| Orphan without valid metadata | Never user-readable | Detect within 24 hours and delete within the next 24 hours |

R2 lifecycle deletion can occur after the configured expiration boundary, so application authorization denies non-active objects immediately and must not depend on provider cleanup timing. Active user assets do not receive an age-only lifecycle expiry because the approved MVP includes generation history and download.

### Deletion Contract

1. Authenticate/re-verify the actor and authorize the asset, account, or approved privileged request.
2. Atomically mark metadata `deleting`; stop preview/download authorization immediately.
3. Enqueue an idempotent deletion command keyed by asset/account and deletion generation.
4. Delete original, every derivative, staging residue, and applicable provider copy.
5. Verify R2 `HEAD`/metadata absence and reconcile retries; a missing object is successful idempotent convergence.
6. Mark `deleted`, remove or minimize content metadata, and retain only a redacted deletion receipt allowed by [Data Retention](../10_Data/RETENTION.md).

The target is immediate logical denial and physical R2 deletion within 24 hours. An incident or legally authorized hold must be separately approved, access-isolated, time-bounded, and must not retain unrelated content. Signed URLs issued before deletion may fail once the object is removed; callers must handle `404`/`403` without revealing prior ownership.

### Reconciliation and Recovery

- Compare database `storage_key`, state, checksum, and size with R2 metadata without listing data to users.
- Retry writes and deletes with stable operation identities; never overwrite an existing key to “repair” ambiguity.
- Alert on unavailable metadata with present objects, available metadata with missing objects, expired staging, overdue deletion, checksum mismatch, or unexpected bucket exposure.
- R2 durability is not a backup. No restore or undelete promise exists until a separate backup design is approved and exercised.
- During R2 outage, do not finalize generation success or permanent credit consumption until storage outcome is known; follow the [R2 Outage Playbook](../../playbooks/R2_OUTAGE.md).

### Official Evidence

- [Cloudflare R2 Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Cloudflare R2 Object Lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- [Cloudflare R2 Objects and Prefixes](https://developers.cloudflare.com/r2/objects/)
- [Cloudflare R2 Upload Objects](https://developers.cloudflare.com/r2/objects/upload-objects/)
- [Cloudflare R2 Consistency](https://developers.cloudflare.com/r2/reference/consistency/)

## Checklist

- [x] Environment, bucket, credential, and public-access boundaries are defined.
- [x] Collision-resistant object key grammar and metadata authority are defined.
- [x] Signed URL operation, TTL, cache, CORS, and leakage rules are defined.
- [x] Validation, publish, lifecycle, deletion, and reconciliation behavior are defined.
- [x] Retention distinguishes active, staging, quarantine, orphan, and deleted content.
- [x] Immutable original key, private upload, object verification, and bounded download presign adapter are implemented and unit tested.
- [ ] R2 configuration, database schema, APIs, jobs, and tests implement `storage-v1`.
- [ ] Production-like evidence satisfies the Storage and Security checklists.

## Related Documents

- [System Context](SYSTEM_CONTEXT.md)
- [Data Model](DATA_MODEL.md)
- [Security Architecture](SECURITY.md)
- [REST API](../06_API/REST.md)
- [Privacy](../09_Security/PRIVACY.md)
- [Data Retention](../10_Data/RETENTION.md)
- [Image Pipeline](../05_AI/IMAGE_PIPELINE.md)
- [Storage Checklist](../../.codex/checklists/storage.md)
