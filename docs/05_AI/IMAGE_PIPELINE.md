# Image Pipeline

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

이미지 생성 작업의 전체 처리 파이프라인을 정의합니다.

## Goals

- 안정성과 유지보수성을 우선합니다.
- 팀 간 계약과 책임을 명확히 합니다.

## Requirements

- 기존 기능과 문서 내용을 보존합니다.
- 변경 시 관련 문서와 검증 결과를 함께 갱신합니다.

## Implementation

검증 → 크레딧 예약 → 생성 → 기술 품질 검사 → 원본 대비 동일인·피부 semantic
검사 → 불변 staging key 업로드 → 형식·크기·decode·checksum 검증 → R2/DB
메타데이터 일치 → `available` 게시 → 정산 순서로 처리합니다. 저장 결과가 모호하면 성공이나 영구 크레딧 소비로 확정하지 않고 원래
job/asset identity로 조정합니다. 실패·고아·파생 객체와 다운로드 권한은
[Storage Architecture](../03_Architecture/STORAGE.md)를 따릅니다.

`/generate` Server Action이 이 pipeline의 trusted entry point입니다. DB
orchestration function은 job 생성과 예약, 성공 정산, 실패 환불을 각각 원자적으로
처리하며 request UUID를 idempotency key로 사용합니다. Provider와 R2 credential은
server-only 환경 변수에서만 읽고, client에는 설정 여부와 bounded 오류만
노출합니다.

source image bytes는 Google image adapter에 직접 전달합니다. Semantic gate는
Sharp로 원본과 결과를 최대 1,600px JPEG로 정규화해 AWS Rekognition
`CompareFaces`에 전달하고, identity를 통과한 결과만 Google skin validator에
전달합니다. Job에는 원문 파일명이나 public URL 대신 SHA-256 reference만
기록합니다. Validator와 error log에는 image bytes, 원문 prompt와 provider body를
남기지 않습니다. 검증된 output만 기존 private R2 staging/publish 계약과
owner-scoped asset row에 연결합니다. UI에는 준비·생성·마무리
상태와 결과만 보여 주고 내부 job state와 object key는 노출하지 않습니다.

최초 목표 후보는 3장이며 semantic 또는 기술 품질에 실패한 후보만 보충합니다.
Image generation 호출은 batch당 최대 5회이고 재귀 또는 무제한 재시도는 사용하지
않습니다. 5회 안에 3장이 통과하지 않으면 부분 결과를 게시하지 않고 reservation을
해제합니다. Semantic validator의 장애나 schema 오류도 fail-closed합니다.

Hair Designer 개발 환경의 서버 로그 `hair_designer.validation`은 같은 요청의
`request_id`, Prompt version, 후보 번호(1~3), 이미지 생성 호출 순서(1~5),
검증 단계, pass/fail/skipped/unavailable, 실제 반환 점수(0~1)와 threshold,
고정된 실패 코드를 기록합니다. 순서는 생성 이미지의 구조·비율 검사,
AWS CompareFaces의 동일인 점수(0.90 이상), AWS 통과 시 Gemini의 피부
보존 점수(0.72 이상)입니다. AWS 미통과 시 Gemini 피부 단계는 `skipped`,
점수는 `null`로 기록하고 결과 내부의 대체 skinScore 1을 실제 점수로
표시하지 않습니다. AWS 0점은 현재 adapter에서 매칭 없음과 얼굴 미검출을
구분하지 못합니다. Hair Designer에 별도 Gemini 동일인 점수는 없습니다.
로그는 `NODE_ENV=development`에서만 출력하고 DB·클라이언트·운영 로그에는
검증 점수, 원본 이미지, embedding, Prompt, API credential을 추가하지 않습니다.
최종 job 오류 코드는 그대로이며 검사 기준·재시도·Credit 처리는 변경하지 않습니다.

Non-production에서 R2 credential이 전혀 없으면 opaque key hash로 이름을 만든
private OS temporary file에 output을 저장하고 동일한 checksum 검증을 수행합니다.
다운로드 route는 인증과 owner RLS를 다시 확인합니다. 일부 R2 값만 설정된 경우와
production의 R2 누락은 local fallback 없이 거부합니다.

## Checklist

- [x] `storage-v1` publish 및 storage ambiguity 경계가 파이프라인에 연결됐다.
- [x] 생성 실행과 Credit reservation lifecycle이 원자적 DB function에 연결됐다.
- [x] 동일인·피부 검증 전 결과가 asset/storage에 게시되지 않게 했다.
- [x] 최초 3장에 대한 최대 5회 image generation 상한을 구현했다.
- [x] 구현 또는 운영 상태와 문서가 일치한다.
- [ ] 관련 변경 시 이 문서를 함께 갱신한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Storage Architecture](../03_Architecture/STORAGE.md)
- [REST API](../06_API/REST.md)
- [Data Retention](../10_Data/RETENTION.md)
