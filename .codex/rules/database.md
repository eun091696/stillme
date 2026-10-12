# Database

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

Database rules는 AI Photo Studio 팀의 반복 가능한 개발 기준을 제공합니다.

## Goals

- 반복 작업의 판단 편차를 줄입니다.
- 안정성, 추적성, 검증 가능성을 유지합니다.

## Requirements

- 기존 기능과 공개 계약을 보존합니다.
- 예외는 담당자, 만료 조건, 후속 작업과 함께 기록합니다.

## Implementation

UUID, 외래 키, 인덱스, RLS, 감사 필드와 무중단 마이그레이션 계획을 요구합니다.

## Checklist

- [ ] 범위와 소유자가 명확하다.
- [ ] 보안·데이터·운영 영향을 검토했다.
- [ ] 자동 검증과 수동 검증을 완료했다.

## Related Documents

- [CODEX](../../CODEX.md)
