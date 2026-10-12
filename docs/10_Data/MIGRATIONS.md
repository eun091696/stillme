# Database Migrations

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

무중단 마이그레이션, 검증, 롤백 절차를 정의합니다.

## Goals

- 팀 간 판단 기준을 통일합니다.
- 구현과 운영 상태를 문서와 일치시킵니다.

## Requirements

- 책임 Agent와 검토 Agent를 지정합니다.
- 변경은 관련 코드, 테스트, 문서와 함께 검토합니다.

## Implementation

마이그레이션은 `supabase/migrations`에 timestamp 순서로 저장합니다. 로컬
재현 절차는 다음과 같습니다.

```bash
npm run supabase:start
npm run supabase:reset
npm run test:db
```

`supabase:reset`은 로컬 데이터베이스만 재생성합니다. linked 또는 production
database reset은 이 명령에 포함하지 않습니다. `seed.sql`은 자격 증명과 개인
데이터를 포함하지 않는 결정적 개발 데이터만 허용합니다.

첫 migration `20260726000100_create_profiles.sql`은 profiles schema, grants,
RLS policies, timestamp trigger, signup trigger를 하나의 원자적 변경으로
생성합니다.

Migration `20260728000100_create_generation_jobs.sql`은 generation job
idempotency, version metadata, state transition, retry bound, grants와 owner-read
RLS를 원자적으로 생성합니다.

Migration `20260728000200_create_assets.sql`은 original asset metadata,
generation-owner foreign key, immutable R2 identity, lifecycle transition,
grants와 owner-read RLS를 원자적으로 생성합니다.

Migration `20260728000300_create_credit_ledger.sql`은 credit account,
append-only ledger, 원장 합계 balance view, idempotency·reversal·non-negative
invariant, grants와 owner-read RLS를 원자적으로 생성합니다.

Migration `20260728000400_create_credit_reservations.sql`은 generation별
reservation, available balance, succeeded-only ledger settlement,
terminal-failure release, idempotent service RPC와 owner-read RLS를 원자적으로
생성합니다.

Migration `20260728000500_create_toss_payments.sql`은 versioned credit 상품,
server-priced order, immutable verified payment, hash-only webhook receipt,
atomic `purchase_grant`, owner-read RLS와 service-only RPC를 생성합니다.

Migration `20260728000600_create_payment_refunds.sql`은 full-refund credit
reservation, immutable refund와 reconciliation evidence, provider-verified
원장 reversal, owner-read RLS와 service-only RPC를 생성합니다. 기존
`credit_balances` view에는 `refund_reserved_credits`를 끝 열로 추가하고
`available_balance` 계산에서 차감합니다.

Migration `20260728000700_create_operator_rbac.sql`은 Admin·Support role과
permission mapping, direct-access가 차단된 assignment·approval·audit table,
MFA permission check와 dual-control role-change RPC를 추가합니다. 실제 operator
UUID나 초기 assignment는 포함하지 않습니다.

Migration `20260826000100_reconcile_stale_generation_credit_reservations.sql`은
30분 이상 stale한 generation의 `reserved` Credit을 제한된 batch로 복구하는
service-role 전용 RPC와 후보 조회 index를 추가합니다. 성공·settled·consume
원장·retryable failure·게시 가능성이 남은 asset은 자동 release에서 제외하고,
generation completion과 동일한 row-lock 순서로 consume/release 경합을
직렬화합니다.

## Checklist

- [x] 로컬 configuration, migration, seed가 version control에 있다.
- [x] 빈 로컬 DB에서 migration과 seed 재생이 성공한다.
- [x] pgTAP schema와 RLS 테스트가 통과한다.
- [ ] hosted development와 staging dry run을 검증한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Schema History](SCHEMA_HISTORY.md)
- [Database](../03_Architecture/DATABASE.md)
- [Migration Workflow](../../.codex/workflows/migration.md)
