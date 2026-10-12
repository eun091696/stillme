# Git Rule

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

Defines safe branch, commit, push, and Pull Request behavior for autonomous and human contributors.

## Goals

- Preserve history and unrelated work.
- Make every change reviewable and recoverable.

## Requirements

- Inspect branch, status, diff, and remote before mutation.
- Never discard, overwrite, force-push, or rewrite shared history without explicit authority.
- Never commit secrets or unrelated user changes.

## Implementation

Create a focused branch from the current base, stage explicit paths, commit logical units, validate before push, and describe purpose, risk, tests, documentation, migration, and rollback in the Pull Request.

## Checklist

- [ ] Base and working tree were inspected.
- [ ] Branch and commit scope are focused.
- [ ] Staged diff contains no secrets or unrelated files.
- [ ] Required validation passed.
- [ ] Push and Pull Request target are correct.

## Related Documents

- [Codex Operating Contract](../../CODEX.md)
- [Review Workflow](../workflows/review.md)
- [Release Workflow](../workflows/release.md)
