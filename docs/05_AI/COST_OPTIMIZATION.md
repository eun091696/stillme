# AI Cost Optimization

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

생성 품질을 유지하면서 단위 비용을 통제합니다. 이 문서는 runtime 청구
원장이 아니라 모델 선택과 가격 검토에 사용하는 versioned planning
baseline입니다.

## Goals

- 성공 생성 한 건과 예상 volume의 provider 비용을 동일한 공식으로 계산합니다.
- 모델·해상도·가격 변경이 기존 상품의 margin을 조용히 훼손하지 못하게 합니다.
- client performance와 AI provider 비용을 CI에서 독립적으로 검증합니다.

## Requirements

- 기준 모델은 `google-gemini-image-v1` / `gemini-3.1-flash-image`입니다.
- MVP output은 provider 기본값과 일치하는 `1K`, Standard API, image 1개입니다.
- 공식 가격 기준일은 2026-07-30이며 1K image output은 `$0.067`,
  text/image input은 `$0.50 / 1M tokens`입니다.
- 최대 1,000자 prompt는 보수적으로 4,000 input tokens까지 계획합니다.
- 성공 생성 budget은 `$0.070`이며 text output과 추가 image는 별도 비용으로
  계산합니다.
- 계획 환율은 기존 pricing stress contract와 같은 `₩1,600/USD`입니다.
- 가격·모델·해상도·환율 변경은 estimator, unit test, pricing sensitivity와
  문서를 같은 PR에서 갱신해야 합니다.

## Implementation

`src/lib/generation/cost.ts`는 floating-point 누적 대신 integer microusd로
input token, text output과 성공 image 수를 계산합니다. 현재 최대 계획
input과 1K image 한 건은 `$0.069`, `₩110.4`이며 `$0.070` budget 안입니다.
10,000건 계획 원가는 `$690`입니다.

Provider가 image를 반환하지 않은 실패의 실제 과금은 provider usage export로
확인해야 합니다. Timeout처럼 결과가 모호한 요청은 성공으로 추정해 중복
재시도 비용을 숨기지 않습니다. Runtime usage ingestion과 budget alert는
Phase 9 automation 범위입니다.

공식 가격은 [Gemini Developer API Pricing](https://ai.google.dev/gemini-api/docs/pricing)에서
확인합니다.

## Checklist

- [x] 현재 model, resolution, 공식 가격과 planning 환율을 version으로 고정했다.
- [x] 단위·volume·추가 output·invalid counter test를 구현했다.
- [x] 성공 생성 budget을 CI validation에 연결했다.
- [ ] Provider usage export와 실제 청구 오차를 production-like 환경에서 검증한다.
- [ ] 기존 상품 margin 재승인을 완료한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [AI Models](MODELS.md)
- [Model Evaluation](MODEL_EVALUATION.md)
- [Pricing](../01_Business/PRICING.md)
- [Test Strategy](../04_Engineering/TEST.md)
