# Logging Architecture

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document is the canonical structured log contract for approved `observability-v1`. It defines event shape, correlation, redaction, access, sampling, and retention without selecting a vendor or claiming runtime instrumentation.

## Goals

- Reconstruct customer-visible failures across HTTP, workers, providers, storage, payments, and credits.
- Correlate logs and traces without leaking customer content or credentials.
- Keep query cost and cardinality predictable.
- Separate operational evidence, security audit, and product analytics.

## Requirements

### Governance

| Field | Contract |
| --- | --- |
| Decision ID | `OBS-001` |
| Version | `observability-v1` |
| Status | `APPROVED` |
| Owner | DevOps Engineer |
| Approver | CTO |
| Reviewers | Backend, Frontend, AI Engineer, Database, Security, QA, PM |
| Review trigger | New service/provider/data class, SLO change, incident, telemetry vendor, retention change, or material cost/cardinality change |

### Required Record

| Field | Contract |
| --- | --- |
| `timestamp` / `observed_timestamp` | UTC RFC 3339 event and collection times |
| `schema_version` | Positive integer; breaking field semantics require increment |
| `severity_text` / `severity_number` | OpenTelemetry-compatible severity |
| `service_name` / `service_version` | Stable component and deployed release |
| `deployment_environment` | `development`, `staging`, `production` |
| `event_name` | Stable lowercase domain event name |
| `outcome` | Bounded `success`, `failure`, `denied`, `cancelled`, `unknown` |
| `request_id` | Server-generated opaque request correlation |
| `trace_id` / `span_id` | W3C/OpenTelemetry context when present |
| `operation_id` | Stable idempotent command/reconciliation reference when needed |
| `route_template` / `http_method` / `http_status_code` | Template, method, bounded status; never raw URL/query |
| `duration_ms` | Non-negative bounded duration |
| `error_code` / `retryable` | Stable API/domain code and boolean; no free-form provider body |
| `provider` / `dependency` | Approved enum only |

`job_id`, `order_id`, `asset_id`, `payment_id`, and ledger references may appear only in restricted operational/audit streams when required for reconciliation. They never appear as metric labels or general browser telemetry. General logs use pseudonymous `actor_ref` only when approved; raw user ID, email, name, or IP is prohibited.

### Prohibited Data

Never emit credentials, API/session/payment keys, cookies, authorization headers, request/response bodies, raw URL/query, email, name, raw IP, prompt, image bytes, OCR text, signed URL, card/bank data, SQL, database connection strings, provider payloads, or unsanitized stack/error text.

Stack traces are allowed only in a restricted error sink after redaction and must not be copied to tickets, alerts, dashboards, chat, or customer responses.

## Implementation

### Correlation and Propagation

- Accept W3C `traceparent` only after syntax validation; create a new context when invalid.
- Return `X-Request-ID` per `api-v1`; do not trust a client value as globally unique.
- Propagate trace/request/operation context across Route Handler, domain command, outbox, worker, webhook, and provider adapter.
- Link asynchronous work using span links or stable operation/job references rather than forging a parent span.
- Provider correlation IDs are bounded and stored only when non-secret.

### Stream Separation

| Stream | Purpose | Default retention |
| --- | --- | --- |
| Application logs | Request, worker, dependency diagnosis | 30 days |
| Distributed traces | Path/latency diagnosis | 7 days |
| Security/audit events | Privileged, auth, denial, financial and deletion evidence | 180 days |
| SEV0/SEV1 incident evidence | Approved redacted case record | 1 year after closure |

Product analytics follows [Analytics Events](../11_Analytics/EVENTS.md) and is not copied from logs by default. Retention and deletion follow [Data Retention](../10_Data/RETENTION.md).

### Sampling and Backpressure

- Keep 100% of redacted error, security, financial-invariant, deletion, and SEV0/SEV1 records.
- Sample healthy traces at an initial 10%; preserve the sampling decision and allow temporary, approved incident overrides.
- Metrics are aggregated rather than sampled.
- Telemetry export never blocks a domain commit indefinitely or causes duplicate economic effects.
- Under exporter outage, use bounded buffering/drop policy, count drops, alert monitoring blindness, and never spill sensitive payloads to an ungoverned file.

### Official Evidence

- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
- [OpenTelemetry Log Correlation](https://opentelemetry.io/docs/specs/otel/logs/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [OpenTelemetry HTTP Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/http/http-spans/)

## Checklist

- [x] Required structured fields, trace correlation, and stream separation are defined.
- [x] Prohibited fields, restricted identifiers, redaction, and stack-trace boundaries are explicit.
- [x] Sampling, backpressure, retention, and telemetry-outage behavior are defined.
- [x] Operational logs remain separate from analytics.
- [ ] Logger schema, context propagation, exporters, access, retention, and tests are implemented.
- [ ] Production-like redaction, cardinality, volume, and outage evidence exists.

## Related Documents

- [Monitoring Architecture](MONITORING.md)
- [API Architecture](API.md)
- [Security Architecture](SECURITY.md)
- [Observability](../07_Operations/OBSERVABILITY.md)
- [Data Retention](../10_Data/RETENTION.md)
- [Analytics Events](../11_Analytics/EVENTS.md)
- [Observability Checklist](../../.codex/checklists/observability.md)
