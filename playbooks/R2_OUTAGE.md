# R2 Outage

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This playbook contains planned response steps for Cloudflare R2 upload, download, metadata, lifecycle, or deletion failure. It is not evidence that alerts, dashboards, queues, credentials, or recovery automation exist.

## Goals

- Protect private content and prevent false generation success.
- Preserve enough redacted evidence to reconcile database and object state.
- Restore service without overwriting objects, duplicating charges, or falsely completing deletion.

## Requirements

- Record incident ID, request/job/asset IDs, environment, affected operation, first/last failure, and user impact without URLs, signatures, prompts, images, or credentials.
- Check Cloudflare status, application/provider errors, recent deploy/configuration/IAM/lifecycle changes, and affected prefixes.
- Do not make a bucket public, broaden credentials/CORS, disable authorization, or issue long-lived URLs as mitigation.
- Destructive bulk operations and credential rotation require named Incident Commander, Security/DevOps review, exact target, rollback/containment, and evidence.

## Implementation

### Detect and Triage

1. Classify impact: upload, publish, preview/download, lifecycle, deletion, or broad R2/API outage.
2. Stop finalizing affected generation jobs; preserve stable operation IDs and credit reservation state.
3. Block new signed grants if ownership/state cannot be verified.
4. Identify database/object divergence by exact opaque identifiers; never expose bucket listing to customers.

### Contain

| Failure | Safe containment |
| --- | --- |
| Upload/metadata ambiguous | Keep asset non-`available`; enqueue reconciliation with the original operation identity |
| Download failure | Return bounded retry guidance; do not bypass private access |
| Suspected exposure | Stop signing, disable public path, revoke scoped credential, preserve redacted evidence |
| Deletion overdue | Keep logical denial; retry exact-key delete and verify absence |
| Lifecycle misconfiguration | Stop new affected writes when necessary; review exact rule/prefix before change |
| Checksum mismatch | Quarantine or delete object; never publish or overwrite in place |

### Recover and Reconcile

1. Verify provider health and least-privilege credentials in the affected environment.
2. Reconcile database state, exact R2 key, checksum, size, and lifecycle class.
3. Resume idempotent writes/deletes using the original job/asset/deletion identity.
4. Mark `available` only after metadata and object evidence agree.
5. Confirm expired staging/quarantine and overdue deletions converge.
6. Reconcile credit reservation/consumption according to generation outcome; storage ambiguity cannot become permanent consumption.
7. Notify affected users with status and recovery behavior without revealing internals or another user.

### Close

Document timeline, root cause, affected classes/counts, containment, reconciliation totals, unresolved objects, credential action, user communication, tests, and owners/dates for prevention. A provider recovery alone does not close the incident while divergence or overdue deletion remains.

## Checklist

- [ ] Private access and environment isolation remained intact.
- [ ] No false success, duplicate asset, overwrite, or permanent credit loss occurred.
- [ ] Database/object/checksum and deletion reconciliation completed.
- [ ] Signed URL, secret, prompt, image, and payment data stayed out of evidence.
- [ ] User impact and recovery were verified.
- [ ] Follow-up tests, alerts, and documentation owners are recorded.

## Related Documents

- [Storage Architecture](../docs/03_Architecture/STORAGE.md)
- [Data Retention](../docs/10_Data/RETENTION.md)
- [Generation Pipeline](../docs/05_AI/IMAGE_PIPELINE.md)
- [Incident Management](../docs/07_Operations/INCIDENT.md)
- [Storage Checklist](../.codex/checklists/storage.md)
