import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  throw new Error(
    "Start local Supabase and configure the local test environment.",
  );
}

const localSupabaseUrl = supabaseUrl;
const localPublishableKey = publishableKey;
const localServiceRoleKey = serviceRoleKey;
const admin = createClient(localSupabaseUrl, localServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = new Set<string>();

async function createUserClient(label: string) {
  const email = `reservation-${label}-${crypto.randomUUID()}@example.test`;
  const password = `Test-${crypto.randomUUID()}-9a`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { display_name: `Reservation ${label}` },
  });
  if (error) throw error;

  createdUserIds.add(data.user.id);
  const client = createClient(localSupabaseUrl, localPublishableKey, {
    auth: { persistSession: false },
  });
  const { error: loginError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (loginError) throw loginError;

  return { client, userId: data.user.id };
}

async function createQueuedJob(userId: string) {
  const id = crypto.randomUUID();
  const { error } = await admin.from("generation_jobs").insert({
    id,
    user_id: userId,
    idempotency_key: crypto.randomUUID(),
    prompt: "credit reservation integration",
    style: "photographic",
    aspect_ratio: "1:1",
    model_id: "imagen-3",
    provider_model: "imagen-3.0-generate-002",
    adapter_version: "google-v1",
    prompt_template_version: "prompt-v1",
  });
  if (error) throw error;
  return id;
}

afterEach(async () => {
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
    createdUserIds.delete(userId);
  }
});

describe("generation credit reservation integration", () => {
  it("reserves, settles, and releases exactly once through server RPCs", async () => {
    const owner = await createUserClient("owner");
    const other = await createUserClient("other");
    const successfulJobId = await createQueuedJob(owner.userId);
    const failedJobId = await createQueuedJob(owner.userId);

    const { error: grantError } = await admin
      .from("credit_ledger_entries")
      .insert({
        amount: 5,
        idempotency_key: crypto.randomUUID(),
        policy_version: "commercial-v1",
        reference_id: crypto.randomUUID(),
        transaction_type: "trial_grant",
        user_id: owner.userId,
      });
    expect(grantError).toBeNull();

    const reservationRequest = {
      credit_amount: 2,
      credit_policy_version: "commercial-v1",
      request_idempotency_key: crypto.randomUUID(),
      target_generation_job_id: successfulJobId,
    };
    const firstReservation = await admin.rpc(
      "reserve_generation_credits",
      reservationRequest,
    );
    const repeatedReservation = await admin.rpc(
      "reserve_generation_credits",
      reservationRequest,
    );
    expect(firstReservation.error).toBeNull();
    expect(repeatedReservation.error).toBeNull();
    expect(repeatedReservation.data).toBe(firstReservation.data);

    const { data: reservedBalance, error: reservedBalanceError } =
      await owner.client
        .from("credit_balances")
        .select("balance, reserved_credits, available_balance")
        .single();
    expect(reservedBalanceError).toBeNull();
    expect(reservedBalance).toEqual({
      available_balance: 3,
      balance: 5,
      reserved_credits: 2,
    });

    const { data: otherReservations, error: otherReservationError } =
      await other.client.from("credit_reservations").select("id");
    expect(otherReservationError).toBeNull();
    expect(otherReservations).toEqual([]);

    expect(
      (
        await admin
          .from("generation_jobs")
          .update({ status: "processing" })
          .eq("id", successfulJobId)
      ).error,
    ).toBeNull();
    expect(
      (
        await admin
          .from("generation_jobs")
          .update({ status: "succeeded" })
          .eq("id", successfulJobId)
      ).error,
    ).toBeNull();

    const firstSettlement = await admin.rpc("settle_generation_credits", {
      target_reservation_id: firstReservation.data,
    });
    const repeatedSettlement = await admin.rpc("settle_generation_credits", {
      target_reservation_id: firstReservation.data,
    });
    expect(firstSettlement.error).toBeNull();
    expect(repeatedSettlement.error).toBeNull();
    expect(repeatedSettlement.data).toBe(firstSettlement.data);

    const failedReservation = await admin.rpc(
      "reserve_generation_credits",
      {
        credit_amount: 2,
        credit_policy_version: "commercial-v1",
        request_idempotency_key: crypto.randomUUID(),
        target_generation_job_id: failedJobId,
      },
    );
    expect(failedReservation.error).toBeNull();
    expect(
      (
        await admin
          .from("generation_jobs")
          .update({ status: "cancelled" })
          .eq("id", failedJobId)
      ).error,
    ).toBeNull();

    const firstRelease = await admin.rpc("release_generation_credits", {
      failure_reason_code: "USER_CANCELLED",
      target_reservation_id: failedReservation.data,
    });
    const repeatedRelease = await admin.rpc("release_generation_credits", {
      failure_reason_code: "USER_CANCELLED",
      target_reservation_id: failedReservation.data,
    });
    expect(firstRelease.error).toBeNull();
    expect(repeatedRelease.error).toBeNull();
    expect(repeatedRelease.data).toBe(firstRelease.data);

    const { data: finalBalance, error: finalBalanceError } = await owner.client
      .from("credit_balances")
      .select("balance, reserved_credits, available_balance")
      .single();
    expect(finalBalanceError).toBeNull();
    expect(finalBalance).toEqual({
      available_balance: 3,
      balance: 3,
      reserved_credits: 0,
    });

    const { count, error: consumeCountError } = await admin
      .from("credit_ledger_entries")
      .select("id", { count: "exact", head: true })
      .eq("transaction_type", "generation_consume")
      .eq("reference_id", successfulJobId);
    expect(consumeCountError).toBeNull();
    expect(count).toBe(1);
  });

  it("serializes stale reconciliation against concurrent completion", async () => {
    const owner = await createUserClient("reconciliation-race");
    const jobId = await createQueuedJob(owner.userId);
    const { error: grantError } = await admin
      .from("credit_ledger_entries")
      .insert({
        amount: 5,
        idempotency_key: crypto.randomUUID(),
        policy_version: "commercial-v1",
        reference_id: crypto.randomUUID(),
        transaction_type: "trial_grant",
        user_id: owner.userId,
      });
    expect(grantError).toBeNull();

    const reservation = await admin.rpc("reserve_generation_credits", {
      credit_amount: 1,
      credit_policy_version: "commercial-v1",
      request_idempotency_key: crypto.randomUUID(),
      target_generation_job_id: jobId,
    });
    expect(reservation.error).toBeNull();
    expect((await admin.rpc("start_generation_request", {
      target_generation_job_id: jobId,
      target_reservation_id: reservation.data,
    })).error).toBeNull();

    await Promise.allSettled([
      admin.rpc("complete_generation_request", {
        target_generation_job_id: jobId,
        target_reservation_id: reservation.data,
      }),
      admin.rpc("reconcile_stale_generation_credit_reservations", {
        as_of: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        batch_limit: 100,
        stale_after: "30 minutes",
      }),
    ]);

    const [{ data: job }, { data: finalReservation }, { count }] = await Promise.all([
      admin.from("generation_jobs").select("status").eq("id", jobId).single(),
      admin.from("credit_reservations").select("status")
        .eq("id", reservation.data).single(),
      admin.from("credit_ledger_entries")
        .select("id", { count: "exact", head: true })
        .eq("transaction_type", "generation_consume")
        .eq("reference_id", jobId),
    ]);

    expect([
      { consumeCount: 1, job: "succeeded", reservation: "settled" },
      { consumeCount: 0, job: "failed", reservation: "released" },
    ]).toContainEqual({
      consumeCount: count,
      job: job?.status,
      reservation: finalReservation?.status,
    });
  });
});
