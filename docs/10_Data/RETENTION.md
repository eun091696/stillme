# Data Retention

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document is the canonical purpose, retention-event, deletion, hold, and evidence policy for planned MVP data. `storage-v1` approves the user-content lifecycle; statutory periods remain subject to Korean legal/privacy review before launch. Documentation is not evidence that deletion jobs, notices, provider controls, or legal compliance exist.

## Goals

- Retain each data class only for an approved product, security, operational, or legal purpose.
- Delete prompts and image content independently from records that must remain for transaction evidence.
- Make deletion include primary data, objects, derivatives, caches, providers, and eventual backup expiry.
- Prevent “keep forever” defaults and unverifiable deletion claims.

## Requirements

### Policy Fields

Every collected class declares:

- purpose and classification;
- system/provider and accountable owner;
- retention start/end event;
- deletion or anonymization objective;
- legal/product basis and review state;
- hold and exception behavior;
- verification evidence.

Expired data is inaccessible before asynchronous deletion. A legal hold requires written authority, minimum scope, owner, start/end dates, access audit, and periodic review.

### Retention Matrix

| Data class | Approved retention/event | Deletion objective | Owner/status |
| --- | --- | --- | --- |
| Active generated originals and derivatives | Until owner deletes asset/account; no age-only expiry during active history | Logical denial immediately; R2 deletion within 24 hours | PM + Backend, `APPROVED` for `storage-v1` |
| Staging/failed upload bytes | 24 hours from allocation/upload | Lifecycle plus orphan reconciliation within 48 hours total | Backend + DevOps, `APPROVED` |
| Quarantined bytes | 7 days from quarantine | Delete within 24 hours after expiry unless approved incident/legal hold | Security, `APPROVED` |
| Prompt and generation metadata | While associated active history is needed; minimize/delete with asset/account request except required redacted evidence | Content removed within 24 hours; metadata minimization verified | PM + Database, `APPROVED` for storage lifecycle |
| Account/profile | Until account deletion request or service termination | Immediate access termination; physical-system workflow requires implementation evidence | PM + Security, `REQUIRED` |
| Contract/withdrawal records | 5 years | Separate restricted legal archive; destroy after obligation/hold ends | Legal + Finance, `LEGAL_REVIEW_REQUIRED` |
| Payment and supply records | 5 years | Separate restricted legal archive; never retain card credentials | Legal + Finance, `LEGAL_REVIEW_REQUIRED` |
| Consumer complaint/dispute records | 3 years | Restricted case record; delete unrelated prompt/image content | Legal + Support, `LEGAL_REVIEW_REQUIRED` |
| Display/advertising records | 6 months | Delete after obligation/hold ends | Legal + Marketing, `LEGAL_REVIEW_REQUIRED` |
| Application/infrastructure logs | 30 days | Lifecycle delete; approved incident case may retain redacted evidence separately | DevOps, `APPROVED` for `observability-v1` |
| Distributed traces | 7 days | Lifecycle delete; no user content or credentials | DevOps, `APPROVED` for `observability-v1` |
| Security/audit events | 180 days | Restricted lifecycle delete; approved legal/incident hold only | Security + DevOps, `APPROVED` for `observability-v1` |
| SEV0/SEV1 incident evidence | 1 year after closure | Restricted case deletion unless approved legal hold | Security + DevOps, `APPROVED` for `observability-v1` |
| Operational metrics/SLO reports | Raw bounded series 90 days; daily SLO/error-budget reports 13 months | Aggregate/lifecycle delete; metric labels contain no domain/user IDs | DevOps, `APPROVED` for `observability-v1` |
| Analytics events | Exact period requires purpose/consent/access review | Pseudonymous deletion/aggregation contract required | PM + Security, `NOT_APPROVED` |
| Backups | Exact expiry and restore behavior require backup design | Deleted data remains inaccessible and expires by backup policy | Database + DevOps, `NOT_APPROVED` |

The statutory rows reflect the current Korean e-commerce decree as an engineering input, not a final legal classification. Legal review must confirm applicability, notice text, start event, exact stored fields, and any later amendment before production.

## Implementation

### Deletion Workflow

1. Re-verify requester identity and resolve the authorized subject/resource scope.
2. Create an opaque deletion case and immutable, redacted audit event.
3. Revoke application access and new signed grants immediately.
4. Enqueue idempotent deletes for database content, R2 originals/derivatives/staging, cache, analytics, and provider copies.
5. Separate only the minimum legally required transaction record from user content and deny ordinary product access.
6. Verify each system/provider outcome; retry or escalate overdue items without marking completion early.
7. Issue completion evidence that states deleted, anonymized, legally retained, pending-provider, and backup-expiry scopes.

### Holds and Exceptions

- Product convenience, debugging, model training, or vague future value is not a retention basis.
- Incident evidence is minimized and access-controlled; copying raw content into tickets or chat is prohibited.
- A hold never re-enables customer access or prevents deletion of unrelated data.
- Provider retention/training settings, deletion APIs, subprocessor location, and contractual timelines are a launch gate.
- If a provider cannot meet the approved lifecycle, block that data flow or obtain explicit Security/Privacy/CTO exception with expiry.

### Validation and Monitoring

- Scheduled tests seed uniquely identifiable synthetic records in every lifecycle class and prove logical denial, physical absence, derivative cleanup, and redacted receipt.
- Daily reconciliation identifies expired staging/quarantine, overdue deletion, orphan objects, missing objects, and mismatched metadata.
- Metrics contain counts/ages and opaque IDs only; never prompt text, image bytes, signed URLs, direct identifiers, or payment details.
- Backup restoration tests must prove deleted content remains unavailable and expires as documented before any recovery promise is published.

현재 local pgTAP의 `data_retention.test.sql`은 synthetic account 삭제 시 profile,
Credit ledger, generation job과 asset metadata가 cascade되어 owner data가 더 이상
조회되지 않는지 검증합니다. R2 object 삭제, backup expiry와 legal hold evidence는
실제 운영 환경 검증 전까지 완료로 주장하지 않습니다.

`list_expired_asset_cleanup(as_of)`는 service-role 전용 reconciliation 후보 조회로
24시간 temporary/실패 asset과 7일 quarantine asset을 bounded reason code와
immutable storage identity로 반환합니다. 이 함수는 삭제나 R2 호출을 수행하지 않으며,
후속 worker가 provider 확인과 idempotent deletion을 완료하기 전에는 retention
완료로 표시하지 않습니다.

### Official Evidence

- [Korean E-Commerce Act Enforcement Decree, Article 6](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=63460)
- [Korean E-Commerce Act, Article 6](https://www.law.go.kr/LSW/lsInfoP.do?ancNo=21312&ancYd=20260120&efYd=20260721&lsiSeq=282793)
- [Korean Privacy Portal Destruction Principle](https://www.privacy.go.kr/front/contents/cntntsView.do?contsNo=277)
- [Cloudflare R2 Object Lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)

## Checklist

- [x] User-content, temporary, quarantine, and statutory record classes are separated.
- [x] Each approved storage class has an event, objective, owner, and exception rule.
- [x] Account/asset deletion covers objects, derivatives, metadata, cache, provider, and backup boundaries.
- [x] Statutory periods are recorded as legal-review inputs rather than compliance claims.
- [ ] Legal/privacy review approves production classification, notices, and provider contracts.
- [ ] Deletion, lifecycle, reconciliation, monitoring, and backup-expiry evidence exists.
- [x] `observability-v1` log, trace, audit, incident, metric, and SLO-report periods are approved.
- [ ] Analytics and backup retention periods are approved in their owning milestones.

## Related Documents

- [Storage Architecture](../03_Architecture/STORAGE.md)
- [Privacy](../09_Security/PRIVACY.md)
- [Backup Policy](BACKUP_POLICY.md)
- [Security Architecture](../03_Architecture/SECURITY.md)
- [Storage Checklist](../../.codex/checklists/storage.md)
- [Logging Architecture](../03_Architecture/LOGGING.md)
- [Monitoring Architecture](../03_Architecture/MONITORING.md)
