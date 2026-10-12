# Prompt Engine

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

Prompt Engine은 사용자가 선택한 사진 서비스를 버전이 있는 완성형 Runtime
Prompt로 변환합니다. 운영 생성 경로는 세분화된 Module을 실행 시점에 자동
조합하지 않으며, 서비스별 Runtime Prompt와 검증된 사용자 옵션만 서버에서
결정론적으로 조립합니다.

현재 운영 서비스와 Runtime Prompt는 다음 세 가지입니다.

| 서비스 preset | Runtime Prompt | 현재 version |
| --- | --- | --- |
| `resume-id` | `id-photo` | `1.4.0` |
| `business-profile` | `business-profile` | `2.3.0` |
| `profile-photo` | `profile-photo` | `1.0.0` |

`passport-photo`는 현재 서비스 Registry, 타입과 UI에서 제거되어 운영 Runtime으로
사용하지 않습니다.

## Goals

- 서비스 하나의 Core Prompt를 해당 Runtime 파일에서 읽고 수정할 수 있게 합니다.
- 모델 선택과 Prompt version metadata를 분리합니다.
- 동일한 입력은 같은 순서와 규칙으로 조립합니다.
- API key와 최종 Prompt를 일반 클라이언트 화면이나 로그에 노출하지 않습니다.
- Research, Benchmark와 Knowledge Base를 운영 Runtime dependency에서 분리합니다.

## Requirements

- 각 preset은 `runtimePromptId` 하나를 선언합니다.
- Runtime Prompt의 `body`와 `version`이 Core Prompt의 source of truth입니다.
- 추가 요청은 trim, 빈 값 제거, 240자 제한, control character와 rule override 차단을
  적용합니다.
- 동일인성 또는 나이의 대폭 변경, 허위 학교·회사·로고·자격 생성, 제출 규격 통과
  보장과 지원 범위 밖 요청을 거부합니다.
- raw Prompt는 DB, client bundle과 일반 사용자 화면에 저장하거나 노출하지 않습니다.
- Prompt 변경은 해당 Runtime의 semantic version과 관련 테스트를 함께 갱신합니다.

## Implementation

운영 코드는 다음 경계로 나뉩니다.

- `src/lib/prompts/runtime/<service>/prompt.ts`: 서비스별 Core Prompt와 version
- `src/lib/prompts/runtime/index.ts`: 운영 Runtime Registry
- `src/lib/prompts/presets/id-photo.ts`: 사용자-facing preset과 Runtime mapping
- `src/lib/prompts/preset-registry.ts`: preset 조회
- `src/lib/prompts/builder.ts`: Core Prompt와 검증된 옵션 조립
- `src/lib/prompts/validation.ts`: 사용자 추가 요청 정규화와 거부 규칙
- `src/lib/prompts/candidate-options.ts`: 후보별 허용 의상과 배경
- `src/lib/prompts/business-profile/`: 비즈니스 직업군과 촬영 스타일 규칙

### 기본 조립

`buildPrompt()`는 preset에서 `runtimePromptId`를 조회하고 완성형 Runtime Prompt를
불러옵니다. 검증된 공통 추가 요청이 있으면 별도 영역으로만 덧붙입니다. 반환값은
`promptId`, `promptVersion`, `presetId`, `runtimePromptId`, `model` metadata 계약을
유지합니다. 호환 필드인 `modules`는 기본 조립에서 빈 배열이며 Core Prompt의 source
of truth가 아닙니다.

### 후보별 조립

`buildCandidatePrompt()`는 서버 allowlist에 등록된 후보 옵션만 Prompt로 변환합니다.
증명사진과 프로필 사진은 후보별 배경과 추가 요청을 적용합니다. 비즈니스 프로필은
Core Prompt에 서버에서 분류한 직업군 Module, 공통 촬영 스타일, 후보별 의상·배경과
추가 요청을 결합합니다.

비즈니스 프로필의 우선순위는 동일인·안전 규칙, 명시적인 후보별 의상·배경,
후보별 요청, 공통 사용자 요청, 직업군 추천 기본값, Core fallback 순서입니다.
촬영 스타일은 조명, 톤, 분위기와 마감에만 적용하며 후보별 의상과 배경을 덮어쓰지
않습니다.

### Runtime과 연구 자료의 경계

Knowledge Base, Prompt Validation Harness와 Benchmark 자료는 설명·연구·평가를 위한
별도 자산입니다. Builder는 이 자료를 요청마다 읽거나 자동 주입하지 않습니다.
Candidate 또는 Review 상태의 연구 규칙도 별도 승인과 Runtime version 변경 없이
운영 Prompt에 반영하지 않습니다.

### Model과 보안

모델 선택은 generation adapter와 metadata에 전달되며 Core Prompt를 암묵적으로
바꾸지 않습니다. 최종 Prompt 조립과 provider 호출은 서버에서만 수행합니다. 서버
진단에는 API key, authorization header, 이미지 bytes/base64, raw Prompt, signed URL
또는 개인정보를 기록하지 않습니다.

### 새 서비스 추가

1. `runtime/<service>/prompt.ts`에 완성형 Prompt와 `1.0.0` version을 정의합니다.
2. `RuntimePromptId`와 `runtime/index.ts` Registry에 서비스를 등록합니다.
3. preset mapping과 서비스 UI Registry를 연결합니다.
4. Builder, validation, metadata, client bundle 경계와 독립성 테스트를 갱신합니다.
5. 문서와 Benchmark를 갱신하고 별도 승인 후 운영에 반영합니다.

## Checklist

- [x] 운영 preset이 세 개의 서비스 Runtime Prompt에 연결됩니다.
- [x] Core Prompt와 후보별 옵션을 서버에서 조립합니다.
- [x] 사용자 추가 요청을 정규화하고 안전 규칙을 적용합니다.
- [x] Runtime Prompt와 Knowledge Base/Benchmark dependency를 분리합니다.
- [x] Prompt ID와 version metadata를 generation 흐름에 전달합니다.
- [x] 최종 Prompt와 비밀값을 client bundle에서 제외합니다.
- [ ] 실제 provider smoke test는 비용과 자격증명 사용 승인을 받은 뒤 수동 실행합니다.

## Related Documents

- [Product Prompts](../02_Product/PROMPTS.md)
- [Prompt Knowledge Base](PROMPT_KNOWLEDGE_BASE.md)
- [Prompt Engineering](PROMPT_ENGINEERING.md)
- [AI Models](MODELS.md)
- [AI Generation](../02_Product/AI_GENERATION.md)
- [Image Pipeline](IMAGE_PIPELINE.md)
