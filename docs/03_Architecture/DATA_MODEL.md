# Data Model

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

Data Model 영역의 기준과 현재 프로젝트 결정을 관리합니다.

## Goals

- 안정성과 유지보수성을 우선합니다.
- 팀 간 계약과 책임을 명확히 합니다.

## Requirements

- 기존 기능과 문서 내용을 보존합니다.
- 변경 시 관련 문서와 검증 결과를 함께 갱신합니다.

## Implementation

#### auth.users

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| id | uuid | Supabase Auth가 관리하는 기본 키 |
| email | varchar | 인증 이메일; 애플리케이션 Data API에 직접 노출하지 않음 |
| created_at | timestamp | Supabase Auth가 관리하는 생성 시각 |

#### profiles

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| id | uuid | `auth.users.id` 참조 기본 키, 사용자 삭제 시 cascade |
| display_name | text | 1–80자, trim된 사용자 표시 이름 |
| created_at | timestamptz | 생성 시각 |
| updated_at | timestamptz | 마지막 수정 시각 |

`profiles`는 가입 trigger로 생성되고 authenticated owner만 조회 및
`display_name` 수정이 가능합니다. 이 모델과 RLS는 migration
`20260726000100_create_profiles.sql`로 로컬 검증됐습니다.

#### generation_jobs

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| id | uuid | 기본 키 |
| user_id | uuid | users 외래 키 |
| prompt | text | 사용자 프롬프트 |
| style | varchar | 선택 스타일 |
| aspect_ratio | varchar | 결과 비율 |
| idempotency_key | uuid | 사용자별 중복 요청 방지 identity |
| model_id | text | 내부 model version ID |
| provider_model | text | 실제 provider model ID |
| adapter_version | text | Provider adapter contract version |
| prompt_template_version | text | 적용된 prompt template version |
| status | enum | queued, processing, succeeded, failed, cancelled |
| attempt_count | integer | 시작된 provider attempt 수 |
| max_attempts | integer | 1–5 범위의 고정 retry 상한 |
| retryable | boolean | 현재 실패가 retry 가능한지 여부 |
| next_attempt_at | timestamptz | retry가 가능해지는 시각 |
| last_error_code | text | 원문 오류가 아닌 bounded error code |
| created_at | timestamptz | 요청 시각 |
| started_at | timestamptz | 마지막 processing 시작 시각 |
| completed_at | timestamptz | terminal 상태 도달 시각 |
| updated_at | timestamptz | 마지막 state transition 시각 |

`generation_jobs`는 migration `20260728000100_create_generation_jobs.sql`로
구현됩니다. 사용자와 idempotency key 조합은 유일하며 input, ownership, model
version과 attempt limit은 생성 후 변경할 수 없습니다. Authenticated user는
자신의 job만 읽고 생성·상태 변경은 server/service boundary만 수행합니다.

#### assets

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| id | uuid | 기본 키 |
| generation_job_id | uuid | generation_jobs 외래 키 |
| user_id | uuid | 소유자 삭제·인가·조정을 위한 users 외래 키 |
| storage_key | varchar | 서버가 생성한 불변 객체 키, 유일 값 |
| object_class | varchar | original, derivative, staging, quarantine |
| status | varchar | allocated, uploading, validating, available, deleting, deleted, failed |
| mime_type | varchar | decode로 검증한 파일 형식 |
| checksum_sha256 | varchar | 업로드 후 검증하는 무결성 값 |
| byte_size | bigint | 검증된 객체 크기 |
| width | integer | 픽셀 너비 |
| height | integer | 픽셀 높이 |
| retention_class | varchar | active, temporary_24h, quarantine_7d |
| deleted_at | timestamp | 논리 삭제 및 접근 차단 시각 |
| created_at | timestamp | 생성 시각 |

사용자별 이력 조회를 위해 `generation_jobs(user_id, created_at)` 복합 인덱스를
둡니다. 자산은 `assets(storage_key)` 유일 제약, `assets(user_id, status, created_at)`
인덱스, `assets(generation_job_id, status)` 인덱스를 요구합니다. 파생 객체는 부모
자산보다 오래 유지할 수 없습니다. `assets` schema, owner-read RLS와 lifecycle
transition은 migration `20260728000200_create_assets.sql`로 구현·검증합니다.
현재 migration은 original asset만 허용하며 derivative, staging과 quarantine
class는 후속 migration에서 추가합니다.

#### credit_accounts

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| user_id | uuid | `auth.users.id`를 참조하는 사용자별 account 기본 키 |
| created_at | timestamptz | account 생성 시각 |

#### credit_ledger_entries

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| id | uuid | 불변 원장 거래 기본 키 |
| user_id | uuid | credit account 소유자 |
| transaction_type | enum | grant, consume, restore, refund reversal, expiration, adjustment 유형 |
| amount | integer | 방향과 상한이 검증된 credit 증감량 |
| idempotency_key | uuid | 사용자별 중복 경제 효과 방지 identity |
| policy_version | text | 적용된 business policy version |
| reference_id | uuid | 주문, 생성, 환불 또는 조정 요청 reference |
| reversal_of | uuid | 원 consume 또는 purchase grant 거래 |
| reason_code | text | 원문 없이 제한된 복구·조정 사유 |
| requested_by | uuid | 수동 조정 요청자 |
| approved_by | uuid | 수동 조정 승인자 |
| created_at | timestamptz | 원장 기록 시각 |

`credit_balances`는 security-invoker view에서 owner-visible ledger 합계를
계산하며 활성 예약 합계와 사용 가능한 잔액도 함께 제공합니다. Ledger는
update/delete할 수 없고 account row lock이 concurrent insert와 reservation을
직렬화해 balance와 available balance가 음수가 되지 않게 합니다.

#### credit_reservations

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| id | uuid | 예약 및 settlement idempotency의 기본 키 |
| generation_job_id | uuid | 예약 하나만 허용하는 생성 작업 |
| user_id | uuid | credit account 소유자 |
| amount | integer | 예약한 양의 credit 수량 |
| idempotency_key | uuid | 사용자별 예약 중복 방지 identity |
| policy_version | text | 예약 시 고정한 소비 정책 |
| status | enum | `reserved`, `settled`, `released` |
| ledger_entry_id | uuid | settled 시 생성된 `generation_consume` |
| release_reason_code | text | terminal failure 또는 cancel 사유 |
| settled_at / released_at | timestamptz | terminal transition 시각 |

#### credit_products, payment_orders, payments, payment_webhook_receipts

- `credit_products`는 versioned 상품 코드, KRW 금액과 지급 credit을 서버
  allowlist로 고정합니다.
- `payment_orders`는 사용자, 상품 version, 금액, 통화와 idempotency key를
  주문 시점에 고정하고 `pending`에서 검증된 `paid`로만 전이합니다.
- `payments`는 검증된 결제와 `purchase_grant` ledger entry를 1:1로 연결하며
  원 결제 키 대신 SHA-256 hash만 저장합니다.
- `payment_webhook_receipts`는 Toss transmission ID와 payload hash를 고유
  identity로 사용하고 `processed`, `ignored`, `quarantined` 결과를 보존합니다.

#### payment_refunds, payment_reconciliation_results

- `payment_refunds`는 원 결제, 전액 환불 금액, 회수 credit, policy version,
  idempotency key와 원장 reversal을 연결합니다. `pending`과
  `reconciliation_required` credit은 사용 가능 잔액에서 제외됩니다.
- `payment_reconciliation_results`는 provider snapshot hash와 관측된 상태·잔액,
  `in_sync`, `repaired`, `review_required` 결과만 append-only로 보존합니다.
- Provider payment key와 cancellation transaction key 원문은 저장하지 않습니다.

#### operator_role_assignments, operator_role_change_requests, operator_audit_events

- `operator_role_assignments`는 `admin`과 `support` 역할, grant/revoke actor,
  독립 approver, bounded reason code와 active/revoked 시점을 보존합니다.
- `operator_role_change_requests`는 target, role, grant/revoke action, 요청자,
  UUID idempotency key, 24시간 expiry와 applied 상태를 관리합니다.
- `operator_audit_events`는 적용된 role 변경 하나당 actor, approver, target,
  role과 reason code를 한 번만 append합니다.
- Role-permission mapping은 Support의 최소 조회·adjustment 요청과 Admin의
  approval·notice·role 관리 권한을 분리합니다.
- Table은 직접 노출하지 않고 MFA가 검증된 RPC만 assignment lifecycle을
  변경합니다.

## Checklist

- [ ] 책임 Agent가 내용을 검토했다.
- [x] `auth.users`와 `profiles`의 실제 구현 상태가 기록됐다.
- [x] `profiles` constraint, trigger, RLS가 migration과 테스트에 연결됐다.
- [x] `storage-v1`에 필요한 최소 자산 메타데이터와 불변 키 계약이 정의됐다.
- [x] Credit account, append-only ledger와 계산 balance가 구현됐다.
- [x] Generation credit reservation과 settlement lifecycle이 구현됐다.
- [x] Toss 주문, 결제와 webhook receipt의 멱등성 모델이 구현됐다.
- [x] 전액 환불 reservation, 원장 reversal과 reconciliation evidence가 구현됐다.
- [x] Operator role, permission, dual-control request와 audit model이 구현됐다.
- [ ] 실제 schema, constraint, RLS와 lifecycle job이 구현됐다.
- [ ] 관련 변경 시 이 문서를 함께 갱신한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Storage Architecture](STORAGE.md)
- [RLS Policy](../09_Security/RLS_POLICY.md)
- [Data Retention](../10_Data/RETENTION.md)
