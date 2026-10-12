import "server-only";

import { createAdminClient } from "../supabase/admin";

const STALE_AFTER = "30 minutes";

export type GenerationCreditReconciliationResult = {
  scanned: number;
  released: number;
  skipped: number;
  failed: number;
};

function boundedCount(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

export function createGenerationCreditReconciliationLogRecord(
  result: GenerationCreditReconciliationResult,
) {
  return {
    schema_version: 1,
    timestamp: new Date().toISOString(),
    severity_text: result.failed > 0 ? "ERROR" : "INFO",
    service_name: "ai-photo-studio",
    deployment_environment: process.env.NODE_ENV ?? "development",
    event_name: "generation_credit.reconciliation",
    outcome: result.failed > 0 ? "partial_failure" : "success",
    scanned_count: result.scanned,
    released_count: result.released,
    skipped_count: result.skipped,
    failed_count: result.failed,
  } as const;
}

export async function reconcileStaleGenerationCreditReservations(
  limit = 50,
): Promise<GenerationCreditReconciliationResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("INVALID_RECONCILIATION_LIMIT");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc(
    "reconcile_stale_generation_credit_reservations",
    {
      as_of: new Date().toISOString(),
      stale_after: STALE_AFTER,
      batch_limit: limit,
    },
  );
  if (error) throw new Error("GENERATION_CREDIT_RECONCILIATION_FAILED");

  const row = Array.isArray(data) ? data[0] : null;
  const result = {
    scanned: boundedCount(row?.scanned_count),
    released: boundedCount(row?.released_count),
    skipped: boundedCount(row?.skipped_count),
    failed: boundedCount(row?.failed_count),
  };
  const record = createGenerationCreditReconciliationLogRecord(result);
  const serialized = JSON.stringify(record);
  if (result.failed > 0) console.error(serialized);
  else console.info(serialized);
  return result;
}
