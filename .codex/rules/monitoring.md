# Monitoring Rule

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This rule applies `observability-v1` SLI, SLO, error-budget, alert, dashboard, on-call, and Runbook contracts.

## Goals

- Measure customer-visible reliability rather than internal activity.
- Page only for urgent, actionable user or invariant risk.
- Make every alert owned, testable, and linked to safe recovery.

## Requirements

- Every SLO defines eligible and good events, exclusions, source, window, target, owner, and missing-data behavior.
- Planned maintenance and provider-caused customer failure count unless the SLO explicitly defines a product-approved exclusion.
- Separate business KPI, SLO, infrastructure diagnostic, and zero-tolerance invariant.
- Use multiwindow burn-rate alerts for sufficiently populated ratio SLIs and synthetic/direct invariant alerts for low traffic.
- Every page names a primary owner, secondary owner, severity, dashboard, Runbook, acknowledgement target, and escalation.
- Never page on a metric with no actionable response or suppress an exhausted error budget without an approved exception.
- A release cannot claim readiness while critical telemetry, paging delivery, or referenced Runbooks are unverified.

## Implementation

Define the user journey first, then good/eligible events and recording rules. Page on 14.4× burn across both 1 hour/5 minutes or 6× across both 6 hours/30 minutes; create tickets for slower sustained burn. Zero-tolerance security, payment, credit, and data-integrity guardrails bypass error budgets and trigger the incident process immediately.

## Checklist

- [ ] SLI queries and target math match the canonical SLO registry.
- [ ] Missing/late telemetry cannot render a false green state.
- [ ] Burn-rate, low-traffic, invariant, and notification-delivery tests pass.
- [ ] Alert labels are bounded and payloads contain no prohibited data.
- [ ] Runbook links, ownership, escalation, and quarterly review are current.
- [ ] Error-budget policy gates deployment and records exceptions.

## Related Documents

- [Monitoring Architecture](../../docs/03_Architecture/MONITORING.md)
- [Operations Monitoring](../../docs/07_Operations/MONITORING.md)
- [Operations Runbook](../../docs/07_Operations/RUNBOOK.md)
- [Incident Management](../../docs/07_Operations/INCIDENT.md)
- [Observability Checklist](../checklists/observability.md)
