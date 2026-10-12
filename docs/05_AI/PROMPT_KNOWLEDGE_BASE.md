# Prompt Knowledge Base

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

Prompt Knowledge Base는 Prompt Builder가 실행할 규칙과 분리된 Prompt Encyclopedia다. 각 Rule이
왜 필요한지, 어떤 결과를 만드는지, 어느 preset에 적합한지를 한국어 설명과 함께 기록한다.
Builder와 module registry는 이 문서를 runtime dependency로 참조하지 않는다. 따라서 지식 설명을
보강해도 생성 결과의 결정성과 서버 번들 보안에 영향을 주지 않는다.

현재 구현은 `src/lib/prompt-knowledge/`에 있으며 7개 category와 20개 이상의 Rule을 제공한다.

## Goals

- 개발자가 Rule의 의도와 적용 범위를 빠르게 이해하도록 한다.
- 영어 prompt line과 한국어 운영 설명을 분리한다.
- `worksFor`, `avoidFor`, `source`, `confidence`로 preset 확장 시 판단 근거를 남긴다.
- 향후 성공률·실패 태그·모델별 성능을 추가할 수 있는 구조를 유지한다.
- 사용자에게는 결과 중심 preset 선택과 사진 업로드를 우선 제공하고, raw prompt는 고급 설정에서만 노출한다.

## Requirements

각 Rule은 다음 필드를 갖는다.

| Field | Purpose |
| --- | --- |
| `id` | 안정적인 namespace 기반 식별자 |
| `category` | `identity`, `lighting`, `quality`, `composition`, `restriction`, `underwater`, `portrait` |
| `english` | Prompt Module이 사용할 수 있는 영어 Rule 문장 |
| `korean` | 직역이 아닌 운영자용 의미 설명 |
| `purpose` | 이 Rule이 필요한 이유 |
| `effect` | 기대되는 품질·안전 효과 |
| `worksFor` / `avoidFor` | 적용·비적용 preset 또는 category |
| `source` | `Internal`, 공식 문서, 커뮤니티 등 근거 |
| `confidence` | 현재 검증 신뢰도(0~1) |
| `notes` | 구현·운영 참고사항 |

`testCount`, `successRate`, `failureTags`, `lastUpdated`, `relatedRules`, `recommendedModel`,
`promptVersion`는 선택 필드로 예약한다.

## Implementation

### Runtime 경계

`PROMPT_KNOWLEDGE_BASE`와 `PROMPT_KNOWLEDGE_BY_ID`는 개발자 조회용 registry다. Builder는
knowledge ID를 자동 주입하지 않고 `src/lib/prompts/`의 Prompt Module과 preset이 선언한
`moduleIds`만 조합한다. 동일한 개념을 module로 구현할 때도 Knowledge Base의 설명을 복사해
runtime 의존성을 만들지 않는다.

### Research Rule 승인 흐름

Knowledge Base의 Research Rule은 Runtime Module과 별도 생명주기를 가집니다. 공개 자료의 prompt 원문을 그대로 복사하지 않고 의미, 원리와 관찰 가능한 효과만 추출합니다.

1. `candidate`: 출처와 가설을 기록한 연구 후보이며 runtime에 반영하지 않습니다.
2. `review`: 중복, 적용 범위, 위험과 검증 방법을 검토합니다.
3. `approved`: 실제 Nano Banana 이미지 비교에서 의도한 효과와 회귀 여부를 확인한 규칙입니다.

텍스트 검토나 ChatGPT 결과만으로는 `approved`로 올리지 않습니다. 생성 실패에는 얼굴 구조, 피부, 머리카락, 표정 등 failure tag를 붙이고 해당 책임을 가진 Prompt Module의 개선 근거로 연결합니다. Knowledge Base 상태가 바뀌어도 Runtime Module은 별도 변경과 prompt version 검토를 거쳐야 합니다.

### 현재 category와 대표 Rule

- Identity: `identity.facial-asymmetry`, `identity.face-proportions`, `identity.age-range`, `identity.skin-texture`
- Lighting: `lighting.soft-studio`, `lighting.natural-direction`, `lighting.background-separation`
- Quality: `quality.photorealistic`, `quality.no-plastic-skin`, `quality.no-over-sharpening`, `quality.detail-preservation`
- Composition: `composition.centered`, `composition.eye-level`, `composition.chest-up`
- Restriction: `restriction.no-text`, `restriction.no-extra-person`, `restriction.no-facial-distortion`
- Underwater: `underwater.scene-preservation`, `underwater.color-recovery`, `underwater.equipment-preservation`, `underwater.natural-light-falloff`
- Portrait: `portrait.expression-natural`, `portrait.hair-preservation`, `portrait.professional-posture`

각 항목의 한국어 목적·효과·출처·신뢰도는 `registry.ts`를 source of truth로 관리한다.

### 새 Rule 추가 절차

1. `types.ts`의 category와 필수 필드를 확인한다.
2. registry에 고유 namespace ID를 등록한다.
3. 한국어 설명은 번역이 아니라 문제·효과 중심으로 작성한다.
4. `worksFor`와 `avoidFor`를 명시하고 근거와 confidence를 기록한다.
5. Knowledge Base 테스트와 문서 목록을 갱신한다.
6. 실제 생성에 반영하려면 별도의 Prompt Module과 preset `moduleIds`를 추가한다.

### UX 방향

홈과 생성 화면은 “무엇을 만들고 싶으신가요?”라는 결과 선택을 먼저 보여준다. 업로드가 필요한
preset은 사진 업로드를 가장 앞에 배치하고, Prompt는 시스템이 생성한다. 사용자가 입력하는
`additionalRequest`는 고급 설정의 마지막 입력으로만 연결한다. 현재 개발 전용 생성 화면에서는
7개 결과 category와 기존 생성 흐름을 연결했으며, production preset별 업로드 폼은 다음 UX
milestone에서 단계적으로 연결한다.

### id-photo Known Limitation

Production `id-photo` v1.3.0은 G constrained-edit 구조를 기준으로 원본 보존과 허용된 영역의
제한 편집을 우선한다. G는 F보다 헤어 보존과 원본에 없는 액세서리 생성 방지에서 개선됐지만,
`gemini-3.1-flash-image`는 같은 원본과 Prompt에서도 피부 트러블 보정 강도와 미세 피부
디테일에 후보별 편차가 생길 수 있다. H의 피부 강도 제어 실험도 이 편차를 완전히 해소하지
못했으므로 H 정책은 production에 반영하지 않는다. 피부 보정 편차는 Known Limitation으로
관리하고 향후 실제 사용자 generation 데이터로 실패율을 측정한다.

## Checklist

- [x] 타입과 category를 정의했습니다.
- [x] 20개 이상의 설명형 Rule을 등록했습니다.
- [x] Builder와 Knowledge Base의 runtime 의존성을 분리했습니다.
- [x] registry 및 독립성 테스트를 추가했습니다.
- [x] 결과 중심 preset 선택 UX와 고급 Prompt 입력을 분리했습니다.
- [x] Research Rule과 Runtime Module의 승인 경계를 문서화했습니다.
- [ ] production preset별 업로드·옵션 폼을 연결합니다.
- [ ] 실제 generation 결과를 기반으로 `successRate`와 `failureTags`를 축적합니다.

## Related Documents

- [Prompt Engine](PROMPT_ENGINE.md)
- [Prompt Engineering](PROMPT_ENGINEERING.md)
- [AI Models](MODELS.md)
- [Image Pipeline](IMAGE_PIPELINE.md)
- [AI Generation](../02_Product/AI_GENERATION.md)
