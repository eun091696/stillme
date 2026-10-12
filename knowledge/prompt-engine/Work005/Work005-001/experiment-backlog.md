# Nano Banana Experiment Backlog

실제 호출은 수행하지 않았다. 각 실험은 기존 Benchmark의 동일 원본·동일 출력 설정·블라인드 평가를 사용하고, 먼저 NB2로 최소 반복 후 차이가 모호한 경우에만 Pro로 확대한다.

| ID | 우선순위 | 가설 | 비교 조건 | 최소 생성 | 주요 지표 |
|---|---:|---|---|---:|---|
| EXP-001 | P0 | `same person` 단독보다 identity+facial geometry 분리가 드리프트를 줄인다 | Carat baseline vs 분리 Rule | 3원본×2×2회=12 | identity, geometry, win rate |
| EXP-002 | P0 | preserve/maintain/keep 동사 차이보다 보존 속성의 구체성이 더 중요하다 | 동사 3종, 동일 속성 / 단일 동사+상세 속성 | 2원본×4=8 | identity variance |
| EXP-003 | P0 | Source of Truth를 첫 문장에 두면 의상·배경 변경 중 얼굴 보존이 향상된다 | 선두/후미/없음 | 2원본×3=6 | identity, change control |
| EXP-004 | P0 | skin tone·texture·retouch 강도를 분리하면 플라스틱 피부가 감소한다 | `natural` 단독 vs 3축 Rule | 3원본×2=6 | texture, tone, naturalness |
| EXP-005 | P0 | Hair preservation과 grooming delta 분리가 취업사진의 헤어 교체를 줄인다 | `clean hair` vs preserve+tidy-only | 2원본×2=4 | hair fidelity, category fit |
| EXP-006 | P1 | head orientation과 gaze 분리가 정면 성공률을 높인다 | `front-facing` vs pose+gaze | 3원본×2=6 | pose, gaze |
| EXP-007 | P1 | 긍정형 `restrained retouch`가 긴 과보정 금지문보다 안정적이다 | positive vs negative vs both | 2원본×3=6 | skin, prompt adherence |
| EXP-008 | P1 | output 비율은 Prompt 문구보다 API imageConfig가 더 안정적이다 | text only / config only / both | 2원본×3=6 | exact ratio, crop |
| EXP-009 | P1 | `shadowless`보다 `soft minimal shadow`가 자연스러움을 높인다 | 두 lighting Rule | 2원본×2=4 | integration, naturalness |
| EXP-010 | P1 | category mood를 identity 이전에 두면 미화 드리프트가 커진다 | module order 3종 | 2원본×3=6 | identity, category fit |
| EXP-011 | P2 | 다중 참조 role assignment가 대상 혼합을 줄인다 | 암묵 역할 vs index-role schema | synthetic 2세트×2=4 | role accuracy |
| EXP-012 | P2 | 합성의 긍정적 물리 상태가 반복 Negative보다 z-order·재질을 잘 지킨다 | positive physics vs original-style negatives | synthetic 2세트×2=4 | occlusion, material, scale |
| EXP-013 | P2 | 한 Prompt의 8회 반복보다 1개 portrait 생성 후 deterministic layout이 신원 일관성이 높다 | direct sheet vs post-layout | 2원본×2=4 | identity variance, layout |
| EXP-014 | P2 | NB2와 Pro의 얼굴 보존 우열은 공식 근거가 없으며 복잡도에 따라 달라진다 | EXP-001/011 승자 Prompt를 양 모델 비교 | 조건당 2회 | quality/cost/latency |

## 실행 순서

1. EXP-001, 003, 004로 Core identity contract를 결정한다.
2. EXP-005~010으로 category preset과 compiler 순서를 결정한다.
3. EXP-011~013은 Portrait MVP 밖의 합성 연구 트랙에서만 실행한다.
4. EXP-014는 NB2 결과가 기준 미달이거나 복합 참조가 필요한 경우에만 실행한다.

## 승격 조건

- Hard Gate 통과율 100%
- 동일 인물·얼굴 구조 평균이 Benchmark 승인 기준 이상
- baseline 대비 블라인드 선호 우세와 치명 회귀 없음
- Core와 Holdout 모두 통과
- 비용·지연 포함 결과당 성공 비용 기록
- 위 조건 전까지 Rule 상태는 `candidate` 또는 `review`

