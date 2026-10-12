# Payments

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

이 문서는 Toss Payments를 통한 구매 검증, 크레딧 지급, 취소와 환불 정책의 사업·제품 계약을 정의합니다.

**Policy Status:** `OWNER_APPROVED_LEGAL_REVIEW_REQUIRED`

**Policy Version:** `commercial-v1`

저장소 소유자는 2026-07-26에 아래 제품 정책을 승인했습니다. 이 문서는 법률 자문이나 Toss Payments 계약을 대체하지 않으며, 고객에게 공개할 환불 약관은 법률 검토와 실제 가맹점 계약 검증 후에만 게시할 수 있습니다.

## Goals

- 제공자 화면의 성공 표시가 아니라 서버 검증을 결제 성공 기준으로 사용합니다.
- 동일 결제 또는 콜백이 반복되어도 크레딧을 한 번만 지급합니다.
- 결제, 크레딧과 환불 기록을 상호 추적 가능하게 합니다.
- 사용자가 실패 상태와 복구 경로를 이해할 수 있게 합니다.

## Requirements

### Payment Boundaries

- MVP 결제 제공자는 Toss Payments입니다.
- 주문 생성, 결제 검증, 크레딧 지급과 환불 요청은 인증된 서버 경계에서 처리합니다.
- 서버는 주문 사용자, 상품 버전, 통화, 금액, 결제 키와 제공자 상태를 검증합니다.
- 제공자 비밀 키, 결제 키, 전체 카드 정보와 서명 값은 클라이언트 로그나 분석 이벤트에 남기지 않습니다.
- 성공한 결제는 결제 레코드와 크레딧 원장 지급을 연결하며 둘 중 하나만 완료된 상태를 탐지·복구할 수 있어야 합니다.

### Required CEO Decisions

| Decision ID | Decision | Required evidence | Owner | Status |
| --- | --- | --- | --- | --- |
| `PAYMENT-001` | 미사용 구매 크레딧의 전액 환불 가능 기간 | 관련 법률, Toss 계약, 지원 처리 비용 | CEO | `OWNER_APPROVED_LEGAL_REVIEW_REQUIRED` |
| `PAYMENT-002` | 일부 크레딧 사용 후 부분 환불 허용 여부와 계산식 | 세금·수수료·프로모션 회수·원장 복잡도 | CEO | `OWNER_APPROVED_LEGAL_REVIEW_REQUIRED` |
| `PAYMENT-003` | 시스템 실패 생성의 자동 복구와 금전 환불 경계 | 장애 보상 정책과 고객 기대 | CEO, PM | `APPROVED` |
| `PAYMENT-004` | 환불 불가 사유와 예외 승인 권한 | 법률 검토, 사기 방지, 고객 지원 정책 | CEO, Security | `OWNER_APPROVED_LEGAL_REVIEW_REQUIRED` |
| `PAYMENT-005` | 환불 처리 SLA와 고객 통지 채널 | Toss 처리 시간, 지원 운영 시간 | CEO, Support | `OWNER_APPROVED_LEGAL_REVIEW_REQUIRED` |

## Implementation

### Payment State Model

| State | Meaning | Allowed next states |
| --- | --- | --- |
| `created` | 서버 주문이 생성됨 | `pending`, `cancelled`, `failed` |
| `pending` | 제공자 승인 또는 서버 검증 대기 | `paid`, `cancelled`, `failed` |
| `paid` | 서버 검증과 결제 기록 완료 | `refund_pending` |
| `refund_pending` | 승인된 환불 처리 중 | `partially_refunded`, `refunded`, `refund_failed` |
| `partially_refunded` | 일부 금액 환불 완료 | `refund_pending`, `refunded` |
| `refunded` | 승인 금액 환불 완료 | 종결 |
| `cancelled` | 결제 승인 전 사용자 또는 제공자 취소 | 종결 |
| `failed` | 결제 또는 검증 실패 | 종결 |
| `refund_failed` | 환불 제공자 처리 실패 | `refund_pending` |

### Purchase Flow

1. 서버가 활성 상품 버전으로 주문을 생성하고 예상 금액과 크레딧을 고정합니다.
2. 클라이언트는 주문 식별자와 제공자 공개 설정만 사용해 결제를 진행합니다.
3. 서버는 Toss Payments 결과를 주문의 사용자, 금액, 통화와 대조 검증합니다.
4. 검증된 결제 레코드와 `purchase_grant` 원장 거래를 동일한 주문 멱등성 키로 연결합니다.
5. 부분 완료 상태는 재처리 작업으로 정확히 한 번의 지급 결과로 수렴합니다.
6. 실패·취소·검증 불일치 결제에는 크레딧을 지급하지 않습니다.

현재 구현은 `20260728000500_create_toss_payments.sql`과
`/api/payments/orders`, `/api/payments/confirm`, `/api/webhooks/toss`에 있습니다.
일반 결제 webhook은 별도 서명을 가정하지 않고 인증된 Toss 조회 결과를 저장된
주문과 대조합니다. 결제 키와 payload는 원문 대신 SHA-256 hash만 저장하며,
검증된 결제 레코드와 `purchase_grant`는 하나의 DB transaction에서 반영됩니다.

### Refund Flow

1. 인증된 사용자의 환불 요청을 원 주문과 연결합니다.
2. 승인된 정책 버전으로 환불 가능 금액, 회수할 크레딧과 예외를 계산합니다.
3. 시스템은 중복 요청을 같은 환불 식별자로 처리합니다.
4. Toss Payments 환불 성공 후 원 결제와 연결된 환불 레코드 및 `payment_refund_reversal` 거래를 기록합니다.
5. 제공자 환불은 성공했으나 원장 반영이 실패한 경우 자동 복구 대상으로 분류합니다.
6. 실패한 이미지 생성은 기본적으로 크레딧 복구 대상이며 금전 환불은 별도 승인된 장애 보상 정책을 따릅니다.

`PAYMENT-001`부터 `PAYMENT-005`의 제품 동작은 구현 기준으로 승인됐지만 고객 공개 환불 약관과 자동 부분 환불 활성화는 법률 검토 전까지 차단합니다.

현재 `/api/payments/refunds`는 결제 후 7일 이내이며 해당 구매 지급 이후 debit이
없어 미사용을 증명할 수 있는 주문의 전액 환불만 허용합니다. Toss 취소 전에
크레딧을 예약하고, 검증된 `CANCELED` snapshot의 금액·통화·잔액·transaction
identity가 일치할 때만 `payment_refund_reversal`을 기록합니다. Timeout처럼
결과가 모호하면 예약을 유지한 `reconciliation_required`로 전환합니다.
`/api/payments/reconcile`은 orderId 조회 결과를 hash-only evidence로 보존하고,
확정 가능한 누락만 복구하며 부분 취소와 충돌은 `review_required`로 분리합니다.

### Audit and Security

- 결제와 환불 상태 변경은 행위자, 원인, 요청 ID, 제공자 참조, 이전·새 상태와 시각을 기록합니다.
- 운영자는 제공자 성공 여부를 임의로 만들거나 원 결제 레코드를 수정할 수 없습니다.
- 수동 복구는 요청자와 승인자를 분리하고 새 감사 이벤트와 원장 거래를 생성합니다.
- 고객 메시지는 내부 오류, 비밀 값 또는 다른 사용자의 주문 정보를 노출하지 않습니다.

### Recommended Customer Refund Baseline

이 기준은 CEO 승인과 한국 소비자법 전문 검토 전까지 고객 약관으로 게시하지 않습니다.

| Decision ID | Recommended value |
| --- | --- |
| `PAYMENT-001` | 구매 후 7일 이내이며 구매 크레딧을 전혀 사용하지 않은 주문은 원 결제수단으로 전액 환불 |
| `PAYMENT-002` | 구매 후 7일 이내 일부 사용 시, 실제 결제금액을 구매 크레딧 수로 나눈 단가에 미사용 구매 크레딧을 곱해 원 단위 내림한 금액을 환불; 별도 위약금은 부과하지 않음 |
| `PAYMENT-003` | 결과가 제공되지 않은 시스템 실패는 자동 크레딧 복구가 기본; 같은 장애가 반복되어 서비스를 사용할 수 없는 경우 Support가 금전 환불 검토로 승격 |
| `PAYMENT-004` | 이미 전부 소비된 정상 제공분, 중복 환불, 사기성 요청은 거절 가능하되 법정 청약철회·계약 불일치 권리는 우선 적용 |
| `PAYMENT-005` | 유효한 철회·환불 승인일로부터 3영업일 이내 제공자 환불 요청을 시작하고 접수·완료·실패를 이메일과 계정 내역으로 통지 |

프로모션 크레딧은 환불 금액을 만들지 않으며 환불 시 회수합니다. 여러 구매 lot가 있는 경우 환불 대상 주문에서 남은 구매 크레딧만 계산합니다. 계약 내용과 다르게 제공된 경우에는 일반 7일 기준보다 법정 권리와 승인된 고객 약관을 우선합니다.

### Legal Review Notes

- 현행 전자상거래법 제17조는 계약 내용과 다르게 이행된 경우 공급일부터 3개월, 그 사실을 안 날부터 30일 이내 청약철회 가능성을 규정합니다.
- 같은 법 제18조는 유효한 청약철회 시 디지털콘텐츠의 경우 철회일로부터 3영업일 이내 환급하도록 규정합니다.
- 디지털콘텐츠 공급 개시 후 청약철회 제한에는 사전 고지와 시험 사용 등 별도 요건이 관련될 수 있으므로 출시 약관은 법률 전문가가 확인해야 합니다.
- Toss Payments 계약별 취소 수수료, 정산 상계와 부분 취소 제약은 실제 가맹점 계약 및 테스트 상점에서 별도로 검증해야 합니다.

## Checklist

- [x] 서버 검증, 상태 모델과 멱등성 경계가 정의됐다.
- [x] 결제와 크레딧 지급의 부분 실패 복구가 정의됐다.
- [x] 환불과 원장 회수의 추적 관계가 정의됐다.
- [x] 비밀 값과 결제 데이터의 로그 제한이 정의됐다.
- [x] `PAYMENT-001`부터 `PAYMENT-005`까지 저장소 소유자가 제품 정책으로 승인했다.
- [x] Toss 주문, 승인 확인과 webhook 재조회 검증이 구현됐다.
- [x] 결제·webhook 중복 요청이 크레딧을 중복 지급하지 않는지 자동 검증됐다.
- [x] 미사용 전액 환불, credit reservation과 provider reconciliation이 구현됐다.
- [x] 병렬 주문·승인·환불·reconciliation과 환불/생성 예약 경합이 단일 경제 효과와 음수 방지로 검증됐다.
- [x] 부분 환불은 법률 검토 전까지 자동 처리되지 않고 review로 분리된다.
- [ ] 승인된 고객 환불 약관과 운영 절차가 게시됐다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Pricing](PRICING.md)
- [Credits](CREDITS.md)
- [MVP User Stories](../02_Product/FEATURES.md)
- [Data Model](../03_Architecture/DATA_MODEL.md)
- [Payment Failure Playbook](../../playbooks/PAYMENT_FAILURE.md)
- [Business Decisions](../../.codex/memory/decisions.md)
