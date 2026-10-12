# Product Metrics

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document is the canonical formula registry for `analytics-v1`. It defines eligibility, numerator, denominator, time window, dimensions, and quality behavior. Targets and business responses belong to [Business KPI](../01_Business/KPI.md).

## Goals

- Make every KPI reproducible from governed source events.
- Prevent denominator drift and inconsistent cohort definitions.
- Expose sample size, freshness, and data quality with every result.
- Separate launch hypotheses from observed production baselines.

## Requirements

### Common Metric Contract

Every published metric includes:

- stable metric ID and version;
- owner and source event set;
- timezone, window, numerator, denominator, exclusions, and deduplication key;
- result, sample size, freshness, completeness, and quality status;
- supported dimensions with minimum segment size;
- lineage to the transformation version.

The default business timezone is `Asia/Seoul`. Event timestamps remain UTC. Users are deduplicated by internal opaque actor ID and jobs, orders, assets, and ledger records by their domain ID.

### Shared Exclusions

Exclude non-production environments, internal/test actors, synthetic monitors, bots, invalid schemas, quarantined payloads, known duplicate domain records, and events outside the completed observation window. User cancellation is excluded only where a metric explicitly says so.

## Implementation

### Canonical Registry

| Metric ID | Name | Formula and window | Sources | Owner |
| --- | --- | --- | --- | --- |
| `MET-001` | Weekly value-realizing creators | Distinct actors with both a successful generation and successful download in the same KST ISO week | `generation_job_succeeded`, `image_download_succeeded` joined by actor and owned job | PM |
| `MET-002` | 24-hour activation rate | Newly verified actors with first successful generation within 24 hours / all newly verified actors whose 24-hour window is complete | `auth_email_verified`, `generation_job_succeeded` | PM |
| `MET-003` | Time to first successful image | Median minutes from email verification to first successful generation among activated actors, reported with p75 and p95 | Same as `MET-002` | PM |
| `MET-004` | Successful-generation download rate | Distinct successful jobs downloaded within 24 hours / distinct successful jobs with a complete 24-hour window | `generation_job_succeeded`, `image_download_succeeded` | PM |
| `MET-005` | D7 value retention | Activated actors with a successful generation or download on cohort days 7–13 / activated actors whose day-13 window is complete | Activation derivation, `generation_job_succeeded`, `image_download_succeeded` | PM |
| `MET-006` | Activated-to-paid conversion | Activated actors with first verified payment within 7 days of activation / activated actors with a complete 7-day window | Activation derivation, `payment_verification_succeeded` | CEO |
| `MET-007` | Generation success rate | Distinct succeeded jobs / distinct accepted jobs reaching terminal or still eligible terminal status during the rolling 7-day window | `generation_job_accepted`, `generation_job_succeeded`, `generation_job_failed` | CTO |
| `MET-008` | Generation latency p95 | p95 `duration_ms` for successful jobs over rolling 7 days; also show median by model | `generation_job_succeeded` | CTO |
| `MET-009` | Verified payment completion rate | Distinct verified orders / distinct checkout orders, excluding explicit user cancellations, with a complete 24-hour window | `payment_checkout_started`, `payment_checkout_cancelled`, `payment_verification_succeeded`, `payment_verification_failed` | CEO |
| `MET-010` | Contribution per successful generation | Recognized generation revenue minus model, storage, processing, payment allocation, refund, and support-cost allocation; gross margin is contribution / recognized revenue | Trusted ledger plus `generation_job_succeeded`; event estimate is diagnostic only | CEO |
| `MET-011` | Credit recovery integrity | Eligible failed jobs with exactly one matching credit restoration / all eligible failed jobs | `generation_job_failed`, `credit_restore_committed`, credit ledger | Backend |
| `MET-012` | Payment-credit reconciliation | Verified paid orders with exactly one matching committed credit grant / all verified paid orders | `payment_verification_succeeded`, `credit_grant_committed`, payment and credit ledgers | Backend |

### Cohort and Window Semantics

- Day `0` begins at the activation timestamp, not local midnight.
- A D7 window includes elapsed days 7 through 13; a D30 window, when added, includes days 30 through 36.
- A user enters the activation cohort once, at first qualifying activation.
- Jobs crossing a reporting boundary are assigned by the event relevant to the formula.
- Open windows are excluded from final rates and may appear only as clearly labeled provisional diagnostics.

### Dimensions

Approved dimensions are:

- acquisition `entry_point`;
- new versus returning actor;
- product ID;
- model ID and model version;
- style ID and aspect ratio;
- platform class;
- failure stage and bounded reason code;
- app release version.

Do not publish a segment with fewer than 30 eligible actors or jobs. Sensitive or inferred demographic segmentation is not approved.

### Metric Quality Status

| Status | Meaning | Publication behavior |
| --- | --- | --- |
| `HEALTHY` | All source, freshness, reconciliation, and completeness gates pass | Publish normally |
| `DEGRADED` | Result may be directionally useful but a named gate fails | Show warning; no target or roadmap decision |
| `INSUFFICIENT_DATA` | Sample or complete window is below the KPI gate | Show counts; do not score target |
| `UNAVAILABLE` | Source or lineage is missing | Hide value and alert owner |

### Change Control

A metric formula change creates a new metric version and effective date. Historical data is either recomputed with the new version or remains labeled with the old version; dashboards may not splice versions into one unlabeled series.

## Checklist

- [x] Every launch KPI maps to one canonical metric ID.
- [x] Formula, window, source, owner, exclusions, and cohort rules are explicit.
- [x] Open windows and low samples cannot masquerade as final results.
- [x] Dimensions and minimum segment size protect interpretation and privacy.
- [x] Data-quality status controls publication and decisions.
- [ ] Transformations and reconciliation queries are implemented and tested.

## Related Documents

- [Business KPI](../01_Business/KPI.md)
- [Analytics Events](EVENTS.md)
- [Product Funnel](FUNNEL.md)
- [Analytics Dashboard](DASHBOARD.md)
- [Credits](../01_Business/CREDITS.md)
- [Payments](../01_Business/PAYMENTS.md)
