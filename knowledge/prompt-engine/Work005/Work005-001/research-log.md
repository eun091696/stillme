# Research Log

## 조사 기록

| ID | 확인일 | Tier | 출처 | 신뢰도 | 확인 내용 | 판정 |
|---|---|---:|---|---:|---|---|
| S01 | 2026-08-04 | 1 | [Google Gemini 이미지 생성 문서](https://ai.google.dev/gemini-api/docs/image-generation) | 10/10 | NB2/Pro 모델명, 이미지 편집, 참조 이미지 수, 해상도·비율, 캐릭터 일관성 | 채택 |
| S02 | 2026-08-04 | 1 | [Google Cloud Nano Banana Prompting Guide](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana) | 10/10 | 구체성, 긍정형 지시, 카메라 제어, NB2/Pro 공통 Framework | 채택 |
| S03 | 2026-08-04 | 1 | [Google Gemini Cookbook](https://github.com/google-gemini/cookbook) | 9/10 | 공식 실습 저장소, 일관성 높은 이미지 편집 워크플로 존재 | 참고·채택 |
| S04 | 2026-08-04 | 1 | [Carat ID Photo Gallery](https://carat.im/prompt-gallery/id-photo) | 7/10 | 공개 Prompt 8건, 결과 미리보기, 원 모델 표기 | Rule 후보 추출 |
| S05 | 2026-08-04 | 1 | [Carat ID Photo Prompt](https://carat.im/prompt-gallery/id-photo-prompt) | 7/10 | 기본형 3건의 중복 공개, 구조·조명·보정 설명, 무료 공개 고지 | 중복 검증 |

## Carat 수집 완전성

2026-08-04 공개 HTML과 렌더링된 페이지에서 다음 8개 제목을 확인했다.

1. Profile ID Photo
2. Business ID Photo
3. Job Application ID Photo
4. Student ID Photo
5. Ki-Re-i ID Photo Sheet
6. ID Photo in Transparent Phone Case Composite Prompt
7. Two Passport Photos Shot
8. Clean Basic ID Photo

`id-photo-prompt` 연결 페이지의 Profile/Business/Clean Basic은 동일 문구의 재게시로 확인했다. 삭제하지 않고 `duplicateOccurrence`로 기록하되 새 Rule로 중복 등록하지 않았다.

## 공개·법적 처리

- Carat 페이지는 Prompt 텍스트가 공개되어 있고 별도 페이지에서 무료 복사 가능하다고 설명한다.
- 그럼에도 긴 원문 전체를 연구 산출물에 재수록하지 않고 기능적 지시와 구조만 독립적으로 요약했다.
- Ki-Re-i 사례의 브랜드명·로고 형상·DNP 스타일 지시는 상표·트레이드드레스 모방 위험 때문에 Reject했다.
- X 작성자 링크가 붙은 커플 패스포트 사례는 원출처 소유권과 재사용 범위를 확인하지 못해 구조적 관찰만 남겼다.
- 결과 이미지는 내려받거나 재배포하지 않았다.

## 조사하지 않은 자료

- 유료 Prompt Pack, Prompt marketplace, 로그인 전용 자료
- Carat의 다른 카테고리 전체: 현재 범위를 벗어나므로 링크된 `id-photo-prompt`만 중복 확인에 사용
- Tier 2~4: Tier 1에서 대상 Prompt와 공식 모델 원리가 충분히 확보되어 확장하지 않음

## 방법상 한계

- Carat Prompt 대부분은 GPT Image 2용이며 Nano Banana에서 재현된 증거가 없다.
- 공개 미리보기는 선택 편향이 있고 실패율·seed·설정·반복 횟수가 없다.
- 따라서 Carat에서 추출한 효과는 `expected`, 공식 Google 근거는 `supported`, 모델별 차이는 실험 전 `unverified`로 구분했다.

