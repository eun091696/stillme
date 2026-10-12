import assert from "node:assert/strict";
import test from "node:test";
import { createAuthSupportRecord } from "./auth-support.mjs";

const validInput = {
  caseId: "AUTH-20260728-A1B2C3",
  environment: "development",
  issue: "password-reset",
  observedAt: "2026-07-28T03:00:00.000Z",
  requestId: "request_12345678",
};

test("creates a bounded support record without personal data", () => {
  const record = createAuthSupportRecord(validInput);

  assert.equal(record.schemaVersion, "auth-support-v1");
  assert.equal(record.nextProcedure, "playbooks/LOGIN_FAILURE.md");
  assert.equal("email" in record, false);
  assert.ok(record.prohibitedEvidence.includes("session_token"));
});

test("routes signup and verification cases to the signup playbook", () => {
  assert.equal(
    createAuthSupportRecord({ ...validInput, issue: "verification" }).nextProcedure,
    "playbooks/SIGNUP_FAILURE.md",
  );
});

test("rejects invalid case, environment, issue, timestamp, and request IDs", () => {
  assert.throws(() => createAuthSupportRecord({ ...validInput, caseId: "ticket-1" }));
  assert.throws(() =>
    createAuthSupportRecord({ ...validInput, environment: "unknown" }),
  );
  assert.throws(() => createAuthSupportRecord({ ...validInput, issue: "account-delete" }));
  assert.throws(() => createAuthSupportRecord({ ...validInput, observedAt: "yesterday" }));
  assert.throws(() => createAuthSupportRecord({ ...validInput, requestId: "short" }));
});
