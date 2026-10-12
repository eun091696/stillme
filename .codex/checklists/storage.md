# Storage Checklist

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This checklist is the design, implementation, and release gate for `storage-v1`. Checked design items do not prove that R2 buckets, lifecycle rules, jobs, or tests exist.

## Goals

- Turn the storage lifecycle into reviewable evidence.
- Prevent private content exposure, overwrite, orphan accumulation, and incomplete deletion.
- Preserve truthful implementation and production-readiness claims.

## Requirements

- Evidence names the environment, bucket class, object class, command or test, result, owner, date, and known gaps.
- Security-relevant evidence maps `THR-007`, `THR-008`, `THR-009`, `THR-019`, `CTL-STO-01`, `CTL-STO-02`, and `CTL-PRV-01`.
- Exceptions are time-bound and record compensating control, removal plan, and Security/CTO approval.

## Implementation

### Required Evidence

| Surface | Required evidence |
| --- | --- |
| Bucket/IAM | Private access, environment isolation, least-privilege tokens, no public/custom-domain path |
| Keys | Canonical grammar, server generation, UUID validation, no PII, traversal or overwrite |
| Upload | Method/key/header binding, expiry, CORS, size/type/decode/checksum, partial failure |
| Download | Owner/state authorization, exact GET key, expiry, private/no-store, no referrer/log leak |
| Lifecycle | Staging/quarantine rules, multipart abort, orphan scan, derivative-parent coupling |
| Deletion | Immediate logical denial, idempotent physical delete, absence verification, retry/reconciliation |
| Retention | Purpose, period/event, legal basis or product owner, hold, deletion owner, provider-copy behavior |
| Recovery | R2 outage, DB/object divergence, retry safety, no unverified backup/restore claim |

## Checklist

### Design Gate

- [x] Environment and bucket boundaries are defined.
- [x] Object key grammar and immutable-write rules are defined.
- [x] Signed URL method and TTL matrix is defined.
- [x] Staging, quarantine, active asset, orphan, and deletion lifecycles are defined.
- [x] User-content retention is separated from statutory transaction records.
- [x] Official provider and statutory evidence is recorded.

### Implementation Gate

- [ ] R2 buckets, CORS, lifecycle rules, IAM, and secret delivery match `storage-v1`.
- [ ] Database schema and jobs implement the state machine, deletion ledger, and reconciliation.
- [ ] Upload/download authorization and validation tests pass.
- [ ] Cross-user, key tamper, expiry, cache/referrer, overwrite, and content-abuse tests pass.
- [ ] Orphan and deletion jobs are idempotent and tested during R2/DB failure.

### Release Gate

- [ ] Staging evidence confirms private access and environment isolation.
- [ ] Deletion and lifecycle timing are measured against the documented objective.
- [ ] Legal/privacy review approves customer notice, statutory classification, and provider-copy handling.
- [ ] Alerting, Runbook, restore position, credential revocation, and incident exercise are complete.

## Related Documents

- [Storage Architecture](../../docs/03_Architecture/STORAGE.md)
- [Data Retention](../../docs/10_Data/RETENTION.md)
- [Security Checklist](security.md)
- [Test Strategy](../../docs/04_Engineering/TEST.md)
- [R2 Outage Playbook](../../playbooks/R2_OUTAGE.md)
