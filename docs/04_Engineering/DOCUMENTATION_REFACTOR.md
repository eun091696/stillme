# Documentation Refactor Report

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

문서 내용을 삭제하지 않고 팀 소유권, 변경 경계, 운영 책임을 기준으로 재구성한 결과입니다.

## Goals

- 안정성과 유지보수성을 우선합니다.
- 팀 간 계약과 책임을 명확히 합니다.

## Requirements

- 기존 기능과 문서 내용을 보존합니다.
- 변경 시 관련 문서와 검증 결과를 함께 갱신합니다.

## Implementation

### 이동 및 이름 변경

| 이전 경로 | 새 경로 |
| --- | --- |
| `docs/01_PRODUCT.md` | `docs/01_Business/PRODUCT.md` |
| `docs/02_ROADMAP.md` | `docs/01_Business/ROADMAP.md` |
| `docs/01_Business/사업기획서.md` | `docs/01_Business/BUSINESS_MODEL.md` |
| `docs/09_PAYMENTS.md` | `docs/01_Business/PAYMENTS.md` |
| `docs/08_CREDITS.md` | `docs/01_Business/CREDITS.md` |
| `docs/02_Product/기능명세서.md` | `docs/02_Product/FEATURES.md` |
| `docs/05_AUTH.md` | `docs/02_Product/AUTH.md` |
| `docs/13_UI_GUIDE.md` | `docs/02_Product/UI_GUIDE.md` |
| `docs/06_AI_GENERATION.md` | `docs/02_Product/AI_GENERATION.md` |
| `docs/10_ADMIN.md` | `docs/02_Product/ADMIN.md` |
| `docs/03_ARCHITECTURE.md` | `docs/03_Architecture/ARCHITECTURE.md` |
| `docs/04_DATABASE.md` | `docs/03_Architecture/DATABASE.md` |
| `docs/07_STORAGE.md` | `docs/03_Architecture/STORAGE.md` |
| `docs/11_SECURITY.md` | `docs/03_Architecture/SECURITY.md` |
| `docs/04_Engineering/시스템구조.md` | `docs/03_Architecture/SYSTEM_CONTEXT.md` |
| `docs/04_Engineering/DB설계.md` | `docs/03_Architecture/DATA_MODEL.md` |
| `docs/12_API.md` | `docs/06_API/REST.md` |
| `docs/14_TEST.md` | `docs/04_Engineering/TEST.md` |
| `docs/15_DEPLOYMENT.md` | `docs/04_Engineering/DEPLOYMENT.md` |
| `docs/16_FINAL_REPORT.md` | `docs/04_Engineering/FINAL_REPORT.md` |
| `docs/17_TODO.md` | `docs/04_Engineering/TODO.md` |
| `docs/02_Product/MVP범위.md` | `docs/08_Release/MVP.md` |
| `docs/08_Release/출시체크리스트.md` | `docs/04_Engineering/RELEASE.md` |

### 변경된 링크

- 루트 문서는 `docs/00_HOME.md`를 단일 문서 진입점으로 참조합니다.
- 모든 하위 문서의 홈 링크는 `../00_HOME.md` 상대경로로 통일했습니다.
- 문서 홈의 영역 링크를 실제 새 경로로 변경했습니다.
- 절대경로와 존재하지 않는 대상은 자동 검사에서 실패하도록 구성했습니다.

### 추가된 문서

- Business: `PRICING.md`
- Product: `USER_FLOW.md`, `PROMPTS.md`
- Architecture: `API.md`, `CACHE.md`, `LOGGING.md`, `MONITORING.md`
- Engineering: `CODING_STANDARD.md`, `CHANGELOG.md`
- AI: `MODELS.md`, `IMAGE_PIPELINE.md`, `PROMPT_ENGINEERING.md`, `COST_OPTIMIZATION.md`, `QUALITY_CONTROL.md`
- API: `WEBHOOKS.md`, `AUTHORIZATION.md`, `ERROR_CODES.md`
- Operations: `INCIDENT.md`, `BACKUP.md`, `OBSERVABILITY.md`, `DEVOPS.md`, `RUNBOOK.md`
- Release: `RELEASE_NOTE.md`, `VERSION_HISTORY.md`
- Root: `AGENTS.md`

### 중복 정리

- 삭제된 문서는 없습니다.
- `ARCHITECTURE.md`는 기술 구성, `SYSTEM_CONTEXT.md`는 시스템 경계와 원칙으로 책임을 분리했습니다.
- `DATABASE.md`는 저장소 원칙, `DATA_MODEL.md`은 테이블 상세로 책임을 분리했습니다.
- `AI_GENERATION.md`는 제품 동작, `IMAGE_PIPELINE.md`은 구현 파이프라인으로 책임을 분리했습니다.
- 배포 절차는 `DEPLOYMENT.md`, 운영 자동화는 `DEVOPS.md`, 출시 승인은 `RELEASE.md`로 분리했습니다.

### 추후 추천 문서

- `docs/03_Architecture/ADR.md`: 주요 기술 결정 기록
- `docs/02_Product/ACCESSIBILITY.md`: 접근성 기준
- `docs/07_Operations/SLO.md`: 서비스 수준 목표
- `docs/07_Operations/DATA_RETENTION.md`: 개인정보 및 생성물 보존 정책
- `docs/06_API/OPENAPI.md`: 기계 판독 가능한 API 계약 운영 지침

## Checklist

- [x] 기존 문서 내용을 보존했다.
- [x] 파일명을 영문 대문자 규칙으로 통일했다.
- [x] Markdown 섹션 순서를 통일했다.
- [x] 상대 링크와 깨진 링크를 검사했다.
- [x] 문서 소유권을 Agent 역할과 연결했다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Coding Standard](CODING_STANDARD.md)
- [Agent Collaboration Guide](../../AGENTS.md)
