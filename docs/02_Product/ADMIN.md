# Admin

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

이 문서는 고객 운영을 위한 Admin·Support 권한과 승인 경계의 canonical 제품
계약입니다. 운영 화면과 조회·정정 기능은 이 경계를 우회할 수 없습니다.

## Goals

- 일반 사용자와 운영자 권한을 명시적으로 분리합니다.
- Support에는 고객 지원에 필요한 최소 조회·요청 권한만 제공합니다.
- 역할과 고위험 변경은 독립 승인과 불변 audit evidence를 요구합니다.

## Requirements

- 운영 권한은 이메일, profile metadata 또는 UI 표시에서 파생하지 않습니다.
- Production 운영 작업은 `aal2` MFA session에서만 허용합니다.
- Role grant·revoke는 `role.manage` 권한을 가진 요청자와 서로 다른 승인자가
  필요하며 승인자는 대상 사용자가 될 수 없습니다.
- Role change request는 bounded reason code, UUID idempotency key와 24시간
  expiry를 갖습니다.
- Credit 조정은 한 건당 ±150 credits 이내이며 bounded reason code, 개인 정보를
  포함하지 않는 support case reference, UUID idempotency key와 명시적 확인이
  필요합니다.
- Credit 조정 요청자와 승인자는 달라야 하고 둘 다 대상 사용자가 될 수 없습니다.
- 마지막 active Admin은 회수할 수 없습니다.
- 원시 role assignment, approval request와 audit table은 Data API로 직접
  읽거나 수정할 수 없습니다.
- 고객 UUID는 운영 조회 URL, redirect query와 일반 log에 기록하지 않습니다.
- Database lookup 결과는 client에 전달하기 전에 승인된 minimum DTO field만
  명시적으로 검증하고 재구성하며 예상하지 않은 field는 폐기합니다.

## Implementation

### Role Matrix

| Permission | Support | Admin |
| --- | --- | --- |
| 운영 interface 접근 | 허용 | 허용 |
| User 최소 정보 조회 | 허용 | 허용 |
| Payment·Credit·Generation 조회 | 허용 | 허용 |
| Credit adjustment 요청 | 허용 | 허용 |
| Credit adjustment 승인 | 불가 | 허용 |
| Notice 관리 | 불가 | 허용 |
| Operator role 관리 | 불가 | 허용 |

### Approval Boundary

`20260728000700_create_operator_rbac.sql`은 server-owned role assignment,
role-permission mapping, role change request와 immutable audit event를
구현합니다. Role grant·revoke는 다음 순서를 따릅니다.

1. MFA를 완료한 Admin이 target, role, action, reason code와 idempotency key로
   요청합니다.
2. 다른 MFA Admin이 만료 전에 승인합니다.
3. Database transaction이 assignment 변경, request 완료와 audit event 생성을
   함께 적용합니다.
4. Role 회수는 다음 권한 검사부터 즉시 반영됩니다.

초기 Admin bootstrap은 이메일 allowlist나 runtime API로 수행하지 않습니다.
대상 UUID와 두 책임자의 승인이 명시된 reviewable migration으로만 수행하며 현재
저장소에는 실제 운영자 assignment를 포함하지 않습니다.

Notice UI는 후속 Phase 6 Milestone입니다.

### Protected Interface

`/admin`은 dynamic Server Component로만 렌더링합니다. Middleware는 anonymous
request를 `/login?next=/admin`으로 이동시키고, page boundary는 `auth.getUser()`로
identity를 다시 검증한 뒤 `operator_has_permission('operator.read')` RPC를
호출합니다. Active role 또는 `aal2`가 없거나 authorization RPC가 실패하면
일반 404로 기본 거부하며 운영 화면이나 target data를 노출하지 않습니다.

운영 화면은 지원 요청에 포함된 정확한 사용자 UUID만 입력받습니다. 검색 성공
시 user, payment, credit과 generation domain별 audit event를 기록하고 각 RPC가
해당 lookup permission을 독립적으로 확인합니다. User 결과는 표시 이름·UUID·
가입 시각, Credit은 원장 기반 잔액과 예약량, Payment와 Generation은 최근
10개 상태만 반환합니다. Email, generation prompt, payment key와 provider
payload는 반환하거나 검색하지 않습니다. 일부 domain 조회가 거부되거나
실패하면 원시 database error를 표시하지 않고 전체 결과를 기본 거부합니다.
조회 form은 Server Action POST 상태로 처리해 고객 UUID를 browser history,
access log 또는 referrer에 포함할 수 있는 query string을 만들지 않습니다.
Server Action은 console permission을 다시 확인하고 RPC 결과를 allowlist DTO로
변환한 뒤에만 client component로 전달합니다.

### Credit Corrective Action

`20260730000100_create_operator_credit_adjustments.sql`은 Support와 Admin이
`credit.adjust.request`로 요청하고 다른 Admin이
`credit.adjust.approve`로 승인하는 two-person workflow를 구현합니다.

1. 운영자는 조회된 사용자 UUID, ±150 이내 정수 수량, 승인된 reason code,
   support case reference와 확인 checkbox로 요청합니다.
2. 요청은 24시간 동안 pending이며 잔액을 변경하지 않습니다.
3. 요청자·대상 사용자와 다른 MFA Admin만 승인할 수 있습니다.
4. 승인은 `manual_adjustment` ledger entry, actor, approver, target, reason과
   request reference를 하나의 transaction으로 기록합니다.
5. 동일 요청·승인 replay는 같은 request와 ledger entry로 수렴합니다.

승인 오류를 되돌릴 때 기존 request 또는 ledger를 수정하지 않습니다. 원 support
case와 request를 참조하는 반대 수량의 새 요청을 만들고 다른 Admin의 승인을
받습니다. 음수 balance가 되는 조정은 승인 transaction 전체가 거부됩니다.

## Checklist

- [x] Admin과 Support permission boundary가 정의됐다.
- [x] MFA, dual control, expiry, idempotency와 audit 경계가 구현됐다.
- [x] 실제 운영자 identity나 assignment가 저장소에 포함되지 않는다.
- [x] Protected admin interface와 anonymous·ordinary-user denial이 구현됐다.
- [x] 최소 정보 lookup이 domain별 permission과 audit 경계로 구현됐다.
- [x] Credit corrective action이 한도, confirmation, dual control과 불변
      ledger audit로 구현됐다.
- [x] 고객 식별자 URL 비노출, minimum DTO allowlist와 operator permission
      matrix가 자동 검증됐다.
- [ ] 관련 변경 시 이 문서를 함께 갱신한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Authentication Policy](../09_Security/AUTH_POLICY.md)
- [API Authorization](../06_API/AUTHORIZATION.md)
- [RLS Policy](../09_Security/RLS_POLICY.md)
