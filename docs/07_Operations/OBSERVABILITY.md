# Observability

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document defines the planned telemetry topology, dashboards, instrumentation lifecycle, and operating evidence for `observability-v1`. It is vendor-neutral and does not claim that instrumentation or an observability backend exists.

## Goals

- Correlate user journeys across HTTP, jobs, providers, data, and storage.
- Give service owners one path from SLO breach to bounded diagnosis.
- Detect instrumentation failure and telemetry cost/cardinality regressions.
- Preserve privacy and security throughout collection, export, storage, and access.

## Requirements

### Signal Ownership

| Signal | Canonical owner | Purpose |
| --- | --- | --- |
| Logs | [Logging Architecture](../03_Architecture/LOGGING.md) | Discrete diagnostic/audit evidence |
| Metrics/SLO | [Monitoring Architecture](../03_Architecture/MONITORING.md) | Aggregated reliability and budget decisions |
| Traces | This document | Execution path and latency correlation |
| Product events | [Analytics Events](../11_Analytics/EVENTS.md) | Governed product/business measurement |
| Alerts/on-call | [Operations Monitoring](MONITORING.md) | Action and escalation |
| Response procedures | [Operations Runbook](RUNBOOK.md) | Safe diagnosis, mitigation, and recovery |

Operational telemetry and analytics may share an approved domain fact but not a storage stream, retention assumption, or access grant by default.

### Instrumentation Contract

- Resource attributes identify environment, service, release, region/runtime class, and telemetry schema version.
- HTTP spans use route templates, not raw URLs; asynchronous work uses links and stable operation references.
- Span/metric attributes use allowlisted bounded values; identifiers stay in restricted logs/traces only when necessary.
- Client telemetry is untrusted and cannot prove authentication, payment, credit, generation, storage, or authorization success.
- Sampling is decided and recorded at the trust boundary; tail/error retention cannot capture prohibited data.

## Implementation

### Telemetry Flow

```text
Next.js / workers / provider adapters
        │ typed logs, metrics, traces
        ▼
bounded exporter/collector boundary
        │ schema validation, redaction, sampling, drop metrics
        ▼
separate log / metric / trace stores
        │ access control, retention, deletion, audit
        ▼
SLO views → alert rules → on-call → Runbook → incident evidence
```

Exporter failure is fail-open for ordinary domain processing but fail-visible through bounded local counters/health, notification-path checks, and `SLO-OBS-001`. It must not change payment, credit, generation, or deletion identity.

### Required Dashboards

| Dashboard | Contents | Primary owner |
| --- | --- | --- |
| Service SLO | Target, good/eligible/bad, budget remaining, burn windows, missing data, release annotations | DevOps |
| API | Rate, error, latency, saturation by route template/status class/release | Backend |
| Generation | Accepted/success/failed, queue/state age, latency, provider, retry/reconcile, credit outcome | AI Engineer + Backend |
| Payment/Credit | Confirmation state/latency, webhook age, reconciliation, duplicate/restore invariants | Backend + Database |
| Storage/Deletion | Signed grant outcomes, object divergence, staging/orphan age, overdue deletion | Backend + DevOps |
| Security/Privacy | Bounded denial/anomaly counts, secret/prohibited-field scan status, audit pipeline health | Security |
| Telemetry Health | Export/drop, schema rejection, freshness, cardinality, cost, alert evaluation/delivery | DevOps |

Every dashboard shows environment, release, UTC window, freshness, quality status, owner, SLO/Runbook links, and known data gaps. A missing critical source marks the panel `UNKNOWN`, not zero.

### Instrumentation Change Lifecycle

1. Define user outcome, SLI/event/log schema, owner, volume/cardinality estimate, privacy class, retention, and failure behavior.
2. Add typed instrumentation and synthetic fixtures.
3. Validate locally and in staging without production customer content.
4. Compare domain truth to signal/query and exercise missing/exporter failure.
5. Deploy gradually with release annotation and cost/error monitoring.
6. Remove or version a signal only after queries, alerts, dashboards, and Runbooks migrate.

### Access and Review

- DevOps administers telemetry infrastructure; domain owners receive least-privilege views.
- Security/audit streams require Security approval and access audit.
- Support receives curated incident status and opaque case/request references, not raw observability access.
- Quarterly review removes unused/high-cardinality signals, stale alerts, orphan dashboards, broad access, and expired retention exceptions.

## Checklist

- [x] Signal ownership and telemetry flow are explicit.
- [x] Correlation, sampling, privacy, exporter failure, and missing-data behavior are defined.
- [x] Required dashboards have contents and owners.
- [x] Instrumentation lifecycle and quarterly hygiene are defined.
- [ ] SDK/collector/exporter, stores, access controls, dashboards, and tests are implemented.
- [ ] Production-like correlation, freshness, cost, cardinality, and outage evidence exists.

## Related Documents

- [Logging Architecture](../03_Architecture/LOGGING.md)
- [Monitoring Architecture](../03_Architecture/MONITORING.md)
- [Operations Monitoring](MONITORING.md)
- [Operations Runbook](RUNBOOK.md)
- [Incident Management](INCIDENT.md)
- [Data Retention](../10_Data/RETENTION.md)
- [Observability Checklist](../../.codex/checklists/observability.md)
