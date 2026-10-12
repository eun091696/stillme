# 제품 정의

## Table of Contents

- [제품 개요](#overview)
- [목표](#goals)
- [요구사항](#requirements)
- [제품 정의](#implementation)
- [체크리스트](#checklist)
- [관련 문서](#related-documents)

## Overview

이 문서는 STILLME(내부 프로젝트명 AI Photo Studio)의 제품 목적, 대상 사용자, MVP 범위와 성공 기준을 관리하는 최상위 제품 계약이다.

## Goals

- 한국 사용자를 위한 안전하고 유용한 AI 이미지 생성 경험을 제공한다.
- 제품, engineering과 운영 팀이 동일한 제품 기준을 사용하게 한다.
- 구현 우선순위와 측정 기준을 명확하게 유지한다.

## Requirements

- 기존 기능과 승인된 제품 결정을 보존한다.
- 제품 범위 변경은 담당자, Acceptance Criteria와 측정 신호를 포함해야 한다.
- 변경 시 관련 문서와 검증 결과를 함께 갱신한다.

## Implementation

### Vision — 제품 비전

개인, creator와 소상공인이 정체성과 자연스러움을 지키면서 빠르고 안전하게 실제로 활용할 수 있는 이미지를 만들도록 돕는 한국 사용자 중심 AI 사진 생성 SaaS STILLME를 구축한다. 사용자 메시지는 “Different photo. Still you.”, 한국어로 “달라진 사진. 여전히 나.”를 사용한다.

### Target Users — 대상 사용자

- 개인 사용자
- Creator
- 소상공인

### MVP 범위

- 회원가입
- Credit 구매
- AI 이미지 생성
- 생성 이력 확인과 download

### Success Metrics — 성공 지표

성공 지표의 기준 결정은 [Business KPI](KPI.md)가 관리한다. 제품 성과는 다음 항목으로 평가한다.

- north-star metric인 주간 가치 실현 creator 수
- 인증 사용자 activation과 첫 이미지 생성 성공까지 걸린 시간
- 성공한 생성 결과의 download 비율과 D7 value retention
- 활성 사용자에서 유료 사용자로의 전환과 생성별 양의 contribution
- 생성 성공률, latency, payment-credit reconciliation과 zero-tolerance safety guardrail

`analytics-v1` 목표는 승인 전까지 출시 가설이며, 승인 후에도 조건을 충족한 production sample로 측정한다. 제품 문서는 현재 성과를 달성한 것으로 주장하지 않는다.

## Checklist

- [ ] 책임 Agent가 내용을 검토했다.
- [ ] 구현 또는 운영 상태와 문서가 일치한다.
- [ ] 관련 변경 시 이 문서를 함께 갱신한다.

## Related Documents

- [문서 Home](../00_HOME.md)
- [Business KPI](KPI.md)
- [Business Model](BUSINESS_MODEL.md)
- [기능 Story](../02_Product/FEATURES.md)
- [Analytics Event](../11_Analytics/EVENTS.md)
- [제품 Metric](../11_Analytics/METRICS.md)
