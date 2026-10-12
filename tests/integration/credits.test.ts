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
const admin = createClient(localSupabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = new Set<string>();

async function createUserClient(label: string) {
  const email = `credit-${label}-${crypto.randomUUID()}@example.test`;
  const password = `Test-${crypto.randomUUID()}-9a`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { display_name: `Credit ${label}` },
  });
  if (error) {
    throw error;
  }

  createdUserIds.add(data.user.id);
  const client = createClient(localSupabaseUrl, localPublishableKey, {
    auth: { persistSession: false },
  });
  const { error: loginError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (loginError) {
    throw loginError;
  }

  return { client, userId: data.user.id };
}

afterEach(async () => {
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      throw error;
    }
    createdUserIds.delete(userId);
  }
});

describe("credit ledger local integration", () => {
  it("computes owner balance and rejects cross-user, duplicate, and direct writes", async () => {
    const owner = await createUserClient("owner");
    const other = await createUserClient("other");
    const idempotencyKey = crypto.randomUUID();
    const referenceId = crypto.randomUUID();

    const { error: grantError } = await admin
      .from("credit_ledger_entries")
      .insert({
        amount: 3,
        idempotency_key: idempotencyKey,
        policy_version: "commercial-v1",
        reference_id: referenceId,
        transaction_type: "trial_grant",
        user_id: owner.userId,
      });
    expect(grantError).toBeNull();

    const { error: consumeError } = await admin
      .from("credit_ledger_entries")
      .insert({
        amount: -1,
        idempotency_key: crypto.randomUUID(),
        policy_version: "commercial-v1",
        reference_id: crypto.randomUUID(),
        transaction_type: "generation_consume",
        user_id: owner.userId,
      });
    expect(consumeError).toBeNull();

    const { data: ownerBalance, error: ownerBalanceError } = await owner.client
      .from("credit_balances")
      .select("balance")
      .single();
    const { data: ownerEntries, error: ownerEntriesError } = await owner.client
      .from("credit_ledger_entries")
      .select("amount, transaction_type")
      .order("created_at");
    expect(ownerBalanceError).toBeNull();
    expect(ownerEntriesError).toBeNull();
    expect(ownerBalance).toEqual({ balance: 2 });
    expect(ownerEntries).toEqual([
      { amount: 3, transaction_type: "trial_grant" },
      { amount: -1, transaction_type: "generation_consume" },
    ]);

    const { data: otherEntries, error: otherEntriesError } = await other.client
      .from("credit_ledger_entries")
      .select("id");
    expect(otherEntriesError).toBeNull();
    expect(otherEntries).toEqual([]);

    const { error: directWriteError } = await owner.client
      .from("credit_ledger_entries")
      .insert({
        amount: 3,
        idempotency_key: crypto.randomUUID(),
        policy_version: "commercial-v1",
        reference_id: crypto.randomUUID(),
        transaction_type: "trial_grant",
        user_id: owner.userId,
      });
    expect(directWriteError?.code).toBe("42501");

    const { error: duplicateError } = await admin
      .from("credit_ledger_entries")
      .insert({
        amount: 3,
        idempotency_key: idempotencyKey,
        policy_version: "commercial-v1",
        reference_id: crypto.randomUUID(),
        transaction_type: "trial_grant",
        user_id: owner.userId,
      });
    expect(duplicateError?.code).toBe("23505");

    const { error: insufficientError } = await admin
      .from("credit_ledger_entries")
      .insert({
        amount: -3,
        idempotency_key: crypto.randomUUID(),
        policy_version: "commercial-v1",
        reference_id: crypto.randomUUID(),
        transaction_type: "generation_consume",
        user_id: owner.userId,
      });
    expect(insufficientError?.code).toBe("P0001");
  });
});
