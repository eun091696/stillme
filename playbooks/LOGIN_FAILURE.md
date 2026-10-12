# Login Failure

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

`RB-AUTH-001`의 로그인, 비밀번호 재설정과 세션 만료 장애를 개인정보 없이
진단합니다. Primary owner는 Backend이며 Security, Support, QA가 검토합니다.
마지막 실행 검증일은 2026-07-28입니다.

## Goals

- 사용자 영향을 최소화합니다.
- 안전하게 복구하고 재발 방지 근거를 남깁니다.

## Requirements

- `auth-support-v1` case ID, 환경, issue, UTC 시각과 opaque request ID만 기록합니다.
- Email, password, cookie, session/recovery token과 인증 링크를 요청하거나 기록하지 않습니다.
- 계정 존재 여부를 확인해 주거나 email verification을 우회하지 않습니다.
- 승인 없는 session revoke, password 변경, user metadata 변경과 database 쓰기를 실행하지 않습니다.

## Implementation

### Case Intake

```bash
npm run auth:support:case -- \
  --case-id AUTH-20260728-A1B2C3 \
  --environment development \
  --issue password-reset \
  --observed-at 2026-07-28T03:00:00.000Z \
  --request-id request_12345678
```

지원 기록에는 출력된 allowlist field만 사용합니다.

### Read-Only Diagnosis

1. 여러 사용자에게 동시에 발생하면 Supabase Auth 상태와 최근 배포를 확인하고 incident로 전환합니다.
2. `login`은 HTTP status와 provider error code만 확인하고 사용자는 일반화된 login 오류를 유지합니다.
3. `password-reset`은 `/forgot-password` 요청과 callback redirect allowlist를 확인합니다.
4. `session-expiry`는 `/account`가 `/login?reason=session_expired`로 이동하고 보호 body를 반환하지 않는지 확인합니다.
5. 개별 사용자 문제는 self-service 재시도 경로만 안내하며 credential이나 token을 대신 처리하지 않습니다.

### Mitigation and Escalation

- Login 실패: 입력 재확인 후 `/forgot-password`를 안내합니다.
- 만료 recovery link: 새 reset email을 요청하도록 안내합니다.
- 만료 session: 다시 login하도록 안내합니다.
- 반복 rate limit 또는 provider 장애: 재시도 폭증을 유도하지 말고 Backend와 DevOps에 escalation합니다.
- 강제 session revoke, 계정 disable/restore 또는 metadata 수정이 필요하면 Security 승인과 audit 가능한 admin tooling이 구현될 때까지 중단합니다.

### Exit Criteria

- 사용자가 self-service flow로 login하거나 안전한 일반 오류를 받습니다.
- 보호 route가 anonymous/expired session에 data를 반환하지 않습니다.
- case record에 timestamp, environment, issue, request ID, mitigation과 escalation만 남습니다.

## Checklist

- [x] 개인정보를 받지 않는 case intake command가 있다.
- [x] Login, reset과 expiry의 read-only 진단 및 self-service 완화가 정의됐다.
- [x] Credential, manual password change와 인증 우회가 금지됐다.
- [x] Unit, Auth integration과 protected-route test가 연결됐다.
- [ ] Production provider log, alert와 audited admin tooling을 검증했다.

## Related Documents

- [Product Authentication](../docs/02_Product/AUTH.md)
- [Authentication Policy](../docs/09_Security/AUTH_POLICY.md)
- [Operations Runbook](../docs/07_Operations/RUNBOOK.md)
- [Signup Failure](SIGNUP_FAILURE.md)
