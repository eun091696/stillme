# Prompt Engine Module Mapping

## 비교 기준

실제 애플리케이션 Repository는 이 작업공간에 없었다. 따라서 “현재 Prompt Engine” 비교는 Work 002의 24개 후보(`POR-*`)와 구현 명세에 한정한다. 코드 Registry에 실제 존재한다고 단정하지 않는다.

## 매핑 결과

| Candidate 기능 | 현재 후보 Module | 판정 | 권고 |
|---|---|---|---|
| 입력 사진을 유일한 인물 근거로 사용 | `core.operation` + `core.identity` | 책임 중복 | `core.source-of-truth`를 독립시켜 reference role을 명시 |
| 동일 인물 유지 | `core.identity` (`POR-C02`) | 존재 | 유지, 절대 수치 표현 제거 |
| 얼굴 구조 유지 | `core.facial-features` (`POR-C03`) | 존재 | identity와 분리 유지 |
| 피부색·질감·절제 보정 | `core.skin` (`POR-C04`,`POR-C11`) | 책임 중복 | tone / texture / retouch-intensity로 하위 분리 |
| 헤어 특징 유지 | `core.hair` (`POR-C05`) | 존재 | grooming change가 있을 때 override field 필요 |
| 요청 외 변경 금지 | `core.operation` + `core.restrictions` (`POR-C01`,`POR-C07`) | 책임 중복 | operation은 작업 선언, edit-boundary는 허용 속성 담당 |
| 얼굴 정면 / 렌즈 시선 | `id.pose` (`POR-ID01`) | 더 분리 필요 | `pose.head-orientation`, `gaze.target` 분리 |
| 표정 범위 | `core.expression` + category expression | 존재·충돌 가능 | core는 원래 인상 보존, category는 허용 delta만 지정 |
| 의상 | `business.wardrobe` (`POR-BIZ03`) | 부분 존재 | 공통 wardrobe module + category preset으로 승격 |
| 배경색 | `id.background` (`POR-ID05`) | 부분 존재 | exact color는 parameter, passport claim은 policy guard |
| 균일 조명 | `id.lighting` (`POR-ID04`) | 존재 | diffusion / uniformity / shadow / glare 분리 검토 |
| 크롭·비율 | `core.output`,`id.composition` (`POR-C12`,`POR-ID03`) | 책임 중복 | composition은 인물 배치, output은 API ratio/resolution |
| 합성 경계 일치 | `core.integration` (`POR-C08`) | 존재 | 유지 |
| 손가락 가림·접촉 순서 | 없음 | 신규 | `integration.occlusion-contact` 후보. 현 출시 범위에는 비활성 |
| 재질·반사·그림자 일치 | `core.integration` 일부 | 더 분리 필요 | `integration.material-response` 후보 |
| 다중 참조 역할 지정 | 없음 | 신규 | `core.reference-role-assignment`; image index→role schema |
| 다중 출력 동일성 | 없음 | 신규 | `layout.replication-consistency`; ID sheet 범위 밖 |
| 로고·브랜드 생성 제한 | 학생증 Rule 일부 (`POR-STU01`) | 부분 존재 | 전역 `safety.brand-mark` guard로 승격 |
| 텍스트·워터마크 제외 | `core.output`에 암묵적 | 더 분리 필요 | `output.exclusions` 배열로 명시 |

## 신규 Module 후보

| Module | 책임 | 활성 범위 |
|---|---|---|
| `core.source-of-truth` | 어떤 이미지의 어떤 속성이 기준인지 선언 | 모든 인물 편집 |
| `core.reference-role-assignment` | 복수 이미지의 subject/scene/style 역할 고정 | 다중 참조 작업 |
| `integration.occlusion-contact` | 앞뒤 관계, 접촉 그림자, 손가락 가림 보존 | 합성 작업; 현재 Portrait MVP 제외 |
| `safety.brand-mark` | 로고·상표·공식 문서 외관 모방 차단/검토 | 전역 |

## 책임 경계 권고

- `identity`: 누구인가
- `facial-geometry`: 얼굴 구조가 같은가
- `source-of-truth`: 어느 입력이 기준인가
- `edit-boundary`: 무엇을 바꿀 수 있는가
- `integration`: 바뀐 부분이 원본 물리 조건과 맞는가
- `output`: 파일·비율·오염 요소 계약
- `policy`: 제출 적합성·브랜드·허위 공식성

이 경계를 지키면 “얼굴 유지” 문구를 여러 Module에서 반복하는 대신, Compiler가 한 번만 강하게 배치할 수 있다.

