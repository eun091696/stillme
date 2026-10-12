# API Versioning

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document defines compatibility, version selection, deprecation, and migration for `api-v1`.

## Goals

- Allow server and client releases to roll independently without silent breakage.
- Separate API, event, webhook, policy, and model version lifecycles.
- Make every breaking change discoverable, testable, and reversible.

## Requirements

### Version Location

- Stable product HTTP APIs use a major version in the path: `/api/v1`.
- Minor compatible evolution does not change the path.
- Provider callback URLs may remain stable while the adapter stores provider payload/schema version and converts to an internal versioned event.
- Analytics event, prompt, model, commercial policy, and database migration versions are not inferred from the API major.

### Compatibility

| Change | Compatibility | Rule |
| --- | --- | --- |
| Add optional response field | Compatible | Consumer ignores unknown fields |
| Add optional request field | Compatible | Server default is documented |
| Add enum value | Potentially breaking | Requires tolerant-consumer evidence or new version |
| Make optional field required | Breaking | New major |
| Remove/rename/change type or meaning | Breaking | New major |
| Change auth, ownership, economic, or idempotency semantics | Breaking | New major or explicit migration |
| Tighten a security limit | Case-specific | May ship urgently with release note and recovery guidance |
| Fix behavior that violated the documented contract | Compatible fix | Regression test required |

## Implementation

### Deprecation Lifecycle

1. Publish successor contract, rationale, migration guide, and compatibility tests.
2. Mark the old version deprecated without changing its behavior.
3. Emit documented `Deprecation` and `Sunset` response metadata where applicable.
4. Observe consumer usage and contact known owners.
5. Maintain externally consumed stable versions for at least 90 days after successor availability unless an active security incident requires faster containment.
6. Remove only after the sunset gate, zero unsupported consumers, rollback plan, and CTO approval.

Same-application private calls still support rolling deployments and at least one compatible client release; “internal” is not permission for an uncoordinated break.

### Schema and Contract Evidence

- Request, success, Problem Details, headers, and webhook fixtures are versioned.
- Consumer-driven contract tests cover the current client and the previous compatible deployed client.
- Persist the policy/model/catalog/schema version needed to reconstruct economic and generation decisions.
- Historical records retain original semantics; a new API version does not rewrite them.

### Version Review

Every API change answers:

- Is a current valid request rejected or interpreted differently?
- Can a current consumer parse the response and enum values?
- Do auth, visibility, money, credits, retry, or state transitions change?
- Can old and new releases coexist during deployment and rollback?
- Are metrics, logs, docs, fixtures, and SDK/types synchronized?

## Checklist

- [x] URL major version and independent version domains are defined.
- [x] Compatible and breaking changes are classified.
- [x] Deprecation, 90-day external sunset, urgent-security exception, and rollback gates are explicit.
- [x] Rolling deployment and historical semantic preservation are required.
- [ ] Machine-readable schemas and compatibility tests are implemented.
- [ ] Consumer inventory and deprecation telemetry exist.

## Related Documents

- [REST API](REST.md)
- [Error Codes](ERROR_CODES.md)
- [Webhooks](WEBHOOKS.md)
- [API Architecture](../03_Architecture/API.md)
- [Release](../04_Engineering/RELEASE.md)
- [Version History](../08_Release/VERSION_HISTORY.md)
