# Work005-001 — Nano Banana Prompt Behavior Lab

## Public Prompt Reverse Engineering: Carat ID Photo

이 디렉터리는 Carat의 공개 증명사진 갤러리를 문장 단위로 복제하지 않고, AI Image Studio가 검증할 수 있는 Rule 단위로 분석한 연구 결과다.

## 범위

- 기준일: 2026-08-04 (Asia/Seoul)
- 필수 대상: Carat `id-photo` 공개 페이지에서 확인된 Prompt 8건
- 교차 근거: Google Gemini 이미지 생성 공식 문서, Google Cloud Nano Banana 공식 가이드, Google Gemini Cookbook
- 제외: 로그인·유료·비공개 자료, 이미지 생성, API 호출, Runtime/Builder/Registry 수정
- 상태 상한: `candidate` 또는 `review`; 이미지 실험 없이 `approved` 금지

## 결과물

| 파일 | 역할 |
|---|---|
| `prompt-analysis.md` | 8개 Prompt의 Rule 분해와 품질 평가 |
| `rule-taxonomy.md` | 계층형 Rule 체계와 중복 의미 분석 |
| `candidate-rules.json` | 기계 판독 가능한 후보 Rule |
| `module-mapping.md` | 기존 Prompt Engine 후보와의 존재·누락·중복·분리 분석 |
| `research-log.md` | 실제 조사 출처, 신뢰도, 범위·제외 기록 |
| `experiment-backlog.md` | Nano Banana 2/Pro 최소 비용 실험 후보 |

## 핵심 집계

- Carat 공개 Prompt: 8건 전부 조사
- 반복·중복 사례: 5건의 기본 증명사진 계열을 각각 조사한 뒤 의미 Rule로 통합
- Candidate Rule: 24개
- 기존 Work 002 Rule과 직접·부분 중복: 18개
- 기존 Rule의 책임 확장이 필요한 항목: 중복 18개 중 일부 5개
- 신규 Module 후보: 4개
- 서비스 범위 부적합으로 Reject: 3개 Prompt 전체 또는 일부 Rule
- 실제 이미지 생성: 0건

## Summary

Carat의 공개 증명사진 Prompt 8건을 모두 개별 분석하고, 반복되는 기본형도 occurrence 수준에서 보존한 뒤 의미 Rule만 통합했다. 원문을 Runtime에 복사하지 않았으며 24개의 독립 Rule 후보와 14개의 실험 backlog를 만들었다.

## Research Scope

증명사진·취업사진·학생증·프로필과 페이지 안에 함께 노출된 ID-photo 파생 합성 사례만 포함했다. Carat의 다른 갤러리 전체, 유료·로그인 자료, 실제 모델 호출은 포함하지 않았다.

## Sources Investigated

Google 공식 문서 2개, Google 공식 Cookbook 1개, Carat 공개 페이지 2개를 실제 확인했다. 상세 URL과 신뢰도는 `research-log.md`에 있다.

## Prompt Classification

단일 참조 인물 편집 5건, 인물+문서 레이아웃 1건, 2-image 물리 합성 1건, 2-person 창의 합성 1건이다. Runtime 검토 대상 5건, 현 Portrait MVP Reject/Research-only 3건으로 분류했다.

## Rule Taxonomy

`Source Contract → Subject Fidelity → Styling → Capture Simulation → Integration → Output Contract`의 6개 상위 영역으로 정리했다. 상세 계층은 `rule-taxonomy.md`에 있다.

## Candidate Rules

24개이며 18개는 Work 002 후보와 직접 또는 부분 중복(이 중 5개는 책임 분리·확장 필요), 4개는 완전 신규 Module 후보다. 나머지 2개는 기존 출력·레이아웃 책임의 명시화다. 모든 상태는 `candidate/review`이며 `approved`는 0개다.

## Duplicate Rules

`preserve/maintain/keep/retain/protect`는 동사 차이만으로 별도 Rule을 만들지 않는다. `front-facing/gaze`, `identity/facial geometry`, `natural/clean/neat`, `soft/even/shadowless`는 겉보기 유사하지만 서로 다른 제어축이라 분리한다.

## Missing Rules

주요 누락은 `source-of-truth`, `reference-role-assignment`, `occlusion-contact`, `brand-officiality`다. Skin, lighting, pose는 존재하지만 책임이 뭉쳐 있어 하위 축 분리가 필요하다.

## Prompt Engine Mapping

실제 코드 Repository가 없어 Work 002 후보·구현 명세를 현재 기준선으로 삼았다. 코드에 존재한다고 단정하지 않는다. 상세 매핑은 `module-mapping.md`에 있다.

## Nano Banana Experiment Backlog

Core identity 5개, Compiler/category 5개, 합성 연구 3개, NB2/Pro 비교 1개로 총 14개다. NB2를 우선 사용하고 기준 미달·복합 참조에서만 Pro 비교를 연다.

## Key Findings

1. Carat 기본형의 강점은 일관된 변수 순서지만 정체성 보존을 얼굴 특징 한 문장에 과도하게 맡긴다.
2. Source of Truth, Identity, Facial Geometry, Edit Boundary는 중복이 아니라 별도 실패축이다.
3. `official crop`은 스타일 지시이며 법정 제출 규격을 보장하지 않는다.
4. 합성 Prompt에서는 얼굴 묘사보다 reference role, z-order, contact shadow, material response가 중요하다.
5. Carat 성공 예시는 Nano Banana 효과 증거가 아니므로 공식 원리와 이식 가설을 분리해야 한다.

## Recommended Next Research

먼저 EXP-001/003/004로 identity contract를 고정하고, EXP-005/007/008로 grooming·positive framing·API output config를 검증한다. 브랜드를 제거한 synthetic fixture가 준비되기 전에는 Ki-Re-i 및 합성형 실험을 실행하지 않는다.

## 사용 원칙

`candidate-rules.json`은 Registry 입력물이 아니라 연구 후보 데이터다. 사람이 근거·충돌을 검토하고 Benchmark Dataset으로 실제 이미지 결과를 평가하기 전에는 Runtime Prompt에 적용하지 않는다.
