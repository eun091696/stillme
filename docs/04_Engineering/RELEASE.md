# Release Checklist

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

Release Checklist 영역의 기준과 현재 프로젝트 결정을 관리합니다.

## Goals

- 안정성과 유지보수성을 우선합니다.
- 팀 간 계약과 책임을 명확히 합니다.

## Requirements

- 기존 기능과 문서 내용을 보존합니다.
- 변경 시 관련 문서와 검증 결과를 함께 갱신합니다.

## Implementation

#### 제품

- [ ] MVP 범위의 필수 사용자 흐름을 검증했다.
- [ ] 빈 상태, 로딩, 오류 상태 문구를 검토했다.
- [ ] 모바일과 데스크톱 화면을 확인했다.

#### 품질

- [ ] `npm run lint`가 통과한다.
- [ ] `npm run build`가 통과한다.
- [ ] 접근성 핵심 항목을 점검했다.
- [ ] 주요 브라우저에서 생성과 다운로드를 확인했다.

#### 보안과 운영

- [ ] 비밀 값이 저장소에 포함되지 않았다.
- [ ] 인증·인가 규칙을 검증했다.
- [ ] 오류 추적과 주요 지표 대시보드를 준비했다.
- [ ] SLI query, error budget, multiwindow alert와 missing-data 상태를 검증했다.
- [ ] 모든 page에 owner, secondary, dashboard와 검증된 Runbook이 연결됐다.
- [ ] primary/secondary 알림 전달, acknowledgement, escalation과 silence expiry를 훈련했다.
- [ ] 로그·트레이스·메트릭·알림에 금지 데이터가 없는지 검사했다.
- [ ] 백업과 장애 대응 절차를 문서화했다.

#### 배포

- [ ] 프로덕션 환경 변수를 등록했다.
- [ ] DB 마이그레이션 계획을 검토했다.
- [ ] 롤백 절차를 확인했다.
- [ ] 출시 후 모니터링 담당자를 지정했다.

## Checklist

- [ ] 책임 Agent가 내용을 검토했다.
- [ ] 구현 또는 운영 상태와 문서가 일치한다.
- [ ] 관련 변경 시 이 문서를 함께 갱신한다.

## Related Documents

- [00_HOME](../00_HOME.md)
- [Monitoring Architecture](../03_Architecture/MONITORING.md)
- [Operations Monitoring](../07_Operations/MONITORING.md)
- [Observability Checklist](../../.codex/checklists/observability.md)
