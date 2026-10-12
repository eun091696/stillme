# Schema History

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

DB 스키마 변경 이력과 호환성 영향을 기록합니다.

## Goals

- 팀 간 판단 기준을 통일합니다.
- 구현과 운영 상태를 문서와 일치시킵니다.

## Requirements

- 책임 Agent와 검토 Agent를 지정합니다.
- 변경은 관련 코드, 테스트, 문서와 함께 검토합니다.

## Implementation

| Migration | Status | Compatibility impact | Validation |
| --- | --- | --- | --- |
| `20260726000100_create_profiles.sql` | Local verified | Additive; creates the first application table and auth trigger | Local reset plus 10 pgTAP tests |
| `20260728000100_create_generation_jobs.sql` | Local verified | Additive; creates generation job state, indexes, trigger, grants, and RLS | Local reset plus 15 pgTAP tests |
| `20260728000200_create_assets.sql` | Local verified | Additive; creates original asset metadata, lifecycle trigger, grants, and RLS | Local reset plus 14 pgTAP tests |
| `20260728000300_create_credit_ledger.sql` | Local verified | Additive; creates credit accounts, append-only ledger, computed balance, grants, triggers, and RLS | Local migration plus 30 pgTAP tests |
| `20260728000400_create_credit_reservations.sql` | Local verified | Additive table, enum, RPCs and view columns; reserves available credit and settles successful generations through the ledger | Local migration, 20 focused pgTAP tests and Data API integration |
| `20260728000500_create_toss_payments.sql` | Local verified | Additive catalog, orders, payments, webhook receipts, enums and service RPCs; grants purchased credits only after exact Toss verification | Clean local reset, 31 focused pgTAP tests and Data API integration |
| `20260728000600_create_payment_refunds.sql` | Local verified | Additive refund reservations, reconciliation evidence, service RPCs and one additive balance-view column; full refunds reverse the original purchase grant | Clean local reset, focused pgTAP and Data API integration |
| `20260728000700_create_operator_rbac.sql` | Local verified | Additive Admin·Support roles, permission mapping, MFA dual-control requests and immutable role-change audit | Clean local reset plus 27 focused pgTAP tests |

The migration adds `public.profiles`, owner-only select/update policies,
column-limited grants, timestamp maintenance, and automatic profile creation
after an Auth user insert. The generation migration adds owner-readable,
server-mutable jobs with immutable request identity and bounded retry state. The
credit migration adds owner-readable balances and immutable economic history
without a writable balance column. The reservation migration adds owner-readable
reservation state and service-only atomic lifecycle RPCs. New migrations have no
hosted development, staging, or production application claim yet. The Toss
payment migration adds server-priced orders, immutable verified payments,
hash-only webhook receipts and atomic `purchase_grant` posting.
The refund migration adds pre-cancellation credit reservation, immutable
full-refund records, hash-only reconciliation evidence and atomic
`payment_refund_reversal` posting.
The operator RBAC migration adds no actual operator assignment. It introduces
default-deny role data and MFA-gated request/approval functions; initial Admin
bootstrap remains an explicitly reviewed environment action.

## Checklist

- [x] 최초 schema migration과 compatibility impact가 기록됐다.
- [x] 로컬 적용 및 RLS 검증 결과가 기록됐다.
- [ ] remote environment 적용 시 migration reference를 추가한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Database Migrations](MIGRATIONS.md)
- [Database](../03_Architecture/DATABASE.md)
