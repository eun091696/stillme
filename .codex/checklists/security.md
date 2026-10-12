# Security Checklist

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This checklist is the implementation and release gate for `security-v1`. A checked design item is not evidence that the runtime control exists.

## Goals

- Turn threat and control IDs into reviewable evidence.
- Require negative tests at every sensitive boundary.
- Prevent documentation, happy-path tests, or provider defaults from being treated as security proof.

## Requirements

- Every security-relevant change names affected `THR-*` and `CTL-*` IDs.
- Evidence identifies environment, command/test, result, owner, date, and known gaps.
- Critical and high risks block release unless the documented exception policy permits acceptance.
- Exceptions are time-bound and include compensating control and removal plan.

## Implementation

### Review Evidence

| Surface | Required evidence |
| --- | --- |
| Identity/session | Server verification, expiry/revocation, recovery, cache, enumeration, CSRF |
| Authorization/RLS | Anonymous, owner, cross-user, forged owner, privileged, service access |
| Input/output | Schema/size/state validation, XSS, injection, header policy |
| Payment/credit | Server amount/order verification, replay, concurrency, partial failure, reconciliation |
| AI/cost | Prompt/content policy, rate and budget caps, retry bound, provider failure |
| Storage | Private bucket, ownership, signed URL expiry/method/key, content validation |
| Secrets | Repository/history/build/bundle scans, least privilege, rotation/revocation |
| Logs/privacy | Prohibited-field fixtures, access, retention, deletion, export |
| Operations | Alerts, containment, rollback, reconciliation, incident exercise |
| Supply chain | Lockfile, dependency review, CI/deployment identity and secret scope |

## Checklist

### Design Gate

- [x] Assets, actors, trust boundaries, and data flows are documented.
- [x] Threats have severity, controls, owner, and residual target.
- [x] Authentication, RLS, secrets, privacy, and control contracts are defined.
- [x] Official provider and framework guidance is recorded.
- [x] Security Engineer, CTO, and repository owner approve `security-v1`.

### Implementation Gate

- [ ] All affected controls are implemented or have approved exceptions.
- [x] Authorization and RLS negative tests cover every implemented operation.
- [x] Payment, credit, generation, webhook, and retry paths are replay/concurrency safe.
- [ ] Signed access, uploads, prompts, and outputs pass abuse tests.
- [ ] Secrets and prohibited data are absent from repository, build, bundle, logs, and analytics.
- [ ] Security headers, origins, cache rules, and rate limits pass in staging.

### Release Gate

- [ ] No unaccepted critical or high risk remains.
- [ ] Security, privacy, dependency, and secret scans pass.
- [ ] Alerts, incident containment, key rotation, reconciliation, backup, and rollback are exercised.
- [ ] Security and CTO sign-off references current evidence and exception expiry.

## Related Documents

- [Threat Model](../../docs/09_Security/THREAT_MODEL.md)
- [Security Architecture](../../docs/03_Architecture/SECURITY.md)
- [Authentication Policy](../../docs/09_Security/AUTH_POLICY.md)
- [RLS Policy](../../docs/09_Security/RLS_POLICY.md)
- [Secrets Management](../../docs/09_Security/SECRETS.md)
- [Privacy](../../docs/09_Security/PRIVACY.md)
- [Test Strategy](../../docs/04_Engineering/TEST.md)
- [Release Checklist](release.md)
