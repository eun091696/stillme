# Secrets Management

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

This document defines creation, classification, delivery, use, rotation, revocation, and incident handling for application secrets. Public identifiers and Supabase publishable keys are configuration; Supabase secret/service-role keys, R2 credentials, Toss secret keys, AI provider keys, tokens, and signing material are restricted secrets.

## Goals

- Keep secrets out of source control, client bundles, logs, analytics, and support tools.
- Minimize credential scope, lifetime, and blast radius.
- Separate development, staging, and production.
- Make rotation and compromise response testable.

## Requirements

### Rules

- Never prefix a secret with `NEXT_PUBLIC_` or pass it as a Client Component prop.
- Store deployed secrets in the approved provider secret store; local secrets use ignored environment files.
- `.env.example` contains names and safe descriptions only.
- Use distinct credentials per environment, provider, workload, and permission set.
- Service-role or bypass-RLS credentials are restricted to named server jobs and never share a browser/SSR user client.
- Prefer short-lived workload identity or scoped tokens where supported.
- Never paste real secret values into issues, PRs, commits, tests, screenshots, chat, documentation, analytics, or incident timelines.

### Inventory

Every credential record includes owner, provider, environment, purpose, permissions, storage location, consumers, creation time, rotation method, last rotation, next review, and revocation procedure. The inventory stores metadata only, not the value.

## Implementation

### Lifecycle

1. Owner requests the minimum credential for one workload and environment.
2. Security/DevOps reviews scope and delivery path.
3. Secret is injected only into the required server or job runtime.
4. CI and bundle scans confirm non-exposure.
5. Owner rotates on provider guidance, personnel/access change, scope change, or suspected exposure.
6. Revocation removes old access, redeploys consumers, and verifies provider/audit state.

### Exposure Response

1. Treat a suspected value as compromised; do not wait for proof of use.
2. Contain the consumer and revoke/rotate the credential.
3. Search repository history, artifacts, logs, analytics, caches, screenshots, and provider audit records.
4. Redeploy with a new value and verify old-value rejection.
5. Assess accessed data and financial actions, invoke incident/privacy procedures, and reconcile state.
6. Record root cause and preventive control without recording the secret.

Deleting a secret from the latest file does not remove it from Git history and is not remediation by itself.

### Verification

- pre-commit and CI secret scans over tracked content;
- Git history and generated build/client bundle scan before release;
- environment-variable allowlist review for client exposure;
- least-privilege provider-token review;
- scheduled rotation and emergency-rotation exercise;
- negative test proving old credentials are revoked.

## Checklist

- [x] Secret and public configuration boundaries are defined.
- [x] Environment separation, least privilege, inventory, rotation, and revocation are required.
- [x] Client, log, analytics, documentation, and support exposure are prohibited.
- [x] Exposure response treats repository history and artifacts as affected surfaces.
- [ ] Provider credentials and metadata inventory are configured.
- [ ] CI scans and a rotation exercise pass.

## Related Documents

- [Security Architecture](../03_Architecture/SECURITY.md)
- [Threat Model](THREAT_MODEL.md)
- [Authentication Policy](AUTH_POLICY.md)
- [Logging](../03_Architecture/LOGGING.md)
- [Deployment](../04_Engineering/DEPLOYMENT.md)
- [Incident Management](../07_Operations/INCIDENT.md)
