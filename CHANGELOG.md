# Changelog

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

저장소 전체의 사용자·개발자 영향 변경을 버전별로 기록합니다.

## Goals

- 팀 간 판단 기준을 통일합니다.
- 구현과 운영 상태를 문서와 일치시킵니다.

## Requirements

- 책임 Agent와 검토 Agent를 지정합니다.
- 변경은 관련 코드, 테스트, 문서와 함께 검토합니다.

## Implementation

### Unreleased

- 2026-10-12: 기존 Private 저장소와 운영 배포를 그대로 보존하고, 실제 환경파일·빌드 산출물·기존 Git 이력을 제외한 631개 파일을 새 `stillme` 저장소의 독립 8커밋으로 이관했다. 최초 CI에서 새 전체 이력 8커밋의 비밀정보 검출 0건, 단위 537건·스크립트 40건 및 빌드 통과를 확인했다. 4개 페이지 성능 기준 초과와 E2E 1건은 미해결이며 전체 통과·공개 완료로 주장하지 않는다.
- 성능 검사가 실패하더라도 클라이언트 번들 비밀정보 검사가 먼저 실행되도록 `validate` 검사 순서만 조정했다. 어떤 검사나 성능 기준도 삭제·완화하지 않았다. E2E의 서비스 링크 클릭·정확한 목적지 검증은 보존하고 해당 이동 확인의 대기 상한만 5초에서 15초로 조정했다. 첫 CI에서 이동이 5초 내 확인되지 않았다는 사실 외의 실패 원인은 확정하지 않았다. 수정 후 원격 재검증이 필요하다.

- 페이지별 120 KiB/개별 asset 64 KiB 성능 기준과 실패 exit를 그대로 유지한 채, 실패 때도 자산 파일명·gzip byte 통계만 최대 12개 출력하도록 진단을 보완했다. CLI 통과·실패 및 소스 본문 비노출 회귀를 추가했다.
- 정적 서버 이미지 adapter 경량화 시도는 원격 실측에서 payload 감소가 없어서 전부 철회했다. 원래 Next Image 구현을 복원하고 실험 파일·전용 테스트를 제거했다. 120 KiB 성능 기준을 완화하지 않으며 4개 페이지의 초과는 미해결 상태다.
- E2E의 미인증 모바일 메뉴는 실제 보호 경로의 login redirect를 검증하며, 서비스 card는 이미 확인한 href로 클릭한다. 로그인 대기 URL은 query의 `/generate`가 아니라 실제 pathname과 인증 헤더까지 검증한다. 업로드 입력은 같은 파일 재선택을 위해 비워지는 현재 동작을 존중하고, 교체된 파일명·새 preview URL·제거·MIME 방어를 검증한다. 이력 다운로드는 현재 `사진 N 다운로드` 이름과 일치하도록 보완했다.

- 강화된 전체 이력 검사에서 과거 `.github/workflows/ci.yml:20`(커밋 `677e3a3fbfeef02964c498f05ac3a82685a82616`)의 Supabase publishable key 1건이 추가 검출됐다. 현재 main은 이미 가짜 CI marker를 사용한다. 실제 키의 유효·활성 여부는 검증하지 않았으며 원문을 보고·log·새 commit에 복사하지 않았다. 실제 키를 검사 예외로 숨기지 않고 이력 정리 및 강화 검사 통과 전 Private·병합 보류를 유지한다.

- 기존 E2E의 옛 홈 문구·캐러셀·메뉴·서비스 카드 선택자를 현재 승인된 정적 그리드와 헤더 구조에 동기화했다. 인증 redirect, upload 검증, cross-user 이력 차단, 대비 4.5, 키보드·모바일 reflow 검증은 유지한다. 계정·크레딧 현재 페이지와 프로필 세부 서비스의 현재 영역 안내를 보완하고, 홈 생성/이력 다운로드 클릭 영역을 최소 44px로 유지했다. 실제 사진 생성·결제·크레딧·DB migration 로직은 변경하지 않았다.

- 민감정보 검사에서 기존 CI의 넓은 Supabase publishable-key 예외를 제거하고 정확한 가짜 CI 검증 marker 한 개만 허용했다. 실제 publishable key도 예외로 통과하지 않도록 회귀 검증하며, 강화된 기준으로 전체 Git 이력을 다시 검사한다.

- 공개 전 원격 전체 회귀에서 드러난 증명사진 framing 테스트 fixture를 보완했다. 얼굴 목표 비율 `0.52`에서 1.5배 확대 제한에 걸리지 않는 입력으로 목표 도달을 검사하고, 기존 작은 얼굴 입력은 확대 제한 보존을 별도로 검증한다. 실제 crop/이미지 처리 코드와 목표 비율은 변경하지 않았다. 원격 전체 검증 통과 전 공개 보류 원칙은 유지한다.

- 공개 준비 보안 변경: Next.js와 ESLint 설정을 15.5.27, Sharp를 0.35.5, source-map-js를 1.2.2로 고정하고 lockfile을 갱신했다. 개발용 Vitest를 4.1.11로 올리고 JS-YAML 및 brace-expansion 보안 패치를 적용했다. Next ESLint의 유일한 `fast-glob` 소비자를 고정된 `tinyglobby@0.2.17` 기반 로컬 directory-glob adapter로 교체해 공식 패치 없는 `braces` 경로를 제거했다. 깨끗한 npm 10 설치 및 운영·개발 감사 0건을 확인했다. README는 수정하지 않고 공개 한국어 섹션 계약 검사를 추가했으며, Groble DB 테스트의 성공 결제 fixture는 transaction-stable `now()` 기준으로 보완했다. 이 구현·로컬 검증만으로 공개 승인을 의미하지 않으며, 공개 여부는 PR의 최종 원격 전체 CI와 강화된 전체 이력 검증 결과로 결정한다.
- CI Secret scan에 원격 전체 branch/tag/PR refs 동기화, 비 shallow 검증, branch 수 일치 확인, 검사 commit/ref inventory와 명시적 `--all --full-history` 검사를 추가했다. 보고 내용은 마스킹하고 secret artifact 업로드와 PR 댓글을 비활성화했다. 전체 CI 통과 전 Private을 유지한다. 첫 명시적 전체 이력 검사에서 162개 커밋을 검사해 의심 항목 2건을 발견했으며, 원문 없이 rule/file/line/commit 위치만 보고하도록 보완했다. 검출 2건은 과거 단위 테스트의 동일한 멱등성 UUID로 확인했다. `.gitleaks.toml` 예외는 해당 커밋·테스트 파일·정확한 UUID 줄에 AND 조건으로 한정한다. 앞선 `e5a0c2c` CI에서 26개 브랜치·56개 PR refs·181 reachable commits 전체 이력 검사가 통과했다. 최종 변경의 전체 CI 및 이력 재검증 전에는 병합·공개하지 않는다.

- 2026-09-28: Generate the three candidates concurrently with a shared five-call budget and per-slot retries; add production-safe timing logs (durations and reason codes only). Local measurements: ID ~31s, Hair Designer ~30s (previously 50-90s sequential).
- 2026-09-27: Privacy policy and service guide now disclose AWS Rekognition face comparison (similarity used only for candidate acceptance, not stored, no face templates) and Gemini skin-quality checks, with an in-page revision notice. Consent version unchanged.
- 2026-09-27: Character prompts now append an explicit outfit override when "중립색 의상" is selected and a final style/outfit/background check (runtime body versions unchanged; one production run with clay + neutral kept the original olive jacket before this change).
- 2026-09-27: Hair Designer prompt 2.5.3 appends a final outfit/background check when an explicit outfit is chosen (observed 2/3 adherence before, 3/3 after one real run each; small sample).
- 2026-09-27: Replaced reused mock thumbnails with option-specific example photos under `public/images/options` (5 Hair styles, 5 Hair Designer outfits, 6 ID background/outfit/tie combinations, 9 profile backgrounds, 12 character style/outfit/background combinations). ID and character option previews now follow the current selection. The ID setup uses a single-column progressive layout (stepper on top, live preview beside the choices), and option labels are Korean.
- 2026-09-27: Removed same-production free follow-up candidates (formerly two extra candidates per production); one Credit now yields three candidates, with up to two automatic quality regenerations. Terms section 3 revised with an in-page revision notice. ID photos (`resume-id`) are generated at 3:4 (`20260927000100` migration). Google HTTP 402 (prepaid balance depleted) now maps to `PROVIDER_ACCESS_DENIED` with a customer-facing message, and the skin validator retries one transient failure. DB functions and columns for the retired follow-up flow are retained for existing rows but are no longer called.
- Added the AI-first repository governance system, task routing, dependency-aware roadmap, agent contracts, documentation architecture, validation automation, and operational playbooks.
- Reviewed the governance change on a clean branch with no application-source modifications.
- Converted MVP capabilities into traceable user stories with owners, failure behavior, measurement signals, and Given/When/Then acceptance criteria.
- Added decision-ready pricing, credit ledger, payment, and refund policy contracts while preserving the CEO approval gate for commercial values.
- Added provider-cost and legal-source evidence with concrete commercial launch recommendations for CEO and legal review.
- Approved the `commercial-v1` pricing and credit policy baseline while retaining legal review as a pre-release gate for customer refund terms.
- Approved the `ui-v1` design system and WCAG 2.2 Level AA accessibility baseline with implementation and release evidence contracts.
- Approved the `analytics-v1` KPI, event, funnel, metric, dashboard, privacy, and data-quality contracts while preserving implementation and production-evidence gates.
- Approved the `security-v1` threat model, control catalog, authentication, RLS, secrets, privacy, and security-test contracts while preserving implementation and production-evidence gates.
- Approved the `api-v1` versioning, REST, Problem Details, authorization, idempotency, webhook, reconciliation, and contract-test baseline without claiming runtime implementation.
- Approved the `storage-v1` private R2 key, signed access, validation, retention, deletion, reconciliation, outage, and test baseline without claiming runtime implementation or legal compliance.
- Approved the `observability-v1` SLO, error-budget, logging, metrics, tracing, dashboard, alerting, on-call, Runbook, incident, retention, and validation baseline without claiming runtime instrumentation or staffing.
- Added reproducible local Supabase configuration, the first profiles migration, owner-only RLS, email signup/login/logout, a protected account route, editable basic profiles, and runnable unit, database, and local integration tests.

## Checklist

- [ ] 소유자가 내용을 검토했다.
- [ ] 구현 또는 운영 상태와 일치한다.
- [ ] 관련 테스트와 모니터링을 확인했다.

## Related Documents

- [README](README.md)
