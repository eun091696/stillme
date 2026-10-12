# Privacy

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document defines privacy-by-design boundaries for account, prompt, image, payment, support, log, and analytics data. It is an engineering baseline and does not replace Korean privacy-law review, provider contracts, or a published customer privacy notice.

## Goals

- Collect and retain only data required for an approved purpose.
- Prevent prompts, images, identifiers, and payment metadata from leaking across users or systems.
- Make provider transfer, access, export, correction, and deletion traceable.
- Block production collection where purpose, notice, access, retention, or deletion is unresolved.

## Requirements

### Data Inventory

| Data | Classification | Purpose | Primary access |
| --- | --- | --- | --- |
| Account email and profile | Confidential personal data | Authentication, account service, support | User, restricted support |
| Session/token | Restricted credential | Authentication | Auth service and application runtime only |
| Prompt and generation options | Confidential user content | Requested generation | User, generation service; restricted support only when authorized |
| Generated image and metadata | Confidential user content | Preview, history, download | Owner and scoped processing |
| Order/payment metadata | Confidential financial metadata | Payment, refund, reconciliation | Owner summary; restricted finance/support |
| Credit ledger | Integrity-critical account data | Balance and audit | Owner history; restricted operations |
| Logs/security events | Internal or confidential | Reliability, fraud, incident | Restricted engineering/security |
| Analytics events | Pseudonymous internal data | Approved product measurement | Restricted aggregate/product roles |

Card data and provider credentials are not application analytics or general support data.

### Privacy Rules

- Purpose, fields, provider, access, retention, deletion, and owner are approved before collection.
- Default analytics and logs exclude direct identifiers, raw prompts, images, signed URLs, tokens, payment details, request bodies, and free-form errors.
- Production provider settings and contracts must document whether prompts/images are retained or used for training; unapproved secondary use is prohibited.
- Cross-border transfer, subprocessors, required notice/consent, age restrictions, and customer terms require legal/privacy review before launch.
- Support access is just-in-time, least-privileged, reason-bound, audited, and does not expose credentials.
- Backups, caches, derived data, analytics, and provider copies are included in deletion and retention design.

## Implementation

### Rights and Requests

Identity is re-verified before access, correction, export, or deletion. Requests receive an opaque case ID, authorized scope, immutable audit, and completion evidence without exposing another user. Legal holds and financial-record obligations require documented authority and do not justify retaining unrelated content.

### Privacy Review Gate

Every new field, event, provider, export, upload, model, support view, or experiment documents:

- data subject and purpose;
- minimum fields and classification;
- source and destination;
- access roles and audit;
- retention/deletion behavior;
- notice/consent or other legal-basis review where applicable;
- misuse, breach, and rollback behavior.

### Storage Retention Boundary

Approved `storage-v1` keeps active generated assets only while the owner retains the
asset/account, denies access immediately on deletion, targets physical R2 removal within
24 hours, expires staging after 24 hours, and expires quarantine after 7 days unless an
approved hold applies. Payment, contract, and dispute evidence is stored separately from
prompts and image bytes; a legal retention obligation never authorizes retaining unrelated
user content. Exact provider-copy, backup, analytics, and log retention remain launch gates
in [Data Retention](../10_Data/RETENTION.md).

### Incident Boundary

Suspected disclosure triggers containment, access/key revocation, preservation of redacted evidence, affected-data assessment, provider coordination, and legal notification review. Do not copy exposed data into tickets or chat during response.

### Operator Privacy Boundary

운영 조회는 지원 case에 이미 포함된 고객 UUID만 허용하며 email, 이름, prompt
검색을 제공하지 않는다. 조회 식별자는 URL query, redirect와 일반 log에
기록하지 않고 인증된 Server Action POST body에서만 처리한다. Server Action은
MFA operator authorization을 다시 검증하고 각 domain RPC의 독립 permission
검사를 통과한 결과를 minimum DTO allowlist로 재구성한다. Database가 예상하지
않은 email, prompt, payment key, provider payload 또는 malformed field를
반환하면 client에 전달하지 않고 기본 거부한다.

Automated regression은 operator raw table의 `SELECT`, `INSERT`, `UPDATE`,
`DELETE` 권한 부재, anonymous RPC 차단, internal audit function 실행 차단,
Support·Admin permission 집합, 공개 RPC 반환 schema와 고정 `search_path`를
검증한다. 실제 production operator assignment와 privacy-law review는 별도
release gate로 유지한다.

### 2026-07-31 Privacy Engineering Review

현재 application DTO, Server Action, API response, RLS, operator lookup,
browser cache와 build output을 검토했다. Account email과 owner prompt는 해당
사용자 화면에만 표시되며 operator DTO에서는 email, prompt, payment key와
provider payload를 거부한다. Payment provider identity는 hash만 저장하고
raw webhook body를 저장하거나 응답하지 않는다.

CI는 server credential 이름과 synthetic canary가 production client bundle에
포함되지 않음을 검사하며 full-history secret scan을 별도로 실행한다.
Protected response는 `private, no-store`, 모든 page는 `no-referrer`와 enforced
CSP를 사용한다. 오류 응답은 bounded code만 반환하며 request body, email,
prompt, signed URL과 credential을 log하지 않는다.

이번 engineering review에서 구현 범위의 미해결 critical/high privacy
finding은 없다. 법률상 분류, customer notice, subprocessors, provider
retention/training, production request handling, backup와 analytics retention은
승인되거나 검증된 것으로 간주하지 않으며 Phase 8 전까지 계속 launch를
차단한다.

## Checklist

- [x] Core MVP data classes, purposes, and access boundaries are identified.
- [x] Data minimization, provider use, support access, rights, and deletion scope are defined.
- [x] `storage-v1` content classes, deletion objective, and statutory-record separation are defined.
- [x] Operator lookup identifier, minimum DTO와 least-privilege boundary가
      자동 검증됐다.
- [x] Legal/privacy review is an explicit launch gate.
- [x] Documentation does not claim a published notice or implemented rights workflow.
- [ ] Statutory classification, subprocessors, backup/log/analytics periods, and notices are approved.
- [ ] Production privacy controls and request handling are tested.

## Related Documents

- [Threat Model](THREAT_MODEL.md)
- [Security Architecture](../03_Architecture/SECURITY.md)
- [Data Retention](../10_Data/RETENTION.md)
- [Analytics Events](../11_Analytics/EVENTS.md)
- [Storage](../03_Architecture/STORAGE.md)
- [Incident Management](../07_Operations/INCIDENT.md)
