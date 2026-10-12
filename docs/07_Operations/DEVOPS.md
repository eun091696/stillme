# DevOps

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

CI/CD, 환경, 비밀 값, 인프라 변경 절차를 정의합니다.

## Goals

- 안정성과 유지보수성을 우선합니다.
- 팀 간 계약과 책임을 명확히 합니다.

## Requirements

- 기존 기능과 문서 내용을 보존합니다.
- 변경 시 관련 문서와 검증 결과를 함께 갱신합니다.

## Implementation

개발·스테이징·프로덕션을 분리하고 승인된 변경만 프로덕션에 반영합니다.
프로덕션 배포는 release annotation, SLI/query freshness, error-budget 상태,
primary/secondary 알림 전달과 연결된 Runbook 검증을 요구합니다. 오류 예산이 소진된
surface는 [Monitoring Architecture](../03_Architecture/MONITORING.md)의 정책에 따라
위험한 feature release를 중단합니다.

## Checklist

- [x] `observability-v1` 배포 및 오류 예산 경계가 연결됐다.
- [ ] 구현 또는 운영 상태와 문서가 일치한다.
- [ ] 관련 변경 시 이 문서를 함께 갱신한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Monitoring Architecture](../03_Architecture/MONITORING.md)
- [Operations Monitoring](MONITORING.md)
- [Operations Runbook](RUNBOOK.md)
