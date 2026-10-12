# Work006 — Nano Banana Validation Guide

## 1. 범위

Work005-001의 Candidate Rule과 Work005-002의 실험 설계만 검증 대상으로 삼는다. Prompt 문구, Runtime Prompt, Prompt Engine, Builder, Registry, Module은 생성하거나 수정하지 않는다. 실제 실행자는 이 문서에 정의된 조건 ID에 기존 실험용 Prompt variant를 연결한다.

## 2. 공통 실험 프로토콜

1. 동의받은 동일 원본 사진을 한 Case의 모든 조건에 사용한다.
2. Baseline(`A`)과 Rule 적용 조건(`B`) 사이에는 `변경되는 변수` 하나만 다르게 한다.
3. 모델, 원본, 요청, 해상도, 비율, 출력 설정, 후처리, 반복 수, Rule 순서와 평가 순서를 고정한다.
4. NB2와 Pro는 동일 Case로 각각 실행하되 점수를 합치지 않는다.
5. seed 고정이 불가능하면 조건별 최소 2회 반복하고 반복 번호를 기록한다.
6. 평가자는 조건명을 가린 상태로 원본과 결과를 나란히 본다.
7. 각 결과를 7개 항목, 각 1~5점으로 평가한다.
8. 총점 31점 이상이며 `동일인 유지=5`, `얼굴 구조 유지=5`일 때만 Pass다.
9. 한 반복이라도 다른 사람처럼 보이거나 얼굴 구조가 명백히 변하면 해당 조건은 Fail로 기록한다.

## 3. 공통 고정 변수

- 같은 단일 인물 원본과 같은 crop
- 같은 사용자 요청과 허용 변경 목록
- 같은 모델 및 모델 버전
- 같은 해상도·aspect ratio·출력 형식
- 같은 P0 winner Core(해당 Rule 자체를 검증하는 Case에서는 대상 Rule만 제외)
- 같은 배경·조명·의상·구도·표정 요구
- 같은 반복 횟수와 후처리 없음

## 4. Case 실행 순서

CASE-001~007을 먼저 수행한다. 해당 Case의 승자 조건은 아직 Approved Rule이 아니며 Phase 1의 임시 고정값으로만 사용한다. 그 뒤 CASE-008~010에서 이 임시 고정값을 잠그고 카테고리 Rule 효과를 검증한다.

## 5. 공통 기록 필드

`caseId`, `conditionId`, `model`, `modelVersion`, `sourceId`, `repeat`, `variantHash`, `changedVariable`, `fixedVariablesHash`, `outputConfig`, `scores`, `total`, `identityGate`, `geometryGate`, `decision`, `failureCodes`, `reviewer`, `notes`.

## 6. 판정

- **Pass**: 31점 이상, 동일인 5점, 얼굴 구조 5점.
- **Fail**: 총점 30점 이하 또는 두 필수 항목 중 하나라도 4점 이하.
- **Inconclusive**: 단일 변수 원칙 위반, 출력 누락, 실행 조건 불일치. 재실행하며 Pass로 간주하지 않는다.
- Pass는 Rule 승인이 아니다. Phase 1 결과는 Review 입력으로만 전달한다.

## 7. Case 요약

| Case | 이름 | 검증 Rule | Work005 연결 |
|---|---|---|---|
| CASE-001 | 동일인 보존 | CARAT-R002 | EXP-001 |
| CASE-002 | 얼굴 구조 보존 | CARAT-R003 | EXP-001 |
| CASE-003 | 피부 보존 | CARAT-R007, R008 | EXP-002 |
| CASE-004 | 헤어 보존 | CARAT-R005 | EXP-003 |
| CASE-005 | 표정 보존 | CARAT-R004, R011 | EXP-004 |
| CASE-006 | Source of Truth | CARAT-R001 | EXP-005 |
| CASE-007 | Edit Boundary | CARAT-R019 | EXP-006 |
| CASE-008 | 비즈니스 프로필 | R012~R015 | EXP-010 |
| CASE-009 | 학생증 | R004, R006, R011~R015 | Work005 P04 + category mapping |
| CASE-010 | 자연 프로필 | R004, R011~R015 | Work005 P01 + category mapping |

세부 조건은 `validation-cases.json`, 채점은 `benchmark-scorecard.md`, 패턴 판정은 `failure-patterns.md`와 `success-patterns.md`, 실행 전후 확인은 `validation-checklist.md`를 사용한다.
