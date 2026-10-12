# Work005-002 Rule 검증 계획

## 1. 범위와 판정 원칙

본 문서는 Work005-001의 `prompt-analysis.md`, `rule-taxonomy.md`, `candidate-rules.json`, `module-mapping.md`, `experiment-backlog.md`, `research-log.md`만 사용한다. 실제 API 호출, 이미지 생성, Prompt 승인, Engine 변경은 수행하지 않는다.

상태 의미:

- **실험 준비 완료**: 단일 변수 또는 명확한 묶음으로 Portrait Benchmark에서 검증 가능하다.
- **추가 근거 필요**: 현재 Portrait MVP 밖이거나 별도 합성 fixture가 필요하다.
- **제외 후보**: Runtime 생성보다 결정적 후처리가 우월하거나 범위·법적 위험이 크다.

## 2. Candidate Rule 전수 검토

| ID | Rule 이름 | 목적 | 기대 효과 | 해결하려는 실패 사례 | Nano Banana에서 검증이 필요한 이유 | 상태 |
|---|---|---|---|---|---|---|
| CARAT-R001 | Uploaded Portrait Source of Truth | 업로드 인물을 유일한 정체성 기준으로 고정 | 참조 모호성·대체 얼굴 감소 | 스타일 지시가 원본 인물을 덮어씀 | 이미지 입력 지원은 공식 근거가 있으나 문구 위치·유무 효과는 미검증 | 실험 준비 완료 |
| CARAT-R002 | Recognizable Same Person | 동일 인물 연속성 유지 | 얼굴 교체 감소 | 다른 사람처럼 보이는 결과 | subject consistency 기능과 실제 표현별 효과는 동일하지 않음 | 실험 준비 완료 |
| CARAT-R003 | Facial Geometry Invariants | 눈·코·입·턱·비율 고정 | 이목구비 드리프트 감소 | 닮았지만 얼굴형이 달라짐 | Carat의 모호한 face 보존보다 세부 속성화 효과가 미검증 | 실험 준비 완료 |
| CARAT-R004 | Characteristic Impression Preservation | 원래 인상과 허용 표정 변화 분리 | stock smile·인상 변화 감소 | 전문적 분위기가 무표정/과장 미소로 변질 | 인상은 주관적이므로 관찰 가능한 표정 envelope와 비교 필요 | 실험 준비 완료 |
| CARAT-R005 | Hair Identity Preservation | 헤어라인·가르마·길이·질감 보존 | 헤어스타일 교체 감소 | `neat hair`가 새 헤어 생성으로 확대 | grooming과 preservation 분리 효과가 미검증 | 실험 준비 완료 |
| CARAT-R006 | Grooming Delta Only | 잔머리 정돈만 허용 | 과도한 헤어 편집 방지 | 볼륨·가르마·길이까지 변경 | 허용 delta가 실제로 좁게 적용되는지 확인 필요 | 실험 준비 완료 |
| CARAT-R007 | Natural Skin Tone | 원본 피부 색조 유지 | 주황·회색·과도한 미백 감소 | 피부색 인종 특성 변형 | `natural` 단독과 원본 기준 색조 지시 차이 미검증 | 실험 준비 완료 |
| CARAT-R008 | Restrained Retouch | 최소 정돈만 허용 | 플라스틱 피부·과미화 감소 | 모공·잡티 삭제, 얼굴 미용 변형 | 긍정형과 금지형의 안정성 비교가 필요 | 실험 준비 완료 |
| CARAT-R009 | Front Head Orientation | 머리 방향을 정면으로 맞춤 | 대칭적 ID 구도 성공률 향상 | 얼굴은 정면이나 시선이 벗어남 또는 반대 | pose 보정이 정체성을 손상할 수 있음 | 실험 준비 완료 |
| CARAT-R010 | Lens Gaze | 양 눈의 카메라 응시 | 시선 이탈 감소 | 머리는 정면이나 눈동자가 옆을 봄 | pose와 gaze를 분리했을 때의 이득 미검증 | 실험 준비 완료 |
| CARAT-R011 | Expression Envelope | 카테고리별 미소 강도 제한 | 입·치아 artifact와 과장 표정 감소 | 무표정 원본이 큰 미소로 바뀜 | Keep/Do not change만으로 허용 범위를 전달할 수 있는지 불명확 | 실험 준비 완료 |
| CARAT-R012 | Authorized Wardrobe Preset | 허가된 경우만 의상 변경 | 정장 적용과 원본 보호 동시 달성 | 무단 의상 변경, 칼라·목 경계 artifact | 복합 스타일 변경이 얼굴 보존을 약화시킬 가능성 | 실험 준비 완료 |
| CARAT-R013 | Plain Background Preset | 단색·중성 배경 적용 | 산만함·배경 오염 감소 | 배경 잔존, halo, 공식 적합성 오해 | 구체 색·중성 기술과 단순 `plain`의 차이 미검증 | 실험 준비 완료 |
| CARAT-R014 | Soft Even Studio Light | 확산·균일 노출 제공 | 얼굴 정보 가독성 향상 | 강한 명암·노출 불균형 | 구체 조명 요소별 기여가 미검증 | 실험 준비 완료 |
| CARAT-R015 | Minimal Natural Shadow | 약한 실제적 그림자 유지 | 평면 cutout 감소 | `shadowless`로 합성 티 발생 | 긍정형 물리 상태가 더 자연스러운지 A/B 필요 | 실험 준비 완료 |
| CARAT-R016 | Chest-up Centered Crop | 인물 크기·중앙 배치 표준화 | 크롭 안정성 향상 | 머리 잘림·축소·비대칭 배치 | 텍스트 구도 지시의 재현성이 모델별 미검증 | 실험 준비 완료 |
| CARAT-R017 | Aspect Ratio via Output Config | 비율을 API 설정으로 강제 | 정확한 출력 비율 | 프롬프트의 3:4 요구 무시 | NB2/Pro 공통 지원은 확인됐지만 text/config/both 효율 비교 필요 | 실험 준비 완료 |
| CARAT-R018 | Text and Watermark Exclusion | 의도치 않은 글자·표시 억제 | 출력 오염 감소 | 워터마크·가짜 로고·문자 생성 | 프롬프트 exclusion이 플랫폼 provenance와 별개이며 효과 미검증 | 실험 준비 완료 |
| CARAT-R019 | Unspecified Attributes Locked | 요청 외 속성 잠금 | collateral edit 감소 | 배경만 바꾸는데 얼굴·헤어·의상도 변경 | edit boundary의 범위와 위치 효과가 미검증 | 실험 준비 완료 |
| CARAT-R020 | Reference Role Assignment | 복수 입력의 subject/scene/style 역할 고정 | 참조 혼합 감소 | 인물·장면·삽입 이미지 뒤섞임 | Portrait 단일 참조 세트로 검증 불가; synthetic multi-reference fixture 필요 | 추가 근거 필요 |
| CARAT-R021 | Occlusion and Contact Order | 앞뒤·접촉·부분 가림 고정 | z-order 자연스러움 향상 | 손가락이 사진 뒤로 감, 떠 보임 | 현재 Portrait MVP 밖이며 합성 Benchmark 항목이 필요 | 추가 근거 필요 |
| CARAT-R022 | Material Response Matching | 광택·반사·그림자·빛 방향 일치 | 붙여넣기 느낌 감소 | 삽입물의 재질·해상도 불일치 | 합성 전용 fixture와 평가자 합의가 필요 | 추가 근거 필요 |
| CARAT-R023 | Replication Consistency | 반복 셀의 동일성 유지 | 인쇄 시트 정체성 일관성 | 8개 셀마다 얼굴 변화 | 결정적 post-layout이 더 적합하고 Portrait Runtime 범위 밖 | 제외 후보 |
| CARAT-R024 | Brand and Officiality Guard | 로고 복제·공식 승인 오해 방지 | 위험 요청 차단·경고 | 상표 모방, 제출 가능성 허위 암시 | 이미지 품질이 아니라 정책 응답 정확도로 검증해야 함 | 실험 준비 완료 |

## 3. Rule-실험 추적성

| Rule | 주 실험 | 보조 실험/비고 |
|---|---|---|
| R001 | EXP-005 | EXP-008 |
| R002, R003 | EXP-001 | EXP-008, EXP-009 |
| R004, R011 | EXP-004 | EXP-009 |
| R005 | EXP-003 | EXP-015 |
| R006 | EXP-015 | EXP-003 |
| R007, R008 | EXP-002 | EXP-009 |
| R009, R010 | EXP-016 | EXP-012 |
| R012 | EXP-010 | EXP-006 |
| R013 | EXP-013 | EXP-006 |
| R014, R015 | EXP-011 | EXP-009 |
| R016 | EXP-012 | EXP-008 |
| R017 | EXP-017 | API 설정 실험 |
| R018 | EXP-014 | text/watermark 분리 채점 |
| R019 | EXP-006 | EXP-008 |
| R020~R022 | 후속 합성 트랙 | 현재 추가 근거 필요 |
| R023 | 후처리 비교 후 제외 검토 | Runtime 승인 대상 아님 |
| R024 | EXP-014 | 정책 Hard Gate |

## 4. 현재 결론

- 실험 준비 완료: 20개
- 추가 근거 필요: 3개
- 제외 후보: 1개
- 어느 Rule도 `approved`가 아니며 기존 `candidate/review` 상태를 변경하지 않는다.

