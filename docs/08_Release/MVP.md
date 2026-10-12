# MVP

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

MVP 영역의 기준과 현재 프로젝트 결정을 관리합니다.

## Goals

- 안정성과 유지보수성을 우선합니다.
- 팀 간 계약과 책임을 명확히 합니다.

## Requirements

- 기존 기능과 문서 내용을 보존합니다.
- 변경 시 관련 문서와 검증 결과를 함께 갱신합니다.

## Implementation

#### 목표

사용자가 가입 후 5분 안에 첫 AI 이미지를 생성하고 다운로드할 수 있게 합니다.

#### 포함

- 이메일 기반 회원가입과 로그인
- 텍스트 프롬프트 기반 이미지 생성
- 기본 스타일 및 비율 선택
- 생성 작업 상태와 결과 확인
- 결과 이미지 다운로드
- 사용자별 생성 이력

#### 제외

- 팀 협업과 권한 관리
- 모바일 네이티브 앱
- 고급 레이어 편집
- 외부 스토리지·디자인 도구 연동
- 사용자 학습 모델

#### 완료 기준

- 핵심 생성 흐름의 주요 오류가 사용자에게 명확히 안내됨
- 지원 브라우저에서 반응형 UI가 동작함
- 개인정보·생성 데이터 처리 정책이 문서화됨

## Checklist

- [ ] 책임 Agent가 내용을 검토했다.
- [x] 포함 기능이 테스트 가능한 Story ID와 인수 기준에 연결됐다.
- [ ] 구현 또는 운영 상태와 문서가 일치한다.
- [ ] 관련 변경 시 이 문서를 함께 갱신한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Feature Stories](../02_Product/FEATURES.md)
- [User Flow](../02_Product/USER_FLOW.md)
