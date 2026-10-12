# Database

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

이 문서는 데이터베이스 원칙과 실제 구현된 스키마 범위를 관리합니다. 현재
구현 범위는 Supabase 관리 `auth.users`와 애플리케이션 소유
`public.profiles`, `public.generation_jobs`, `public.assets`,
`public.credit_accounts`, payment·refund table과
`public.operator_role_assignments`, `public.operator_role_change_requests`,
`public.operator_audit_events`입니다.

## Goals

- 안정성과 유지보수성을 우선합니다.
- 팀 간 계약과 책임을 명확히 합니다.

## Requirements

- 기존 기능과 문서 내용을 보존합니다.
- 변경 시 관련 문서와 검증 결과를 함께 갱신합니다.

## Implementation

### Implemented Tables

| Table | Ownership | Access |
| --- | --- | --- |
| `auth.users` | Supabase Auth | Auth service only; application code does not expose it through Data API |
| `public.profiles` | Application | Authenticated owner can select and update `display_name` |
| `public.generation_jobs` | Application | Authenticated owner can select; server/service creates and transitions jobs |
| `public.assets` | Application | Authenticated owner can select available metadata; server/service controls lifecycle |
| `public.credit_accounts` | Application | Authenticated owner can select; creation and lifecycle are server-controlled |
| `public.credit_ledger_entries` | Application | Authenticated owner can select; server/service can append only |
| `public.credit_reservations` | Application | Authenticated owner can select; service RPC controls lifecycle |
| `public.credit_products` | Application | Authenticated catalog read; server-owned publication |
| `public.payment_orders`, `public.payments` | Application | Authenticated owner summary; verified service mutation |
| `public.payment_refunds` | Application | Authenticated owner summary; verified service mutation |
| `public.payment_reconciliation_results` | Application | Service-only immutable evidence |
| `public.operator_role_assignments` | Application | Function-only role lifecycle; no direct Data API access |
| `public.operator_role_change_requests` | Application | MFA Admin request/approval RPC only |
| `public.operator_audit_events` | Application | Function-only immutable role-change evidence |

`profiles.id` is a UUID primary key referencing `auth.users.id` with cascading
deletion. A security-definer signup trigger with an empty `search_path` creates
the profile. RLS is enabled and forced; `anon` has no table privileges and
`authenticated` receives only select plus column-limited display-name update.

`generation_jobs`는 사용자별 idempotency uniqueness, versioned model metadata,
bounded attempts와 database-enforced state transition을 갖습니다. `assets`는
generation owner와 일치하는 immutable R2 key, verified metadata, lifecycle
transition과 logical deletion state를 갖습니다. Credit balance는
`credit_ledger_entries` 합계로 계산하며 account row lock, amount·reference
constraint와 immutable trigger가 음수 balance, 중복 경제 효과와 과거 거래
변경을 차단합니다. Payment와 refund table은 provider 검증, 원장 효과와
reconciliation evidence를 연결합니다. Operator RBAC는 server-owned role
mapping, `aal2` permission check, 24시간 approval request, dual control과
role-change audit를 database transaction으로 강제합니다.

## Checklist

- [x] 최초 프로필 스키마가 versioned migration에 있다.
- [x] 외래 키, 제약, grants, RLS, trigger가 자동 테스트된다.
- [x] Credit ledger와 계산 balance invariant가 versioned migration에 있다.
- [x] Admin·Support role과 dual-control approval boundary가 versioned migration에 있다.
- [ ] 나머지 MVP 테이블을 각 기능 milestone과 함께 구현한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Data Model](DATA_MODEL.md)
- [RLS Policy](../09_Security/RLS_POLICY.md)
- [Database Migrations](../10_Data/MIGRATIONS.md)
