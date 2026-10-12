# Business KPI

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document defines the decision layer for AI Photo Studio business and product measurement. Metric formulas belong to [Product Metrics](../11_Analytics/METRICS.md), source events belong to [Analytics Events](../11_Analytics/EVENTS.md), and this document owns targets, decision cadence, accountability, and escalation.

`analytics-v1` is a launch hypothesis, not an industry benchmark or a claim about current production performance.

## Goals

- Measure whether customers reach the core value of generating and using an image.
- Connect growth, monetization, retention, reliability, and safety to named decisions.
- Prevent small samples, duplicate events, or client-only signals from driving product decisions.
- Give CEO, PM, Engineering, QA, and Operations one review contract.

## Requirements

### Governance

| Field | Contract |
| --- | --- |
| Decision ID | `AN-001` |
| Version | `analytics-v1` |
| Status | `APPROVED` |
| Accountable owner | CEO |
| Operational owner | PM |
| Required reviewers | CTO, Marketing, Backend, Database, Security, QA |
| Approval scope | Metric definitions, initial targets, event taxonomy, funnel windows, dashboard gates |
| Approval authority | Repository owner acting for CEO and PM |
| Review cadence | Weekly operating review; monthly target review; quarterly version review |
| Revisit triggers | Material pricing or funnel change, event schema break, 30 days of qualified production data, privacy finding, or metric integrity incident |

### Interpretation Rules

- Use Korea Standard Time (`Asia/Seoul`) for business reporting boundaries and UTC for event timestamps.
- Identify cohorts by the first qualifying event; later profile changes do not rewrite historical cohorts.
- Exclude internal, test, local, staging, bot, and synthetic traffic from business KPIs.
- Deduplicate server facts before aggregation and publish numerator, denominator, sample size, window, and freshness together.
- Show `INSUFFICIENT_DATA` instead of a percentage when a minimum sample is not met.
- Do not compare partial and complete periods without an explicit projection label.
- Segment results only when the segment is large enough to avoid re-identification and misleading conclusions.

## Implementation

### North-Star Metric

**Weekly Value-Realizing Creators (`KPI-NS-001`)** is the number of distinct authenticated users who complete at least one successful image generation and a successful download during the same KST ISO week.

This metric represents delivered user value rather than traffic or generation attempts. Its canonical formula is `MET-001`.

### Launch KPI Scorecard

Targets are internal launch hypotheses. They become eligible for target tuning only after the qualified sample and observation window are satisfied.

| KPI ID | Metric | Canonical metric | Initial target | Qualified sample/window | Accountable owner | Decision if off target |
| --- | --- | --- | --- | --- | --- | --- |
| `KPI-NS-001` | Weekly value-realizing creators | `MET-001` | Establish baseline, then positive 4-week trend | Four complete weeks | CEO | Review acquisition, activation, and download constraints together |
| `KPI-ACT-001` | 24-hour activation rate | `MET-002` | `>= 40%` | `>= 200` newly verified users over 28 days | PM | Prioritize onboarding and first-generation friction |
| `KPI-ACT-002` | Median time to first successful image | `MET-003` | `<= 5 minutes` | `>= 100` activated users over 28 days | PM | Review onboarding steps, queue latency, and error recovery |
| `KPI-USE-001` | Successful-generation download rate | `MET-004` | `>= 60%` | `>= 200` successful generation jobs over 28 days | PM | Review output quality, preview, storage, and download UX |
| `KPI-RET-001` | D7 value retention | `MET-005` | `>= 20%` | `>= 200` activated users with a complete D7 window | PM | Investigate quality, repeat use cases, and lifecycle communication |
| `KPI-REV-001` | Activated-to-paid conversion | `MET-006` | `>= 5%` | `>= 200` activated users with a complete 7-day window | CEO | Review packaging, trial value, price, and checkout friction |
| `KPI-REL-001` | Generation success rate | `MET-007` | `>= 95%` | `>= 500` accepted jobs over rolling 7 days | CTO | Trigger provider, pipeline, and failure-stage review |
| `KPI-REL-002` | Generation latency p95 | `MET-008` | `<= 120 seconds` | `>= 500` successful jobs over rolling 7 days | CTO | Review queue, provider, post-processing, and storage latency |
| `KPI-PAY-001` | Verified payment completion rate | `MET-009` | `>= 95%` | `>= 100` non-user-cancelled checkout attempts over 28 days | CEO | Review provider errors, validation, and checkout recovery |
| `KPI-ECO-001` | Contribution per successful generation | `MET-010` | `> 0` and `>= 60%` gross margin | `>= 500` successful jobs with allocated cost over 28 days | CEO | Adjust routing, credit cost, packaging, or price before scaling |

### Non-Negotiable Guardrails

Guardrails are release or incident thresholds, not optimization goals.

| Guardrail ID | Measure | Threshold | Owner | Required response |
| --- | --- | --- | --- | --- |
| `GRD-SEC-001` | Confirmed cross-user data or asset disclosure | `0` | Security | Stop affected release or access path and invoke incident process |
| `GRD-PAY-001` | Duplicate credit grant for one verified payment | `0` | Backend | Disable affected settlement path and reconcile ledger |
| `GRD-CRD-001` | Unrestored credit after eligible technical generation failure | `0` | Backend | Reconcile affected jobs and correct the invariant |
| `GRD-ANA-001` | Prohibited sensitive value in analytics payload | `0` | Security | Stop ingestion, contain exposure, purge under approved procedure |
| `GRD-DATA-001` | Critical KPI with unknown lineage or failed quality gate | `0 published as healthy` | PM | Mark dashboard `DEGRADED` and block KPI decisions |

### Decision Cadence

1. Data owner publishes freshness, quality status, sample size, and exceptions before the weekly review.
2. PM reviews activation, use, retention, and funnel diagnostics.
3. CTO reviews generation reliability, latency, data integrity, and cost signals.
4. CEO reviews the north star, paid conversion, contribution, and target changes.
5. A target changes only through a new decision entry with effective date, evidence window, owner, and expected consequence.

### Approval Record

The repository owner approved `analytics-v1` on 2026-07-26 by instructing Codex to continue after the complete KPI scorecard, hypothesis status, validation results, and explicit CEO/PM approval boundary were reported.

Approved scope:

- the north-star definition and initial target hypotheses;
- minimum samples, observation windows, owners, and decision responses;
- event taxonomy, formulas, funnels, dashboard states, and zero-tolerance guardrails;
- mandatory review after 30 days of qualified production data.

Engineering, data, security, privacy, consent, retention, and QA implementation gates remain required. Approval authorizes future instrumentation work; it does not claim events, pipelines, dashboards, or production results already exist.

## Checklist

- [x] Every KPI has an ID, owner, target, sample gate, window, and decision response.
- [x] The north-star metric measures realized user value.
- [x] Reliability, economics, security, payment, credit, and data-quality guardrails are explicit.
- [x] Canonical formulas and source events are linked instead of duplicated.
- [x] Targets are labeled as internal launch hypotheses.
- [x] Repository owner has approved `analytics-v1` for CEO and PM.
- [ ] Instrumentation and dashboard implementation have independent validation evidence.

## Related Documents

- [Product](PRODUCT.md)
- [Business Model](BUSINESS_MODEL.md)
- [Pricing](PRICING.md)
- [Credits](CREDITS.md)
- [Payments](PAYMENTS.md)
- [Analytics Events](../11_Analytics/EVENTS.md)
- [Product Metrics](../11_Analytics/METRICS.md)
- [Product Funnel](../11_Analytics/FUNNEL.md)
- [Analytics Dashboard](../11_Analytics/DASHBOARD.md)
- [Privacy](../09_Security/PRIVACY.md)
- [Master Plan](../../MASTER_PLAN.md)
