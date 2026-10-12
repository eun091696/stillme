# Observability Checklist

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This checklist is the design, implementation, and release gate for `observability-v1`. Checked design items are not evidence that telemetry, dashboards, alerts, paging, or on-call coverage exists.

## Goals

- Make reliability objectives measurable and actionable.
- Prevent false-green dashboards, alert fatigue, and sensitive telemetry.
- Ensure responders can safely diagnose and mitigate incidents.

## Requirements

- Evidence records environment, release, SLO/control ID, command/query/test, result, owner, date, and gaps.
- Every production page must be actionable within its acknowledgement objective.
- Security-related telemetry maps `THR-009`, `THR-015`, `CTL-LOG-01`, `CTL-OPS-01`, and `CTL-PRV-01`.
- Exceptions name compensating control, owner, expiry, rollback, and CTO/Security approval.

## Implementation

### Required Evidence

| Surface | Evidence |
| --- | --- |
| Instrumentation | Typed schema, context propagation, redaction, sampling, backpressure |
| Logs/traces | Required fields, prohibited-field tests, access, retention, deletion |
| Metrics | Good/eligible event parity, bounded labels, freshness, cardinality and cost |
| SLO | Query review, replay fixture, target/error-budget math, missing-data state |
| Alerts | Multiwindow burn, invariant, synthetic, deduplication, silence/expiry |
| Notification | Primary/secondary delivery, acknowledgement, escalation, audit |
| Dashboard | SLO, budget, traffic, error, latency, saturation, deploy annotation |
| Runbook/incident | Owner, preconditions, diagnosis, safe mitigation, rollback, drill |

## Checklist

### Design Gate

- [x] SLO registry defines user journeys, formulas, targets, windows, owners, and gaps.
- [x] Structured logging, correlation, privacy, retention, and sampling are defined.
- [x] Metrics, dashboards, burn-rate alerts, guardrail alerts, and low-traffic handling are defined.
- [x] Severity, on-call, escalation, communication, and Runbook ownership are defined.
- [x] Official SRE, OpenTelemetry, and W3C evidence is recorded.

### Implementation Gate

- [ ] Instrumentation schemas, exporters, storage, queries, and dashboards exist.
- [ ] SLO and alert rules are versioned, reviewed, and tested with synthetic failures.
- [ ] Notification delivery, acknowledgement, escalation, deduplication, and silence expiry work.
- [ ] Prohibited-field, cardinality, cost, missing-data, and telemetry-outage tests pass.
- [ ] Every page links a tested Runbook and recent deployment/configuration context.

### Release Gate

- [ ] Production-like traffic proves SLI correctness and dashboard freshness.
- [ ] Primary/secondary on-call roster and access are staffed and exercised.
- [ ] SEV0/SEV1 incident, provider failure, rollback, and monitoring-blind drills pass.
- [ ] Error-budget policy is enforced by release governance.
- [ ] Security, DevOps, service owner, and QA approve current evidence.

## Related Documents

- [Logging Architecture](../../docs/03_Architecture/LOGGING.md)
- [Monitoring Architecture](../../docs/03_Architecture/MONITORING.md)
- [Observability](../../docs/07_Operations/OBSERVABILITY.md)
- [Operations Monitoring](../../docs/07_Operations/MONITORING.md)
- [Operations Runbook](../../docs/07_Operations/RUNBOOK.md)
- [Incident Management](../../docs/07_Operations/INCIDENT.md)
