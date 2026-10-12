# Backend

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

Backend rules는 AI Photo Studio 팀의 반복 가능한 개발 기준을 제공합니다.

## Goals

- 반복 작업의 판단 편차를 줄입니다.
- 안정성, 추적성, 검증 가능성을 유지합니다.

## Requirements

- 기존 기능과 공개 계약을 보존합니다.
- 예외는 담당자, 만료 조건, 후속 작업과 함께 기록합니다.

## Implementation

입력 검증, 인증·인가, 도메인 처리, 영속화, 응답 변환을 분리하고 멱등성을 명시합니다.

## Checklist

- [ ] 범위와 소유자가 명확하다.
- [ ] 보안·데이터·운영 영향을 검토했다.
- [ ] 자동 검증과 수동 검증을 완료했다.

## Related Documents

- [CODEX](../../CODEX.md)
