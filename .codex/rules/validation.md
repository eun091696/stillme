# Validation Rule

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

Defines the evidence required before Codex may claim a task is complete.

## Goals

- Match validation scope to the requested outcome and risk.
- Make failures, omissions, and environment gaps explicit.

## Requirements

- Run documentation, type, lint, build, and applicable test gates.
- Verify external state when the outcome includes GitHub, deployment, migration, or provider behavior.
- Never infer broad completion from a narrow passing test.

## Implementation

Define evidence before editing. Validate requirements individually, then run repository-wide regression gates. Record the command or inspection, result, covered scope, and remaining gaps.

## Checklist

- [ ] Every acceptance criterion has direct evidence.
- [ ] Failure and rollback behavior were checked.
- [ ] Documentation, typecheck, lint, and build pass.
- [ ] Relevant unit, integration, and E2E tests pass.
- [ ] External state was verified where required.

## Related Documents

- [Test Strategy](../../docs/04_Engineering/TEST.md)
- [Codex Operating Contract](../../CODEX.md)
- [Feature Checklist](../checklists/feature.md)
