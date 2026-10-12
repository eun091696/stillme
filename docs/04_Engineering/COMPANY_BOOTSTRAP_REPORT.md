# AI Company Bootstrap Report

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

AI Photo Studio 저장소를 다수 팀이 장기간 운영할 수 있는 내부 개발 표준으로 확장한 결과를 기록합니다.

## Goals

- 코드와 문서의 변경 계약을 팀 단위로 분리합니다.
- 기능 개발, 장애 대응, 보안, 데이터, 분석 업무를 반복 가능한 절차로 만듭니다.
- 기존 기능, API, 문서와 Git 이력을 보존합니다.

## Requirements

- `.codex` 규칙과 워크플로는 코드 변경 전에 확인합니다.
- 모든 Markdown은 표준 섹션과 상대 링크를 사용합니다.
- 문서, 린트, 타입, 빌드 검증이 실패한 변경은 완료로 간주하지 않습니다.

## Implementation

### 추가된 운영 계층

- Rules 18개
- Workflows 8개
- Templates 9개
- Prompts 9개
- Checklists 7개
- Memory 5개
- 장애 Playbooks 11개

### 추가된 도메인 문서

- Security 5개
- Data 4개
- Analytics 4개
- 신규 Agent 5개
- Business, Product, AI, API, Operations 확장 문서

### 자동화

- `npm run docs:bootstrap`: 누락된 회사 표준 문서 생성 및 형식 정규화
- `npm run docs:check`: 필수 섹션 순서, 상대경로, 링크 대상 검증

### 보존 정책

기존 문서의 Overview, 본문, Checklist, Related Documents는 새 표준으로 이동해 보존했습니다. 기존 App Router 코드의 동작은 변경하지 않았습니다.

## Checklist

- [x] `.codex` 구조를 생성했다.
- [x] Security, Data, Analytics 영역을 생성했다.
- [x] 13개 Agent 역할을 문서화했다.
- [x] 11개 장애 Playbook을 생성했다.
- [x] 문서 자동 검사를 구성했다.
- [ ] 변경사항을 검토하고 커밋한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Codex Rules](../../CODEX.md)
- [Agent Collaboration Guide](../../AGENTS.md)
- [Documentation Refactor Report](DOCUMENTATION_REFACTOR.md)
