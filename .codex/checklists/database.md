# Database

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

Database checklists는 AI Photo Studio 팀의 반복 가능한 개발 기준을 제공합니다.

## Goals

- 반복 작업의 판단 편차를 줄입니다.
- 안정성, 추적성, 검증 가능성을 유지합니다.

## Requirements

- 기존 기능과 공개 계약을 보존합니다.
- 예외는 담당자, 만료 조건, 후속 작업과 함께 기록합니다.

## Implementation

Database 작업의 승인 게이트로 사용하며 미충족 항목은 담당자와 예외 승인 근거를 기록합니다.

## Checklist

- [ ] 요구사항과 완료 기준이 연결됐다.
- [ ] 실패·롤백·보안 시나리오를 확인했다.
- [ ] 코드, 테스트, 문서, 관측성을 검증했다.
- [ ] 책임자와 승인자가 기록됐다.

## Related Documents

- [CODEX](../../CODEX.md)
