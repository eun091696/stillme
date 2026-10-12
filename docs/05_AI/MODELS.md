# AI Models

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

지원 모델과 선택 기준을 관리합니다.

## Goals

- 안정성과 유지보수성을 우선합니다.
- 팀 간 계약과 책임을 명확히 합니다.

## Requirements

- 기존 기능과 문서 내용을 보존합니다.
- 변경 시 관련 문서와 검증 결과를 함께 갱신합니다.
- 기본 image model은 `gemini-3.1-flash-image`이며 Google AI REST `v1`
  `generateContent` endpoint만 사용합니다.
- 내부 model ID `google-gemini-image-v1`, adapter version `1`, prompt template
  version `style-v1`을 모든 성공 결과에 기록합니다.
- MVP output resolution은 provider 기본값과 일치하는 `1K`이며 model
  metadata와 cost baseline에 명시합니다.
- Provider model 변경은 새 내부 model version과 regression evidence가 필요합니다.
- `GOOGLE_AI_API_KEY`는 server-only이며 request URL, error, log 또는 client
  bundle에 포함하지 않습니다.
- 애플리케이션은 `flash`와 `pro` 내부 key만 사용하며 provider id를 호출부에
  반복하지 않습니다. 각각 `gemini-3.1-flash-image`(Nano Banana 2)와
  `gemini-3-pro-image`(Nano Banana Pro)에 매핑됩니다.
- 지원 해상도 타입은 공식 문서의 대문자 `1K`, `2K`, `4K`만 허용합니다.
- Provider response는 지원 image MIME type과 bounded base64 payload를
  검증한 뒤에만 내부 결과로 변환합니다.

## Implementation

품질, 지연 시간, 단가, 안전성, 지원 해상도를 기준으로 모델을 승인합니다.

### Implemented Adapter

`src/lib/generation/google-adapter.ts`는 validated generation request를 Google AI
request로 변환합니다. Transport를 주입할 수 있어 credential이나 network 없이
contract test가 가능하며, 일시적인 `429`와 `5xx`만 retryable provider failure로
분류합니다. 결제 설정 문제를 명시한 `429`는 재시도로 해결되지 않으므로
`PROVIDER_ACCESS_DENIED`로 분류합니다. Provider response body는 application error에
포함하지 않습니다.

현재 model ID와 REST contract는 2026-07-28 Google AI 공식 image-generation
문서를 기준으로 검증했습니다. Model을 교체하거나 Google contract가 변경되면 이
문서, registry metadata와 adapter test를 같은 변경에서 갱신합니다.

### Local environment example

실제 키는 저장소에 기록하지 않고 사용자가 로컬 `.env.local`에 직접 입력합니다.

```dotenv
GOOGLE_AI_API_KEY=사용자가*발급한*키
GOOGLE_IMAGE_DEFAULT_MODEL=gemini-3.1-flash-image
GOOGLE_IMAGE_PRO_MODEL=gemini-3-pro-image
IMAGE_CREDIT_BYPASS=true
```

`IMAGE_CREDIT_BYPASS`는 서버에서만 평가하며 production에서는 항상 fail-closed
입니다. API key가 없으면 adapter가 Google 호출 전에 명확한 설정 오류를 반환합니다.

## Checklist

- [x] Google AI model adapter와 version metadata를 구현했다.
- [x] Nano Banana 2/Pro 모델 key와 `1K`/`2K`/`4K` validation을 구현했다.
- [x] 구현 또는 운영 상태와 문서가 일치한다.
- [ ] 관련 변경 시 이 문서를 함께 갱신한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Image Pipeline](IMAGE_PIPELINE.md)
- [Cost Optimization](COST_OPTIMIZATION.md)
- [Model Evaluation](MODEL_EVALUATION.md)
- [AI Generation](../02_Product/AI_GENERATION.md)
