# Credit System

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

이 문서는 선불 크레딧의 지급, 사용, 복구, 환불과 감사 원칙을 정의합니다. 크레딧은 현금이 아니며 사용자 간 양도할 수 없는 AI Photo Studio 내부 사용 단위입니다.

**Policy Status:** `APPROVED`

**Policy Version:** `commercial-v2`

## Goals

- 모든 잔액 변경을 재현 가능한 원장으로 설명합니다.
- 생성 실패나 중복 요청으로 사용자가 크레딧을 잃지 않게 합니다.
- 결제, 생성과 환불이 재시도되어도 정확히 한 번의 경제적 결과로 수렴하게 합니다.
- 가격 정책과 소비 정책의 책임을 분리합니다.

## Requirements

### Inherited Principles

- 크레딧은 선불 방식입니다.
- 모든 유료 AI 이미지 생성은 승인된 크레딧을 소비합니다.
- 시스템 실패로 결과가 제공되지 않으면 소비한 크레딧을 자동 복구합니다.
- 모든 지급, 소비, 복구, 환불, 만료와 운영 조정은 불변 원장 거래로 기록합니다.
- 잔액을 직접 덮어쓰거나 과거 원장 거래를 수정·삭제하지 않습니다.
- 사용자는 자신의 잔액과 거래 내역만 조회할 수 있습니다.

### Required CEO Decisions

| Decision ID | Decision | Required evidence | Owner | Status |
| --- | --- | --- | --- | --- |
| `CREDIT-001` | 표준 이미지 생성 1회의 크레딧 소비량 | 모델별 원가·품질·재시도율 | CEO | `APPROVED` |
| `CREDIT-002` | 고해상도, 추가 결과 또는 후처리별 소비량 | 기능별 증분 원가와 사용자 가치 | CEO | `APPROVED` |
| `CREDIT-003` | 프로모션 크레딧의 만료와 사용 우선순위 | 캠페인 정책과 고객 고지 | CEO | `APPROVED` |
| `CREDIT-004` | 구매 크레딧의 만료 여부 | `PRICE-004`, 법률·회계 검토 | CEO | `APPROVED` |
| `CREDIT-005` | 운영자 수동 조정 한도와 승인 절차 | 지원·사기·감사 위험 | CEO, Security | `APPROVED` |

## Implementation

### Ledger Contract

원장 거래는 최소한 다음 유형을 구분합니다.

| Transaction type | Balance effect | Required reference |
| --- | ---: | --- |
| `purchase_grant` | 증가 | 검증된 결제 및 주문 |
| `trial_grant` | 증가 | 체험 정책 버전 |
| `promotion_grant` | 증가 | 캠페인 및 정책 버전 |
| `generation_consume` | 감소 | 생성 작업 및 소비 정책 버전 |
| `generation_restore` | 증가 | 실패한 원 소비 거래 |
| `payment_refund_reversal` | 감소 | 환불 및 원 구매 거래 |
| `expiration` | 감소 | 만료 정책 및 대상 지급 거래 |
| `manual_adjustment` | 증가 또는 감소 | 운영 사유, 요청자, 승인자 |

모든 거래에는 사용자, 수량, 통화와 분리된 크레딧 단위, 원인, 멱등성 키, 생성 시각, 정책 버전과 원본 참조가 있어야 합니다.

### Implemented Ledger Boundary

Migration `20260728000300_create_credit_ledger.sql`은 사용자별 credit account,
append-only ledger와 원장 합계 기반 balance view를 구현합니다. 모든 write는
server/service boundary로 제한하며 owner는 자신의 account, 거래와 계산된
balance만 조회합니다. Account row lock은 concurrent debit을 직렬화해 음수
balance를 차단하고, 사용자·idempotency key 및 사용자·거래 유형·reference
조합은 중복 경제 효과를 차단합니다.

Generation restore는 원 `generation_consume` 전체를 정확히 한 번 반전해야
합니다. Payment refund reversal은 원 `purchase_grant`와 연결되고 누적 회수량이
지급량을 초과할 수 없습니다. 직접 update/delete와 account 우회 삭제는
거부되며 승인된 사용자 삭제 cascade에서만 개인정보와 함께 제거됩니다.

Migration `20260730000100_create_operator_credit_adjustments.sql`은
`operator-adjustment-v1` 정책으로 한 건당 ±150 credits의 수동 조정을
구현합니다. MFA 운영자가 bounded reason code와 support case reference로
24시간 요청을 만들고, 요청자·대상 사용자와 다른 MFA Admin이 승인할 때만
`manual_adjustment` ledger entry가 추가됩니다. Request와 approval replay는
같은 경제 효과로 수렴하며 음수 balance는 기존 ledger guard가 차단합니다.
오조정 rollback은 과거 거래를 변경하지 않고 원 case를 참조하는 반대 수량의
새 dual-control request로 기록합니다.

Migration `20260728000400_create_credit_reservations.sql`은 생성 작업마다 하나의
예약을 만들고 활성 예약 합계를 `available_balance`에서 제외합니다. 예약은
잔액 증감이 아니므로 원장 거래를 만들지 않습니다. 결과가 `succeeded`가 되면
같은 transaction에서 `generation_consume`을 기록하고 예약을 `settled`로
전환합니다. Retryable failure는 예약을 유지하며, terminal failure 또는
cancel에서만 원장 변경 없이 `released`로 전환합니다. 모든 mutation RPC는
service role 전용이고 동일 요청은 같은 결과 ID로 수렴합니다.

### Consumption Lifecycle

`commercial-v2`에서 **1 Credit은 사진 제작 1회**입니다. 최초 제작은 후보 이미지
3장을 한 배치로 제공합니다. 품질 검수를 통과하지 못한 후보는 같은 제작 안에서
자동 재생성되고(추가 호출 최대 2회), 그래도 3장을 채우지 못하면 제작은 실패하고
Credit 예약은 해제됩니다. `productionId`를 담은 오래된 client 요청은 Credit·생성
side effect 전에 `REQUEST_OUTDATED`로 거부합니다.

1. 서버가 인증 사용자와 현재 사용 가능한 잔액을 검증합니다.
2. 생성 작업과 1 Credit 예약을 하나의 도메인 작업으로 연결합니다.
3. 동일 요청의 재시도는 같은 멱등성 키를 사용합니다.
4. 최초 후보 3장이 모두 안전하게 저장되고 작업이 완료되면 1 Credit 소비를 확정합니다.
5. 제공자·후처리·저장 실패로 결과가 제공되지 않으면 원 소비와 연결된 복구 거래를 정확히 한 번 기록합니다.
6. 사용자 입력 거부나 크레딧 부족처럼 작업 시작 전 실패에는 소비 거래를 만들지 않습니다.

### Balance Rules

- 잔액은 유효한 원장 거래의 합계로 계산하거나 그 합계와 검증 가능한 캐시로 유지합니다.
- 잔액은 음수가 될 수 없습니다.
- 동일한 결제, 생성, 복구 또는 환불 참조는 중복 경제 효과를 만들 수 없습니다.
- 운영 조정은 원 거래를 수정하지 않고 반대 방향의 새 거래를 추가합니다.
- 환불 시 회수해야 할 구매 크레딧이 이미 소비된 경우의 처리 방식은 [Payments](PAYMENTS.md)의 CEO 승인 전까지 자동화하지 않습니다.

### User Visibility

인증된 사용자는 `/account`에서 원장 합계로 계산된 사용 가능 Credit과 예약 중
Credit을 확인할 수 있습니다. 최근 원장 거래는 유형과 증감량만 표시하며 다른
사용자의 거래, 내부 reference 또는 provider 식별자는 노출하지 않습니다. 실제
생성 화면 `/generate`도 같은 `available_balance`를 사용해 제출 가능 여부를
표시합니다.

개발 서버(`NODE_ENV=development`)에서는 실제 결제 없이 생성 흐름을 검증할 수
있도록 `test-v1` 정책의 테스트용 `trial_grant`를 사용자별 한 번 자동 지급합니다.
이 경계는 production에서 자동으로 비활성화되며, 테스트 지급도 원장 거래로
기록되어 예약·정산·환불 경계를 우회하지 않습니다.

### New User Promotion

`new-user-2-free-v1` 캠페인은 2026-09-23 00:00 KST 이후 생성되고 인증을 완료한
신규 계정에 `promotion_grant` 2 Credit을 한 번 지급합니다. 지급은 사용자 ID와
캠페인 버전으로 만든 결정론적 멱등성 키와 `promotion_grant` reference unique
제약을 함께 사용합니다. 인증 callback에서 우선 지급하고 첫 생성 제출에서도
재시도해 일시적인 실패가 영구 누락되지 않게 합니다.

이 캠페인은 가격 할인이나 쿠폰이 아니며 판매 상품과 결제 금액을 변경하지
않습니다. 현재 원장에는 grant lot별 잔여량과 소비 배분이 없으므로 캠페인
Credit을 안전하게 90일 만료할 수 없습니다. 구매 Credit 오차를 피하기 위해
`new-user-2-free-v1`은 만료 없이 운영하고, 90일 만료는 별도 lot allocation과
동시성 검증이 준비된 후 새 정책 버전으로 적용합니다. 동일 Auth 사용자 ID의
중복 지급은 방지하지만 별도 이메일·소셜 계정을 사용하는 동일인의 중복 가입은
현재 데이터만으로 확정 차단하지 않습니다.

### Recommended Launch Policy

| Decision ID | Recommended value |
| --- | --- |
| `CREDIT-001` | 사진 제작 1회는 1 Credit이며 최초 후보 3장을 제공 |
| `CREDIT-002` | 제작 건당 후보는 3장이며 품질 재생성은 같은 제작 안에서 최대 2회 |
| `CREDIT-003` | 가장 빨리 만료되는 프로모션 크레딧을 먼저 소비하고, 구매 크레딧을 그다음 소비 |
| `CREDIT-004` | 구매 크레딧은 만료하지 않고 무료·프로모션 크레딧은 지급 후 90일에 만료 |
| `CREDIT-005` | 수동 조정은 한 건당 현재 최대 판매 팩의 크레딧 수량 이하, 요청자와 승인자 분리, 사유·증거 필수 |

소비량은 모델과 해상도를 서버 정책 버전에 고정합니다. 제공자 가격이 10% 이상 변하거나 30일 실측 기여 마진이 승인 하한 아래로 내려가면 CEO와 CTO가 소비량을 재검토합니다. 변경은 새 생성 요청에만 적용하며 기존 작업이나 원장 거래를 소급 수정하지 않습니다.

## Checklist

- [x] 모든 잔액 변경에 불변 원장과 감사 참조가 요구된다.
- [x] 생성 성공·실패·재시도의 소비 수명주기가 정의됐다.
- [x] 중복 지급, 중복 소비와 음수 잔액 방지 규칙이 정의됐다.
- [x] 환불은 원 구매와 반대 원장 거래로 연결된다.
- [x] `CREDIT-001`부터 `CREDIT-005`까지 저장소 소유자가 승인했다.
- [x] Append-only ledger, 계산 balance, idempotency와 reversal invariant가 구현됐다.
- [x] Atomic generation reservation, settlement와 terminal release가 구현됐다.
- [x] 한도, evidence, dual control과 compensating rollback을 갖춘 운영 조정이
      구현됐다.
- [x] 승인된 소비량과 신규 가입 2회 프로모션이 버전된 정책으로 반영됐다.
- [ ] 프로모션 Credit 90일 만료를 위한 grant lot allocation이 구현됐다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Pricing](PRICING.md)
- [Payments](PAYMENTS.md)
- [AI Generation](../02_Product/AI_GENERATION.md)
- [MVP User Stories](../02_Product/FEATURES.md)
- [Data Model](../03_Architecture/DATA_MODEL.md)
- [Business Decisions](../../.codex/memory/decisions.md)
