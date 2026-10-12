# Coding Rule

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

Defines repository-wide implementation discipline independent of a specific framework layer.

## Goals

- Keep changes readable, reversible, testable, and aligned with domain boundaries.
- Prevent hidden coupling and speculative abstractions.

## Requirements

- Preserve existing behavior unless an approved requirement changes it.
- Prefer explicit types, small functions, dependency injection at external boundaries, and domain-specific names.
- Do not commit dead code, unexplained TODOs, secrets, or production mocks.

## Implementation

Implement one coherent responsibility per module. Keep side effects at named boundaries. Convert external data into validated internal types. Handle expected errors explicitly. Reuse a pattern only after the shared contract is stable.

## Checklist

- [ ] The change has one clear responsibility.
- [ ] Inputs and external responses are validated.
- [ ] Errors and cleanup paths are implemented.
- [ ] Tests cover behavior and failure paths.
- [ ] No unrelated refactor is included.

## Related Documents

- [Coding Standard](../../docs/04_Engineering/CODING_STANDARD.md)
- [TypeScript Rule](typescript.md)
- [Architecture Rule](architecture.md)
