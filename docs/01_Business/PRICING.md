# Pricing

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

이 문서는 AI Photo Studio의 상품 구성, 표시 가격과 가격 변경 절차를 관리하는 기준 문서입니다. 가격 결정 권한은 CEO에게 있으며 PM이 제품 범위, CTO가 원가·구현 위험을 검토합니다.

**Policy Status:** `APPROVED`

**Policy Version:** `commercial-v2`

저장소 소유자는 2026-07-26에 아래 출시 가격과 단위 경제성 기준을 승인했습니다. 구현자는 승인된 catalog version 밖의 가격, 할인 또는 무료 크레딧을 임의로 배포할 수 없습니다.

## Goals

- 고객에게 결제 전에 정확한 가격과 제공 크레딧을 표시합니다.
- 클라이언트 조작으로 가격이나 지급량이 바뀌지 않게 합니다.
- 가격 변경이 기존 주문과 원장 기록을 소급 변경하지 않게 합니다.
- 단위 경제성과 고객 가치를 함께 검토할 수 있는 승인 절차를 만듭니다.

## Requirements

### Approved Product Boundaries

- MVP의 유료 상품은 Toss Payments를 사용하는 일회성 선불 크레딧 팩입니다.
- 월 구독과 자동 갱신은 사업 모델 가설이며 별도 승인 전에는 MVP 결제 범위에 포함하지 않습니다.
- 결제 통화는 대한민국 원화(KRW)입니다.
- 고객에게 표시하는 금액은 부가세 포함 최종 결제 금액이어야 합니다.
- 상품 ID, 가격, 통화, 지급 크레딧과 판매 상태는 서버가 관리하는 버전된 카탈로그가 기준입니다.
- 클라이언트가 보낸 가격이나 크레딧 수량은 결제 승인 근거로 신뢰하지 않습니다.

### Required CEO Decisions

| Decision ID | Decision | Required evidence | Owner | Status |
| --- | --- | --- | --- | --- |
| `PRICE-001` | 최초 무료 체험 크레딧 수량과 지급 조건 | 부정 사용 위험, 첫 생성 전환 목표, 사용자당 체험 원가 | CEO | `APPROVED` |
| `PRICE-002` | 출시 크레딧 팩별 SKU, 가격과 지급량 | 모델·R2·결제 수수료·지원 비용을 포함한 단위 경제성 | CEO | `APPROVED` |
| `PRICE-003` | 할인, 쿠폰과 프로모션 허용 범위 | 마진 하한, 중복 적용 규칙, 캠페인 목적 | CEO | `APPROVED` |
| `PRICE-004` | 구매 크레딧의 만료 여부와 기간 | 고객 고지, 회계·법률 검토, 휴면 부채 영향 | CEO | `APPROVED` |
| `PRICE-005` | 월 구독 도입 여부와 갱신 조건 | 유지율 가설, 해지·환불 운영, 반복 결제 준비도 | CEO | `DEFERRED_AFTER_MVP` |

`PRICE-001`부터 `PRICE-004`의 승인값만 `commercial-v2` 운영 카탈로그 구현에 사용할 수 있습니다.

## Implementation

### Catalog Contract

각 판매 가능한 상품 버전은 최소한 다음 정보를 가집니다.

| Field | Contract |
| --- | --- |
| `product_id` | 변경되지 않는 내부 상품 식별자 |
| `version` | 가격 또는 지급량 변경 시 증가하는 버전 |
| `display_name` | 고객에게 표시할 상품명 |
| `currency` | MVP에서는 `KRW` |
| `price_amount` | 부가세를 포함한 정수 원화 금액 |
| `credit_amount` | 검증된 결제 후 지급할 정수 크레딧 |
| `sales_status` | `draft`, `active`, `retired` 중 하나 |
| `effective_at` | 신규 주문에 적용되는 시작 시각 |

주문은 결제 시작 시점의 상품 버전을 고정합니다. 이후 카탈로그가 변경되어도 이미 생성된 주문의 가격과 지급량은 바뀌지 않습니다.

인증된 사용자는 `/credits`에서 현재 `active` 상품 카탈로그의 이름, 지급 Credit과
부가세 포함 KRW 가격을 확인할 수 있습니다. 결제 provider가 연결되지 않은
환경에서는 구매 버튼을 비활성화하며, client가 가격·지급량을 직접 결정하지
않습니다. 실제 결제 시작은 Toss client configuration과 server order creation이
모두 준비된 뒤 활성화합니다.

현재 표시 카탈로그는 다음과 같습니다. 가격은 부가세 포함이며 버튼은 PG 연결
전까지 비활성화합니다.

| Product | Credit | Price |
| --- | ---: | ---: |
| Starter | 3 | ₩4,900 |
| Standard | 7 | ₩9,900 |
| Pro | 16 | ₩19,900 |

1 Credit은 후보 3장을 포함한 사진 제작 1회입니다.

### Price Change Governance

1. CEO가 가격과 지급량을 승인하고 근거를 결정 기록에 남깁니다.
2. PM이 고객 표시 문구와 제품 범위를 검토합니다.
3. CTO와 Backend가 원가 하한, 서버 검증과 마이그레이션 영향을 검토합니다.
4. QA가 결제 전 표시 금액과 Toss Payments 승인 금액의 일치를 검증합니다.
5. 변경은 새 상품 버전으로만 적용하며 기존 주문을 수정하지 않습니다.
6. 고객 영향이 있는 변경은 출시 노트와 지원 문서에 반영합니다.

### Unit Economics Gate

상품 승인은 다음 식의 모든 입력이 증거로 제공된 후에만 가능합니다.

```text
contribution_margin =
  price_excluding_vat
  - payment_fee
  - expected_generation_cost
  - storage_and_delivery_cost
  - expected_refund_and_support_cost
```

모델별 생성 원가와 품질 기준은 [Cost Optimization](../05_AI/COST_OPTIMIZATION.md)에서 관리합니다.

### Evidence-Based Launch Recommendation

**Evidence reviewed:** 2026-07-30

- 현재 구현 모델인 Gemini 3.1 Flash Image Standard 1K 출력은 이미지당
  `$0.067`이며 text/image input은 `$0.50 / 1M tokens`입니다.
- Gemini 3 Pro Image 표준 출력은 1K/2K `$0.134`, 4K `$0.24`입니다.
- Cloudflare R2 Standard는 저장 `$0.015/GB-month`, Class A `$4.50/million`, Class B `$0.36/million`이며 인터넷 egress는 무료입니다.
- Toss Payments 일반 신용·체크카드 수수료는 3.4%이고 수수료 VAT 10%가 별도입니다. 실제 계약·우대 수수료는 가맹점 계약으로 재확인해야 합니다.

원가 스트레스 테스트는 USD/KRW `1,600`, 이미지 생성 재시도·실패 버퍼 25%, 일반 카드 수수료 3.74%를 사용합니다. 이 값은 회계 환율이나 고객 가격이 아니라 보수적 승인 검토용 가정입니다.

| Decision ID | Recommended launch value | Rationale |
| --- | --- | --- |
| `PRICE-001` | 2026-09-23 이후 인증을 완료한 신규 계정에 프로모션 Credit 2개를 한 번 지급 | `new-user-2-free-v1`; 상품 가격 할인 또는 쿠폰과 동시 적용하지 않음 |
| `PRICE-002` | `STARTER-3`: 3 Credits / ₩4,900; `STANDARD-7`: 7 Credits / ₩9,900; `PRO-16`: 16 Credits / ₩19,900 | 사진 제작 단위와 고객 표시 가격을 일치시킨 `commercial-v2` 카탈로그 |
| `PRICE-003` | MVP에서는 자동 할인·쿠폰 중복 적용 없음; 별도 프로모션은 새 catalog version과 CEO 승인 필요 | 초기 원장·환불 복잡도와 마진 누수를 제한 |
| `PRICE-004` | 구매 크레딧은 만료하지 않음; 무료·프로모션 크레딧은 지급 후 90일 만료 | 유료 고객 신뢰를 우선하고 프로모션 부채는 제한 |
| `PRICE-005` | 월 구독과 자동 갱신은 MVP 이후로 유지 | 반복 결제·해지·환불 운영이 준비되지 않음 |

### New User Promotion

`new-user-2-free-v1`은 2026-09-23 00:00 KST 이후 생성되고 인증을 완료한
계정에 `promotion_grant` 2 Credit을 한 번 기록합니다. 1 Credit은 일반 제작 한
건과 동일하므로 무료 제작 2회를 의미하며 각 제작의 후보 3장 정책도 같습니다. 판매 상품 가격, 결제 금액과 지급량은 변경하지 않습니다.

현재 원장은 프로모션 지급 lot별 잔여량과 만료를 추적하지 않으므로 이 캠페인
Credit에는 만료를 적용하지 않습니다. 구매 Credit을 잘못 만료할 수 있는 단순
차감 방식은 사용하지 않으며, 90일 만료는 lot allocation이 구현된 후 별도
migration과 동시성 검증을 거쳐 적용합니다. 동일 Auth 사용자 ID에는 원장 unique
제약으로 한 번만 지급하지만 서로 다른 이메일·소셜 계정의 동일인 여부는 현재
판별하지 않습니다.

### Recommendation Sensitivity

| Generation class | Credit cost | Stress model cost | Revenue at lowest pack unit price | Pre-support margin after estimated card fee |
| --- | ---: | ---: | ---: | ---: |
| Standard Flash 사진 제작, 1K, 최대 후보 5장 | 1 Credit | 약 ₩690 | 약 ₩1,633 | 약 54% |

위 마진은 VAT 정산, 프롬프트 입력 토큰, 고객 지원, 세금, 환불, 모니터링과 기타 인프라 비용을 완전히 포함하지 않은 사전 검토치입니다. 따라서 실제 출시 전 실측 생성 원가와 세무·회계 검토가 필요합니다.

### 2026-07-30 Cost Revalidation Finding

`COST-001` estimator의 Standard 1K 이미지당 stress 원가 약 `₩138`을 제작당 최대
이미지 생성 호출 5회(후보 3장과 품질 재생성 2회)에 적용하면 제작당 약 `₩690`입니다.
Starter의 Credit당 매출 약 `₩1,633`과 배분 카드 수수료를 적용한 사전 margin은 약
54%입니다. 품질 재생성 한도를 모두 쓰는 경우를 둔 보수적 계산입니다. production 판매 전에는 실측 생성 원가와 환불·지원
비용을 다시 확인합니다.

## Checklist

- [x] MVP 가격 모델의 범위와 승인 owner가 명시됐다.
- [x] 서버 기준 카탈로그와 버전 정책이 정의됐다.
- [x] 가격 변경이 기존 주문을 소급 변경하지 않도록 했다.
- [x] 승인에 필요한 단위 경제성 증거가 정의됐다.
- [x] `PRICE-001`부터 `PRICE-004`까지 저장소 소유자가 승인했다.
- [x] 승인된 SKU와 가격이 버전된 카탈로그에 반영됐다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Business Model](BUSINESS_MODEL.md)
- [Credits](CREDITS.md)
- [Payments](PAYMENTS.md)
- [MVP User Stories](../02_Product/FEATURES.md)
- [Cost Optimization](../05_AI/COST_OPTIMIZATION.md)
- [Business Decisions](../../.codex/memory/decisions.md)
