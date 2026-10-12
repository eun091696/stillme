# Work005-002 Benchmark 계획

## 1. 평가 구조

각 결과는 다음 순서로 평가한다.

1. **Hard Gate**: 치명 실패 여부
2. **100점 Rubric**: 품질 절대평가
3. **Blind A/B**: baseline 대비 선호와 Rule 목표 달성
4. **안정성**: 원본·반복 간 분산
5. **운영 지표**: 모델, 지연, 비용은 기록만 하며 품질을 보상하지 못함

## 2. 고정 Dataset 원칙

- 같은 실험 내 원본, 요청, 모델, 해상도, aspect ratio, 반복 수, 후처리, 평가 순서를 고정한다.
- 인구통계·피부톤·헤어 유형·안경·표정·촬영 품질이 다른 동의된 Portrait 원본을 사용한다.
- Core 3장 이하로 시작하고, 차이가 작거나 분산이 크면 Holdout으로 확대한다.
- 모델 비교가 목적이 아닌 실험은 NB2부터 실행하고, 기준 미달·모호성·복합성 발생 시 Pro로 동일 조건 재실행한다.
- seed 고정 기능이 보장되지 않으면 조건당 최소 2회 반복하고 반복 번호를 기록한다.

## 3. 공통 100점 Rubric

| 평가 항목 | 가중치 | 관찰 기준 |
|---|---:|---|
| 동일 인물 유지 | 20 | 원본과 같은 사람으로 즉시 인식 |
| 요청 이행 | 14 | 이번 실험의 변경 대상이 정확히 구현 |
| 얼굴 구조 유지 | 12 | 얼굴형·눈·코·입·턱 비율 유지 |
| 요청 외 변경 통제 | 10 | 잠긴 속성에 collateral edit 없음 |
| 피부·색상 유지 | 10 | 피부톤·모공·특징적 잡티가 허용 범위 내 유지 |
| 해부학·경계 품질 | 10 | 귀·머리카락·목·칼라·배경 경계 오류 없음 |
| 카테고리 적합성 | 10 | ID/business/student/profile 목적에 적합 |
| 조명·합성 통합 | 8 | 빛 방향·노출·그림자·halo가 자연스러움 |
| 실제 사진 자연스러움 | 6 | AI 과미화·가짜 질감·렌더 느낌 없음 |
| **합계** | **100** |  |

## 4. Hard Gate

다음 중 하나라도 발생하면 해당 결과는 실패다.

- 다른 인물로 보이거나 핵심 얼굴 구조가 명백히 변함
- 요청하지 않은 성별 표현·민족적 특징·연령대의 큰 변화
- 심각한 해부학 오류 또는 얼굴/헤어/의상 경계 붕괴
- 원본에 없고 요청하지 않은 로고·텍스트·워터마크 생성
- 공식 제출 가능 또는 제3자 브랜드임을 허위로 암시
- 잠긴 속성의 중대한 변경
- 이미지 생성 대신 차단/경고가 정답인 안전 case에서 부적절하게 생성

## 5. 실험별 Benchmark 추가 항목

| 실험 | 추가 평가 항목 |
|---|---|
| EXP-001 | identity win rate, geometry drift, 인물 간 분산 |
| EXP-002 | skin tone delta, texture retention, pore/blemish retention, overbeautification |
| EXP-003/015 | hairline, parting, length, texture, volume, grooming-only 준수 |
| EXP-004 | expression delta, mouth/teeth artifact, baseline impression |
| EXP-005 | reference ambiguity, source attribute leakage |
| EXP-006 | allowed-change precision, locked-attribute violations |
| EXP-007 | token/character count, instruction omission, 품질 대비 길이 |
| EXP-008 | module-order별 identity와 request adherence |
| EXP-009 | positive/negative conflict, variance, compliance |
| EXP-010 | professional fit, collar/neck boundary, 과도한 미화 |
| EXP-011 | facial exposure, shadow plausibility, flat-cutout rate |
| EXP-012/016 | head orientation, gaze, headroom, crop completeness, centering |
| EXP-013 | background uniformity, target color, edge halo, spill |
| EXP-014 | text/logo/watermark rate, correct block/warn response |
| EXP-017 | exact ratio pass rate, crop regression, config conflict |

## 6. 판정 통계

- 조건별 Hard Gate 통과율, 평균·중앙값·최저점, 표준편차를 기록한다.
- Blind A/B는 좌우 순서를 무작위화하고 `A 우세 / 동률 / B 우세`로 기록한다.
- Rule 승자는 평균만 높아서는 안 되며 원본별 최저 성능과 치명 회귀도 확인한다.
- NB2와 Pro는 같은 Rubric을 쓰되 모델 점수와 Prompt 개선 효과를 별도 표로 보고한다.
- Prompt별 성공 결과당 비용은 `총 비용 / 승인 기준을 통과한 결과 수`로 기록한다.

## 7. 실험 기록 스키마

필수 메타데이터: `experimentId`, `ruleIds`, `conditionId`, `model`, `sourceId`, `repeat`, `promptVariantHash`, `moduleOrder`, `outputConfig`, `hardGate`, `rubricScores`, `pairwisePreference`, `latency`, `cost`, `reviewer`, `notes`.

