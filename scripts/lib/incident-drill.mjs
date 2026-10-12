const ALLOWED_OUTCOMES = new Set(["repaired", "review_required"]);

export function buildPaymentIncidentDrillReport({
  observedAt,
  repairedOutcome,
  repairedReplayConverged,
  repairedLedgerInvariant,
  reviewOutcome,
  reviewPreservedCredits,
}) {
  if (
    !Number.isFinite(Date.parse(observedAt)) ||
    !ALLOWED_OUTCOMES.has(repairedOutcome) ||
    !ALLOWED_OUTCOMES.has(reviewOutcome)
  ) {
    throw new Error("Payment incident drill evidence is invalid.");
  }

  const passed =
    repairedOutcome === "repaired" &&
    repairedReplayConverged === true &&
    repairedLedgerInvariant === true &&
    reviewOutcome === "review_required" &&
    reviewPreservedCredits === true;

  return {
    schemaVersion: "payment-incident-drill-v1",
    playbookId: "RB-PAY-001",
    environment: "local",
    scenario: "provider-cancellation-reconciliation",
    severity: "SEV2",
    observedAt,
    status: passed ? "passed" : "failed",
    evidence: {
      automaticRepair: repairedOutcome,
      idempotentReplay: repairedReplayConverged,
      ledgerInvariant: repairedLedgerInvariant,
      unsafeRepairEscalation: reviewOutcome,
      reservedCreditsPreserved: reviewPreservedCredits,
    },
  };
}
