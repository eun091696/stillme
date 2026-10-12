# AI Generation Failure

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

AI 생성 실패, 크레딧 복구, 재처리를 수행합니다.

## Goals

- 사용자 영향을 최소화합니다.
- 안전하게 복구하고 재발 방지 근거를 남깁니다.

## Requirements

- 요청 ID, 사용자 영향, 시작 시각을 기록합니다.
- 승인 없는 데이터 수정이나 파괴적 명령을 실행하지 않습니다.

## Implementation

1. 영향 범위와 심각도를 확인합니다.
2. 최근 변경과 의존 서비스 상태를 확인합니다.
3. 가장 안전한 완화책을 적용합니다.
4. 복구와 데이터 정합성을 검증합니다.
5. 타임라인과 후속 조치를 기록합니다.

## Checklist

- [ ] 소유자가 내용을 검토했다.
- [ ] 구현 또는 운영 상태와 일치한다.
- [ ] 관련 테스트와 모니터링을 확인했다.

## Related Documents

- [README](../README.md)
