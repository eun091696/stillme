# Features

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

이 문서는 MVP의 사용자 가치를 테스트 가능한 사용자 스토리와 인수 기준으로 정의하는 제품 계약입니다. 기능 구현, QA 시나리오, 릴리스 승인에서는 아래 Story ID를 공통 추적 키로 사용합니다.

## Goals

- 가입 후 5분 안에 첫 AI 이미지를 생성하고 다운로드하는 핵심 여정을 명확히 합니다.
- 각 기능의 사용자 결과, 책임자, 실패 동작과 측정 신호를 연결합니다.
- 구현 전에 정상·실패·권한 시나리오를 독립적으로 검증할 수 있게 합니다.

## Requirements

### Scope Contract

MVP 포함 범위는 확인 링크 기반 이메일 인증, 이메일·Google·Kakao 로그인과 세션, 크레딧 구매, AI 이미지 생성, 생성 상태 확인, 결과 다운로드, 사용자별 생성 이력입니다. 전화번호 인증, Naver 인증, 팀 협업, 네이티브 앱, 고급 편집, 외부 디자인 도구 연동과 사용자 학습 모델은 제외합니다.

### Story Contract

각 사용자 스토리는 다음 정보를 반드시 가집니다.

- 영구적인 Story ID
- 사용자 역할과 기대 결과
- 하나의 책임 owner와 필요한 reviewer
- 명시적인 실패 동작
- 성공 또는 실패를 판별할 측정 신호
- 자동화 가능한 Given/When/Then 인수 기준

가격, 크레딧 차감량, 환불 조건의 최종 값은 [Pricing](../01_Business/PRICING.md), [Credits](../01_Business/CREDITS.md), [Payments](../01_Business/PAYMENTS.md)의 승인을 따른다. 아래 측정 신호의 구현 계약은 승인된 `analytics-v1` [Analytics Events](../11_Analytics/EVENTS.md)를 따른다. 문서 승인은 이벤트 producer, consent, retention, pipeline 또는 dashboard 구현 완료를 의미하지 않는다.

## Implementation

### MVP Traceability

| Story ID | Capability | User outcome | Accountable owner | Required reviewers | Failure behavior | Measurement signal |
| --- | --- | --- | --- | --- | --- | --- |
| `AUTH-001` | 이메일 가입과 링크 인증 | 확인된 계정을 만든다 | PM | Backend, Security, QA | 입력 오류 또는 인증 실패를 설명하고 계정을 인증 상태로 오인하지 않는다 | 가입 시도, 가입 성공, 이메일 인증 성공·실패 |
| `AUTH-002` | 이메일·Google·Kakao 로그인, 세션과 로그아웃 | 안전하게 계정에 접근하고 세션을 종료한다 | PM | Backend, Frontend, Security, QA | 인증 실패를 일반화해 표시하고 보호 화면이나 타인 데이터에 접근시키지 않는다 | 로그인 성공·실패, 로그아웃 성공, 보호 화면 차단 |
| `PAY-001` | 크레딧 구매 | 검증된 결제 후 사용할 크레딧을 받는다 | PM | Backend, Security, Database, QA | 미검증·취소·실패 결제에는 크레딧을 지급하지 않고 재시도 가능한 상태를 안내한다 | 결제 시작, 검증 성공·실패, 크레딧 지급 성공 |
| `GEN-001` | 이미지 생성 요청 | 프롬프트, 스타일과 비율로 생성 작업을 시작한다 | PM | AI Engineer, Backend, Frontend, Security, QA | 잘못된 입력이나 크레딧 부족 시 작업을 만들지 않고 수정 방법을 안내한다 | 생성 요청, 검증 실패, 작업 생성 성공 |
| `GEN-002` | 생성 상태와 결과 | 진행 상태를 확인하고 성공 이미지를 받는다 | PM | AI Engineer, Backend, Frontend, QA | 제공자·저장 실패를 명확히 표시하고 차감 크레딧을 복구하며 안전하게 재시도하게 한다 | 생성 성공·실패·재시도, 처리 시간, 크레딧 복구 |
| `HIST-001` | 생성 이력과 다운로드 | 자신의 결과를 다시 찾고 다운로드한다 | PM | Backend, Frontend, Security, QA | 누락·만료된 결과를 설명하고 다른 사용자의 메타데이터나 파일을 노출하지 않는다 | 이력 조회 성공·실패, 다운로드 성공·실패, 권한 차단 |

### User Stories and Acceptance Criteria

#### AUTH-001 — 이메일 가입과 인증

**User Story:** 신규 사용자로서 이메일과 비밀번호로 가입하고 이메일의 확인 버튼을 눌러 내 계정을 안전하게 활성화하고 싶다.

**Acceptance Criteria:**

1. Given 유효한 이메일과 정책을 충족하는 비밀번호, when 사용자가 가입을 제출하면, then 시스템은 인증 메일 발송 상태를 안내하고 인증 전 계정을 보호 기능의 인증 사용자로 취급하지 않는다.
2. Given 이미 등록된 이메일 또는 유효하지 않은 입력, when 가입을 제출하면, then 민감한 계정 존재 정보를 과도하게 노출하지 않는 오류와 수정 가능한 필드를 표시한다.
3. Given 유효한 이메일 확인 링크, when 사용자가 링크를 완료하면, then 계정이 인증되고 로그인 가능한 상태가 된다.
4. Given 만료되었거나 변조된 확인 링크, when 사용자가 접근하면, then 계정을 인증하지 않고 확인 메일 재요청 경로를 제공한다.
5. 가입 시도와 인증 결과는 비밀번호, 토큰 또는 전체 이메일 주소 없이 측정 가능해야 한다.
6. 이메일 가입 화면은 일회용 인증번호 입력을 요구하지 않고 비밀번호 확인을 검증해야 한다.
7. Given 캠페인 시작 이후 생성되고 인증을 완료한 신규 계정, when 인증 callback 또는 첫 생성 요청이 처리되면, then 사진 제작 2회에 해당하는 프로모션 Credit 2개를 원장에 정확히 한 번 기록하고 판매 상품 가격은 변경하지 않는다.

#### AUTH-002 — 로그인, 세션과 로그아웃

**User Story:** 인증된 사용자로서 이메일, Google 또는 Kakao 계정으로 로그인 상태를 안전하게 유지하고 필요할 때 종료하여 내 작업에만 접근하고 싶다.

**Acceptance Criteria:**

1. Given 인증된 계정과 올바른 자격 증명, when 로그인하면, then 안전한 세션이 생성되고 의도했던 보호 화면으로 이동한다.
2. Given 잘못된 자격 증명 또는 미인증 계정, when 로그인하면, then 세션을 만들지 않고 계정 열거를 피하는 오류와 적절한 복구 경로를 표시한다.
3. Given 비로그인 또는 만료된 세션, when 보호 화면에 접근하면, then 보호 데이터를 반환하지 않고 로그인 경로로 이동한다.
4. Given 로그인된 사용자, when 로그아웃하면, then 세션이 무효화되고 보호 화면 재접근이 차단된다.
5. 로그인, 로그아웃과 보호 화면 차단 결과는 자격 증명이나 세션 토큰 없이 측정 가능해야 한다.
6. Given Google 또는 Kakao의 첫 OAuth 완료, when Supabase가 새 사용자를 만들면, then 기존 프로필·크레딧 계정 생성 정책을 한 번 적용하고 동일 제공자의 재로그인에는 중복 생성하지 않는다.
7. OAuth 계정 연결은 Supabase identity 정책을 사용하며 이메일 문자열만으로 서로 다른 사용자를 강제 병합하지 않는다.

#### PAY-001 — 크레딧 구매

**User Story:** 인증된 사용자로서 승인된 상품을 결제하고 확인된 만큼의 크레딧을 받아 이미지 생성에 사용하고 싶다.

**Acceptance Criteria:**

1. Given 인증된 사용자와 서버가 제공한 유효한 상품, when 결제를 시작하면, then 주문 식별자와 결제 대기 상태가 생성되고 Toss Payments 승인 흐름으로 이동한다.
2. Given 제공자가 성공을 반환한 결제, when 서버 검증이 금액·주문·사용자와 일치하면, then 결제와 크레딧 원장이 한 번만 기록되고 잔액이 갱신된다.
3. Given 취소, 실패, 검증 불일치 또는 중복 콜백, when 결과를 처리하면, then 중복 크레딧을 지급하지 않고 사용자가 재시도 또는 지원 경로를 선택할 수 있다.
4. Given 결제 검증은 성공했지만 크레딧 반영이 완료되지 않은 상태, when 복구 처리가 실행되면, then 동일 주문에 대해 정확히 한 번의 지급 결과로 수렴한다.
5. 결제 단계와 크레딧 지급 결과는 카드 정보나 제공자 비밀 값을 수집하지 않고 측정 가능해야 한다.

#### GEN-001 — 이미지 생성 요청

**User Story:** 크레딧이 있는 사용자로서 프롬프트, 스타일과 화면 비율을 선택해 이미지 생성을 요청하고 싶다.

**Acceptance Criteria:**

1. Given 인증된 사용자, 충분한 크레딧, 공백 제거 후 비어 있지 않은 허용 프롬프트와 지원 옵션, when 생성을 제출하면, then 하나의 사용자 소유 작업이 생성되고 진행 상태가 표시된다.
2. Given 비로그인 사용자, when 생성을 제출하거나 생성 API에 접근하면, then 작업과 차감 기록을 만들지 않고 인증을 요구한다.
3. Given 빈 프롬프트, 지원하지 않는 옵션 또는 정책 위반 입력, when 제출하면, then 작업을 만들지 않고 수정 가능한 오류를 해당 입력과 연결한다.
4. Given 크레딧 부족, when 제출하면, then 작업과 차감 기록을 만들지 않고 잔액 부족 및 구매 경로를 안내한다.
5. 요청 결과는 원문 프롬프트 전체나 개인 데이터를 분석 이벤트에 포함하지 않고 측정 가능해야 한다.

#### GEN-002 — 생성 상태와 결과

**User Story:** 생성을 요청한 사용자로서 작업 진행 상황과 최종 결과를 확인하고 실패 시 안전하게 재시도하고 싶다.

**Acceptance Criteria:**

1. Given 생성 작업이 대기 또는 처리 중, when 소유자가 상태를 확인하면, then 현재 상태를 표시하고 중복 제출을 유도하지 않는다.
2. Given 생성과 R2 저장이 성공, when 작업이 완료되면, then 소유자는 미리보기와 다운로드 동작을 보고 크레딧 원장에는 승인된 차감이 한 번 기록된다.
3. Given 제공자, 후처리 또는 저장 실패, when 작업이 실패하면, then 오류는 재시도 가능 여부를 설명하고 차감된 크레딧은 원장 기록과 함께 복구된다.
4. Given 완료 또는 실패한 작업에 중복 결과가 도착, when 처리하면, then 이미지와 크레딧 상태가 중복 변경되지 않는다.
5. 성공률, 실패 단계, 재시도와 처리 시간은 비밀 값이나 전체 프롬프트 없이 측정 가능해야 한다.

#### HIST-001 — 생성 이력과 다운로드

**User Story:** 인증된 사용자로서 내 생성 결과를 최신순으로 확인하고 사용 가능한 이미지를 다운로드하고 싶다.

**Acceptance Criteria:**

1. Given 생성 이력이 있는 사용자, when 이력 화면을 열면, then 본인 작업만 최신순으로 표시하고 각 항목에 생성 시각, 사용자용 서비스 이름, 상태와 사용 가능한 결과 미리보기를 제공한다.
2. Given 이력이 없는 사용자, when 화면을 열면, then 오류가 아닌 빈 상태와 첫 생성 경로를 표시한다.
3. Given 완료된 본인 결과, when 다운로드하면, then 권한과 파일 유효성을 확인한 제한된 접근으로 파일을 제공한다.
4. Given 다른 사용자의 작업 식별자 또는 만료·누락된 파일, when 조회나 다운로드를 시도하면, then 메타데이터와 파일을 노출하지 않고 안전한 오류를 반환한다.
5. 이력 조회와 다운로드 결과는 서명 URL, 전체 프롬프트 또는 개인 식별자를 분석 이벤트에 포함하지 않고 측정 가능해야 한다.

### Cross-Cutting Acceptance Criteria

- 모든 핵심 흐름은 지원 모바일·데스크톱 화면에서 동작해야 한다.
- 키보드만으로 가입, 로그인, 결제 시작, 생성 요청, 상태 확인과 다운로드를 수행할 수 있어야 한다.
- 진행, 성공, 빈 상태와 오류는 색상에만 의존하지 않는 텍스트 상태를 제공해야 한다.
- 비밀 키, 제공자 토큰, 결제 정보, 서명 URL과 세션 값은 클라이언트 분석 또는 로그에 기록하지 않아야 한다.
- 사용자 소유 리소스는 서버 측 권한 검사와 데이터 계층 정책으로 격리해야 한다.
- 모든 외부 콜백과 재시도 가능한 쓰기는 중복 처리에 안전해야 한다.

## Checklist

- [x] 현재 MVP 기능이 Story ID에 연결됐다.
- [x] 각 스토리에 사용자 결과, 책임자, reviewer와 실패 동작이 있다.
- [x] 각 스토리에 테스트 가능한 Given/When/Then 인수 기준이 있다.
- [x] 각 스토리에 개인정보를 제한한 측정 신호가 있다.
- [x] 가격·크레딧·환불과 이벤트 스키마의 후속 승인 경계가 명시됐다.
- [ ] 구현 시 각 인수 기준을 자동 테스트와 연결한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Product](../01_Business/PRODUCT.md)
- [MVP Scope](../08_Release/MVP.md)
- [User Flow](USER_FLOW.md)
- [Authentication](AUTH.md)
- [AI Generation](AI_GENERATION.md)
- [Credits](../01_Business/CREDITS.md)
- [Payments](../01_Business/PAYMENTS.md)
- [Analytics Events](../11_Analytics/EVENTS.md)
