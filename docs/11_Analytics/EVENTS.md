# Analytics Events

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document is the canonical `analytics-v1` event contract. It defines stable names, ownership, source authority, minimum properties, privacy limits, versioning, and the MVP catalog. It does not select an analytics vendor or authorize collection before privacy and security gates are implemented.

## Goals

- Give product stories, metrics, funnels, tests, and dashboards one shared event vocabulary.
- Separate user intent signals from trusted server outcomes.
- Support deterministic deduplication and lineage.
- Minimize collection and prevent credentials, private content, or payment data from entering analytics.

## Requirements

### Ownership

| Responsibility | Owner | Required reviewers |
| --- | --- | --- |
| Business meaning and event approval | PM | CEO, domain owner |
| Client instrumentation | Frontend | PM, QA, Security |
| Server and provider facts | Backend | Database, Security, QA |
| Model and quality dimensions | AI Engineer | PM, Security, QA |
| Pipeline, access, and retention | Database | DevOps, Security |
| Validation and release evidence | QA | PM, implementation owner |

### Naming and Versioning

- Event names use lowercase `domain_object_action` syntax.
- Names describe completed or attempted facts, never UI labels.
- `schema_version` is an integer beginning at `1`.
- Additive optional properties may keep the current version; removal, semantic change, type change, or required-property addition requires a new schema version.
- Do not reuse or silently redefine an event name.
- Deprecated producers stop only after downstream metrics migrate and the deprecation window is documented.

### Trust Classes

| Class | Meaning | KPI eligibility |
| --- | --- | --- |
| `client_intent` | Interaction observed by the browser | Diagnostic only |
| `server_fact` | Domain outcome committed or verified by the server | Eligible after quality gates |
| `provider_fact` | External outcome verified by trusted server processing | Eligible after reconciliation |
| `derived_fact` | Deterministic event produced from governed data | Eligible with lineage |

Client events cannot prove authentication, payment, credit, generation, storage, or authorization success.

### Required Envelope

| Property | Type | Contract |
| --- | --- | --- |
| `event_id` | UUID string | Globally unique deduplication key |
| `event_name` | string | Approved catalog name |
| `schema_version` | integer | Payload contract version |
| `occurred_at` | UTC timestamp | Time the domain fact occurred |
| `received_at` | UTC timestamp | Set by ingestion |
| `environment` | enum | `development`, `staging`, or `production` |
| `source` | enum | `web`, `server`, `worker`, `webhook`, or `derived` |
| `trust_class` | enum | Approved trust class |
| `actor_id` | opaque string or null | Internal pseudonymous subject ID; never email |
| `anonymous_id` | opaque string or null | Rotatable pre-auth identifier |
| `session_id` | opaque string or null | Session correlation, not an authentication token |
| `request_id` | opaque string or null | Trace correlation without secret content |
| `story_id` | string | Related MVP story ID |

At least one of `actor_id` or `anonymous_id` is required for user-journey events. Operational facts may use neither when a user is not relevant.

### Privacy and Security

Never include:

- email address, name, phone number, address, raw IP address, password, session or provider token;
- full prompt, uploaded image, generated image bytes, OCR text, or signed storage URL;
- card, bank, billing-authentication, Toss secret, or unmasked payment data;
- free-form exception messages, stack traces, SQL, headers, cookies, or request bodies;
- small or sensitive segments that allow practical re-identification.

Use approved enums and bounded numeric values for failure and configuration dimensions. Operational security logs and analytics have separate purposes and access controls.

## Implementation

### MVP Event Catalog

| Event | Trust class | Producer | Story | Required domain properties | KPI/funnel use |
| --- | --- | --- | --- | --- | --- |
| `auth_signup_submitted` | `client_intent` | Web | `AUTH-001` | `entry_point` | Signup diagnostics |
| `auth_signup_accepted` | `server_fact` | Server | `AUTH-001` | `account_id`, `verification_required` | Signup funnel |
| `auth_email_verified` | `server_fact` | Server | `AUTH-001` | `account_id` | Cohort entry |
| `auth_login_succeeded` | `server_fact` | Server | `AUTH-002` | `method` | Login health |
| `auth_login_failed` | `server_fact` | Server | `AUTH-002` | `reason_code` | Recovery diagnostics |
| `auth_logout_succeeded` | `server_fact` | Server | `AUTH-002` | none | Session diagnostics |
| `payment_checkout_started` | `server_fact` | Server | `PAY-001` | `order_id`, `product_id`, `amount_minor`, `currency` | Payment funnel |
| `payment_checkout_cancelled` | `provider_fact` | Webhook/server | `PAY-001` | `order_id`, `reason_code` | Exclusion and recovery |
| `payment_verification_succeeded` | `provider_fact` | Server | `PAY-001` | `order_id`, `product_id`, `amount_minor`, `currency` | Paid conversion |
| `payment_verification_failed` | `provider_fact` | Server | `PAY-001` | `order_id`, `reason_code` | Payment reliability |
| `credit_grant_committed` | `server_fact` | Server | `PAY-001` | `order_id`, `ledger_entry_id`, `credit_amount` | Ledger reconciliation |
| `generation_requested` | `client_intent` | Web | `GEN-001` | `style_id`, `aspect_ratio` | Request diagnostics |
| `generation_rejected` | `server_fact` | Server | `GEN-001` | `reason_code`, `style_id`, `aspect_ratio` | Input and credit friction |
| `generation_job_accepted` | `server_fact` | Server | `GEN-001` | `job_id`, `model_id`, `style_id`, `aspect_ratio`, `reserved_credits` | Generation denominator |
| `generation_job_started` | `server_fact` | Worker | `GEN-002` | `job_id`, `model_id`, `queue_ms` | Pipeline diagnostics |
| `generation_job_succeeded` | `server_fact` | Worker | `GEN-002` | `job_id`, `model_id`, `duration_ms`, `output_count`, `charged_credits`, `estimated_cost_minor`, `cost_currency` | Activation, reliability, economics |
| `generation_job_failed` | `server_fact` | Worker | `GEN-002` | `job_id`, `model_id`, `failure_stage`, `reason_code`, `duration_ms`, `retryable` | Reliability and recovery |
| `generation_retry_accepted` | `server_fact` | Server | `GEN-002` | `job_id`, `prior_job_id`, `reason_code` | Retry diagnostics |
| `credit_restore_committed` | `server_fact` | Server | `GEN-002` | `job_id`, `ledger_entry_id`, `credit_amount`, `reason_code` | Credit guardrail |
| `history_view_succeeded` | `server_fact` | Server | `HIST-001` | `result_count`, `has_more` | History adoption |
| `history_view_failed` | `server_fact` | Server | `HIST-001` | `reason_code` | History reliability |
| `image_download_succeeded` | `server_fact` | Server | `HIST-001` | `job_id`, `asset_id`, `format` | North star and usage |
| `image_download_failed` | `server_fact` | Server | `HIST-001` | `job_id`, `reason_code` | Download reliability |
| `resource_access_denied` | `server_fact` | Server | `AUTH-002` or `HIST-001` | `resource_type`, `reason_code` | Security guardrail only |

`account_id`, `order_id`, `job_id`, `asset_id`, and `ledger_entry_id` are internal opaque identifiers. Analytics access must not imply domain-resource access.

### Controlled Dimensions

- `reason_code`, `failure_stage`, `method`, `style_id`, `aspect_ratio`, `model_id`, `format`, `product_id`, and `entry_point` use server-approved allowlists.
- Monetary values use integer minor units plus ISO currency code.
- Durations use non-negative integer milliseconds.
- Unknown values use a documented `unknown` enum, not free text.

### Delivery and Deduplication

1. Domain state commits before the corresponding server fact is emitted.
2. The producer assigns a stable `event_id`; retries reuse it.
3. Ingestion may be at-least-once; storage enforces uniqueness on `event_id`.
4. Metric jobs deduplicate again by event ID and domain invariant key.
5. Late events retain `occurred_at`; dashboards expose freshness and backfill status.
6. Invalid or prohibited payloads go to restricted quarantine without entering KPI datasets.

### Quality Contract

| Check | Gate |
| --- | --- |
| Required-field validity | `>= 99.5%` per critical event over a complete day |
| Duplicate event IDs after ingestion | `< 0.1%` before deduplication; `0` after deduplication |
| Critical event freshness | p95 `<= 15 minutes` |
| Server-to-ledger reconciliation | `100%` for payment and credit events |
| Prohibited-field scan | `0` findings |
| Unknown enum rate | `< 1%`, otherwise investigate schema drift |

Events that fail a critical gate are excluded from healthy KPI publication and marked `DEGRADED`.

### Implementation Evidence

An instrumentation Pull Request must include:

- schema or typed event contract;
- producer tests for success, failure, retry, and prohibited fields;
- ingestion deduplication and quarantine tests;
- event-to-story and event-to-metric mapping;
- sample payloads with synthetic identifiers only;
- dashboard freshness and reconciliation evidence.

## Checklist

- [x] Event names, versions, trust classes, and envelope are defined.
- [x] Every MVP story has success and material failure signals.
- [x] Business outcomes rely on server or verified provider facts.
- [x] Sensitive and free-form properties are prohibited.
- [x] Deduplication, late arrival, quarantine, and quality gates are defined.
- [x] CEO and PM have approved `analytics-v1`.
- [ ] Event producers and pipelines are implemented and tested.

## Related Documents

- [Business KPI](../01_Business/KPI.md)
- [Feature Stories](../02_Product/FEATURES.md)
- [Product Metrics](METRICS.md)
- [Product Funnel](FUNNEL.md)
- [Analytics Dashboard](DASHBOARD.md)
- [Privacy](../09_Security/PRIVACY.md)
- [Logging](../03_Architecture/LOGGING.md)
- [Test Strategy](../04_Engineering/TEST.md)
