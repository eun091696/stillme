# Signup Failure

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

`RB-AUTH-001`의 회원가입과 이메일 verification 실패를 개인정보 없이 진단하고
self-service 복구 경로를 제공합니다. Primary owner는 Backend이며 Security,
Support, QA가 검토합니다. 마지막 실행 검증일은 2026-07-28입니다.

## Goals

- 사용자 영향을 최소화합니다.
- 안전하게 복구하고 재발 방지 근거를 남깁니다.

## Requirements

- `auth-support-v1` case ID, 환경, issue, UTC 시각과 opaque request ID만 기록합니다.
- Email, password, OTP, confirmation URL과 token을 요청하거나 기록하지 않습니다.
- 응답과 지원 절차에서 계정 존재 여부를 구분하지 않습니다.
- 승인 없는 user 생성·삭제, email confirmation 변경과 database 쓰기를 실행하지 않습니다.

## Implementation

### Case Intake

```bash
npm run auth:support:case -- \
  --case-id AUTH-20260728-D4E5F6 \
  --environment development \
  --issue verification \
  --observed-at 2026-07-28T03:00:00.000Z \
  --request-id request_87654321
```

### Read-Only Diagnosis

1. 여러 사용자에게 동시에 발생하면 Supabase Auth 상태, email provider 상태와 최근 배포를 확인하고 incident로 전환합니다.
2. `signup`은 validation, generic provider error와 `/verify-email` 이동 여부를 확인합니다.
3. `verification`은 PKCE code 또는 token-hash callback이 고정 allowlist 경로만 사용하는지 확인합니다.
4. 만료·변조 link가 계정을 인증하지 않고 안전한 재요청 경로를 제공하는지 확인합니다.
5. Delivery 확인에는 provider aggregate 상태만 사용하고 전체 email 주소나 message body를 ticket에 복사하지 않습니다.

### Mitigation and Escalation

- 미도착 또는 만료 link: `/verify-email`에서 다시 요청하도록 안내합니다.
- 반복 rate limit: provider가 안내한 window 이후 재시도하도록 안내하고 반복 발송을 중단합니다.
- Callback 오류: 사용자가 받은 URL을 수집하지 말고 route/status/request ID만 Backend에 전달합니다.
- Email verification 우회, 수동 user confirmation 또는 account metadata 변경 요청은 Security 승인과 audited admin tooling이 없으면 거부합니다.

### Exit Criteria

- 사용자가 generic signup/resend 결과와 안전한 다음 행동을 받습니다.
- 만료·변조 callback이 인증 session을 만들지 않습니다.
- case record에는 허용된 metadata와 mitigation 결과만 남습니다.

## Checklist

- [x] 개인정보를 받지 않는 case intake command가 있다.
- [x] Signup, verification과 resend의 read-only 진단 및 완화가 정의됐다.
- [x] 계정 열거, token 수집과 verification 우회가 금지됐다.
- [x] Callback allowlist와 recovery route test가 연결됐다.
- [ ] Production email delivery, rate limit alert와 expired/replayed token E2E를 검증했다.

## Related Documents

- [Product Authentication](../docs/02_Product/AUTH.md)
- [Authentication Policy](../docs/09_Security/AUTH_POLICY.md)
- [Operations Runbook](../docs/07_Operations/RUNBOOK.md)
- [Login Failure](LOGIN_FAILURE.md)
