# AI Generation

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

AI Generation 영역의 기준과 현재 프로젝트 결정을 관리합니다.

## Goals

- 안정성과 유지보수성을 우선합니다.
- 팀 간 계약과 책임을 명확히 합니다.

## Requirements

- 기존 기능과 문서 내용을 보존합니다.
- 변경 시 관련 문서와 검증 결과를 함께 갱신합니다.
- 사용자 생성 요청은 세 가지 서비스, JPEG/PNG/WEBP source image와 선택적인
  추가 요청만 허용합니다.
- Source image는 최대 10 MiB이며 Server Action transport는 bounded multipart
  overhead를 포함하도록 11 MiB로 제한합니다.
- 추가 요청은 240자 이하이며 Prompt Engine의 identity, affiliation, compliance와
  category safety validation을 통과해야 합니다.
- 알 수 없는 field, control character, 지원하지 않는 option과 policy 위반 입력은
  job이나 경제적 side effect를 만들기 전에 거부합니다.
- Validation error에는 원문 prompt를 포함하지 않습니다.

## Implementation

#### Provider
- Google AI Image Generation API

#### Flow
1. Validate request
2. Create job and reserve 1 Credit atomically
3. Generate candidates and compare each result with the source for identity and skin preservation
4. Replace rejected candidates within a maximum of five image-generation calls
5. Upload and verify only three accepted private Cloudflare R2 objects
6. Publish all initial candidate metadata atomically
7. Settle 1 Credit on success or release the reservation on failure
8. Redirect to the owner-scoped result history

#### Failure Handling
- Asset metadata cleanup and generation failure/Credit release run independently.
- A failed immediate release remains a `reserved` reservation and is reported as
  reconciliation-required instead of creating compensating Credit.
- The service-role reconciliation RPC processes bounded stale batches after 30
  minutes. It skips settled/succeeded/consumed requests, retryable failures, and
  requests with potentially published assets.
- Reservation release remains idempotent, and job/account/reservation row locks
  serialize reconciliation against successful completion.

#### Request Validation

`src/lib/generation/validation.ts`가 서버와 UI에서 공유할 canonical request
validator를 제공합니다. 구조와 allowlist 검증 후 별도 policy adapter를 호출할
수 있으며, provider 또는 moderation 구현은 현재 Milestone 범위에 포함하지
않습니다. 실패 결과는 field와 bounded error code만 반환합니다.

#### Creation Workspace

`/generate`는 인증된 사용자의 서비스 선택 화면입니다. 증명사진,
비즈니스 프로필, 프로필 사진 카드는 각각 `/generate/id-photo`,
`/generate/business-profile`, `/generate/profile-photo` 전용 폼으로 이동합니다.
사용자는 본인 사진 한 장을 업로드한 뒤 서비스별 옵션과 선택적 추가 요청을
입력합니다. 비즈니스 프로필의 필수 직업은 Runtime Prompt source가 아니라
검증된 사용자 생성 맥락으로 후보 모두에 전달합니다. raw prompt, preset
ID, model, resolution, job 내부 상태와 storage 정보는 표시하지 않습니다.
로그인·회원가입 성공 후 기본 진입점도 이 화면입니다.

최초 생성 전 사진 1~3은 각자 서비스별 허용 배경과 개별 추가 요청을 설정할 수
있고, 공통 추가 요청은 세 후보 모두에 적용됩니다. Server Action은 후보별 background
ID를 allowlist로 변환하고 모든 개별 요청을 기존 추가 요청 정책으로 검증한 후,
서로 독립된 최종 Prompt 세 개를 조립합니다. 이 검증은 job 생성과
Credit 예약보다 먼저 수행합니다.

Server Action은 client 입력을 신뢰하지 않고 canonical validator와 인증 상태를
다시 확인합니다. `create_generation_request`가 job 생성과 Credit 예약을 하나의
DB transaction으로 묶고, 요청 UUID로 중복 생성을 차단합니다. Provider, 품질
검사 또는 storage 단계가 실패하면 bounded error code를 기록하고 예약 Credit을
해제합니다. 검증된 asset 게시 후 정산이 불확실한 경우에는 결과를 삭제하지 않고
reconciliation 대상으로 보존합니다.

서버는 선택한 preset으로 Prompt Engine을 실행하고 기본 `flash` 모델과 `1K`
해상도를 기존 Google adapter에 전달합니다. 각 생성 결과는 기술 검사를 통과한 뒤
AWS Rekognition이 원본과 결과의 동일인 유사도를 평가하고, 이를 통과한 결과만
별도 server-only Gemini Flash Lite validator가 피부 보존을 평가합니다. 거부된
후보만 server-owned 보정 지침으로 다시 만들며 최초 3장 준비를 위한 image
generation 호출은 최대 5회입니다. 후보 3장은 동시에 생성하며, 각 후보가 따로 재생성하되 5회 호출 한도는
공유합니다(2026-09-27 로컬 실측: 증명사진 약 31초, 헤어디자이너 약 30초, 이전 순차 방식 50~90초).
후보·제작 단위 소요 시간은 `image_generation.candidate_timing`/`production_timing` 로그로 남기며 점수·이미지·
프롬프트는 기록하지 않습니다. 피부 validator 호출 오류는 이미지 재생성 없이
한 번만 재시도합니다(2026-09-27 실측: 동시 호출 시 24건 중 7건 일시 오류, 순차 72건 0건).
Google HTTP 402(선불 잔액 소진)는 `PROVIDER_ACCESS_DENIED`로 분류해 사용자에게
일시 이용 불가와 Credit 미차감을 안내합니다. Validator 장애나 다섯 번 안에 세 후보를
준비하지 못한 경우 검증되지 않은 부분 결과를 노출하지 않고 예약 Credit을
해제합니다. 실제 AWS·Google provider compatibility와 threshold는 hosted evaluation이 남아
있습니다. 성공 화면은 원본과 최초 후보 3장을
보여 주며, 각 후보를 owner-scoped asset download action으로 내려받을 수 있습니다.
증명사진(`resume-id`)은 3:4 세로 비율로, 캐릭터는 4:5, 그 외 프로필은 1:1로 생성합니다.
사용자에게는 준비·생성·마무리·완료 또는 bounded 한국어
오류 상태만 노출합니다.

개발 환경의 `/dev/image-generation`은 Pro 비교와 adapter 진단을 위한 비필수
내부 경로로만 유지합니다. 실제 사용자 흐름은 이 경로를 통과하지 않습니다.
서버는 `promptId`, `promptVersion`, module ids, model, resolution, source hash와
결과 asset key를 generation metadata에 기록합니다. R2가 없는 non-production
환경에서는 OS temporary directory 아래 private local adapter를 사용하며 public
URL이나 public bucket을 만들지 않습니다. Production은 R2 없이는 fail-closed합니다.

#### History and Download

`/generations`는 인증된 사용자의 owner-scoped job을 최신순 20개까지 표시합니다.
Empty, queued, processing, succeeded, failed와 cancelled 상태를 텍스트로 구분하고
실패 시 bounded error code를 사용자 복구 메시지와 서비스별 재시도 경로로
변환합니다. 완료 항목은 내부 Prompt ID 대신 서비스 이름과 최대 5개의 lazy
preview를 표시합니다. 각 Available asset의 preview와 download는 서버 route에서
인증 사용자와 owner RLS를 다시 확인한 뒤 private local response 또는 최대 10분의
exact-object R2 GET grant로 제공합니다. Storage key와 signed URL은 화면 목록에
포함하지 않습니다.

#### Integration and E2E Evidence

`npm run test:integration`은 local Supabase Data API에서 owner와 cross-user의
generation job 및 available asset 조회를 검증합니다. fake provider/storage 기반
action test는 Prompt Engine 결과 전달, 기본 model/resolution, metadata와 output
asset 연결을 검증합니다. `npm run test:e2e`는 Chromium에서 anonymous 보호,
서비스 선택, upload preview/remove, optional request, invalid file, generation
history, bounded failure와 cross-user 비노출을 검증합니다. 실제 R2 object
download는 credential이 준비되기 전까지 `BLOCKED`이며 local asset은 개발 서버
수명과 machine에 한정됩니다.

## Checklist

- [x] Generation request validation contract를 구현하고 unit test로 검증했다.
- [x] `/generate` creation workspace와 `/generations` history 책임을 분리했다.
- [x] Job 생성, Credit 예약·정산·환불을 원자적 DB orchestration으로 연결했다.
- [x] Provider, 기술·semantic 품질 검사와 R2 검증을 실행하는 server-only pipeline을 연결했다.
- [x] 최초 후보 3장에 최대 5회 generation 호출 상한과 fail-closed 처리를 구현했다.
- [x] Owner-scoped history, failure state와 bounded download action을 구현했다.
- [x] Generation history integration과 browser E2E를 자동화했다.
- [x] 세 가지 서비스의 upload-to-result MVP 흐름을 `/generate`에 연결했다.
- [x] 1 Credit당 후보 3장의 서버 한도를 구현했다.
- [x] 구현 또는 운영 상태와 문서가 일치한다.
- [ ] 관련 변경 시 이 문서를 함께 갱신한다.

## Related Documents

- [00_HOME](../00_HOME.md)
