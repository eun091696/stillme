# Model Evaluation

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

AI 모델의 품질, 비용, 지연 시간, 안전성을 비교하는 평가 체계를 정의합니다.

## Goals

- 팀 간 판단 기준을 통일합니다.
- 구현과 운영 상태를 문서와 일치시킵니다.

## Requirements

- 책임 Agent와 검토 Agent를 지정합니다.
- 변경은 관련 코드, 테스트, 문서와 함께 검토합니다.

## Implementation

### Current Baseline

| Dimension | Baseline | Gate |
| --- | --- | --- |
| Model | `google-gemini-image-v1` | Provider model과 adapter/prompt version 고정 |
| Output | Standard API, `1K`, image 1개 | 성공 output당 `$0.070` 이하 |
| Prompt | 최대 1,000자 | 계획 시 최대 4,000 input tokens |
| Client payload | App Router page별 gzip JS/CSS | 120 KiB 이하 |
| Single client asset | gzip JS/CSS | 64 KiB 이하 |
| Quality | PNG/JPEG/WebP 구조·크기·aspect 검증 | 기존 image-quality test 통과 |
| Latency | Hosted sample 없음 | production-like p50/p95 전에는 추정치 금지 |

`npm run performance:check`는 production build manifest와 실제 asset을 읽어
route별 중복 asset을 제거한 gzip payload를 측정합니다. `npm run validate`와
GitHub Quality job이 budget 초과를 차단합니다.

Model 변경은 동일 prompt corpus에서 quality, safety, p50/p95 latency와
estimated cost를 비교해야 합니다. 현재 live provider sample이 없으므로
latency baseline은 수립됐다고 주장하지 않으며 hosted evaluation은 Phase 9
release gate로 유지합니다.

## Checklist

- [x] 현재 model/output/cost와 client payload baseline을 고정했다.
- [x] Cost estimator와 build budget test를 CI에 연결했다.
- [ ] Hosted provider quality·latency sample과 usage export를 수집한다.

## Related Documents

- [00_HOME](../00_HOME.md)
- [AI Models](MODELS.md)
- [Cost Optimization](COST_OPTIMIZATION.md)
- [Quality Control](QUALITY_CONTROL.md)
- [Test Strategy](../04_Engineering/TEST.md)
