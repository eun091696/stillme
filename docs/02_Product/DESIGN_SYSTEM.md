# Design System

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

이 문서는 STILLME UI의 시각 토큰, 컴포넌트 상태와 접근성 기준을 정의하는 제품 계약입니다. 디자이너와 Frontend Engineer는 이 문서를 공통 기준으로 사용하며 임의 색상, 간격 또는 상호작용 패턴을 기능별로 만들지 않습니다.

**Status:** `APPROVED`

**Version:** `ui-v2-stillme`

**Owner:** Designer

**Required reviewers:** PM, Frontend, QA

## Goals

- 모바일과 데스크톱에서 일관되고 예측 가능한 핵심 흐름을 제공합니다.
- WCAG 2.2 Level AA를 최소 접근성 기준으로 사용합니다.
- 디자인 토큰과 컴포넌트 상태를 구현·테스트 가능한 계약으로 만듭니다.
- AI 생성의 대기, 성공, 실패와 복구 상태를 명확하게 전달합니다.

## Requirements

### Accessibility Conformance

- MVP의 모든 공개·인증 화면은 WCAG 2.2 Level AA를 목표로 합니다.
- 일반 텍스트는 배경과 4.5:1 이상, 24px 이상 또는 18.66px bold 이상 큰 텍스트는 3:1 이상 대비를 가집니다.
- 필수 UI 경계, 상태 표시와 의미 있는 그래픽은 인접 색상과 3:1 이상 대비를 가집니다.
- 모든 기능은 키보드로 사용할 수 있고 논리적인 초점 순서를 유지합니다.
- 포인터 목표는 WCAG 최소 24×24 CSS px를 충족하며 제품 기본 컴포넌트는 44×44 CSS px 이상을 사용합니다.
- 포커스는 제거하지 않으며 최소 2px 외곽선과 주변 배경 대비 3:1 이상을 제공합니다.
- 색상만으로 의미, 오류, 선택 또는 상태를 전달하지 않습니다.
- 텍스트는 200% 확대에서 손실 없이 사용할 수 있고 320 CSS px 너비에서 핵심 흐름이 수평 스크롤 없이 reflow됩니다.
- 비필수 동작 애니메이션은 `prefers-reduced-motion`에서 제거합니다.
- 상태 변화와 비동기 결과는 적절한 live region으로 보조기술에 전달합니다.

### Semantic and Interaction Rules

- 올바른 네이티브 HTML 요소를 먼저 사용하고 ARIA는 의미를 보완할 때만 사용합니다.
- 모든 입력에는 지속적으로 보이는 label과 필요한 형식·필수 여부 안내가 있습니다.
- 입력 오류는 해당 필드와 연결된 텍스트로 원인과 수정 방법을 설명합니다.
- 파괴적·결제·데이터 변경 작업은 실행 전 결과를 명확히 표시하고 필요하면 확인 단계를 제공합니다.
- 로딩은 작업이 진행 중임을 전달하되 무기한 진행 표시만 제공하지 않습니다.
- 비활성 상태는 이유와 복구 조건을 인접 텍스트 또는 도움말로 설명합니다.

## Implementation

### Color Tokens

구현에서는 아래 의미 기반 CSS custom property를 Tailwind theme에 연결합니다. 컴포넌트에서 원시 색상값을 직접 사용하지 않습니다.

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `--color-background` | `#F5F4F0` | `#111111` | 따뜻한 페이지 배경 |
| `--color-surface` | `#FFFFFF` | `#1B1B1B` | 사진·입력 표면 |
| `--color-foreground` | `#111111` | `#F5F4F0` | 기본 텍스트 |
| `--color-muted-foreground` | `#5D5B56` | `#C8C5BD` | 보조 텍스트 |
| `--color-border` | `#77736B` | `#A9A69E` | 입력·컴포넌트 경계 |
| `--color-primary` | `#111111` | `#F5F4F0` | 주요 작업 |
| `--color-primary-foreground` | `#FFFFFF` | `#111111` | 주요 작업 텍스트 |
| `--color-focus` | `#0F766E` | `#FBBF24` | 키보드 포커스 |
| `--color-danger` | `#B91C1C` | `#FCA5A5` | 오류·파괴 작업 |
| `--color-danger-foreground` | `#FFFFFF` | `#0F172A` | 오류·파괴 작업 텍스트 |
| `--color-success` | `#166534` | `#86EFAC` | 성공 |
| `--color-success-foreground` | `#FFFFFF` | `#0F172A` | 성공 텍스트 |

검증된 핵심 대비:

| Pair | Contrast |
| --- | ---: |
| Light foreground / background | 17.16:1 |
| Light muted foreground / background | 6.16:1 |
| Light primary foreground / primary | 18.88:1 |
| Light border / background | 4.29:1 |
| Light focus / background | 4.97:1 |
| Dark foreground / background | 17.16:1 |
| Dark muted foreground / background | 10.95:1 |
| Dark primary foreground / primary | 17.16:1 |
| Dark border / background | 7.76:1 |
| Dark focus / background | 11.31:1 |

새 토큰과 모든 interactive state는 실제 인접 배경 조합으로 다시 검사합니다.

### Typography Tokens

| Token | Size / line-height | Weight | Use |
| --- | --- | ---: | --- |
| `text-display` | 36px / 44px | 700 | 랜딩 핵심 메시지 |
| `text-h1` | 30px / 38px | 700 | 페이지 제목 |
| `text-h2` | 24px / 32px | 700 | 주요 섹션 |
| `text-h3` | 20px / 28px | 600 | 하위 섹션 |
| `text-body` | 16px / 24px | 400 | 기본 본문 |
| `text-body-strong` | 16px / 24px | 600 | 강조 본문 |
| `text-small` | 14px / 20px | 400 | 보조 설명 |
| `text-label` | 14px / 20px | 600 | 입력 label |

기본 글꼴은 시스템 sans-serif stack을 사용합니다. Display headline은 굵기보다 큰 크기, 촘촘한 자간과 충분한 여백으로 editorial hierarchy를 만듭니다. 핵심 정보에 12px 미만 텍스트를 사용하지 않으며 텍스트 이미지를 만들지 않습니다.

### Spacing, Size, Radius, and Elevation

- spacing base는 4px이며 허용 scale은 `4, 8, 12, 16, 24, 32, 48, 64px`입니다.
- 콘텐츠 최대 너비는 1200px, 읽기 중심 본문은 720px를 권장합니다.
- interactive control 기본 높이는 44px, compact control도 포인터 목표 24×24px와 충분한 간격을 보장합니다.
- radius scale은 `2, 4, 10px`이며 pill은 상태 badge에만 사용합니다.
- card 중첩 대신 section, whitespace와 얇은 divider를 우선하고 shadow는 필요한 overlay에만 제한합니다.
- z-index는 `base 0`, `sticky 10`, `popover 30`, `modal 50`, `toast 70`으로 제한합니다.

### Component Contract

모든 interactive component는 `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `error` 중 적용 가능한 상태를 문서화하고 테스트합니다.

| Component | Required behavior |
| --- | --- |
| Button | 동사 중심 label, 44px 기본 높이, 로딩 중 label 유지, 중복 제출 방지, icon-only는 accessible name 필수 |
| Link | 목적이 드러나는 텍스트, 본문 링크는 밑줄 또는 색 외 단서 제공, 새 창은 사전 고지 |
| Text input / textarea | 보이는 label, 설명·오류 연결, 오류 시 텍스트와 아이콘, placeholder를 label로 사용하지 않음 |
| Select / combobox | native select 우선, custom이면 WAI-ARIA APG keyboard contract 준수 |
| Checkbox / radio | label 전체 클릭 가능, group에는 fieldset과 legend, 선택 상태를 색만으로 표현하지 않음 |
| Card | 정보 묶음이며 전체를 가짜 button으로 만들지 않음; 하나의 주 작업만 명확히 표시 |
| Dialog | 명시적 title, focus trap, Escape 닫기, 닫은 뒤 trigger로 focus 복귀, 배경 interaction 차단 |
| Toast / status | 긴급도에 맞는 live region, 자동 사라짐만으로 필수 정보를 제공하지 않음 |
| Progress | 텍스트 상태와 함께 표시, 측정 가능하면 값 제공, 완료·실패를 명확히 구분 |
| Generated image | 목적 있는 대체 텍스트 또는 사용자 프롬프트의 안전한 요약, 다운로드 이름과 상태 제공 |

### Responsive Contract

| Range | Layout rule |
| --- | --- |
| `<640px` | 단일 열, 주요 작업 full-width 허용, navigation 단순화 |
| `640–767px` | 넓은 단일 열, 보조 작업을 같은 흐름에 유지 |
| `768–1023px` | 필요한 경우 2열, form과 preview의 읽기 순서 보존 |
| `≥1024px` | generation form과 preview 병렬 배치 가능, 콘텐츠 최대 너비 적용 |

DOM 순서는 모든 viewport에서 의미 있는 읽기 순서를 유지하며 CSS로 시각 순서만 뒤집지 않습니다.

### Motion and Feedback

- 일반 transition은 150–350ms이며 transform과 opacity 중심으로 기능 이해에 필요한 경우에만 사용합니다.
- 생성 진행을 무한 회전 아이콘 하나로만 표현하지 않고 단계 또는 상태 텍스트를 제공합니다.
- `prefers-reduced-motion: reduce`에서는 parallax, 이동·확대 animation과 비필수 skeleton shimmer를 제거합니다.
- 성공, 경고, 오류 feedback은 아이콘·텍스트·색상을 함께 사용합니다.

### Governance

1. Designer가 토큰 또는 component contract 변경을 제안합니다.
2. PM이 사용자 결과와 콘텐츠 영향을 검토합니다.
3. Frontend가 구현·성능 영향을 검토합니다.
4. QA가 자동·수동 접근성 증거를 확인합니다.
5. breaking token 변경은 새 design-system version과 migration note가 필요합니다.

## Checklist

- [x] WCAG 2.2 Level AA 기준과 예외 정책이 정의됐다.
- [x] light·dark 의미 토큰과 핵심 대비가 검증됐다.
- [x] typography, spacing, sizing, radius와 elevation 기준이 정의됐다.
- [x] 핵심 컴포넌트 상태와 keyboard contract가 정의됐다.
- [x] responsive, motion, error와 async feedback 기준이 정의됐다.
- [x] 저장소 소유자가 `ui-v1` 기준을 승인했다.
- [x] 현재 구현된 page shell, navigation, auth form과 primary action을
      keyboard, focus, contrast, semantic structure와 reflow E2E에 연결했다.

아직 구현되지 않은 dialog, payment/generation custom control과 실제
VoiceOver/NVDA 확인은 각 기능 release 전에 추가한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [UI Guide](UI_GUIDE.md)
- [User Flow](USER_FLOW.md)
- [Feature Stories](FEATURES.md)
- [Test Strategy](../04_Engineering/TEST.md)
- [Accessibility Checklist](../../.codex/checklists/accessibility.md)
- [Design Decision](../../.codex/memory/decisions.md)
