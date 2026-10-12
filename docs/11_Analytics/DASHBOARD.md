# Analytics Dashboard

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document defines how `analytics-v1` metrics and funnel evidence are presented to decision makers. It is vendor-neutral and does not claim that a dashboard or production data pipeline currently exists.

## Goals

- Put target, actual, sample, freshness, and quality in the same decision surface.
- Give each role the minimum information needed for action.
- Prevent degraded or incomplete data from appearing healthy.
- Connect anomalies to owners, investigations, and operational response.

## Requirements

### Display Contract

Every KPI tile or series shows:

- metric ID and version;
- current result and unit;
- target or `BASELINE_REQUIRED`;
- complete comparison period;
- numerator, denominator, or sample size;
- timezone, time window, and last successful refresh;
- quality status and active exclusions;
- owner and formula link.

Never default a missing value to zero. Never hide a broken source behind the previous successful value without a stale-data warning.

### Access and Privacy

- Business views use aggregate data and least-privilege access.
- Actor-, order-, job-, asset-, and ledger-level investigation requires a separately authorized operational view.
- Dashboard URLs, exports, notifications, and screenshots must not contain secrets, raw prompts, signed asset URLs, payment details, or direct personal identifiers.
- Exports are logged, time-bounded where supported, and governed by retention policy.

## Implementation

### Dashboard Views

| View | Primary audience | Required content | Cadence |
| --- | --- | --- | --- |
| Executive scorecard | CEO, PM | `KPI-NS-001`, activation, retention, paid conversion, contribution, guardrail summary | Weekly and monthly |
| Product funnel | PM, Designer, Marketing | Activation and monetization steps, time-to-step, approved segments, sample and quality | Weekly |
| Generation health | CTO, Backend, AI Engineer, DevOps | Success rate, p50/p95 latency, queue time, failure stage, retries, model and cost dimensions | Near-real-time operations; weekly trend |
| Payment and credit integrity | CEO, Backend, Database, Security | Checkout completion, payment-credit reconciliation, restore integrity, duplicates and exceptions | Daily |
| Data quality | PM, Database, QA, DevOps | Validity, duplicates, freshness, unknown enums, quarantine, reconciliation, pipeline status | Continuous and daily |

### Status Presentation

| State | Presentation | Decision rule |
| --- | --- | --- |
| `ON_TARGET` | Target and qualified result clearly visible | Normal review |
| `OFF_TARGET` | Variance and owner visible | Owner records diagnosis and next action |
| `INSUFFICIENT_DATA` | Counts and remaining window visible | No target judgment |
| `DEGRADED` | Warning, failed gate, and last healthy time visible | No roadmap or target decision |
| `UNAVAILABLE` | Missing source and incident owner visible | Restore data before business use |
| `GUARDRAIL_BREACH` | Highest-severity alert with Runbook link | Incident or release-blocking response |

### Alert Routing

| Condition | Initial owner | Response |
| --- | --- | --- |
| Security, privacy, duplicate grant, or credit-loss guardrail breach | Security or Backend | Immediate incident triage |
| Generation success below target for two consecutive complete hours with adequate volume | DevOps, Backend, AI Engineer | Investigate provider and pipeline |
| Critical event freshness p95 above 15 minutes for 30 minutes | Data/Database, DevOps | Mark `DEGRADED` and restore pipeline |
| Payment-credit reconciliation below 100% | Backend, Database | Stop automated healthy status and reconcile |
| KPI target missed for two complete review periods | KPI owner | Record product or business hypothesis and decision |

Alert thresholds do not replace SLOs or incident severity rules. Operational implementation must link to the canonical monitoring and incident documents.

### Release Gate

Before a dashboard is used for a product or launch decision:

1. QA verifies formulas against a fixed synthetic fixture.
2. Database owner verifies deduplication, backfill, and reconciliation.
3. Security verifies access, export, and prohibited-field controls.
4. PM signs off that labels match the canonical metric and funnel contracts.
5. The dashboard displays freshness, quality, sample, version, and owner.

## Checklist

- [x] Role-based views, required fields, quality states, and owners are defined.
- [x] Missing, stale, degraded, and insufficient data cannot appear healthy.
- [x] Aggregate and investigation access boundaries are separate.
- [x] Alert conditions route to explicit owners and responses.
- [x] Dashboard use has a QA, data, security, and PM release gate.
- [ ] Dashboard queries, access controls, alerts, and fixtures are implemented and validated.

## Related Documents

- [Business KPI](../01_Business/KPI.md)
- [Analytics Events](EVENTS.md)
- [Product Metrics](METRICS.md)
- [Product Funnel](FUNNEL.md)
- [Monitoring](../07_Operations/MONITORING.md)
- [Incident Management](../07_Operations/INCIDENT.md)
- [Privacy](../09_Security/PRIVACY.md)
- [Data Retention](../10_Data/RETENTION.md)
