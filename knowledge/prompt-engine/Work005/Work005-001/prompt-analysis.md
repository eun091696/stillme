# Prompt Analysis

## 평가 방법

각 Prompt는 공개 페이지에서 확인했지만 원문은 재수록하지 않았다. `명확성 20 + 정체성 제어 20 + 편집 경계 15 + 사진 제어 15 + 출력 계약 10 + 안전성 10 + Nano Banana 이식성 10 = 100`으로 평가한다. 점수는 공개 Prompt 설계 품질이며 실제 결과 품질 보장은 아니다.

## 분류 요약

| P-ID | 공개 제목 | 원 모델 | 유형 | 점수 | KB 판정 |
|---|---|---|---|---:|---|
| P01 | Profile ID Photo | GPT Image 2 | 단일 참조 인물 편집 | 78 | Candidate |
| P02 | Business ID Photo | GPT Image 2 | 단일 참조 인물 편집 | 83 | Review |
| P03 | Job Application ID Photo | GPT Image 2 | 단일 참조 인물 편집 | 84 | Review |
| P04 | Student ID Photo | GPT Image 2 | 단일 참조 인물 편집 | 80 | Review |
| P05 | Ki-Re-i ID Photo Sheet | GPT Image 2 | 인물+문서 레이아웃 생성 | 55 | Reject |
| P06 | ID Photo in Transparent Phone Case Composite | GPT Image 2 | 2-image 물리 합성 | 74 | Reject for Portrait MVP / Research only |
| P07 | Two Passport Photos Shot | Nano Banana Pro | 2-person 소품 합성 | 62 | Reject for ID service / Research only |
| P08 | Clean Basic ID Photo | GPT Image 2 | 단일 참조 인물 편집 | 82 | Review |

## P01 — Profile ID Photo

- 목적: 이력서·LinkedIn에 가까운 친근한 프로필형 증명사진.
- Rule 분해:
  - Source of Truth: 첨부 인물 사진을 참조 대상으로 지정.
  - Identity: 얼굴 특징의 자연스러운 유지.
  - Expression: 따뜻한 미소.
  - Wardrobe: 밝은 중성 계열 재킷.
  - Background: 따뜻한 회색 스튜디오 톤.
  - Lighting: 깨끗한 조명이나 방향·그림자 조건은 없음.
  - Composition: 정면, 가슴 위 크롭, 세로 3:4.
  - Output/Safety: 이력서·프로필 분위기, 텍스트·워터마크 제외.
- 좋은 점: 용도·표정·의상·배경·크롭이 한 문단에서 일관되고 관찰 가능한 결과 상태를 준다.
- 약점: “자연스럽게 유지”만으로 얼굴 구조·피부·헤어·허용 변경 범위가 보호되지 않는다. `official` 표현은 실제 규격을 보장하지 않는다.
- NB 기대: 구체적 subject/lighting/composition과 긍정형 상태 지정은 공식 가이드와 부합. 정체성 성능은 실험 필요.
- 점수 78: 미적 프로필에는 명확하지만 엄격한 편집 경계가 약함.
- 출처: S04(7/10), 공식 원리 S01·S02(10/10).

## P02 — Business ID Photo

- 목적: 전문적이고 신뢰감 있는 비즈니스 프로필.
- Rule 분해:
  - Identity: 얼굴 특징과 인상을 유지.
  - Expression: 명시적 미소 수준 없음; 전문적 인상으로 간접 지정.
  - Wardrobe: 어두운 정장과 흰 셔츠.
  - Background: 밝은 회색 스튜디오.
  - Lighting: 부드럽고 균일.
  - Composition: 정면, 가슴 위, 3:4.
  - Skin/Edit Boundary: 과한 보정 제한.
  - Safety: 텍스트·워터마크 제외.
- 좋은 점: 용도에 맞는 의상·배경·조명이 서로 충돌하지 않고 최소 보정 제한이 포함된다.
- 약점: 실제 의상 변경을 허용하는지, 원래 헤어·피부색·얼굴 구조를 어디까지 보존하는지 불명확하다.
- NB 기대: 구체성·카메라/구도 제어 원칙과 부합. `과한 보정 금지`는 긍정형 `restrained retouch`로 컴파일하는 실험 가치가 있음.
- 점수 83: 기본형 중 균형이 가장 좋지만 Source Contract가 불완전.
- 출처: S04·S05(7/10), S01·S02(10/10).

## P03 — Job Application ID Photo

- 목적: 채용 지원용 신뢰감·전문성 강조.
- Rule 분해:
  - Identity/Source: 참조 사진의 얼굴과 실제 인상 유지.
  - Hair/Grooming: 깔끔한 헤어와 단정한 인상.
  - Wardrobe: 네이비 블레이저.
  - Background: 흰색.
  - Lighting: 부드러운 스튜디오 조명.
  - Composition: 정면, 가슴 위, 3:4.
  - Negative/Safety: 과한 보정, 텍스트, 워터마크 제외.
- 좋은 점: “실제 인상”과 최소 보정 제한을 함께 둬 과미화 위험을 인지한다.
- 약점: grooming 지시가 헤어스타일 교체로 번질 수 있고, 흰 배경·정장은 공식 채용 규격이 아니라 스타일 preset이다.
- NB 기대: 명확한 스타일 변수는 적합. Hair preservation과 grooming delta를 분리해야 정체성 회귀를 줄일 가능성이 있음.
- 점수 84: 목적 적합성이 높고 실패 방지 표현이 있으나 change budget이 없음.
- 출처: S04(7/10), S01·S02(10/10).

## P04 — Student ID Photo

- 목적: 학생증·교육기관 프로필용 단정하고 젊은 분위기.
- Rule 분해:
  - Identity: 얼굴 특징 유지.
  - Expression: 자연스러운 미소만 허용하는 envelope.
  - Wardrobe: 흰 셔츠.
  - Hair: 깔끔한 헤어스타일.
  - Background: 밝은 청회색.
  - Lighting: 부드럽고 균일.
  - Composition: 정면, 가슴 위, 3:4.
  - Safety: 텍스트·워터마크 제외.
- 좋은 점: 표정의 최대 범위를 제한하고 학생용 시각 변수를 일관되게 지정한다.
- 약점: 기관별 비율·배경 규격을 무시할 수 있고, 교복·로고를 만들지 말라는 guard가 없다. “젊게” 재해석될 여지가 있음.
- NB 기대: positive framing과 구조는 부합. apparent-age preservation을 함께 넣는 A/B 필요.
- 점수 80: 카테고리 preset은 좋지만 기관 규격과 허위 소속 guard가 빠짐.
- 출처: S04(7/10), S01·S02(10/10).

## P05 — Ki-Re-i ID Photo Sheet

- 목적: 일본식 증명사진 부스 인쇄물의 레이아웃·질감·텍스트를 재현.
- Rule 분해:
  - Source/Identity: 한 참조 인물을 8개 사진에 반복.
  - Composition: 얼굴 중심 3:4 자동 크롭, 2×4 반복 그리드, 영역 비율 지정.
  - Camera/Color: 약한 소프트 포커스, +0.5 EV, 블룸, 저채도, 초기 디지털카메라 질감.
  - Background: 사진은 파란색, 시트는 격자 종이.
  - Output: 가로형 스캔 문서, 회전된 일본어 텍스트.
  - Safety: 왜곡 금지, 그림자·3D 효과 제외.
  - Brand: 특정 상표명·로고 형상·기업 스타일의 정밀 복제.
- 좋은 점: 복잡한 레이아웃을 영역·비율·반복 수·회전 방향까지 계층화했다.
- 약점: 과도하게 길고 중복된 형상 설명, 인물 보존 규칙은 약함, 텍스트와 로고 복제에 의존하며 브랜드 모방 위험이 큼. 증명사진 MVP 범위도 아님.
- NB 기대: Pro의 복합 레이아웃·텍스트 처리 실험에는 유익하지만 브랜드 요소를 제거한 synthetic fixture로만 테스트해야 함.
- 점수 55: 제어 밀도는 높지만 법적·범위·유지보수 위험 때문에 Runtime 후보로 부적합.
- 출처: S04(7/10); NB 복합 이미지 기능 S01(10/10).

## P06 — Transparent Phone Case Composite

- 목적: 두 번째 증명사진을 첫 번째 거울셀카의 투명 폰 케이스 내부에 실제 인쇄물처럼 합성.
- Rule 분해:
  - Reference Role: image 1=scene/phone/hand, image 2=insert portrait.
  - Edit Boundary: 폰 외관·색·렌즈·참조 증명사진 보존.
  - Scale/Placement: 카메라 렌즈 크기를 기준으로 매우 작게 배치, 렌즈 비침범.
  - Occlusion: 손가락이 삽입 사진을 자연스럽게 가려야 함.
  - Material/Lighting: 광택·반사·난반사·접촉 그림자·색온도·해상도 일치.
  - Negative: 평면 스티커, 떠 보임, 잘못된 z-order, 과대 크기 방지.
- 좋은 점: 합성 실패를 공간 관계·재질·빛·스케일로 구체화하며 다중 참조의 역할이 명확하다.
- 약점: Negative 반복이 많고 서로 유사한 금지를 여러 번 말한다. 증명사진 생성 서비스가 아니라 scene compositing이다.
- NB 기대: 다중 이미지와 일관성 기능에 맞는 좋은 behavior test. `positive physical state` 대 `negative repetition` 실험에 적합.
- 점수 74: 합성 물리학은 강하지만 장황하고 현 MVP 범위 밖.
- 출처: S04(7/10), 다중 참조 기능 S01(10/10).

## P07 — Two Passport Photos Shot

- 목적: 두 사람의 작은 인화 사진이 종이컵 실전화기로 연결된 유머러스한 합성.
- Rule 분해:
  - Reference Role: 남성·여성 각 참조 인물 역할.
  - Identity/Hair: 각 인물의 얼굴·헤어 유사성 강제.
  - Wardrobe/Background: 흰 칼라 셔츠, 파란 배경.
  - Expression/Pose: 웃음·혀·컵 동작 등 큰 표정 변경.
  - Composition/Interaction: 두 인화물을 나란히 들고 실로 연결.
- 좋은 점: 두 인물과 소품의 역할·좌우 위치·상호작용을 구분한다.
- 약점: `100% similar`는 검증 불가능하고, 큰 표정·포즈 변화가 정체성과 충돌한다. passport라는 명칭은 공식 제출 사진으로 오해될 수 있다.
- NB 기대: Pro 표기 사례이나 성공률·설정·반복 정보가 없어 모델 우수성 근거로 사용할 수 없음.
- 점수 62: 창의 합성 아이디어는 명확하지만 증명사진 품질 Rule로는 충돌이 큼.
- 출처: S04(7/10), 게시물 연결 X 원출처는 권리범위 미확인.

## P08 — Clean Basic ID Photo

- 목적: 공식 문서 느낌의 가장 단순한 기본 증명사진.
- Rule 분해:
  - Identity: 얼굴 특징과 인상 유지.
  - Expression: 무표정에 가까운 자연스러운 표정.
  - Wardrobe: 검정 상의.
  - Background: 흰색.
  - Lighting: 그림자 없는 부드러운 빛.
  - Composition: 정면, 가슴 위, 3:4.
  - Output: 단정한 문서용 인상, 텍스트·워터마크 제외.
- 좋은 점: 변수 수가 적고 충돌이 낮아 baseline으로 쓰기 좋다.
- 약점: 피부·헤어·기하학·edit boundary가 없고, 그림자 완전 제거는 평면적 합성을 유발할 수 있다. 공식 제출 적합성을 보장하지 않는다.
- NB 기대: NB2/Pro 공통 baseline 후보. `shadowless`와 `soft minimal shadow`의 자연스러움 비교 필요.
- 점수 82: 짧고 명확하지만 신분증 규격과 정체성 세부 보호가 부족.
- 출처: S04·S05(7/10), S01·S02(10/10).

## 공통 발견

1. 기본형 5건은 `참조→정체성→정면→의상→배경→조명→크롭→분위기→출력 제외`라는 동일 골격을 공유한다.
2. identity 표현은 반복되지만 facial geometry, skin, hair, age를 독립적으로 보호하지 않는다.
3. `official ID photo crop`은 사진 스타일 token일 뿐 법정 규격 검증을 대신할 수 없다.
4. 합성형 2건은 기존 Portrait Rule보다 reference role, occlusion, material response가 더 중요하다.
5. 긴 Negative 나열은 성공 사례의 원인으로 확인되지 않았다. Google 공식의 positive framing과 비교 실험이 필요하다.

