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
| Client payload | App Router page별 gzip JS/CSS | 기본 120 KiB; 아래 4개 route는 임시 140 KiB |
| Single client asset | gzip JS/CSS | 64 KiB 이하 |
| Quality | PNG/JPEG/WebP 구조·크기·aspect 검증 | 기존 image-quality test 통과 |
| Latency | Hosted sample 없음 | production-like p50/p95 전에는 추정치 금지 |

`npm run performance:check`는 production build manifest와 실제 asset을 읽어
route별 중복 asset을 제거한 gzip payload를 측정합니다. `npm run validate`와
GitHub Quality job이 budget 초과를 차단합니다.

2026-10-13 소유자 승인으로 `/`, `/generate`, `/generate/[service]`,
`/dev/image-generation`의 route별 상한만 임시 140 KiB로 조정했습니다.
현재 최대 실측은 약 134.4 KiB입니다. 기존 120 KiB와 새 140 KiB 모두
대상 기기·네트워크의 로딩 측정으로 검증된 성능 목표라는 근거는 없습니다.
이번 변경은 현 상태에서 추가 용량 증가를 제한하기 위한 임시 예산입니다.
나머지 route는 120 KiB, 개별 asset은 64 KiB이며 공통 JS/CSS도 합산합니다.
소유자와 Frontend owner는 다음 frontend/framework 변경 또는 모바일
로딩 측정 때 네 route 상한을 재검토해야 합니다. AI 생성 latency·cost
기준 및 보안 검사는 이 변경과 무관하게 유지합니다.

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
