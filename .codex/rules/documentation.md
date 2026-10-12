# Documentation

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

Documentation rules는 AI Photo Studio 팀의 반복 가능한 개발 기준을 제공합니다.

## Goals

- 반복 작업의 판단 편차를 줄입니다.
- 안정성, 추적성, 검증 가능성을 유지합니다.

## Requirements

- 기존 기능과 공개 계약을 보존합니다.
- 예외는 담당자, 만료 조건, 후속 작업과 함께 기록합니다.

### README.md 공개 문서 예외

- `README.md`는 외부 독자를 위한 공개용 한국어 소개 문서이며, 내부 운영 문서(CODEX.md, MASTER_PLAN.md, AGENTS.md, CHANGELOG.md, `.codex/**`, `docs/**`, `playbooks/**`)와 다른 섹션 계약을 가집니다.
- 사용자가 승인한 공개 포맷(commit `main845837b`)의 실제 한국어 섹션 순서를 `scripts/lib/documentation-contract.mjs`의 `README_REQUIRED_SECTIONS`로 명시적으로 정의하고 `scripts/check-docs.mjs`가 검증합니다. README 검증을 제외하거나 skip하지 않습니다.
- 내부 문서는 기존 7개 섹션 계약(`INTERNAL_REQUIRED_SECTIONS`: Table of Contents, Overview, Goals, Requirements, Implementation, Checklist, Related Documents)과 순서를 그대로 유지합니다.
- 공개 계약은 저장소 루트의 `README.md`에만 적용됩니다. `requiredSectionsFor`는 저장소 기준 상대경로를 받아 `docs/README.md`, `.codex/**/README.md` 같은 중첩 README는 내부 7섹션 계약으로 검증합니다.
- 담당자: Document Writer / QA. 변경 시 두 계약 중 하나만 수정하고 다른 계약과 기존 duplicate heading·link 검사는 그대로 보존합니다.

## Implementation

코드와 같은 Pull Request에서 소유자, 계약, 예외, 검증 결과와 상대 링크를 갱신합니다.

`scripts/check-docs.mjs`는 파일별로 `scripts/lib/documentation-contract.mjs`의 `requiredSectionsFor(file)`를 호출해 README.md와 내부 문서에 맞는 섹션 계약을 선택한 뒤, 동일한 duplicate heading 검사와 상대 링크 검사를 모든 문서에 공통으로 적용합니다. 회귀 검증은 `scripts/lib/documentation-contract.test.mjs`(`node --test`)에서 수행합니다.

## Checklist

- [ ] 범위와 소유자가 명확하다.
- [ ] 보안·데이터·운영 영향을 검토했다.
- [ ] 자동 검증과 수동 검증을 완료했다.

## Related Documents

- [CODEX](../../CODEX.md)
