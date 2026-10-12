# Accessibility

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

이 체크리스트는 `ui-v1` 구현의 WCAG 2.2 Level AA 품질 게이트입니다. 문서 승인과 실제 제품 준수를 구분하며, 구현 증거가 없는 항목은 완료로 표시하지 않습니다.

## Goals

- 접근성 회귀를 PR과 릴리스 전에 발견합니다.
- 자동 검사만으로 확인할 수 없는 keyboard, focus, screen reader와 zoom 동작을 검증합니다.
- 예외에 owner, 사용자 영향, 만료일과 수정 계획을 요구합니다.

## Requirements

- Owner: Frontend Engineer
- Required reviewers: Designer, QA
- Standard: WCAG 2.2 Level AA
- Scope: signup, login, payment, generation, history와 공통 navigation
- Critical accessibility failure는 릴리스 차단 항목입니다.

## Implementation

### Pull Request Evidence

- 자동 검사 결과와 영향받은 route를 기록합니다.
- keyboard-only 실행 결과와 focus 순서를 기록합니다.
- light/dark contrast 계산 또는 도구 결과를 첨부합니다.
- UI 변경에는 mobile과 desktop screenshot을 첨부합니다.
- dialog, async status 또는 custom widget 변경에는 screen reader 결과를 기록합니다.

### Required Test Matrix

| Layer | Minimum evidence |
| --- | --- |
| Static | semantic HTML, accessible name, label association, invalid ARIA 검사 |
| Component | keyboard event, focus-visible, disabled/loading/error state |
| Integration | form error focus, dialog focus trap/restore, live region update |
| E2E | signup, payment, generation, history의 keyboard-only happy/failure path |
| Manual | VoiceOver + Safari 또는 NVDA + Firefox/Chrome 중 하나 |
| Visual | light/dark contrast, 200% text zoom, 400% browser zoom/reflow, reduced motion |

## Checklist

### 현재 자동화 증적

- Chromium E2E는 현재 구현된 public/auth 화면의 route title, 단일 H1/main,
  skip link, client route focus, form label/help와 keyboard 순서를 검증한다.
- Primary action text contrast는 4.5:1 이상이며 320 CSS px에서 public/auth
  화면의 horizontal overflow가 없음을 검증한다.
- 1440px와 320px 실제 browser rendering을 확인했다.
- VoiceOver/NVDA 수동 확인과 향후 payment/generation custom interaction은
  해당 기능 release 전 필수이며 아래 전체 release checklist 완료로 간주하지
  않는다.

### Structure and Semantics

- [ ] 페이지마다 고유하고 설명적인 title과 하나의 H1이 있다.
- [ ] landmark와 heading 계층이 의미 있는 순서를 가진다.
- [ ] skip link와 route focus management가 동작한다.
- [ ] interactive element는 가능한 한 native HTML을 사용한다.
- [ ] 이미지와 icon에 목적에 맞는 대체 텍스트 또는 장식 처리가 있다.

### Keyboard and Focus

- [ ] 모든 기능을 keyboard만으로 실행할 수 있다.
- [ ] focus 순서가 DOM과 사용자 흐름에 맞고 keyboard trap이 없다.
- [ ] focus-visible indicator가 최소 2px이며 인접 배경과 3:1 이상이다.
- [ ] dialog가 focus를 가두고 닫힌 뒤 trigger로 복귀한다.
- [ ] hover-only 또는 pointer-only action이 없다.

### Forms and Errors

- [ ] 모든 input에 지속적으로 보이는 label이 있다.
- [ ] required, format과 constraint가 입력 전에 안내된다.
- [ ] 오류가 field와 연결되고 텍스트로 원인과 수정 방법을 설명한다.
- [ ] submit 오류 시 첫 오류 또는 오류 요약으로 focus가 이동한다.
- [ ] 인증·결제·생성 중 입력값이 불필요하게 사라지지 않는다.

### Visual and Responsive

- [ ] 일반 텍스트 4.5:1, 큰 텍스트 3:1 대비를 충족한다.
- [ ] UI 경계와 의미 있는 graphic이 3:1 대비를 충족한다.
- [ ] color만으로 상태나 의미를 전달하지 않는다.
- [ ] pointer target이 최소 24×24px이며 핵심 control은 44×44px 이상이다.
- [ ] 320 CSS px reflow, 200% text zoom과 400% browser zoom에서 기능 손실이 없다.
- [ ] light와 dark theme 모두 같은 기준을 충족한다.

### Motion, Timing, and Status

- [ ] reduced motion에서 비필수 이동·확대 animation이 제거된다.
- [ ] 자동 갱신·사라지는 콘텐츠는 pause 또는 지속 접근 방법이 있다.
- [ ] async status와 결과가 적절한 live region으로 전달된다.
- [ ] loading, success, empty와 error 상태가 텍스트로 구분된다.
- [ ] flashing content가 발작 위험 기준을 위반하지 않는다.

### Release Gate

- [ ] 자동 접근성 검사가 통과했다.
- [ ] 핵심 E2E keyboard 시나리오가 통과했다.
- [ ] 지정 screen reader 조합의 수동 검사가 통과했다.
- [ ] Designer와 QA가 증거를 검토했다.
- [ ] 미해결 예외에 owner, 영향, 만료일과 승인 근거가 있다.

## Related Documents

- [Codex Contract](../../CODEX.md)
- [Design System](../../docs/02_Product/DESIGN_SYSTEM.md)
- [UI Guide](../../docs/02_Product/UI_GUIDE.md)
- [Test Strategy](../../docs/04_Engineering/TEST.md)
- [Feature Checklist](feature.md)
