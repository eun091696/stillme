# UI Guide

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

이 문서는 STILLME MVP의 화면 구조, 상호작용 상태, 콘텐츠와 반응형 동작을 정의합니다. 시각 토큰과 컴포넌트 접근성은 [Design System](DESIGN_SYSTEM.md)이 단일 기준입니다.

**Status:** `APPROVED`

**Version:** `ui-v2-stillme`

## Goals

- 가입부터 이미지 다운로드까지 핵심 흐름을 예측 가능하게 만듭니다.
- 로딩·빈 상태·오류·복구를 정상 화면과 동일한 수준으로 설계합니다.
- 키보드, 화면 낭독기, 확대와 reduced motion 환경에서 기능 손실을 방지합니다.

## Requirements

- 모바일 우선으로 설계하고 320 CSS px부터 핵심 흐름을 지원합니다.
- 페이지마다 하나의 명확한 H1과 현재 위치·다음 행동을 제공합니다.
- 사용자 입력과 결제·생성 결과는 실행 전후 상태가 분명해야 합니다.
- 인증, 결제, 생성, 이력 화면은 [Feature Stories](FEATURES.md)의 Story ID를 추적합니다.
- Light와 Dark theme 모두 동일한 정보 계층과 접근성 기준을 충족합니다.

## Implementation

### Page Shell

- skip link를 문서 첫 focusable element로 제공합니다.
- landmark는 `header`, `nav`, `main`, 필요 시 `aside`, `footer`를 사용합니다.
- main content는 페이지마다 하나이며 route 변경 후 페이지 제목 또는 main 시작점으로 focus를 관리합니다.
- global navigation은 현재 항목을 텍스트와 `aria-current`로 표시합니다.
- 공개·인증 navigation은 상단에 sticky로 유지하며 데스크톱에서는 전체 메뉴, 모바일에서는 keyboard로 조작 가능한 축약 메뉴를 제공합니다.
- theme 선택은 시스템 설정을 기본으로 하며 사용자 선택을 저장하고 깜박임을 최소화합니다.

### Core Screen Contract

| Screen | Primary action | Required states | Story IDs |
| --- | --- | --- | --- |
| Signup / verification | 계정 만들기·이메일 확인 | initial, validating, submitting, verification-sent, verified, expired-link, error | `AUTH-001` |
| Login | 로그인 | initial, submitting, invalid, unverified, locked/rate-limited, success | `AUTH-002` |
| Credit purchase | 상품 선택·결제 | catalog-loading, ready, payment-opening, verifying, paid, cancelled, failed, recovery | `PAY-001` |
| Generation studio | 이미지 생성 | empty, editing, invalid, insufficient-credit, queued, processing, completed, failed, restoring-credit | `GEN-001`, `GEN-002` |
| History | 결과 탐색·다운로드 | loading, empty, ready, pagination/loading-more, asset-expired, forbidden, error | `HIST-001` |

### Form Behavior

- label, help, constraint, error 순서로 정보를 제공합니다.
- submit 후 첫 오류 field로 focus를 옮기거나 오류 요약에서 각 field로 이동할 수 있게 합니다.
- 오류는 입력값을 불필요하게 지우지 않고 원인과 해결 행동을 설명합니다.
- required 표시는 텍스트로 제공하고 form 시작에 의미를 설명합니다.
- 비밀번호, 결제 또는 prompt 입력을 분석 로그에 기록하지 않습니다.
- 제출 중 primary button은 진행 label을 유지하며 같은 요청의 중복 제출을 차단합니다.

### Generation Experience

- prompt label과 목적·제한 안내를 항상 표시합니다.
- style과 aspect ratio는 키보드로 선택 가능하며 현재 선택을 텍스트로 전달합니다.
- 예상 credit 소비량과 현재 잔액을 제출 전에 표시합니다.
- queued와 processing을 구분하고 가능한 경우 마지막 상태 갱신 시각을 제공합니다.
- 실패 시 사용자가 책임져야 할 입력 오류와 시스템 오류를 구분합니다.
- credit 복구 여부를 실패 메시지와 거래 내역에서 확인할 수 있게 합니다.
- 생성 결과에는 preview, 안전한 대체 텍스트, download action과 생성 metadata 요약을 제공합니다.
- Home Hero, 서비스 목록·상단 예시, 프로필 카테고리, Look/Hair/Outfit/Background/Tie 카드, 업로드 예시·요약과 결과·보관함 이미지는 중요한 인물·의상·전신 실루엣을 잘라내지 않습니다. 원본 비율과 다른 프레임에서는 `contain`과 중립 배경을 사용하고, 초상 목업 선택 카드의 프레임은 가능한 한 원본 4:5를 따릅니다. 목업은 실제 생성 결과가 아님을 유지합니다.
- `/generate`의 세 서비스는 작은 카드 모음이 아니라 `01/02/03` 번호, 큰 예시 이미지와 설명을 가진 순차 editorial section으로 제공합니다.
- 결과와 생성 이력은 내부 ID를 노출하지 않고 번호가 붙은 큰 이미지 gallery로 표현합니다.
- Landing의 서비스 showcase는 native vertical scroll을 유지한 sticky viewport에서 section 진행도를 연속 계산합니다. `01/02/03` 장면의 위치, 크기, opacity와 reveal은 진행도에 직접 연결되어 스크롤 방향을 바꾸면 역방향으로 재생됩니다. reduced-motion에서는 같은 콘텐츠를 정적인 순차 목록으로 제공합니다.

### Feedback and Messaging

| Feedback | Pattern |
| --- | --- |
| Inline validation | field와 programmatically 연결된 텍스트; `aria-invalid`와 설명 참조 |
| Page error | H1 다음 오류 요약과 복구 action; 내부 stack 또는 secret 노출 금지 |
| Success | 다음 행동이 포함된 status; color와 toast에만 의존하지 않음 |
| Background progress | persistent status region; 완료·실패 시 적절한 live announcement |
| Destructive confirmation | 대상, 결과, 되돌리기 가능 여부를 명시한 dialog |
| Empty state | 현재 상태 설명, 첫 행동과 도움말 제공 |

### Dialog and Overlay

- 필수 집중 작업에만 modal dialog를 사용합니다.
- 열릴 때 의미 있는 첫 control로 focus를 이동하고 Tab 순환을 dialog 내부로 제한합니다.
- Escape와 명시적 close button으로 닫을 수 있고 닫은 뒤 trigger로 focus를 복귀합니다.
- 중요한 오류나 결제 결과를 toast만으로 전달하지 않습니다.
- mobile에서는 viewport와 virtual keyboard를 고려하고 배경 스크롤을 제어합니다.

### Responsive Behavior

- 모바일에서 primary action은 form 다음에 위치하고 결과 preview는 상태 뒤에 위치합니다.
- tablet·desktop의 2열 배치에서도 DOM 읽기 순서는 form → status → result를 유지합니다.
- table은 작은 화면에서 의미를 보존하는 list/card 표현을 제공하거나 표 자체를 스크롤 영역으로 명시합니다.
- hover에만 존재하는 action을 만들지 않으며 touch와 keyboard에서 동일 기능을 제공합니다.

### Content Style

- 버튼은 “확인”보다 “이미지 생성”, “크레딧 구매”처럼 결과를 설명합니다.
- 오류는 책임을 사용자에게 돌리지 않고 무엇이 실패했는지와 다음 행동을 말합니다.
- 상태 이름은 제품·API·로그에서 가능한 한 같은 용어를 사용합니다.
- 긴 기술 오류, provider code와 request ID는 사용자 메시지와 분리하되 지원용 request ID는 복사할 수 있게 제공합니다.

## Checklist

- [x] 핵심 화면별 primary action과 상태가 Story ID에 연결됐다.
- [x] form, dialog, feedback와 route focus behavior가 정의됐다.
- [x] 모바일·데스크톱의 읽기 순서와 interaction parity가 정의됐다.
- [x] 생성·결제·인증 실패의 복구 UI가 정의됐다.
- [x] 저장소 소유자가 `ui-v1` interaction baseline을 승인했다.
- [x] 현재 구현된 화면에서 skip link, route focus, title, heading, label,
      keyboard, contrast와 320px reflow를 browser E2E에 연결했다.

VoiceOver/NVDA 수동 확인과 향후 payment/generation interactive UI는 해당
기능 구현 PR의 release gate로 유지한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Design System](DESIGN_SYSTEM.md)
- [Feature Stories](FEATURES.md)
- [User Flow](USER_FLOW.md)
- [Authentication](AUTH.md)
- [AI Generation](AI_GENERATION.md)
- [Test Strategy](../04_Engineering/TEST.md)
