# RLS Policy

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document defines the default-deny Row Level Security contract for Supabase
data. Profiles, generation jobs와 assets는 versioned migration과 local test
evidence가 있으며 나머지 entity는 policy와 test matrix만 정의된 planned
상태입니다.

## Goals

- Make cross-user access impossible even when an application authorization check is missed.
- Keep anonymous, authenticated, privileged, and service access explicit.
- Protect financial and audit history from direct mutation.
- Require positive and negative evidence for every exposed operation.

## Requirements

### Baseline Rules

- Enable and force RLS where supported on every application table exposed through Supabase APIs.
- Revoke default privileges and grant only required table, view, sequence, and function operations.
- Use `auth.uid()` or server-controlled claims only after null handling; never trust a client-provided owner or role.
- Define separate policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`; use both `USING` and `WITH CHECK` where applicable.
- Index columns used by policies, including owner and tenant keys.
- Views use `security_invoker` or are isolated from exposed schemas; security-definer functions have fixed `search_path`, minimum grants, validated arguments, and review.
- Service-role/bypass access is exceptional, server-only, named, scoped, audited, and tested separately.
- RLS supplements server authorization and domain invariants; it does not validate payment, credit, generation state, or business transitions by itself.

## Implementation

### Planned Policy Matrix

Final names follow approved migrations. Any renamed or split entity inherits the same security intent.

| Entity | Anonymous | Owner | Other user | Privileged/service | Mutation rule |
| --- | --- | --- | --- | --- | --- |
| Profile | None | Read/update approved fields | None | Audited support minimum | User cannot set role, credit, or security fields |
| Generation job | None | Read own; create through server contract | None | Worker updates named states | Owner and economic fields immutable from client |
| Asset metadata | None | Read own available assets | None | Worker creates/updates lifecycle | No arbitrary storage key or owner mutation |
| Order/payment | None | Read safe own summary | None | Server-only create/state transition | No client write; provider and ledger reconciliation |
| Credit account/ledger | None | Read own balance/history | None | Server transaction/function only | Append-only; no user insert/update/delete |
| Audit/security event | None | None unless explicit user export policy | None | Restricted append/read by role | Immutable; sensitive fields minimized |
| Analytics fact | None | None | None | Restricted pipeline | No direct product-client access |

### Required Test Matrix

For every entity and operation, test:

| Actor | Expected result |
| --- | --- |
| Anonymous | Denied unless an explicit public table contract exists |
| Authenticated owner | Only approved columns/rows and valid operation |
| Authenticated other user | Zero rows or denied without existence disclosure |
| Authenticated user with forged owner ID | Denied by `WITH CHECK` and server validation |
| Expired/revoked session | Denied |
| Privileged role without required permission | Denied |
| Approved service job | Only scoped operation; audit correlation present |

Tests also cover bulk operations, joins, views, RPC/functions, upserts, deletes, storage metadata, pagination, and newly added tables.

### Migration Gate

No user-owned table, view, or function may merge unless the same migration:

1. defines explicit grants and RLS state;
2. adds operation-specific policies;
3. adds policy-supporting indexes;
4. adds anonymous/owner/other-user/privileged tests;
5. proves rollback does not temporarily expose data;
6. updates this matrix and the data model.

### Implemented Evidence — Profiles

Migration `20260726000100_create_profiles.sql` enables and forces RLS on
`public.profiles`, removes anonymous privileges, grants authenticated users only
select and column-limited display-name update, and applies owner policies using
`auth.uid()`. Migration `20260728000100_create_generation_jobs.sql` grants
authenticated users owner-scoped select only; create와 transition은 service
boundary로 제한하고 database trigger가 immutable input과 state machine을
강제합니다. `20260728000200_create_assets.sql`은 verified available metadata만
owner에게 보이고 생성·수정·삭제 lifecycle을 service boundary에 제한합니다.
Migration `20260728000300_create_credit_ledger.sql`은 account, ledger와 계산
balance를 owner에게만 노출하고 authenticated direct write와 anonymous access를
거부하며 append-only invariant를 trigger로 강제합니다.
`20260728000400_create_credit_reservations.sql`은 owner에게 예약 조회만 허용하고
reserve, settle, release를 fixed-search-path service RPC로 제한합니다. pgTAP은 schema, owner
read, unavailable·deleted denial,
anonymous·cross-user·direct mutation denial과 invalid transition을 검증합니다.
`20260728000500_create_toss_payments.sql`은 활성 상품과 owner의 안전한
주문·결제 summary만 읽게 하며, 생성·검증·원장 지급과 webhook 처리는
fixed-search-path service RPC로 제한합니다. 원 결제 키와 raw payload는
저장하지 않습니다. 나머지 planned entity는 policy intent 상태입니다.
`20260728000600_create_payment_refunds.sql`은 owner에게 자신의 최소 환불
summary만 노출하고 refund mutation과 reconciliation evidence를 service-only로
격리합니다. Provider key와 transaction key는 SHA-256 hash로만 보존합니다.
`20260728000700_create_operator_rbac.sql`은 role, permission, approval request와
audit table을 direct Data API access에서 격리하고, authenticated caller에게는
MFA permission check와 dual-control role-change RPC만 허용합니다.

### Official Evidence

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase API Security](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase Auth Architecture](https://supabase.com/docs/guides/auth/architecture)

## Checklist

- [x] Default deny, explicit grants, per-operation policies, and owner checks are defined.
- [x] Current user-owned entities have a policy intent and negative-test matrix.
- [x] Views, functions, indexes, service access, and migration gates are covered.
- [x] Policy design is not represented as implemented RLS.
- [ ] Versioned migrations implement every policy and grant.
- [ ] Automated tests verify anonymous, owner, cross-user, privileged, and service access.
- [x] The implemented `profiles` table has versioned grants, RLS, and negative tests.
- [x] The implemented `generation_jobs` table has owner-read RLS, server-only mutation, and negative tests.
- [x] The implemented `assets` table exposes only owner-owned available metadata and has lifecycle negative tests.
- [x] The implemented credit account and ledger expose owner-only history and computed balance with append-only negative tests.
- [x] Generation credit reservations expose owner-only state and service-only lifecycle mutations.
- [x] Payment orders와 payments는 owner-read/server-write이며 webhook receipt는 service-only다.
- [x] Refund는 owner-read/server-write이며 reconciliation evidence는 service-only다.
- [x] Operator RBAC table은 direct access를 거부하고 MFA·dual-control RPC만 노출한다.

## Related Documents

- [Database](../03_Architecture/DATABASE.md)
- [Data Model](../03_Architecture/DATA_MODEL.md)
- [Security Architecture](../03_Architecture/SECURITY.md)
- [Threat Model](THREAT_MODEL.md)
- [Authentication Policy](AUTH_POLICY.md)
- [API Authorization](../06_API/AUTHORIZATION.md)
- [Migration Workflow](../../.codex/workflows/migration.md)
