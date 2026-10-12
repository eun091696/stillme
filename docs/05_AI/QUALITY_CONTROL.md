# AI Quality Control

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

생성 결과의 기술적·정책적 품질 기준을 정의합니다.

## Goals

- 안정성과 유지보수성을 우선합니다.
- 팀 간 계약과 책임을 명확히 합니다.

## Requirements

- 기존 기능과 문서 내용을 보존합니다.
- 변경 시 관련 문서와 검증 결과를 함께 갱신합니다.
- 기술 품질 실패는 asset publication 전에 bounded error로 거부합니다.
- 검증은 원문 prompt, image bytes 또는 provider body를 error에 포함하지 않습니다.
- 최대 dimension은 4,096px, 최대 pixel 수는 16,777,216, encoded file은
  20MiB 이하입니다.
- 최초 후보 3장을 준비하기 위한 image generation 호출은 최대 5회로 제한합니다.
- Semantic validator가 unavailable이거나 응답 schema가 유효하지 않으면 검증되지
  않은 결과를 게시하지 않고 fail-closed합니다.

## Implementation

파일 무결성, 해상도, 안전 필터, 중복, 사용자 신고 흐름을 검사합니다.

### Implemented Technical Gate

`image-quality-v1`은 PNG signature와 chunk boundary, CRC, zlib inflate,
dimension, pixel budget, aspect ratio와 prohibited metadata를 검사합니다.

### Identity and Skin Semantic Gate

`aws-identity-google-skin-v1`은 AWS Rekognition `CompareFaces`로 원본과 결과의
동일인 유사도를 계산하고, identity가 통과한 결과만 Gemini Flash Lite에 전달해
피부 보존 점수를 구조화된 JSON으로 받습니다. Server-owned threshold는 identity
`0.90`, skin `0.72`이며 provider가 반환한 boolean은 신뢰하지 않습니다. 원본에
없는 점·트러블·반점·흉터, plastic skin과 얼굴 구조 변경을 거부 대상으로
평가합니다. Identity 실패 시 Gemini 호출을 생략해 검증 비용을 제한합니다. AWS
credential에는 `rekognition:CompareFaces`만 허용하는 최소 권한 policy를 사용합니다.

거부된 결과는 asset row나 storage object로 게시하지 않습니다. 같은 후보 prompt에
server-owned 보정 지침을 추가하고 최초 batch에서 최대 두 번만 보충 생성합니다.
세 결과가 다섯 번의 image generation 호출 안에 준비되지 않으면 전체 batch를
실패 처리하고 예약 Credit을 해제합니다. Validator 호출도 생성 결과당 한 번으로
제한합니다.

AWS와 Google validator endpoint의 실제 response와 threshold 정확도는 hosted
synthetic/consented evaluation 전까지 production 품질 evidence로 간주하지
않습니다. Content safety moderation, perceptual duplicate detection과 사용자 신고는
후속 Milestone입니다.

## Checklist

- [x] Technical image quality gate를 구현하고 negative test를 추가했다.
- [x] 동일인·피부 semantic gate와 최대 5회 bounded generation unit test를 추가했다.
- [ ] Hosted sample로 validator model compatibility와 threshold를 보정한다.
- [x] 구현 또는 운영 상태와 문서가 일치한다.
- [ ] 관련 변경 시 이 문서를 함께 갱신한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
