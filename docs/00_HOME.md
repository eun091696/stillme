# 문서 Home

## Table of Contents

- [개요](#overview)
- [목표](#goals)
- [요구사항](#requirements)
- [문서 구조와 Index](#implementation)
- [체크리스트](#checklist)
- [관련 문서](#related-documents)

## Overview

이 파일은 AI Photo Studio 지식 체계의 기준 index다. 사람과 Codex가 어떤 문서를 읽어야 하는지, 기준 정보가 어디에 있는지, 누가 소유하는지, 시스템 변경 시 문서를 어떻게 갱신하는지를 안내한다.

문서 구조는 기능 개수가 아니라 안정적인 domain ownership을 기준으로 한다. 수백 개의 기능이 추가되더라도 새로운 최상위 규칙을 반복해서 만들지 않고 기존 domain 아래에 문서를 확장한다.

## Goals

- Autonomous development를 위한 결정적인 reading path를 제공한다.
- 각 제품 또는 engineering contract의 canonical source를 하나만 유지한다.
- Business intent, product behavior, architecture, implementation standard와 operations를 분리한다.
- 오래되거나 중복되거나 깨진 지식을 자동으로 발견할 수 있게 한다.

## Requirements

### Reading Order

1. [README](../README.md) — 저장소 개요와 local workflow
2. [CODEX](../CODEX.md) — task routing과 실행 contract
3. [MASTER_PLAN](../MASTER_PLAN.md) — dependency가 명확한 roadmap
4. [AGENTS](../AGENTS.md) — ownership과 review 책임
5. 현재 문서 Home — canonical domain routing
6. 관련 `.codex` workflow, rule과 checklist
7. 아래에 등록된 domain 문서
8. Task 범위의 source, test, migration, playbook과 Git evidence

### Canonical Ownership

- Business 결정은 `01_Business`에서 관리한다.
- 사용자에게 보이는 behavior는 `02_Product`에서 관리한다.
- System contract와 trust boundary는 `03_Architecture`에서 관리한다.
- Engineering process는 `04_Engineering`에서 관리한다.
- Model behavior와 evaluation은 `05_AI`에서 관리한다.
- Wire contract는 `06_API`에서 관리한다.
- Production procedure는 `07_Operations`와 `playbooks`에서 관리한다.
- Release evidence는 `08_Release`에서 관리한다.
- Security policy는 `09_Security`에서 관리한다.
- Data lifecycle은 `10_Data`에서 관리한다.
- Measurement contract는 `11_Analytics`에서 관리한다.
- 역할별 guidance는 `agents`에서 관리한다.

다른 domain에 contract를 복사하지 않는다. 필요한 context만 요약하고 canonical owner 문서에 relative link를 연결한다.

## Implementation

### 문서 Hierarchy

```text
docs/
├── 00_HOME.md
├── 01_Business/
├── 02_Product/
├── 03_Architecture/
├── 04_Engineering/
├── 05_AI/
├── 06_API/
├── 07_Operations/
├── 08_Release/
├── 09_Security/
├── 10_Data/
├── 11_Analytics/
└── agents/
```

### Business

| 문서 | 목적 | Owner |
| --- | --- | --- |
| [PRODUCT](01_Business/PRODUCT.md) | Vision, 사용자와 value proposition, 성공 기준 | CEO |
| [ROADMAP](01_Business/ROADMAP.md) | Business 순서와 시장 Milestone | CEO, PM |
| [BUSINESS_MODEL](01_Business/BUSINESS_MODEL.md) | Revenue와 고객 가설 | CEO |
| [PRICING](01_Business/PRICING.md) | Plan, 가격 governance와 packaging | CEO |
| [PAYMENTS](01_Business/PAYMENTS.md) | 결제와 환불 business policy | CEO, Backend |
| [CREDITS](01_Business/CREDITS.md) | Credit economy와 audit 원칙 | CEO, PM |
| [COMPETITOR_ANALYSIS](01_Business/COMPETITOR_ANALYSIS.md) | 시장 대안과 positioning | Marketing |
| [KPI](01_Business/KPI.md) | Business metric 정의 | CEO, PM |

### Product

| 문서 | 목적 | Owner |
| --- | --- | --- |
| [FEATURES](02_Product/FEATURES.md) | 사용자에게 보이는 capability와 behavior | PM |
| [AUTH](02_Product/AUTH.md) | Authentication 경험 | PM, Backend |
| [USER_FLOW](02_Product/USER_FLOW.md) | End-to-end user journey | PM, Designer |
| [UI_GUIDE](02_Product/UI_GUIDE.md) | UI state와 interaction 원칙 | Designer, Frontend |
| [DESIGN_SYSTEM](02_Product/DESIGN_SYSTEM.md) | Token과 재사용 UI contract | Designer |
| [PROMPTS](02_Product/PROMPTS.md) | 제품 prompt 경험과 policy | PM, AI Engineer |
| [AI_GENERATION](02_Product/AI_GENERATION.md) | 사용자 관점의 생성 behavior | PM |
| [ADMIN](02_Product/ADMIN.md) | 승인된 운영 기능의 product behavior | PM |

### Architecture

| 문서 | 목적 | Owner |
| --- | --- | --- |
| [ARCHITECTURE](03_Architecture/ARCHITECTURE.md) | System structure와 dependency 방향 | CTO |
| [SYSTEM_CONTEXT](03_Architecture/SYSTEM_CONTEXT.md) | Actor, system과 trust boundary | CTO |
| [DATABASE](03_Architecture/DATABASE.md) | Persistence 원칙과 constraint | Database |
| [DATA_MODEL](03_Architecture/DATA_MODEL.md) | Entity, field, relation과 index | Database |
| [API](03_Architecture/API.md) | Internal API boundary | Backend |
| [STORAGE](03_Architecture/STORAGE.md) | Object lifecycle과 access model | Backend, DevOps |
| [SECURITY](03_Architecture/SECURITY.md) | Architecture security control | Security |
| [CACHE](03_Architecture/CACHE.md) | Caching과 invalidation policy | CTO |
| [LOGGING](03_Architecture/LOGGING.md) | Structured logging contract | DevOps |
| [MONITORING](03_Architecture/MONITORING.md) | Service health measurement | DevOps |

### Engineering

| 문서 | 목적 | Owner |
| --- | --- | --- |
| [CODING_STANDARD](04_Engineering/CODING_STANDARD.md) | 구현 품질 기준 | CTO |
| [AI_WORKFLOW](04_Engineering/AI_WORKFLOW.md) | Codex 실행 lifecycle | CTO, Document Writer |
| [TEST](04_Engineering/TEST.md) | Test layer와 release evidence | QA |
| [DEPLOYMENT](04_Engineering/DEPLOYMENT.md) | Environment와 deployment 절차 | DevOps |
| [RELEASE](04_Engineering/RELEASE.md) | Release gate checklist | QA, DevOps |
| [TODO](04_Engineering/TODO.md) | Roadmap으로 승격되지 않은 명시적 backlog | PM |
| [CHANGELOG](04_Engineering/CHANGELOG.md) | Engineering 변경 이력 | Document Writer |
| [FINAL_REPORT](04_Engineering/FINAL_REPORT.md) | Release 완료 기록 | PM, QA |

### AI, API와 Operations

| 영역 | 기준 문서 | Owner |
| --- | --- | --- |
| AI model | [MODELS](05_AI/MODELS.md), [MODEL_EVALUATION](05_AI/MODEL_EVALUATION.md) | AI Engineer |
| AI pipeline | [IMAGE_PIPELINE](05_AI/IMAGE_PIPELINE.md), [IMAGE_POST_PROCESSING](05_AI/IMAGE_POST_PROCESSING.md) | AI Engineer, Backend |
| AI prompt와 품질 | [PROMPT_ENGINEERING](05_AI/PROMPT_ENGINEERING.md), [QUALITY_CONTROL](05_AI/QUALITY_CONTROL.md), [COST_OPTIMIZATION](05_AI/COST_OPTIMIZATION.md) | AI Engineer |
| API contract | [REST](06_API/REST.md), [VERSIONING](06_API/VERSIONING.md), [ERROR_CODES](06_API/ERROR_CODES.md) | Backend |
| API trust | [AUTHORIZATION](06_API/AUTHORIZATION.md), [WEBHOOKS](06_API/WEBHOOKS.md) | Backend, Security |
| Operations | [RUNBOOK](07_Operations/RUNBOOK.md), [INCIDENT](07_Operations/INCIDENT.md), [DEVOPS](07_Operations/DEVOPS.md) | DevOps |
| Reliability | [OBSERVABILITY](07_Operations/OBSERVABILITY.md), [MONITORING](07_Operations/MONITORING.md), [BACKUP](07_Operations/BACKUP.md) | DevOps |

### Release, Security, Data와 Analytics

| 영역 | 기준 문서 | Owner |
| --- | --- | --- |
| Release | [MVP](08_Release/MVP.md), [RELEASE_NOTE](08_Release/RELEASE_NOTE.md), [VERSION_HISTORY](08_Release/VERSION_HISTORY.md) | PM, QA |
| Security | [THREAT_MODEL](09_Security/THREAT_MODEL.md), [AUTH_POLICY](09_Security/AUTH_POLICY.md), [SECRETS](09_Security/SECRETS.md), [RLS_POLICY](09_Security/RLS_POLICY.md), [PRIVACY](09_Security/PRIVACY.md) | Security |
| Data | [RETENTION](10_Data/RETENTION.md), [BACKUP_POLICY](10_Data/BACKUP_POLICY.md), [SCHEMA_HISTORY](10_Data/SCHEMA_HISTORY.md), [MIGRATIONS](10_Data/MIGRATIONS.md) | Database |
| Analytics | [EVENTS](11_Analytics/EVENTS.md), [FUNNEL](11_Analytics/FUNNEL.md), [DASHBOARD](11_Analytics/DASHBOARD.md), [METRICS](11_Analytics/METRICS.md) | PM, Marketing |

### AI Company 역할

역할의 상세 contract는 [AGENTS.md](../AGENTS.md)에 정의한다. CEO, PM, CTO, Frontend, Backend, AI Engineer, Designer, QA, Security, DevOps, Database, Marketing과 Support의 보조 profile은 [agents](agents/CEO.md)에 저장한다.

### Writing Conventions

모든 Markdown 문서는 자동 validation을 위해 다음 section 순서를 유지한다.

1. Title
2. Table of Contents
3. Overview
4. Goals
5. Requirements
6. Implementation
7. Checklist
8. Related Documents

추가 규칙:

- Relative Markdown link만 사용한다.
- 파일당 H1 하나와 올바른 heading hierarchy를 유지한다.
- `docs/`의 filename은 uppercase underscore 형식을 사용하고 `.codex`는 지정된 lowercase convention을 사용한다.
- Ownership과 contract는 table, requirement는 list, gate는 checkbox, code는 type이 지정된 fenced block으로 표현한다.
- 오래될 수 있는 결정에는 status, owner, evidence와 update trigger를 기록한다.
- Owner와 decision deadline이 없는 `TBD`를 사용하지 않는다.

### Update Policy

| 변경 영역 | 반드시 검토할 문서 |
| --- | --- |
| User behavior | Features, user flow, tests, release notes |
| API | Architecture API, REST, authorization, errors, tests |
| Database/RLS | Database, data model, migrations, RLS policy, backup |
| Object storage | Storage, data model, privacy, retention, tests, R2 playbook |
| AI model/prompt | Models, prompt engineering, evaluation, cost, quality |
| Payment/credit | Payments, credits, API, data model, tests, playbooks |
| Deployment/operations | Deployment, logging, observability, SLO/monitoring, Runbook, incident, release |
| Security/privacy | Threat model, auth policy, secrets, RLS, privacy |

구현 owner는 같은 Pull Request에서 문서를 갱신한다. Domain owner는 내용의 정확성을, Document Writer는 구조와 link를 승인한다. `npm run docs:check`는 필수다.

## Checklist

- [ ] 문서의 canonical domain과 owner가 하나다.
- [ ] 표준 section 순서가 존재한다.
- [ ] 관련 contract를 복제하지 않고 link로 연결했다.
- [ ] 모든 link가 상대경로이며 유효하다.
- [ ] Status와 evidence가 구현 상태와 일치한다.
- [ ] 오래될 수 있는 가정에 owner와 review trigger가 있다.
- [ ] `npm run docs:check`가 통과한다.

## Related Documents

- [저장소 안내](../README.md)
- [Codex Operating Contract](../CODEX.md)
- [Master Plan](../MASTER_PLAN.md)
- [AI Company Agent 운영 체계](../AGENTS.md)
- [Documentation Rule](../.codex/rules/documentation.md)
