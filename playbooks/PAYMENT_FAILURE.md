# Payment Failure

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

`RB-PAY-001`은 결제 승인·환불·reconciliation과 Credit 원장 불일치를
처리합니다. Primary owner는 Backend이며 Database, DevOps, Security가
검토합니다. Local 합성-data drill의 마지막 검증일은 2026-07-30입니다.
Production monitoring, Toss credential과 운영 권한 검증은 별도 release
gate입니다.

## Goals

- 사용자 영향을 최소화합니다.
- 안전하게 복구하고 재발 방지 근거를 남깁니다.

## Requirements

- Incident ID, environment, severity, UTC 시각, bounded payment state와 opaque
  request ID만 기록합니다.
- Email, payment key, authorization header, raw provider payload, 카드 정보와
  customer content를 기록하지 않습니다.
- Provider 상태는 authenticated server boundary에서 다시 조회하며 browser
  payload나 고객 주장만으로 원장 상태를 변경하지 않습니다.
- 자동 복구는 결제·환불 identity, amount, currency와 available Credit이 모두
  일치할 때만 허용합니다.
- Credit이 사용·예약됐거나 provider/local evidence가 충돌하면
  `review_required`로 격리하고 자동 debit, 취소 재호출과 직접 balance 수정을
  금지합니다.
- Data-changing mitigation은 stable idempotency identity와 audit evidence를
  사용하며 승인 없는 destructive command를 실행하지 않습니다.

## Implementation

### Detect and Declare

1. 결제 성공 후 Credit 미반영, provider 취소 후 local paid 상태, refund timeout,
   webhook replay 또는 reconciliation alert를 확인합니다.
2. 불일치가 금전 중복, 음수 available balance 또는 다수 사용자에게 영향을
   주면 보수적으로 severity를 높입니다.
3. Incident Commander, Technical Lead, Scribe와 다음 update 시각을 지정하고
   최근 release/configuration을 기록합니다.

### Read-Only Triage

1. 안전한 payment ID와 request ID로 원 order, payment, refund 상태와 연결된
   ledger entry 수를 확인합니다.
2. Provider key나 payload를 복사하지 않고 server verification 결과의 bounded
   status, amount, currency와 snapshot hash만 사용합니다.
3. purchase grant, reversal, generation reservation과 refund reservation을
   reconciliation해 available balance가 음수가 아닌지 확인합니다.
4. 동일 provider snapshot이 이미 처리됐는지 확인해 중복 복구를 막습니다.

### Contain and Recover

| Evidence | Action |
| --- | --- |
| Provider와 local이 일치 | `in_sync`로 기록하고 mutation 없이 종료 |
| Provider 취소, Credit 미사용 | 원 snapshot identity로 reconciliation하고 single reversal 검증 |
| Provider 취소, Credit 사용·예약 | `review_required`; 자동 reversal과 provider 재취소 금지 |
| Local refund pending, provider 미취소 | pending intent를 `failed`로 수렴하고 reservation 해제 검증 |
| 부분 취소 또는 identity/amount/currency 불일치 | 자동 처리 중단, Database·Backend·Security 검토 |

`repaired`는 payment/refund 상태, 단일 purchase grant, 단일 reversal,
reconciliation result와 최종 available balance를 모두 재검증해야 합니다.
Provider 회복만으로 incident를 종료하지 않습니다.

### Local Drill

다음 command는 local Supabase와 합성 사용자만 사용합니다. Service credential을
출력하지 않으며 drill 종료 시 합성 사용자와 cascade data를 삭제합니다.

```bash
npm run incident:drill:payment
```

Drill은 같은 provider cancellation snapshot replay가 하나의 reconciliation과
ledger reversal로 수렴하는지 검증합니다. 별도 시나리오에서는 generation
reservation 때문에 안전한 reversal이 불가능할 때 `review_required`로
격리되고 Credit이 변경되지 않는지 확인합니다.

허용되는 evidence field는 `schemaVersion`, `playbookId`, `environment`,
`scenario`, `severity`, `observedAt`, `status`와 bounded boolean/outcome
summary뿐입니다. 출력에 UUID, email, order/payment/refund ID, payment key,
provider payload 또는 secret을 추가하지 않습니다.

### Exit Criteria

- 중복 purchase grant, reversal 또는 reconciliation result가 없습니다.
- Balance, generation/refund reservation과 available balance invariant가
  일치합니다.
- `review_required` 항목은 owner와 안전한 다음 action을 갖고 자동 mutation이
  중단됐습니다.
- Evidence와 communication에 금지된 결제·개인·credential data가 없습니다.
- 합성 drill data가 정리됐고 관련 automated test가 통과했습니다.

## Checklist

- [x] Local 합성-data drill이 자동 repair와 manual-review 경계를 검증했다.
- [x] Reconciliation replay와 단일 ledger effect가 검증됐다.
- [x] Credit reservation 충돌 시 unsafe repair가 차단됐다.
- [x] Drill evidence allowlist와 합성 data cleanup이 검증됐다.
- [x] 구현된 refund와 reconciliation 상태에 맞는 복구 절차가 기록됐다.
- [ ] Production monitoring과 담당자 escalation을 확인했다.

## Related Documents

- [README](../README.md)
- [Payments](../docs/01_Business/PAYMENTS.md)
- [Runbook](../docs/07_Operations/RUNBOOK.md)
