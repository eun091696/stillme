# Product Funnel

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document defines the `analytics-v1` journey funnels from verified account to realized image value and payment. Events are canonical in [Analytics Events](EVENTS.md); KPI formulas and targets are not redefined here.

## Goals

- Locate friction in the MVP journey without confusing intent with trusted outcomes.
- Use stable entry rules, order, windows, and exclusions.
- Connect funnel loss to product, reliability, and recovery owners.
- Make incomplete and low-sample cohorts visible.

## Requirements

### Funnel Rules

- Count distinct actors unless a funnel explicitly says orders or jobs.
- Require chronological step order and the same actor ownership.
- Use server or verified provider facts for outcome steps.
- Preserve re-entry diagnostics, but count an actor once at the first qualifying step.
- Exclude incomplete windows from final conversion rates.
- Report step count, previous-step conversion, entry conversion, median elapsed time, and p95 elapsed time.
- Apply common exclusions and quality states from [Product Metrics](METRICS.md).

## Implementation

### Funnel FNL-001 — Activation

**Purpose:** Determine whether a verified user reaches first image value.

**Entry cohort:** First `auth_email_verified`.

**Conversion window:** 24 hours from entry.

| Order | Step | Source | Owner | Loss interpretation |
| --- | --- | --- | --- | --- |
| 1 | Email verified | `auth_email_verified` | Backend | Eligible new account |
| 2 | Generation accepted | `generation_job_accepted` | PM, Backend | Prompt, option, credit, or onboarding friction |
| 3 | Generation succeeded | `generation_job_succeeded` | CTO, AI Engineer | Provider or pipeline reliability |
| 4 | Image downloaded | `image_download_succeeded` | PM, Frontend | Output relevance, preview, storage, or download friction |

Primary outputs are 24-hour activation, time to first successful image, and successful-generation download rate.

### Funnel FNL-002 — Monetization

**Purpose:** Determine whether an activated user completes a first verified purchase.

**Entry cohort:** First activation as defined by `MET-002`.

**Conversion window:** Seven elapsed days from activation.

| Order | Step | Source | Owner | Loss interpretation |
| --- | --- | --- | --- | --- |
| 1 | Activated | Derived from `MET-002` | PM | User has experienced generation value |
| 2 | Checkout started | `payment_checkout_started` | PM, Backend | Purchase intent |
| 3 | Payment verified | `payment_verification_succeeded` | Backend | Provider and server verification |
| 4 | Credit grant committed | `credit_grant_committed` | Backend, Database | Ledger completion |
| 5 | Paid-credit generation succeeded | Generation fact joined to paid-credit ledger | PM | Purchased value realized |

Explicit user cancellation remains visible but is excluded only from the verified payment completion denominator defined by `MET-009`.

### Funnel FNL-003 — Generation Reliability

**Purpose:** Locate where accepted work fails or stalls.

**Unit:** Distinct `job_id`.

**Window:** Rolling seven days, with accepted jobs allowed 24 hours to reach a terminal state.

| Order | Step | Source | Owner | Loss interpretation |
| --- | --- | --- | --- | --- |
| 1 | Job accepted | `generation_job_accepted` | Backend | Valid request and credit reservation |
| 2 | Worker started | `generation_job_started` | Backend, DevOps | Queue or dispatch health |
| 3 | Job succeeded | `generation_job_succeeded` | AI Engineer, Backend | Provider, processing, and storage health |
| 4 | Image downloaded | `image_download_succeeded` | Frontend, Backend | Delivery health and user value |

Failed jobs branch by `failure_stage`, `reason_code`, `model_id`, and `retryable`. Eligible failures must reconcile to exactly one `credit_restore_committed`.

### Funnel FNL-004 — Authentication Recovery

**Purpose:** Diagnose account access failure without exposing account-existence or credential details.

**Entry cohort:** Actor or anonymous session with an approved authentication attempt.

**Window:** 24 hours.

| Step | Source | Owner |
| --- | --- | --- |
| Signup submitted | `auth_signup_submitted` | Frontend |
| Signup accepted | `auth_signup_accepted` | Backend |
| Email verified | `auth_email_verified` | Backend |
| Login succeeded | `auth_login_succeeded` | Backend |

Failure reporting uses bounded reason groups. Raw email, credentials, verification tokens, and provider error text are prohibited.

### Diagnostic Contract

For every material drop, the dashboard provides:

- the affected funnel and step;
- cohort dates and completion status;
- sample size and quality status;
- top approved reason codes;
- comparison with the previous equivalent complete period;
- accountable owner and linked Runbook when operational.

## Checklist

- [x] Activation, monetization, reliability, and authentication funnels are defined.
- [x] Entry, ordering, conversion window, unit, and source are explicit.
- [x] Every material loss point has an accountable owner.
- [x] Outcome steps rely on trusted server or reconciled facts.
- [x] Incomplete windows and user cancellations have explicit handling.
- [ ] Funnel transformations and diagnostic views are implemented and tested.

## Related Documents

- [Business KPI](../01_Business/KPI.md)
- [Feature Stories](../02_Product/FEATURES.md)
- [User Flow](../02_Product/USER_FLOW.md)
- [Analytics Events](EVENTS.md)
- [Product Metrics](METRICS.md)
- [Analytics Dashboard](DASHBOARD.md)
- [Generation Failure Playbook](../../playbooks/AI_GENERATION_FAILURE.md)
- [Payment Failure Playbook](../../playbooks/PAYMENT_FAILURE.md)
