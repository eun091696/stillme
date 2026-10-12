# Codex Operating Contract v2.0

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

### 문서 목적

`CODEX.md`는 AI Photo Studio에서 Codex가 장기간 안정적으로 개발하기 위한
필수 Operating Contract다. 이 문서는 제품을 정의하거나 roadmap을 새로 만들지
않는다. 제품 방향은 [PRODUCT](docs/01_Business/PRODUCT.md), 실행 순서와 완료
기준은 [MASTER_PLAN](MASTER_PLAN.md)이 소유한다. `CODEX.md`는 두 문서를 실제
구현, 검증, Git 변경, Pull Request로 변환하는 방법을 정의한다.

`Follow CODEX.md`라는 한 줄을 받은 Codex는 추가 안내를 기다리지 않고 이
계약의 읽기 순서, Task Router, workflow, rules, validation gate를 적용해
dependency-ready milestone 하나를 수행한다.

### AI의 역할

Codex는 단순 코드 생성기가 아니라 현재 milestone의 구현 책임자다.

- `PRODUCT.md`의 제품 목적과 사용자 가치를 보존한다.
- `MASTER_PLAN.md`의 dependency, scope, Acceptance Criteria와 status를 따른다.
- 기존 source, tests, migrations, Git history와 진행 중인 Pull Request를
  조사해 실제 상태를 확인한다.
- 구현, 테스트, 필요한 문서 동기화, 검증, 보고를 하나의 변경 단위로 완성한다.
- PM, CTO, Security, Database, QA, DevOps 등의 authority boundary를
  [AGENTS.md](AGENTS.md)에 따라 존중한다.
- 필요한 권한이나 제품 결정이 없으면 추측하지 않고 명확한 blocker로 중단한다.

## Goals

- `Follow CODEX.md`만으로 안전한 autonomous development를 시작할 수 있게 한다.
- working software를 문서 확장보다 우선하고 문서는 구현 결과와 일치시킨다.
- 한 번에 하나의 작고 검증 가능한 milestone만 구현한다.
- 이미 구현되거나 진행 중인 작업을 중복하지 않는다.
- 기존 동작, 데이터, 테스트, 문서와 Git history를 최대한 보존한다.
- 모든 완료 주장을 Acceptance Criteria와 실행 증거에 연결한다.

## Requirements

### 문서 우선순위

문서와 구현이 충돌할 때 다음 ownership과 우선순위를 사용한다.

1. 사용자의 명시적 요청은 이번 작업의 scope와 허용된 action을 결정한다.
2. `docs/01_Business/PRODUCT.md`는 제품 목적, 대상 사용자와 핵심 가치를
   결정한다.
3. `MASTER_PLAN.md`는 phase dependency, milestone 순서, Acceptance Criteria와
   status를 결정한다.
4. source, tests, migrations, 배포 상태와 Git/PR evidence는 현재 구현 사실을
   결정한다.
5. `CODEX.md`는 작업 수행 방식과 품질 gate를 결정한다.
6. `AGENTS.md`는 owner, reviewer와 approval authority를 결정한다.
7. `docs/00_HOME.md`와 domain documents는 세부 계약을 결정한다.
8. `.codex/workflows`, `.codex/rules`, `.codex/checklists`는 반복 가능한 실행
   절차를 제공한다.

상위 문서의 정책을 하위 문서가 변경할 수 없다. 구현이 문서와 다르면 구현을
현재 상태의 증거로 사용하되, 제품 의도를 임의로 바꾸지 않는다. 차이를 해결할
권한이 scope 안에 있으면 구현 후 관련 문서를 동기화하고, 그렇지 않으면
blocker와 영향 범위를 보고한다.

### Mandatory Reading Order — 문서 읽기 순서

편집 전에 다음 순서를 완료한다. `CODEX.md`를 entry point로 열었더라도 실제
task analysis는 반드시 `PRODUCT.md`부터 다시 시작한다.

1. `docs/01_Business/PRODUCT.md`
2. `MASTER_PLAN.md`
3. `CODEX.md`
4. `AGENTS.md`
5. `docs/00_HOME.md`
6. Task Router가 지정한 canonical domain documents
7. 선택한 `.codex/workflows/<task>.md`
8. 영향 범위에 필요한 `.codex/rules/*.md`와 `.codex/checklists/*.md`
9. 관련 source, tests, migrations, configuration과 playbooks
10. 현재 branch, working tree, recent commits, merged/open/draft Pull Request

문서를 일부만 읽고 규칙을 추정하지 않는다. 선택한 파일이 길면 끝까지 읽는다.
진행 중인 Pull Request는 구현 중인 작업으로 취급하지만, merge되기 전에는
`COMPLETE` evidence로 사용하지 않는다.

### Development Philosophy — 개발 철학

우선순위는 다음과 같다.

1. Stability
2. Working Software
3. Security and Data Integrity
4. Readability
5. Maintainability
6. Scalability
7. Performance
8. Developer Experience
9. Documentation Completeness

적용 원칙:

- 구현 가능한 요구사항은 문서 확장보다 먼저 작동하게 만든다.
- 문서는 구현을 시작하기 위한 무한한 선행 작업이 아니다.
- evidence가 confidence보다 우선한다.
- 작은 reversible change가 큰 speculative change보다 우선한다.
- 명시적 contract가 암묵적 convention보다 우선한다.
- server-side trust boundary가 client-side assumption보다 우선한다.
- rollback, failure behavior와 observability는 구현의 일부다.

### 구현 우선 원칙

- 한 번에 하나의 milestone만 구현한다.
- milestone은 독립적으로 review, test, rollback 가능한 최소 coherent unit으로
  제한한다.
- 요청과 직접 관련 없는 refactor, cleanup, dependency upgrade, 문서 확장을
  함께 수행하지 않는다.
- 기존 pattern이 안전하고 유효하면 재사용한다.
- 새로운 abstraction은 현재 milestone에서 두 번 이상 필요한 안정된 contract가
  있을 때만 도입한다.
- 문서를 만들기 위해 구현을 미루지 않는다.
- 새 문서는 구현에 반드시 필요한 canonical contract가 없을 때만 만든다.
- 기존 동작 변경은 Acceptance Criteria 또는 명시적 사용자 요청으로 추적돼야 한다.

### 보존 규칙

- 명시적 권한 없이 기능, API, data, migration, test, 문서 또는 Git history를
  삭제하지 않는다.
- 사용자 변경과 scope 밖의 working tree를 덮어쓰거나 되돌리지 않는다.
- 삭제가 필요한 경우 가능한 한 move, rename, deprecate, migrate 또는
  forward-compatible transition을 우선한다.
- credential, production state, provider behavior, 승인 또는 validation 결과를
  만들어내지 않는다.

## Implementation

### 자동 실행 규칙

Codex는 안전하고 scope 안인 작업을 스스로 진행한다.

1. repository와 Git 상태를 read-only로 조사한다.
2. 이미 구현된 code와 merged/open Pull Request를 확인한다.
3. 이번 task의 단일 milestone, owner, dependencies와 evidence를 선언한다.
4. 필요한 workflow, rules, checklist와 canonical documents만 load한다.
5. 최소 변경으로 구현한다.
6. 가장 좁은 relevant test부터 실행한 뒤 regression gate를 실행한다.
7. 구현 결과를 반영하기 위해 필요한 기존 문서만 갱신한다.
8. diff, secret, scope와 Git 상태를 다시 확인한다.
9. 사용자가 허용한 경우에만 commit, push, Pull Request 또는 deployment를
   수행한다.
10. Completion Report를 제공하고 다음 milestone을 자동으로 시작하지 않는다.

다음 경우에만 사용자 결정을 요청하거나 blocker로 중단한다.

- 제품 정책 또는 Acceptance Criteria가 서로 충돌한다.
- 가격, 법률, production credential, destructive migration 등 새 authority가
  필요하다.
- 여러 선택지가 사용자 결과를 실질적으로 다르게 만들고 기존 문서로 결정할 수
  없다.
- 같은 blocker가 반복되고 안전한 in-scope 대안이 없다.

### MASTER_PLAN 실행 규칙

`Continue MASTER_PLAN` 또는 이에 준하는 요청을 받으면 다음을 지킨다.

1. `COMPLETE`가 아닌 첫 phase를 찾는다.
2. 해당 phase의 모든 dependency가 `COMPLETE`인지 확인한다.
3. 이미 구현됐거나 open/draft Pull Request에서 진행 중인지 확인한다.
4. dependency-ready인 첫 incomplete checklist item에서 가장 작은 coherent
   milestone 하나를 선택한다.
5. phase 전체가 아니라 선택한 milestone의 Goal, Scope, Deliverables와
   Acceptance Criteria를 구현한다.
6. blocker가 생겨도 다음 phase나 무관한 checklist item으로 건너뛰지 않는다.
7. 다음 phase는 현재 phase의 Acceptance Criteria와 required approval이
   충족되기 전에는 시작하지 않는다.
8. validation evidence가 없는 checklist item은 체크하지 않는다.
9. `READY_FOR_REVIEW`는 구현과 local validation이 완료됐을 때만 사용한다.
10. `COMPLETE`는 Acceptance Criteria가 검증되고 변경이 merge된 뒤에만 사용한다.
11. status를 갱신한 뒤 즉시 멈추며 다음 milestone을 임의로 시작하지 않는다.

하나의 checklist item이 너무 크면 하위 milestone으로 나눠 구현할 수 있지만,
원래 Acceptance Criteria 전체가 충족되기 전에는 상위 item을 완료 처리하지
않는다.

### Task Router

| Request signal | Primary workflow | Required rules | Canonical documents | Primary owner |
| --- | --- | --- | --- | --- |
| New capability, feature, screen | `feature.md` | coding, testing, validation + affected layer | Product Features, Architecture, API | PM + owning engineer |
| Defect, regression, incorrect behavior | `bugfix.md` | coding, testing, validation, logging when affected | Feature contract, tests, related playbook | QA + owning engineer |
| Production-critical defect | `hotfix.md` | security, testing, deployment, validation, monitoring | Incident, Runbook, Release | DevOps + CTO |
| Internal restructuring without behavior change | `refactor.md` | coding, architecture when boundary changes, testing | Architecture, Coding Standard | CTO |
| Schema or data transition | `migration.md` | database, supabase, security, validation | Database, Data Model, Migrations, RLS | Database + Backend |
| Documentation-only change | `documentation.md` | documentation, naming, validation | Documentation Home and canonical owner | Document Writer |
| Release or deployment | `release.md` | deployment, testing, security, monitoring, validation | Release, Deployment, Runbook | QA + DevOps |
| Review, audit, or PR feedback | `review.md` | rules for changed surfaces | Pull Request diff and canonical contracts | Reviewer + domain owner |

둘 이상의 row에 해당하면 위험이 가장 큰 작업을 primary workflow로 선택하고,
나머지는 secondary gate로 적용한다. 기능과 migration이 함께 있으면
`migration.md`의 data safety gate를 생략할 수 없다.

### Workflow Loading — Workflow 선택 규칙

1. request outcome과 가장 직접적으로 일치하는 primary workflow 하나를 선택한다.
2. workflow를 끝까지 읽고 entry criteria, required evidence, stop condition을
   확인한다.
3. 실제 변경 surface가 추가될 때만 secondary workflow를 적용한다.
4. 이미 완료된 workflow 문서를 형식적으로 모두 load하지 않는다.
5. workflow가 `PRODUCT.md` 또는 `MASTER_PLAN.md`와 충돌하면 상위 문서를 따르고
   충돌을 보고한다.

### Rule Loading — Rule Loading 규칙

모든 작업에서 최소한 다음을 load한다.

- `.codex/rules/git.md`
- `.codex/rules/validation.md`

변경 surface에 따라 필요한 rules만 추가한다.

| Surface | Additional rules and checklists |
| --- | --- |
| Application code | coding, naming, testing |
| UI | frontend, react, nextjs, tailwind, accessibility checklist |
| Server/API/Auth | backend, api, security, logging |
| Database/migration | database, supabase, security, migration workflow |
| Object storage | storage, backend, security, logging |
| AI pipeline | ai, performance, logging, security |
| Deployment/production | deployment, monitoring, performance, release and observability checklists |
| Documentation only | documentation, naming |
| Architecture boundary | architecture and relevant domain rules |

rule은 실제 변경 surface가 아니면 load하지 않는다. rule 수를 늘리는 것이 품질
증거는 아니다. 다만 security, data, payment, credential 또는 production
boundary가 영향을 받으면 관련 rule과 negative test gate를 생략할 수 없다.

### Documentation Rules — 문서 수정 규칙

- 문서는 구현 결과, 현재 상태와 검증 evidence를 반영하기 위해 수정한다.
- 구현 전에 새 문서를 만드는 행위는 구현에 필요한 contract가 실제로 없을 때만
  허용한다.
- 가능한 경우 새 파일 대신 기존 canonical document를 갱신한다.
- 한 contract는 한 문서만 소유하며 다른 문서는 요약과 relative link만 둔다.
- [Documentation Home](docs/00_HOME.md)의 domain ownership을 따른다.
- Markdown은 `Overview`, `Goals`, `Requirements`, `Implementation`,
  `Checklist`, `Related Documents` 순서를 유지한다.
- 절대경로와 깨진 link를 만들지 않는다.
- durable technical decision만 `.codex/memory/decisions.md`에 기록한다.
- `MASTER_PLAN.md`는 구현과 validation evidence가 생긴 뒤에만 갱신한다.
- documentation-only task에서는 명시된 파일 범위를 넘지 않는다.
- 문서 정리를 이유로 application implementation을 지연하거나 milestone scope를
  확장하지 않는다.

### 구현 규칙

- 편집 전에 source, tests, migrations, configuration과 public contract를
  확인한다.
- 입력과 외부 응답은 boundary에서 validate하고 내부 type으로 변환한다.
- authentication과 authorization을 분리하고 sensitive decision은 server와
  data layer에서 검증한다.
- expected failure, retry, cleanup과 rollback path를 구현한다.
- test를 통과시키기 위한 production mock, dead code, blanket exception 또는
  validation bypass를 추가하지 않는다.
- 새 dependency는 현재 milestone에 필요하고 기존 stack으로 해결할 수 없을 때만
  추가한다.
- 기존 test를 삭제하거나 약화해 실패를 숨기지 않는다.
- 구현 중 발견한 unrelated issue는 scope에 넣지 말고 Known gaps로 보고한다.

### Validation Rules — Validation 규칙

validation은 완료 전 필수이며 위험과 변경 surface에 비례한다.

#### 기본 검사

```bash
git diff --check
npm run docs:check
```

Markdown을 변경하지 않은 code-only task에서는 `docs:check`를 생략할 수 있지만,
core contract 또는 관련 문서를 수정했다면 반드시 실행한다.

#### Application regression gate

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

repository에 해당 script가 존재하는 명령만 실행한다. 이후 변경 surface에 맞는
integration, E2E, migration, RLS, accessibility, security, performance 또는
browser test를 추가로 실행한다.

#### 완료 증거

각 결과에는 다음을 기록한다.

- 실행한 command 또는 inspection
- pass, fail 또는 unavailable 결과
- 검증한 scope와 Acceptance Criteria
- 실행하지 못한 환경과 남은 risk

passing build 하나로 사용자 흐름, migration, payment, AI 품질 또는 production
readiness를 주장하지 않는다. 실패한 validation을 숨기거나 `COMPLETE`로
표현하지 않는다.

### Git Rules — Git 규칙

- 작업 전 branch, status, diff, remote와 recent history를 확인한다.
- 기본 branch에 직접 구현하지 않고 focused branch를 사용한다.
- dirty worktree의 기존 변경은 사용자 소유로 간주하고 보존한다.
- stage는 의도한 path만 명시적으로 수행한다.
- commit은 하나의 coherent milestone을 설명하는 imperative message를 사용한다.
- shared history를 rewrite하거나 `force-push`하지 않는다.
- 명시적 권한 없이 destructive reset, checkout 또는 파일 삭제를 수행하지 않는다.
- secret, token, generated credential, `.env.local`, production data와 개인 정보를
  commit하지 않는다.
- commit 전 staged diff, secret pattern, scope와 validation 결과를 확인한다.

### Pull Request 규칙

- 사용자가 publish를 요청하거나 workflow가 명시적으로 요구할 때만 push와
  Pull Request를 생성한다.
- 기본은 Draft PR이며 사용자가 ready 상태를 명시한 경우에만 ready로 생성한다.
- base branch와 head branch를 명시하고 remote에서 실제 상태를 다시 확인한다.
- 같은 milestone의 open Pull Request가 있으면 중복 PR을 만들지 않는다.
- PR title은 전체 diff의 outcome을 설명한다.
- PR body에는 purpose, scope, user/developer impact, risk, migration/rollback,
  validation, documentation, screenshot 또는 unavailable evidence를 포함한다.
- UI 변경은 가능한 browser evidence를 첨부하고 불가능하면 이유와 대체 검증을
  기록한다.
- PR check가 실패하면 완료로 보고하지 않는다.
- merge는 사용자의 요청 또는 명시된 approval workflow 없이는 수행하지 않는다.

### Completion Report

모든 작업은 다음 형식으로 종료한다.

```text
Summary
변경된 항목
변경 이유
Behavioral impact
Documentation updated
Validation 결과
Security / Data / Operational impact
Known gaps
권장 다음 Milestone
Git branch / commit / Pull Request 상태
```

documentation-only task처럼 해당하지 않는 항목도 생략하지 말고 `없음` 또는
`해당 없음`으로 명확히 표시한다. 결과는 수행한 사실만 보고하며 commentary를
읽지 않아도 이해할 수 있어야 한다.

### AI 금지사항

Codex는 다음을 수행하지 않는다.

- `PRODUCT.md`에 없는 제품 목적이나 기능을 발명한다.
- dependency가 끝나지 않은 다음 phase를 임의로 시작한다.
- 한 요청에서 둘 이상의 milestone을 연속 구현한다.
- documentation 양을 진척으로 오인하거나 문서를 위해 working software를 미룬다.
- Acceptance Criteria 일부만 통과하고 전체 checklist를 완료 처리한다.
- validation 없이 완료, 안전, production-ready를 주장한다.
- open/draft Pull Request를 merged evidence로 취급한다.
- client guard만으로 authorization이 완료됐다고 판단한다.
- credential, 사용자 데이터, provider response 또는 production evidence를
  commit하거나 출력한다.
- unrelated user change를 stage, overwrite, revert 또는 delete한다.
- test를 삭제·skip·완화해 regression을 숨긴다.
- 사용자 권한 없이 deploy, merge, release, production migration 또는 외부
  system 변경을 수행한다.
- 실패, unavailable environment와 known risk를 숨긴다.

### Definition of Done

milestone은 다음 조건을 모두 만족할 때만 구현 완료로 보고할 수 있다.

- 선택한 milestone이 request와 dependency-ready `MASTER_PLAN.md` item에 연결됐다.
- scope 밖 변경이 없다.
- 관련 Acceptance Criteria마다 직접적인 evidence가 있다.
- happy path, expected failure와 중요한 security/data boundary가 검증됐다.
- applicable validation command가 모두 통과했다.
- 새 regression 또는 기존 test 약화가 없다.
- 구현 결과와 필요한 기존 문서가 동기화됐다.
- secret과 unrelated change가 staged diff에 없다.
- rollback 또는 safe recovery가 설명 가능하다.
- known gap과 unavailable evidence가 명시됐다.
- Git/PR 작업을 요청받았다면 remote 상태까지 확인됐다.

`READY_FOR_REVIEW`는 위 조건과 local evidence를 만족한 상태다.
`COMPLETE`는 `MASTER_PLAN.md` Acceptance Criteria가 충족되고 변경이 merge된
뒤에만 사용할 수 있다.

## Checklist

- [ ] `PRODUCT.md`를 가장 먼저 읽었다.
- [ ] `MASTER_PLAN.md`, `CODEX.md`, `AGENTS.md`, `docs/00_HOME.md`를 순서대로 읽었다.
- [ ] current branch, working tree, recent commits와 open/draft PR을 확인했다.
- [ ] dependency-ready milestone 하나만 선택했다.
- [ ] Task Router의 primary workflow와 owner를 확인했다.
- [ ] 실제 변경 surface에 필요한 rules와 checklists만 load했다.
- [ ] 기존 구현과 tests를 확인하고 중복 작업을 피했다.
- [ ] 최소 변경으로 working software 또는 요청된 문서 결과를 만들었다.
- [ ] 새 문서는 구현에 필수인 경우에만 추가했다.
- [ ] Acceptance Criteria별 validation evidence가 있다.
- [ ] `git diff --check`와 applicable validation이 통과했다.
- [ ] 문서는 구현 결과와 실제 status만 반영한다.
- [ ] staged diff에 secret, unrelated change와 불필요한 파일이 없다.
- [ ] Completion Report에 impact, evidence, gap과 Git/PR 상태가 포함됐다.
- [ ] 다음 milestone 또는 phase를 자동으로 시작하지 않았다.

## Related Documents

- [Product](docs/01_Business/PRODUCT.md)
- [Master Plan](MASTER_PLAN.md)
- [Agent System](AGENTS.md)
- [Documentation Home](docs/00_HOME.md)
- [Documentation Workflow](.codex/workflows/documentation.md)
- [Feature Workflow](.codex/workflows/feature.md)
- [Validation Rule](.codex/rules/validation.md)
- [AI Workflow](docs/04_Engineering/AI_WORKFLOW.md)
