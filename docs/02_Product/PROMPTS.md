# Product Prompts

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

제품에서 제공하는 프롬프트 입력 정책과 템플릿을 관리합니다.

## Goals

- 안정성과 유지보수성을 우선합니다.
- 팀 간 계약과 책임을 명확히 합니다.

## Requirements

- 기존 기능과 문서 내용을 보존합니다.
- 변경 시 관련 문서와 검증 결과를 함께 갱신합니다.

## Implementation

서비스 카드는 다섯 개의 독립 Runtime Prompt와 일대일로 연결합니다: 증명사진
`id-photo`(`resume-id` preset), 비즈니스 프로필 `business-profile`, 프로필 사진
`profile-photo`, 물속 사진 보정 `underwater-correction`, 캐릭터 프로필
`character-avatar`. 최종 prompt와 metadata는
서버에서만 조립하고 처리합니다. 과거 `business`, `student`, `profile` Runtime
카테고리와 `passport-photo`는 운영 Registry와 서비스 UI에서 사용하지 않습니다.

선택적 추가 요청은 240자 제한과 control/rule override 차단을 적용합니다. 얼굴·나이
등 동일인성을 크게 바꾸는 요청, 허위 학교·회사·로고·교복·자격 생성, 여권·비자
적합성 보장과 제품·웨딩·여행·프리다이빙·일러스트 등 지원 범위 밖 요청은 job이나
Credit side effect 전에 거부합니다.

후보 1~3은 각자 허용된 배경과 개별 추가 요청을
가집니다. 공통 추가 요청은 해당 생성 배치의 모든 후보에 먼저 적용하고, 후보별
선택은 별도 `[사용자 선택 옵션]` 영역으로만 추가합니다. Runtime Prompt 본문은
치환하지 않습니다. 기본 배경을 그대로 선택하면 별도 옵션 문구를 추가하지 않아
기존 기본 Prompt를 보존합니다.

배경 ID는 서버 allowlist에서 사람이 이해할 수 있는 지시문으로 변환합니다.
증명사진은 `white`, `light-gray`, `light-blue`, 비즈니스 프로필은
`auto`, `white`, `light-gray`, `dark-gray`, `office`, `studio`, 프로필 사진은
`bright-studio`, `natural-interior`, `cafe`, `outdoor`, 물속 보정은
`preserve-scene`, `clear-water`, 캐릭터 프로필은 `warm-studio`, `clean-studio`,
`original-scene`만 허용합니다. 개별 요청도
공통 요청과 동일한 240자 및 안전 검증을 통과해야 하며 후보 사이에 공유하지
않습니다.

물속 사진 보정 v1.1.0은 얼굴이 없는 수중 장면도 포함하며 피사체·배치·장비를
보존하면서 색 편향과 빛을 복원합니다. 캐릭터 프로필 v2.1.0은 전신 원본을
머리부터 신발까지 입체적인 3D 모델 렌더로 변환하며 얼굴·피부·체형·의상을
보존합니다. 결과물은 3D처럼 렌더된 이미지이며 회전 가능한 메시·GLB 파일은 아닙니다.
두 서비스에는 얼굴이 없거나 렌더링되어 AWS CompareFaces가 부적합할 수
있어, 별도의 Gemini 원본 충실도 검사를 적용합니다. 점수 부족 또는 검사 장애 시
결과를 공개하지 않고 기존 bounded retry 및 Credit 복원 규칙을 유지합니다.

비즈니스 프로필 v2.4.0은 Identity-first Core Prompt에 서버 결정론적 직업 분류와
22개 직업군 Style Module을 결합합니다. 자유 텍스트 직업은 80자로 제한하고 서버에서
alias registry로 다시 분류하며, 미분류 값은 `general-professional`을 사용합니다. 별도
AI 분류 호출은 하지 않습니다. 후보별 의상은 `auto`, `formal`, `smart-casual`,
`profession-specific`만 허용합니다. 조립 우선순위는 동일인·안전 규칙, 명시적인 후보
의상·배경, 후보별 요청, 공통 사용자 요청, 직업군 추천 기본값, Core fallback 순서입니다.
명시적인 후보 옵션은 해당 영역의 직업군 추천보다 우선하고 `auto`는 직업군 추천을 사용합니다.
공통 촬영 스타일은 `auto`, `natural`, `refined`, `dreamy`, `modern`, `elegant`,
`hair-designer`, `fitness-trainer`만 허용하며 조명, 톤, 촬영 분위기와 사진 마감에만 적용합니다. `auto`는 modifier를
추가하지 않아 기존 기본 조립 결과를 유지하고, 명시적인 후보별 의상과 배경은 Style보다
우선합니다.

Hair Designer 카테고리 후보 Prompt v2.5.3은 v2.5.1 문구를 그대로 두고, 명시적 Outfit을
고른 경우에만 마지막에 `[최종 확인]` 한 줄(선택 의상과 Look 배경, 살롱 배경 금지)을
덧붙입니다. 2026-09-27 실측에서 같은 조건의 의상·배경 일치가 2/3에서 3/3으로
바뀌었으나 표본은 각 1회입니다.

Hair Designer 카테고리 후보 Prompt v2.5.1은 검증된 `hairStyleId`와
`profileOutfitId`를 Look과 별도로 서버에서 조립합니다. 동일인·얼굴 구조·피부·안전
보존이 최우선이고, 사용자가 명시한 Hair 선택은 원본 헤어스타일 기본 보존보다
우선합니다. `current` Hair는 길이·가르마·색·스타일을 유지하며, 다른 선택은 얼굴을
재설계하지 않고 선택한 헤어만 바꿉니다. `current` Outfit은 원본 의상을 유지하고
명시적 Outfit은 Look·직업군 기본 의상 추천보다 우선합니다. 이 예외는 Hair Designer
카테고리에만 적용되며 다른 비즈니스 프로필 Runtime v2.4.0은 변경하지 않습니다.
동일인 또는 피부 검사로 재생성할 때도 명시적 Hair 선택을 허용 영역에 유지하고
얼굴·피부 보존을 최우선으로 지시합니다. 원본 Hair 선택 및 다른 서비스의 재시도
지침과 AWS·Google 품질 통과 기준은 변경하지 않습니다. 실제 생성 성공률은 별도
provider 검증이 필요합니다.

Black Chic의 v2.5.2 장문 pose·composition·mood 변경 이후 같은 원본 사진의
생성 요청이 품질 검사에 실패하여 마지막 성공한 v2.5.1 문구로 되돌렸습니다.
검사별 점수가 보존되지 않아 그 변경이 직접 원인이었는지는 확인할 수 없습니다.
현재 Generate Action은 후보 slot을 Builder에 전달하지 않으므로 서로 다른
촬영 유형을 공통 Prompt에 나열해도 후보 1·2·3에 결정론적으로 배정되지 않습니다.
다양성 개선은 별도 설계와 실제 생성 검증이 필요하며 이번 복구에서 품질 검사
임계값, Identity·Skin·Hair·Outfit, Generate Action을 변경하지 않습니다.

## Checklist

- [ ] 책임 Agent가 내용을 검토했다.
- [x] 구현 또는 운영 상태와 문서가 일치한다.
- [ ] 관련 변경 시 이 문서를 함께 갱신한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Prompt Engine](../05_AI/PROMPT_ENGINE.md)
