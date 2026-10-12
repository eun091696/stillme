# AI Development Workflow

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

Defines the lifecycle for autonomous Codex development from request classification through verified handoff.

## Goals

- Make AI changes deterministic, reviewable, and safe.
- Keep roadmap, domain documentation, code, tests, and operations synchronized.

## Requirements

- Follow the mandatory reading order in `CODEX.md`.
- Select a dependency-ready `MASTER_PLAN.md` milestone.
- Load the applicable workflow, rules, checklist, owners, and canonical documents.
- Stop at missing authority, unsafe external action, or unresolved product choice.

## Implementation

1. Classify the task with the Task Router.
2. Inspect current repository and external state.
3. Derive acceptance criteria and validation evidence.
4. Plan one coherent reversible change.
5. Implement within authorized scope.
6. Run focused tests and repository gates.
7. Update canonical documentation and roadmap evidence.
8. Review the diff for security, data, operations, and unrelated changes.
9. Commit, push, and create a Pull Request only when requested.
10. Return the completion report from `CODEX.md`.

## Checklist

- [ ] Reading order and task routing completed.
- [ ] Dependencies and authority confirmed.
- [ ] Required rules and documents loaded.
- [ ] Acceptance evidence defined before implementation.
- [ ] Validation and review completed.
- [ ] Documentation and roadmap are synchronized.
- [ ] Completion report is evidence-based.

## Related Documents

- [Codex Operating Contract](../../CODEX.md)
- [Master Plan](../../MASTER_PLAN.md)
- [Agent System](../../AGENTS.md)
- [Feature Workflow](../../.codex/workflows/feature.md)
- [Validation Rule](../../.codex/rules/validation.md)
