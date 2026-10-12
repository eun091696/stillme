# Incident Management

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document defines severity, command roles, communication, evidence, closure, and learning for production incidents. It is a planned operating contract and does not claim a staffed incident program.

## Goals

- Prioritize customer safety, data integrity, and containment over diagnosis speed.
- Give one Incident Commander authority and a clear escalation path.
- Preserve redacted evidence and reliable communication.
- Convert incidents into tested reliability improvements.

## Requirements

### Incident Roles

| Role | Responsibility |
| --- | --- |
| Incident Commander | Severity, priorities, delegation, approvals, exit decision |
| Operations Lead | Mitigation, deployment/configuration, provider coordination |
| Technical Lead | Diagnosis, data/domain reconciliation, recovery verification |
| Security Lead | Disclosure/secret/privacy containment and legal review trigger |
| Communications Lead | Internal/customer/status updates approved by IC |
| Scribe | UTC timeline, decisions, evidence references, actions and owners |

DevOps is default Incident Commander until explicitly transferred. The affected service owner is Technical Lead. Security leads any suspected disclosure or credential compromise. One person may hold multiple roles only while workload and independence remain safe.

### Severity

Use `SEV0`–`SEV3` definitions and acknowledgement targets from [Operations Monitoring](MONITORING.md). When uncertain, assign the higher severity until evidence permits downgrade. Customer scope alone does not reduce severity for cross-user disclosure, duplicate financial effect, or destructive data loss.

## Implementation

### Lifecycle

1. **Detect:** Capture alert/source, environment, first seen, affected journey, and safe correlation.
2. **Declare:** Create incident ID, severity, IC, channel, timeline, and initial hypothesis label.
3. **Contain:** Stop exposure, duplication, corruption, or irreversible work before deep diagnosis.
4. **Mitigate:** Apply the smallest reversible Runbook action and verify user impact.
5. **Recover:** Reconcile durable state, queues/providers, credits/payments, storage/deletion, and telemetry.
6. **Communicate:** State confirmed impact, mitigation, next update, and unknowns without speculation or sensitive data.
7. **Close:** Confirm SLI recovery, burn stabilization, invariants, backlog, customer handling, evidence, and residual risk.
8. **Learn:** Blameless review for `SEV0`/`SEV1` and material `SEV2`; assign prevention with owner/date/test.

### Security and Data Boundary

- Do not paste secrets, tokens, user content, signed URLs, payment details, raw provider payloads, or broad database extracts into incident tools.
- Preserve originals only in approved restricted evidence storage with access audit and retention.
- Credential compromise prioritizes revocation/rotation and scope assessment.
- Suspected disclosure triggers Security/CTO and legal notification review; responders do not promise notification status.
- Financial and deletion incidents close only after reconciliation, not merely provider recovery.

### Post-Incident Evidence

Record impact window, affected SLO/guardrail, detection/acknowledgement/containment/recovery times, releases/configuration, root and contributing factors, what went well/poorly, customer/data/security/economic assessment, budget consumed, Runbook gaps, and corrective actions.

Corrective actions are prioritized by recurrence/impact reduction, not document volume. Overdue critical actions block the affected release unless CTO accepts a time-bound exception.

## Checklist

- [x] Incident roles, severity source, lifecycle, and closure evidence are defined.
- [x] Security, data, financial, deletion, and communication boundaries are explicit.
- [x] Review and corrective-action gates are defined.
- [x] 대표 financial incident를 local 합성-data로 훈련하고 bounded evidence와
      cleanup을 검증했다.
- [ ] Incident tooling, restricted evidence storage, role access, and communication channels exist.
- [ ] SEV0/SEV1 drills and real response evidence meet the contract.

## Related Documents

- [Operations Monitoring](MONITORING.md)
- [Operations Runbook](RUNBOOK.md)
- [Observability](OBSERVABILITY.md)
- [Security Architecture](../03_Architecture/SECURITY.md)
- [Data Retention](../10_Data/RETENTION.md)
- [Observability Checklist](../../.codex/checklists/observability.md)
