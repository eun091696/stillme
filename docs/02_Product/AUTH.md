# Authentication

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

이 문서는 이메일·Google·Kakao 인증과 프로필 기반 계정 접근의 제품 계약 및 현재 구현
상태를 관리합니다. 현재 기능은 `AUTH-001`과 `AUTH-002`의 첫 번째
구현 milestone입니다.

## Goals

- 사용자가 이메일, Google 또는 Kakao로 가입하고 로그인·로그아웃할 수 있게 합니다.
- 인증되지 않은 사용자가 계정 화면과 프로필 데이터에 접근하지 못하게 합니다.
- 인증과 프로필 소유권을 앱과 데이터베이스 양쪽에서 검증합니다.

## Requirements

- 이메일과 8–72자 비밀번호 및 비밀번호 확인을 검증합니다.
- hosted 환경은 이메일 확인을 필수화하고 허용된 `/auth/confirm` 경로만 사용합니다.
- 이메일 확인은 6자리 OTP 입력이 아니라 인증 메일의 버튼/링크를 사용합니다.
- Social Auth는 Supabase의 `google`, `kakao` provider만 사용하고 Naver와 전화번호 인증은 지원하지 않습니다.
- 보호 경로는 미들웨어 리다이렉트와 Server Component의 검증된 사용자 조회를 모두 사용합니다.
- 로그인 실패는 계정 존재 여부를 구분하지 않는 일반화된 메시지를 반환합니다.
- 프로필은 본인만 조회하고 표시 이름만 수정할 수 있습니다.

## Implementation

### Implemented Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/signup` | Public | Email/password or Google/Kakao signup |
| `/login` | Public | Email/password or Google/Kakao login with allowlisted internal return path |
| `/forgot-password` | Public | Request a generic, non-enumerating password reset email |
| `/verify-email` | Public | Resend signup verification without exposing account state |
| `/auth/confirm` | Public callback | Exchange OAuth PKCE codes or verify email confirmation links |
| `/reset-password` | Recovery session | Set a new password and invalidate all sessions |
| `/account` | Authenticated | Read and update the current user's basic profile |

Supabase SSR cookies are refreshed by `src/middleware.ts`. Server Actions and
the account Server Component call `auth.getUser()` before protected work. The
`profiles` table is created by an `auth.users` trigger and protected by
owner-only RLS. Social provider metadata may supply a display name; when it is
missing the profile trigger uses a bounded email-local fallback without storing
provider tokens, avatars, phone numbers, or additional provider profile data.

Google and Kakao share the same Server Action and callback. The action accepts
only the two allowlisted provider identifiers, preserves only known internal
destinations, and never handles provider client secrets in the browser. Account
linking and duplicate-identity behavior remain owned by Supabase Auth; the app
does not merge users based only on matching email strings.

Local development sets email confirmation off so automated signup can complete
without external mail delivery. Hosted environments must enable confirmation.
Recovery and resend responses remain generic, recovery callbacks use a fixed
internal destination, reset requires a verified recovery session, and password
changes end with global sign-out. Protected requests with stale Supabase auth
cookies return to login with an explicit session-expiry message.

## Checklist

- [x] 이메일 가입, 로그인, 로그아웃이 구현됐다.
- [x] Google·Kakao OAuth 시작, 공통 callback과 취소 오류 처리가 구현됐다.
- [x] 보호 경로가 미들웨어와 서버 검증을 사용한다.
- [x] 기본 프로필 조회와 표시 이름 수정이 구현됐다.
- [x] 이메일 재확인, 비밀번호 재설정과 만료 세션 UX가 구현됐다.
- [x] 단위, 로컬 통합, RLS 테스트가 실행 가능하다.
- [ ] hosted 환경의 이메일 확인, recovery, session expiry를 E2E 검증한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Feature Stories](FEATURES.md)
- [Authentication Policy](../09_Security/AUTH_POLICY.md)
- [RLS Policy](../09_Security/RLS_POLICY.md)
- [Database](../03_Architecture/DATABASE.md)
