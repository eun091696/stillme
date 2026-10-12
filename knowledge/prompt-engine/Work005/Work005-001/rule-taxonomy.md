# Rule Taxonomy

## 계층

```text
Portrait Edit
├─ Source Contract
│  ├─ Source of Truth
│  ├─ Reference Role Assignment
│  └─ Edit Boundary / Change Budget
├─ Subject Fidelity
│  ├─ Identity / Same Person
│  ├─ Facial Geometry
│  ├─ Hair Fidelity
│  ├─ Apparent Age
│  └─ Expression Envelope
├─ Styling
│  ├─ Wardrobe
│  ├─ Grooming
│  └─ Background
├─ Capture Simulation
│  ├─ Pose and Gaze
│  ├─ Composition and Crop
│  ├─ Lighting
│  ├─ Camera / Focus / Exposure
│  └─ Color and Skin Rendering
├─ Integration
│  ├─ Boundary Coherence
│  ├─ Material Response
│  ├─ Occlusion and Contact
│  └─ Cross-source Quality Match
└─ Output Contract
   ├─ Aspect Ratio / Resolution
   ├─ Text / Watermark Exclusion
   ├─ Document-use Guard
   └─ Brand / Logo Guard
```

## 중복 의미군

| 표현군 | 통합 의미 | 동일 의미 판정 | Nano Banana 차이 가능성 | 처리 |
|---|---|---|---|---|
| preserve / maintain / keep / retain / protect | 지정 속성을 불변조건으로 둠 | 대체로 동일 | 동사 자체보다 뒤의 구체적 속성 목록이 영향 가능 | canonical `preserve` 1회 + 속성 목록 |
| same person / recognizable person / identity similar | 인물 정체성 연속성 | 기능상 유사 | `100% similar`는 측정 불가능하고 과장 | `same recognizable person`로 정규화 |
| facial features / impression / actual impression | 얼굴 구조와 인상 | 완전 동일 아님 | geometry와 affect가 섞이면 모호해질 수 있음 | geometry와 expression/impression 분리 |
| natural / clean / neat | 자연스러움·정돈 | 서로 다름 | 주관어 단독 사용 시 약함 | 관찰 가능한 상태로 구체화 |
| soft / clean / even lighting | 부드러운 균일 조명 | 부분 중복 | 방향성, 그림자, 노출을 분리해야 함 | diffusion·uniformity·shadow로 분리 |
| no excessive retouch / no retouch | 보정 강도 제한 | 다름 | 전자는 최소 보정 허용, 후자는 편집과 충돌 | `restrained retouch` + 피부 불변조건 |
| no text / no watermark | 출력 오염 방지 | 별도 대상 | 함께 압축 가능하나 검증은 분리 | output exclusions 배열 |
| front-facing / look at camera | 머리 방향 / 시선 | 다름 | 하나만 주면 다른 축이 이탈 가능 | pose와 gaze 분리 |
| upper body / chest-up / official crop | 피사체 범위 / 용도 크롭 | 부분 중복 | `official`은 규격을 보장하지 않음 | crop geometry를 수치 메타데이터로 분리 |
| identical / 100% / exact | 강한 보존 의도 | 측정 불가 표현 | 반복보다 구체적 속성이 중요할 가능성 | 절대 보장 문구 Reject, 평가 기준으로 전환 |

## 충돌 규칙

1. `Source of Truth`가 최상위이며 스타일 Rule이 얼굴·헤어 불변조건을 덮어쓰지 못한다.
2. 사용자가 명시한 의상·표정 변경만 해당 속성의 Edit Boundary를 연다.
3. 공식 제출 규격은 Prompt가 아니라 서비스별 validation metadata가 우선한다.
4. 긍정형 목표 상태를 먼저 컴파일하고, 치명적 오류만 짧은 Negative/Guard로 남긴다.
5. 브랜드·로고 복제 요청은 미적 품질과 무관하게 Safety Guard가 우선한다.

