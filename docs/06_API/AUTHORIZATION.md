# API Authorization

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document defines caller, action, resource, field, and state authorization for `api-v1`. Authentication proves an identity; authorization is evaluated separately for every operation.

## Goals

- Deny by default and prevent cross-user data access.
- Apply the same policy to direct HTTP calls, Server Actions, workers, and provider callbacks.
- Use server authorization plus RLS as independent defenses.
- Keep privileged and service access narrow and auditable.

## Requirements

### Authorization Inputs

Only server-verified inputs may influence a decision:

- authenticated subject and assurance/session state;
- server-owned role/permission;
- resource owner/tenant and current state;
- requested action and fields;
- policy version and approved privileged context.

Email, client metadata, hidden UI, URL owner ID, request role, and mutable user profile metadata are not authority.

### Decision Order

1. Verify caller or provider mechanism.
2. Resolve resource without exposing unauthorized existence.
3. Check action permission and current state.
4. Check field-level read/write policy.
5. Execute with user-scoped RLS or an explicitly justified service path.
6. Return the minimum DTO and audit privileged or denied-sensitive actions.

## Implementation

### MVP Matrix

| Resource/action | Guest | Owner user | Other user | Privileged/service |
| --- | --- | --- | --- | --- |
| Public plans | Read | Read | Read | Managed publication only |
| Own profile | None | Minimum read/update fields | None | Audited support minimum |
| Credit balance/ledger | None | Read own | None | Server ledger function; no direct overwrite |
| Order/payment summary | None | Create/read own safe fields | None | Server verification/reconciliation |
| Generation job | None | Create/read own; retry eligible failure | None | Worker transition under named capability |
| Asset/download grant | None | Own available asset only | None | Lifecycle worker/support by permission |
| Admin/support action | None | None | None | Explicit RBAC, MFA, reason, audit, dual control where required |
| Webhook receipt | Provider mechanism only | None | None | Restricted processor |

### Enforcement

- Centralize decisions in a server-side data-access/authorization layer.
- RLS policies match the resource matrix but do not replace application state and field checks.
- Service clients never inherit a user session and cannot be imported into client-reachable modules.
- Privileged operations name permission, actor, target, reason, request ID, previous/new state, and approval where required.
- Denials do not reveal another user's resource; unsafe differences in timing or message are minimized.
- Cookie-authenticated unsafe operations enforce origin/CSRF policy from `security-v1`.

### Required Tests

Every operation includes anonymous, valid owner, other user, forged owner, expired/revoked session, insufficient role, stale role, invalid state, and approved service path. Collection tests prove filters, joins, counts, pagination, and expansions cannot leak unauthorized records.

### Implemented Operator Boundary

`operator_has_permission`은 verified `auth.uid()`, `aal2`, active server-owned
role과 explicit permission mapping을 함께 검사합니다.
`request_operator_role_change`와 `approve_operator_role_change`는
`role.manage`, independent approver, target separation, expiry와 idempotency를
database에서 강제합니다. 이 foundation은 role authorization만 구현하며 Admin
resource lookup DTO와 corrective action authorization은 후속 Milestone입니다.

### Official Evidence

- [Next.js Authentication and Authorization](https://nextjs.org/docs/app/guides/authentication)
- [Supabase Server Auth Client](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Checklist

- [x] Trusted inputs and authorization order are explicit.
- [x] MVP resource/action matrix covers guest, owner, other user, and privileged/service actors.
- [x] Server checks, RLS, minimum DTOs, CSRF, and audit are required.
- [x] Cross-user collection and resource negative tests are defined.
- [ ] Central authorization and DTO layers are implemented.
- [ ] API and RLS authorization matrix passes automatically.
- [x] Operator role permission과 dual-control role-change RPC가 구현·검증됐다.

## Related Documents

- [REST API](REST.md)
- [Authentication Policy](../09_Security/AUTH_POLICY.md)
- [RLS Policy](../09_Security/RLS_POLICY.md)
- [Threat Model](../09_Security/THREAT_MODEL.md)
- [Security Architecture](../03_Architecture/SECURITY.md)
- [Error Codes](ERROR_CODES.md)
