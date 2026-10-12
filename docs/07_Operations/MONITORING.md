# Operations Monitoring

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document defines alert routing, on-call ownership, escalation, notification quality, and review for `observability-v1`. It does not claim a staffed rotation or configured paging service.

## Goals

- Route actionable user and integrity risk to the correct owner quickly.
- Avoid alert fatigue, duplicate pages, and silent notification failure.
- Preserve role coverage without embedding personal contact data in the repository.
- Connect every alert to an SLO/guardrail, dashboard, Runbook, and incident path.

## Requirements

### Alert Payload

Every notification includes environment, severity, SLO/guardrail ID, bounded symptom, first/last occurrence, current/target value, budget/burn when applicable, affected journey, release/configuration annotation, dashboard, Runbook, primary/secondary role, and acknowledgement link.

It excludes user identifiers, URLs with query strings, prompt/image content, secrets, payment details, provider bodies, raw exceptions, and unbounded labels.

### Role Routing

| Surface | Primary | Secondary/reviewer |
| --- | --- | --- |
| Platform/API/deploy/telemetry | DevOps | Backend, CTO |
| Authentication/Supabase | Backend | Security, Database, DevOps |
| Generation/provider/queue | AI Engineer | Backend, DevOps |
| Payment/credit/webhook | Backend | Database, DevOps, Security |
| Database/RLS/backup | Database | Backend, DevOps, Security |
| R2/storage/deletion | Backend | DevOps, Security |
| Security/privacy disclosure | Security | CTO, DevOps, affected owner |
| Customer communication | Support | PM, Incident Commander |

Production requires a separate access-controlled roster mapping these roles to primary/secondary humans, schedules, time zone, notification channels, and escalation. The repository stores no phone number or personal contact secret.

## Implementation

### Notification Policy

- Page on the canonical multiwindow burn-rate conditions, complete critical-journey outage, or zero-tolerance guardrail.
- Create a ticket for slower burn, capacity forecast, stale Runbook, telemetry cost/cardinality drift, or non-urgent reconciliation backlog.
- Deduplicate alerts by environment, SLO/guardrail, service, and incident; suppress secondary symptoms behind the primary failure when safe.
- Every silence has incident/change reference, owner, reason, scope, start, and automatic expiry no longer than 24 hours unless CTO/DevOps reapprove.
- Test primary and secondary notification delivery at least quarterly and before production launch.

### Severity and Response

| Severity | Example | Acknowledge | Leadership/communication |
| --- | --- | --- | --- |
| `SEV0` | Confirmed cross-user disclosure, active secret compromise, widespread financial corruption | 5 minutes | CTO + Security immediately; customer/legal review |
| `SEV1` | Core journey unavailable, payment/credit invariant at risk, rapid SLO burn | 10 minutes | CTO/PM; status update every 30 minutes |
| `SEV2` | Material degradation, bounded backlog, slow burn with user impact | 30 minutes | Service owner; update hourly if incident |
| `SEV3` | No current user impact, hygiene/capacity/stale-document issue | Next business day | Ticket owner |

Targets begin when notification delivery succeeds. Missed acknowledgement escalates to secondary, then CTO/Incident Commander. These are operating objectives, not evidence of staffing.

### Alert Lifecycle

1. Design from SLO/guardrail and name the actionable response.
2. Link dashboard and reviewed Runbook before enabling page severity.
3. Test firing, payload redaction, primary/secondary delivery, acknowledgement, deduplication, silence expiry, and recovery.
4. Review every page for precision, actionability, root signal, and follow-up.
5. Quarterly, remove stale alerts and adjust thresholds only through an SLO/decision update.

## Checklist

- [x] Alert payload, routing, severity, acknowledgement, escalation, and silence policy are defined.
- [x] Primary/secondary ownership maps every MVP critical surface.
- [x] Notification tests and alert-lifecycle review are required.
- [x] Personal contact data remains outside the repository.
- [ ] Paging provider, role roster, routes, alerts, escalation, and audits are configured.
- [ ] Production-like alert and on-call exercises meet response objectives.

## Related Documents

- [Monitoring Architecture](../03_Architecture/MONITORING.md)
- [Observability](OBSERVABILITY.md)
- [Operations Runbook](RUNBOOK.md)
- [Incident Management](INCIDENT.md)
- [Security Architecture](../03_Architecture/SECURITY.md)
- [Observability Checklist](../../.codex/checklists/observability.md)
