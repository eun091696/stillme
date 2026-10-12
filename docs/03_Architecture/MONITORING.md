# Monitoring Architecture

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document is the canonical `observability-v1` SLI, SLO, error-budget, and guardrail registry. SLOs are internal launch objectives, not customer SLAs or claims about current production performance.

## Goals

- Measure reliability through customer-visible outcomes.
- Align alerts and release decisions with explicit error budgets.
- Preserve zero-tolerance security and financial invariants outside availability budgets.
- Expose missing or untrusted telemetry instead of reporting false health.

## Requirements

### Common SLO Contract

- Primary window is rolling 28 days in UTC; generation KPI views also retain the approved rolling 7-day diagnostic.
- Each ratio is `good eligible events / all eligible events`; retries deduplicate by domain identity.
- Expected client validation/state failures, explicit user cancellation, test/internal traffic, and approved synthetic probes are excluded and reported separately.
- Provider, deployment, planned-maintenance, and internal dependency failures count when the customer outcome is bad.
- Missing, stale, invalid, or unreconciled telemetry yields `UNKNOWN`/`DEGRADED`, never `HEALTHY`.
- Targets are reviewed after 30 days of qualified production evidence and at least quarterly.

### SLO Registry

| SLO ID | User journey and good event | Target/window | Owner |
| --- | --- | --- | --- |
| `SLO-API-001` | Valid core API request completes with documented non-5xx outcome | `99.9%` / 28 days | Backend |
| `SLO-API-002` | Successful interactive API request completes server processing within `750 ms` | `95%` / 28 days | Backend |
| `SLO-GEN-001` | Unique accepted generation reaches `succeeded` with available asset and correct credit effect | `>= 95%` / 28 days | AI Engineer + Backend |
| `SLO-GEN-002` | Successful generation completes accepted-to-available within `120 s` | `95%` / 28 days | AI Engineer + Backend |
| `SLO-PAY-001` | Valid confirmation reaches verified/rejected and converged credit state within `5 min` | `99.9%` / 28 days | Backend |
| `SLO-DEL-001` | Valid asset/account deletion reaches verified content removal within `24 h` | `99%` / 28 days | Backend + DevOps |
| `SLO-OBS-001` | Critical telemetry is valid and queryable within `5 min` of occurrence | `99%` / 28 days | DevOps |

For `SLO-API-002`, generation/provider wait and explicit asynchronous `202` completion time are measured by their domain SLO, not the interactive HTTP latency denominator. A successful response that violates an integrity invariant is never “good.”

### Zero-Tolerance Guardrails

The following are direct incident signals, not error-budget events:

- confirmed cross-user disclosure;
- duplicate payment credit grant, negative/invalid ledger state, or missing eligible credit restoration;
- secret or prohibited customer content in logs, traces, metrics, analytics, errors, or alerts;
- public customer-content storage or unauthorized signed grant;
- silently dropped verified payment/webhook/deletion work;
- monitoring rule or dashboard showing healthy from missing critical data.

## Implementation

### Error-Budget Policy

Error budget is `1 - SLO target`. Budgets are reported with good, eligible, bad, excluded, late, missing, remaining, and burn-rate values.

- At `<= 25%` remaining, service owner reviews planned risk and reliability work.
- At `0%` remaining or a confirmed guardrail breach, pause risky feature releases for the affected surface.
- Only incident mitigation, urgent security fixes, rollback, and reliability work directly reducing the failure may bypass the pause with CTO/DevOps approval.
- Resume after the SLI is trustworthy, active burn is controlled, remediation has owners, and CTO/DevOps record the decision.
- Low traffic uses synthetic probes and direct invariant alerts, but synthetic success never hides real-user failure or enters the user SLI.

### Burn-Rate Alerts

For ratio SLOs with sufficient traffic:

| Action | Long + short windows | Burn rate |
| --- | --- | --- |
| Page | `1 h` and `5 min` | `14.4×` |
| Page | `6 h` and `30 min` | `6×` |
| Ticket | `24 h` and `2 h` | `3×` |
| Ticket | `3 d` and `6 h` | `1×` |

Both windows in a pair must breach. Notification deduplicates overlapping conditions. Guardrails and complete journey outages page directly without waiting for statistical volume.

### Metric Families

- Request RED: eligible/good/bad count, duration histogram, retry/rate-limit and saturation.
- Worker/queue: accepted, queue age, state age, attempts, terminal outcome, stuck jobs, capacity.
- Provider: bounded outcome, latency, timeout, throttle, reconciliation backlog; no provider payload/key.
- Domain integrity: payment/credit match, duplicate prevention, restore status, deletion overdue, object/DB divergence.
- Telemetry health: export success/drop, collection delay, schema rejection, missing series, alert evaluation and notification delivery.

Metric labels are bounded allowlists such as environment, service, release, route template, method, status class, outcome, error code, provider, model version, and lifecycle state. User, request, trace, job, order, payment, asset, key, URL, prompt, free text, and raw error are prohibited labels.

### Official Evidence

- [Google SRE Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)
- [Google SRE Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)
- [Google SRE Error Budgets](https://sre.google/sre-book/service-best-practices/)
- [OpenTelemetry Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)

## Checklist

- [x] Every SLO defines user outcome, target, window, eligibility, missing-data behavior, and owner.
- [x] Product KPI, SLO, diagnostic metric, and zero-tolerance guardrail are separated.
- [x] Error-budget policy, multiwindow alerts, and low-traffic handling are defined.
- [x] Metric families and bounded label policy are defined.
- [ ] SLI queries, recording rules, dashboards, alerts, and release enforcement are implemented.
- [ ] Qualified production evidence validates targets and error-budget behavior.

## Related Documents

- [Logging Architecture](LOGGING.md)
- [Business KPI](../01_Business/KPI.md)
- [Product Metrics](../11_Analytics/METRICS.md)
- [Operations Monitoring](../07_Operations/MONITORING.md)
- [Observability](../07_Operations/OBSERVABILITY.md)
- [Incident Management](../07_Operations/INCIDENT.md)
- [Observability Checklist](../../.codex/checklists/observability.md)
