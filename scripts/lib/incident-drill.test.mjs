import assert from "node:assert/strict";
import test from "node:test";

import { buildPaymentIncidentDrillReport } from "./incident-drill.mjs";

test("builds bounded payment drill evidence without customer or provider identifiers", () => {
  const report = buildPaymentIncidentDrillReport({
    observedAt: "2026-07-30T12:00:00.000Z",
    repairedOutcome: "repaired",
    repairedReplayConverged: true,
    repairedLedgerInvariant: true,
    reviewOutcome: "review_required",
    reviewPreservedCredits: true,
    userId: "must-not-leak",
    paymentKey: "must-not-leak",
    providerPayload: "must-not-leak",
  });

  assert.equal(report.status, "passed");
  assert.equal(JSON.stringify(report).includes("must-not-leak"), false);
  assert.deepEqual(Object.keys(report.evidence), [
    "automaticRepair",
    "idempotentReplay",
    "ledgerInvariant",
    "unsafeRepairEscalation",
    "reservedCreditsPreserved",
  ]);
});

test("fails the drill when an economic invariant is not verified", () => {
  const report = buildPaymentIncidentDrillReport({
    observedAt: "2026-07-30T12:00:00.000Z",
    repairedOutcome: "repaired",
    repairedReplayConverged: true,
    repairedLedgerInvariant: false,
    reviewOutcome: "review_required",
    reviewPreservedCredits: true,
  });

  assert.equal(report.status, "failed");
});
