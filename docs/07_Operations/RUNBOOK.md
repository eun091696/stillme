# Operations Runbook

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document defines the Runbook standard and owner registry for repeatable diagnosis, mitigation, rollback, reconciliation, and recovery. Existing playbooks remain preserved and become the procedures registered here.

## Goals

- Let an on-call responder act safely without hidden context.
- Prevent destructive, privilege-broadening, or economically unsafe improvisation.
- Keep every alert linked to an owned and tested procedure.
- Record gaps and escalation when automation or access is unavailable.

## Requirements

### Mandatory Runbook Sections

Each Runbook/playbook defines:

1. purpose, scope, owner, reviewers, and last verified date;
2. entry signals, SLO/guardrail, severity, and prerequisites;
3. dashboards, safe queries, permissions, and expected healthy state;
4. diagnostic decision tree;
5. bounded mitigation with approval boundary;
6. verification for users, data, security, and economic invariants;
7. rollback/recovery, escalation, communication, and exit criteria;
8. evidence fields, known gaps, and follow-up owners.

Commands use placeholders, narrow targets, dry runs where supported, and explicit environment checks. Never place credentials, customer content, production IDs, personal contacts, or destructive broad commands in a Runbook.

### Owner Registry

| Runbook ID | Playbook | Primary owner | Required reviewers |
| --- | --- | --- | --- |
| `RB-AUTH-001` | [Signup Failure](../../playbooks/SIGNUP_FAILURE.md), [Login Failure](../../playbooks/LOGIN_FAILURE.md) | Backend | Security, Support, QA |
| `RB-API-001` | [API Outage](../../playbooks/API_OUTAGE.md) | Backend | DevOps, QA |
| `RB-AI-001` | [AI Generation Failure](../../playbooks/AI_GENERATION_FAILURE.md) | AI Engineer | Backend, DevOps, QA |
| `RB-PAY-001` | [Payment Failure](../../playbooks/PAYMENT_FAILURE.md) | Backend | Database, DevOps, Security |
| `RB-DB-001` | [Database Outage](../../playbooks/DATABASE_OUTAGE.md) | Database | Backend, DevOps, Security |
| `RB-SUPA-001` | [Supabase Outage](../../playbooks/SUPABASE_OUTAGE.md) | Backend | Database, DevOps |
| `RB-R2-001` | [R2 Outage](../../playbooks/R2_OUTAGE.md) | Backend | DevOps, Security |
| `RB-CF-001` | [Cloudflare Outage](../../playbooks/CLOUDFLARE_OUTAGE.md) | DevOps | Backend, Frontend |
| `RB-REDIS-001` | [Redis Outage](../../playbooks/REDIS_OUTAGE.md) | Backend | DevOps, CTO |
| `RB-DEP-001` | [Deployment Rollback](../../playbooks/DEPLOYMENT_ROLLBACK.md) | DevOps | QA, Backend, Database |

Redis remains planned rather than implemented; `RB-REDIS-001` is retained but cannot be marked verified until the dependency is approved and exists.

## Implementation

### Safe Response Sequence

1. Confirm environment, incident ID, actor role, affected SLO/guardrail, and current severity.
2. Preserve redacted evidence and recent release/configuration context.
3. Diagnose read-only with bounded queries and reconcile authoritative domain state.
4. Choose the smallest reversible mitigation; state customer/data/security/economic impact.
5. Obtain required approval for destructive, data-changing, permission, credential, payment, credit, or broad traffic action.
6. Execute with stable operation identity and audit.
7. Verify user journey, data invariants, security boundary, telemetry recovery, and error-budget burn.
8. Close only when exit criteria and residual risks are recorded.

### Review and Drill

- Owner reviews after every use and at least quarterly.
- Required reviewers approve commands and trust-boundary effects.
- SEV0/SEV1, payment/credit, database, storage deletion, provider outage, and rollback procedures require staging/tabletop exercises before launch.
- An untested or stale Runbook downgrades release readiness and appears as an operational risk.
- Drill evidence uses synthetic IDs/data and records duration, decisions, access gaps, unsafe steps, and remediation.

### Verified Local Drill

`RB-PAY-001`은 `npm run incident:drill:payment`로 local 합성-data 훈련을
수행합니다. Provider cancellation과 local paid 상태의 불일치를 자동 repair할
수 있는 경우 단일 reconciliation·ledger reversal로 수렴하고, Credit이 이미
generation에 예약된 경우 mutation 없이 `review_required`로 격리합니다.
`payment-incident-drill-v1` evidence는 bounded outcome과 invariant만 출력하며
고객, 주문, 결제, 환불 또는 provider identifier를 포함하지 않습니다.
2026-07-30 local 실행에서 두 경계와 합성 data cleanup이 통과했습니다.

## Checklist

- [x] Standard sections and safe command boundaries are defined.
- [x] Every existing playbook has a stable ID, primary owner, and reviewers.
- [x] Review, drill, evidence, and stale-Runbook policy are defined.
- [x] Planned Redis status is explicit.
- [x] `RB-PAY-001` local 합성-data reconciliation drill이 통과했다.
- [ ] Each playbook is upgraded to the standard and reviewed by its owner.
- [ ] Production access, commands, dashboards, and exercises are verified.

## Related Documents

- [Operations Monitoring](MONITORING.md)
- [Incident Management](INCIDENT.md)
- [Observability](OBSERVABILITY.md)
- [Deployment](../04_Engineering/DEPLOYMENT.md)
- [Observability Checklist](../../.codex/checklists/observability.md)
