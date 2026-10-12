# Logging Rule

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This rule applies the approved `observability-v1` contract to application, worker, provider, audit, security, and incident logs.

## Goals

- Make failures reconstructable across requests, jobs, providers, and releases.
- Preserve privacy and secret boundaries by construction.
- Keep schemas stable, bounded, searchable, and vendor-neutral.

## Requirements

- Emit structured records with schema version, UTC time, environment, service/release, event name, severity, outcome, and approved correlation IDs.
- Use W3C/OpenTelemetry-compatible `trace_id` and `span_id` where tracing exists.
- Use route templates and bounded reason/error codes instead of raw URLs or free text.
- Never emit secrets, tokens, cookies, authorization headers, request/response bodies, email, raw IP, prompts, image bytes, signed URLs, payment keys/details, SQL, or unsanitized provider/exception bodies.
- Keep domain IDs out of metrics labels. General logs use redacted or opaque references only where operationally required and access-approved.
- Apply retention, access, redaction, sampling, and deletion before production collection.
- Treat absent or malformed critical telemetry as an operational failure, not proof of health.

## Implementation

Use one typed logger boundary. Validate log attributes against an allowlist, redact before serialization, propagate safe request/trace context, and send operational events independently from analytics events. Error objects map to bounded codes and a sanitized diagnostic class; raw stack traces belong only in a restricted error sink after secret/privacy filtering.

## Checklist

- [ ] Schema and event names are versioned and typed.
- [ ] Required correlation fields survive HTTP, worker, queue, webhook, and provider boundaries.
- [ ] Prohibited-field fixtures and entropy/secret scans pass.
- [ ] Access, sampling, retention, deletion, and outage behavior are configured.
- [ ] Cardinality and volume budgets are measured before rollout.
- [ ] Logs link to SLO, alert, trace, release, and Runbook evidence without sensitive data.

## Related Documents

- [Logging Architecture](../../docs/03_Architecture/LOGGING.md)
- [Observability](../../docs/07_Operations/OBSERVABILITY.md)
- [Data Retention](../../docs/10_Data/RETENTION.md)
- [Observability Checklist](../checklists/observability.md)
