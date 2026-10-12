# Storage Rule

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This rule applies the approved `storage-v1` contract to object keys, uploads, downloads, derivatives, lifecycle jobs, deletion, and Cloudflare R2 configuration.

## Goals

- Keep customer content private, isolated, traceable, and deletable.
- Prevent key injection, overwrite, stale authorization, and signed URL leakage.
- Keep database metadata and object state convergent under retries and outages.

## Requirements

- Use environment-isolated private buckets and server-generated keys from the canonical grammar.
- Never place email, prompt text, filename, payment data, or another direct identifier in an object key.
- Authorize actor, asset ownership, state, operation, exact key, and expiry before signing.
- Treat every presigned URL as a reusable bearer credential until expiry.
- Validate content type, byte size, decoded image type/dimensions, checksum, and immutable create semantics.
- Revoke application access before asynchronous physical deletion and verify absence afterward.
- Keep legal transaction records separate from prompts and image bytes.
- Never claim backup, legal compliance, deletion, or restore completion without direct evidence.

## Implementation

Follow: validate intent → allocate database identity/key → authorize → issue narrow grant or server write → verify bytes/checksum → publish metadata atomically → reconcile or delete orphan.

Deletion follows: mark inaccessible → enqueue idempotent deletion → delete every derivative/object → verify absence → minimize metadata → record redacted evidence.

## Checklist

- [ ] Bucket, environment, prefix, owner, purpose, and retention class are declared.
- [ ] Object keys are generated server-side and overwrite-resistant.
- [ ] Signed operation, exact key, headers, expiry, CORS, cache, and logging behavior are tested.
- [ ] Cross-user, expired, tampered, replayed, malformed, oversized, and polyglot cases fail safely.
- [ ] Orphan, partial upload, partial database commit, deletion retry, and provider outage reconcile.
- [ ] Retention, legal hold, deletion evidence, and provider-copy boundaries are reviewed.

## Related Documents

- [Storage Architecture](../../docs/03_Architecture/STORAGE.md)
- [Data Retention](../../docs/10_Data/RETENTION.md)
- [Privacy](../../docs/09_Security/PRIVACY.md)
- [Storage Checklist](../checklists/storage.md)
- [R2 Outage Playbook](../../playbooks/R2_OUTAGE.md)
