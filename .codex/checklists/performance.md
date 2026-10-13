# Performance

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

Performance checklists는 AI Photo Studio 팀의 반복 가능한 개발 기준을 제공합니다.

## Goals

- 반복 작업의 판단 편차를 줄입니다.
- 안정성, 추적성, 검증 가능성을 유지합니다.

## Requirements

- 기존 기능과 공개 계약을 보존합니다.
- 예외는 담당자, 만료 조건, 후속 작업과 함께 기록합니다.

## Implementation

Performance 작업의 승인 게이트로 사용하며 미충족 항목은 담당자와 예외 승인 근거를 기록합니다.

현재 자동화 예산은 production App Router page gzip payload 기본 120 KiB,
2026-10-13 소유자 승인 네 route(`/`, `/generate`, `/generate/[service]`,
`/dev/image-generation`)는 임시 140 KiB, 개별 JS/CSS asset은 64 KiB입니다.
140 KiB는 현재 최대 약 134.4 KiB를 기준으로 추가 증가를 제한하는 임시
상한이며, 기존 120 KiB와 새 상한의 실사용 로딩 근거는 미확인입니다.
소유자와 Frontend owner가 다음 frontend/framework 변경 또는 모바일
로딩 측정 때 재검토하며, 새 route·개별 asset에 예외를 확대하지 않습니다.
공통 JS/CSS와 실패 exit는 그대로 유지합니다. Gemini 3.1 Flash Image 1K 성공 생성
`$0.070`입니다. `npm run validate`가 build와 두 코드 기반 budget을
검증합니다. Hosted latency와 실제 provider usage는 production-like 환경
확보 전까지 미검증으로 유지합니다.

## Checklist

- [x] Client payload와 AI 성공 생성 budget이 완료 기준에 연결됐다.
- [x] Budget 초과와 invalid cost counter가 fail closed로 검증됐다.
- [x] 코드, 테스트, build와 문서를 CI validation에 연결했다.
- [x] Frontend와 AI Engineer가 각 budget owner로 기록됐다.
- [ ] Hosted p50/p95 latency와 실제 provider usage 오차를 검증한다.

## Related Documents

- [CODEX](../../CODEX.md)
