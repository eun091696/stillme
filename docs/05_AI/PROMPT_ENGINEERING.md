# Prompt Engineering

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

시스템 프롬프트와 사용자 프롬프트 조합 규칙을 관리합니다.

## Goals

- 안정성과 유지보수성을 우선합니다.
- 팀 간 계약과 책임을 명확히 합니다.

## Requirements

- 기존 기능과 문서 내용을 보존합니다.
- 변경 시 관련 문서와 검증 결과를 함께 갱신합니다.

## Implementation

템플릿은 버전 관리하고 재현 가능한 모델 설정과 함께 기록합니다.

운영 서비스 Runtime Prompt는 증명사진, 비즈니스 프로필, 프로필 사진, 물속 사진
보정과 캐릭터 프로필의 독립 파일로 관리합니다. 물속 사진 보정 v1.0.0은 장면,
장비, 동일인과 피부 특징을 보존하면서 색감과 빛만 복원합니다. 캐릭터 프로필
v1.0.0은 얼굴 비율과 개인 피부 특징을 유지하는 세미 리얼리스틱 3D 표현으로
제한합니다. 두 프롬프트는 기존 동일인 및 피부 보존 검증을 우회하지 않습니다.

비즈니스 프로필은 헤어 디자이너와 피트니스 트레이너를 결정론적으로 분류합니다.
직업별 모듈과 선택 스타일은 얼굴, 헤어, 피부, 체형을 직업 고정관념에 맞게
변형할 수 없으며 소품, 로고, 자격과 브랜드를 자동으로 만들지 않습니다.

## Checklist

- [ ] 책임 Agent가 내용을 검토했다.
- [ ] 구현 또는 운영 상태와 문서가 일치한다.
- [ ] 관련 변경 시 이 문서를 함께 갱신한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
