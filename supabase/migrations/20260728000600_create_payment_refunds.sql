create type public.payment_refund_status as enum (
  'pending',
  'reconciliation_required',
  'succeeded',
  'failed'
);

create type public.payment_reconciliation_outcome as enum (
  'in_sync',
  'repaired',
  'review_required'
);

create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  idempotency_key uuid not null,
  amount integer not null,
  credit_amount integer not null,
  currency text not null,
  reason_code text not null,
  policy_version text not null,
  status public.payment_refund_status not null default 'pending',
  provider_transaction_hash text,
  ledger_entry_id uuid,
  failure_code text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint payment_refunds_user_idempotency_unique
    unique (user_id, idempotency_key),
  constraint payment_refunds_id_user_unique unique (id, user_id),
  constraint payment_refunds_amount_positive
    check (amount > 0 and credit_amount > 0),
  constraint payment_refunds_currency_krw check (currency = 'KRW'),
  constraint payment_refunds_reason_code_format
    check (reason_code ~ '^[A-Z0-9_]{1,64}$'),
  constraint payment_refunds_policy_version_format
    check (policy_version ~ '^[a-z0-9][a-z0-9._-]{0,39}$'),
  constraint payment_refunds_provider_hash_format
    check (
      provider_transaction_hash is null
      or provider_transaction_hash ~ '^[a-f0-9]{64}$'
    ),
  constraint payment_refunds_failure_code_format
    check (
      failure_code is null
      or failure_code ~ '^[A-Z0-9_]{1,64}$'
    ),
  constraint payment_refunds_ledger_owner_fk
    foreign key (ledger_entry_id, user_id)
    references public.credit_ledger_entries (id, user_id),
  constraint payment_refunds_terminal_state_valid
    check (
      (
        status in ('pending', 'reconciliation_required')
        and ledger_entry_id is null
        and completed_at is null
      )
      or (
        status = 'succeeded'
        and provider_transaction_hash is not null
        and ledger_entry_id is not null
        and completed_at is not null
        and failure_code is null
      )
      or (
        status = 'failed'
        and ledger_entry_id is null
        and completed_at is not null
        and failure_code is not null
      )
    )
);

create unique index payment_refunds_one_active_or_successful
  on public.payment_refunds (payment_id)
  where status in ('pending', 'reconciliation_required', 'succeeded');
create unique index payment_refunds_provider_transaction_unique
  on public.payment_refunds (provider_transaction_hash)
  where provider_transaction_hash is not null;
create index payment_refunds_user_requested_idx
  on public.payment_refunds (user_id, requested_at desc);

create table public.payment_reconciliation_results (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  provider_snapshot_hash text not null,
  observed_status text not null,
  observed_balance_amount integer not null,
  observed_refund_amount integer not null,
  outcome public.payment_reconciliation_outcome not null,
  refund_id uuid references public.payment_refunds (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint payment_reconciliation_snapshot_unique
    unique (payment_id, provider_snapshot_hash),
  constraint payment_reconciliation_hash_format
    check (provider_snapshot_hash ~ '^[a-f0-9]{64}$'),
  constraint payment_reconciliation_amounts_valid
    check (
      observed_balance_amount >= 0
      and observed_refund_amount >= 0
    )
);

create index payment_reconciliation_review_idx
  on public.payment_reconciliation_results (created_at)
  where outcome = 'review_required';

alter table public.payment_refunds enable row level security;
alter table public.payment_refunds force row level security;
alter table public.payment_reconciliation_results enable row level security;
alter table public.payment_reconciliation_results force row level security;

revoke all on table public.payment_refunds
  from anon, authenticated, service_role;
revoke all on table public.payment_reconciliation_results
  from anon, authenticated, service_role;
grant select on table public.payment_refunds to authenticated, service_role;
grant select on table public.payment_reconciliation_results to service_role;

create policy "payment_refunds_select_own"
  on public.payment_refunds
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create function public.guard_payment_refund_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then return old; end if;
    raise exception 'payment refunds cannot be deleted directly';
  end if;
  if (
    new.id, new.payment_id, new.user_id, new.idempotency_key,
    new.amount, new.credit_amount, new.currency, new.reason_code,
    new.policy_version, new.requested_at
  ) is distinct from (
    old.id, old.payment_id, old.user_id, old.idempotency_key,
    old.amount, old.credit_amount, old.currency, old.reason_code,
    old.policy_version, old.requested_at
  ) then
    raise exception 'payment refund identity cannot change';
  end if;
  if (
    old.status in ('pending', 'reconciliation_required')
    and new.status in ('reconciliation_required', 'succeeded', 'failed')
  ) then
    new.updated_at := now();
    return new;
  end if;
  raise exception 'invalid payment refund state transition';
end;
$$;

create function public.deny_payment_reconciliation_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  if (
    tg_op = 'UPDATE'
    and pg_trigger_depth() > 1
    and old.refund_id is not null
    and new.refund_id is null
    and (
      new.id, new.payment_id, new.provider_snapshot_hash,
      new.observed_status, new.observed_balance_amount,
      new.observed_refund_amount, new.outcome, new.created_at
    ) is not distinct from (
      old.id, old.payment_id, old.provider_snapshot_hash,
      old.observed_status, old.observed_balance_amount,
      old.observed_refund_amount, old.outcome, old.created_at
    )
  ) then
    return new;
  end if;
  raise exception 'payment reconciliation results are immutable';
end;
$$;

create trigger payment_refunds_guard_mutation
  before update or delete on public.payment_refunds
  for each row execute procedure public.guard_payment_refund_mutation();
create trigger payment_reconciliation_deny_mutation
  before update or delete on public.payment_reconciliation_results
  for each row execute procedure public.deny_payment_reconciliation_mutation();

create or replace view public.credit_balances
with (security_invoker = true)
as
with ledger_totals as (
  select user_id, sum(amount)::bigint as balance
  from public.credit_ledger_entries
  group by user_id
),
generation_reservation_totals as (
  select user_id, sum(amount)::bigint as reserved_credits
  from public.credit_reservations
  where status = 'reserved'
  group by user_id
),
refund_reservation_totals as (
  select user_id, sum(credit_amount)::bigint as reserved_credits
  from public.payment_refunds
  where status in ('pending', 'reconciliation_required')
  group by user_id
)
select
  account.user_id,
  coalesce(ledger.balance, 0)::bigint as balance,
  coalesce(generation.reserved_credits, 0)::bigint as reserved_credits,
  (
    coalesce(ledger.balance, 0)
    - coalesce(generation.reserved_credits, 0)
    - coalesce(refund.reserved_credits, 0)
  )::bigint as available_balance,
  coalesce(refund.reserved_credits, 0)::bigint as refund_reserved_credits
from public.credit_accounts as account
left join ledger_totals as ledger on ledger.user_id = account.user_id
left join generation_reservation_totals as generation
  on generation.user_id = account.user_id
left join refund_reservation_totals as refund
  on refund.user_id = account.user_id;

revoke all on table public.credit_balances from anon;
revoke all on table public.credit_balances from authenticated;
grant select on table public.credit_balances to authenticated;
grant select on table public.credit_balances to service_role;

create or replace function public.reserve_generation_credits(
  target_generation_job_id uuid,
  credit_amount integer,
  request_idempotency_key uuid,
  credit_policy_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_user_id uuid;
  job_status public.generation_job_status;
  existing_reservation public.credit_reservations%rowtype;
  current_balance bigint;
  reserved_total bigint;
  refund_reserved_total bigint;
  reservation_id uuid;
begin
  if credit_amount is null or credit_amount < 1 or credit_amount > 1000000 then
    raise exception 'credit reservation amount is invalid';
  end if;
  if request_idempotency_key is null then
    raise exception 'credit reservation idempotency key is required';
  end if;
  if (
    credit_policy_version is null
    or credit_policy_version !~ '^[a-z0-9][a-z0-9._-]{0,39}$'
  ) then
    raise exception 'credit reservation policy version is invalid';
  end if;

  select user_id, status into job_user_id, job_status
  from public.generation_jobs
  where id = target_generation_job_id
  for update;
  if not found then raise exception 'generation job does not exist'; end if;

  perform 1 from public.credit_accounts
  where user_id = job_user_id
  for update;
  if not found then raise exception 'credit account does not exist'; end if;

  select * into existing_reservation
  from public.credit_reservations
  where user_id = job_user_id
    and idempotency_key = request_idempotency_key
  for update;
  if found then
    if (
      existing_reservation.generation_job_id <> target_generation_job_id
      or existing_reservation.amount <> credit_amount
      or existing_reservation.policy_version <> credit_policy_version
    ) then
      raise exception 'credit reservation idempotency key was reused';
    end if;
    return existing_reservation.id;
  end if;

  select * into existing_reservation
  from public.credit_reservations
  where generation_job_id = target_generation_job_id
  for update;
  if found then
    raise exception 'generation job already has a credit reservation';
  end if;
  if job_status <> 'queued' then
    raise exception 'credits can only be reserved for a queued generation job';
  end if;

  select coalesce(sum(amount), 0) into current_balance
  from public.credit_ledger_entries where user_id = job_user_id;
  select coalesce(sum(amount), 0) into reserved_total
  from public.credit_reservations
  where user_id = job_user_id and status = 'reserved';
  select coalesce(sum(refund.credit_amount), 0) into refund_reserved_total
  from public.payment_refunds as refund
  where refund.user_id = job_user_id
    and refund.status in ('pending', 'reconciliation_required');

  if current_balance - reserved_total - refund_reserved_total < credit_amount then
    raise exception 'available credit balance is insufficient';
  end if;

  insert into public.credit_reservations (
    generation_job_id, user_id, amount, idempotency_key, policy_version
  )
  values (
    target_generation_job_id, job_user_id, credit_amount,
    request_idempotency_key, credit_policy_version
  )
  returning id into reservation_id;
  return reservation_id;
end;
$$;

create or replace function public.guard_credit_ledger_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_balance bigint;
  refund_reserved_total bigint;
  original_amount integer;
  original_type public.credit_transaction_type;
  prior_refund_amount bigint;
begin
  perform 1 from public.credit_accounts
  where user_id = new.user_id
  for update;
  if not found then raise exception 'credit account does not exist'; end if;

  select coalesce(sum(amount), 0) into current_balance
  from public.credit_ledger_entries where user_id = new.user_id;
  if current_balance + new.amount < 0 then
    raise exception 'credit balance cannot be negative';
  end if;

  if new.amount < 0 then
    select coalesce(sum(credit_amount), 0)
    into refund_reserved_total
    from public.payment_refunds
    where user_id = new.user_id
      and status in ('pending', 'reconciliation_required')
      and (
        new.transaction_type <> 'payment_refund_reversal'
        or id <> new.reference_id
      );
    if current_balance - refund_reserved_total + new.amount < 0 then
      raise exception 'credit balance is reserved for a refund';
    end if;
  end if;

  if new.reversal_of is not null then
    select transaction_type, amount into original_type, original_amount
    from public.credit_ledger_entries
    where id = new.reversal_of and user_id = new.user_id;
    if not found then raise exception 'credit reversal target does not exist'; end if;
  end if;

  if new.transaction_type = 'generation_restore' then
    if original_type <> 'generation_consume' or new.amount <> -original_amount then
      raise exception 'generation restore must reverse one full consumption';
    end if;
  elsif new.transaction_type = 'payment_refund_reversal' then
    if original_type <> 'purchase_grant' then
      raise exception 'payment refund must reference a purchase grant';
    end if;
    select coalesce(sum(amount), 0) into prior_refund_amount
    from public.credit_ledger_entries
    where reversal_of = new.reversal_of
      and transaction_type = 'payment_refund_reversal';
    if abs(prior_refund_amount + new.amount) > original_amount then
      raise exception 'payment refund exceeds purchase grant';
    end if;
  end if;
  return new;
end;
$$;

create function public.begin_payment_refund(
  target_user_id uuid,
  target_payment_id uuid,
  request_idempotency_key uuid,
  refund_reason_code text
)
returns table (
  refund_id uuid,
  refund_status public.payment_refund_status,
  order_number text,
  refund_amount integer,
  refund_credit_amount integer,
  refund_currency text,
  payment_key_hash text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.payments%rowtype;
  order_row public.payment_orders%rowtype;
  existing_refund public.payment_refunds%rowtype;
  current_balance bigint;
  generation_reserved bigint;
  refund_reserved bigint;
  new_refund_id uuid;
begin
  if target_user_id is null or target_payment_id is null
    or request_idempotency_key is null then
    raise exception 'refund identity is required';
  end if;
  if refund_reason_code not in (
    'CUSTOMER_REQUEST', 'DUPLICATE_PAYMENT', 'SERVICE_NOT_PROVIDED'
  ) then
    raise exception 'refund reason is invalid';
  end if;

  select * into payment_row from public.payments
  where id = target_payment_id and user_id = target_user_id
  for update;
  if not found then raise exception 'payment does not exist'; end if;
  select * into order_row from public.payment_orders
  where id = payment_row.order_id
  for update;

  perform 1 from public.credit_accounts
  where user_id = target_user_id for update;

  select * into existing_refund from public.payment_refunds
  where user_id = target_user_id
    and idempotency_key = request_idempotency_key
  for update;
  if found then
    if (
      existing_refund.payment_id <> target_payment_id
      or existing_refund.reason_code <> refund_reason_code
    ) then
      raise exception 'refund idempotency key was reused';
    end if;
    return query select
      existing_refund.id, existing_refund.status, order_row.order_number,
      existing_refund.amount, existing_refund.credit_amount,
      existing_refund.currency, payment_row.payment_key_hash;
    return;
  end if;

  if order_row.status <> 'paid' then
    raise exception 'only a paid order can be refunded';
  end if;
  if payment_row.approved_at < now() - interval '7 days' then
    raise exception 'refund eligibility period has expired';
  end if;
  if exists (
    select 1
    from public.credit_ledger_entries as later_entry
    join public.credit_ledger_entries as purchase_entry
      on purchase_entry.id = payment_row.ledger_entry_id
    where later_entry.user_id = target_user_id
      and later_entry.id <> purchase_entry.id
      and later_entry.amount < 0
      and later_entry.created_at > purchase_entry.created_at
  ) then
    raise exception 'refundable purchase credits cannot be proven unused';
  end if;
  if exists (
    select 1 from public.payment_refunds
    where payment_id = target_payment_id
      and status in ('pending', 'reconciliation_required', 'succeeded')
  ) then
    raise exception 'payment already has an active refund';
  end if;

  select coalesce(sum(amount), 0) into current_balance
  from public.credit_ledger_entries where user_id = target_user_id;
  select coalesce(sum(amount), 0) into generation_reserved
  from public.credit_reservations
  where user_id = target_user_id and status = 'reserved';
  select coalesce(sum(credit_amount), 0) into refund_reserved
  from public.payment_refunds
  where user_id = target_user_id
    and status in ('pending', 'reconciliation_required');
  if (
    current_balance - generation_reserved - refund_reserved
    < order_row.credit_amount
  ) then
    raise exception 'refundable purchase credits are unavailable';
  end if;

  insert into public.payment_refunds (
    payment_id, user_id, idempotency_key, amount, credit_amount,
    currency, reason_code, policy_version
  )
  values (
    payment_row.id, target_user_id, request_idempotency_key,
    payment_row.amount, order_row.credit_amount, payment_row.currency,
    refund_reason_code, order_row.product_version
  )
  returning id into new_refund_id;

  return query select
    new_refund_id, 'pending'::public.payment_refund_status,
    order_row.order_number, payment_row.amount, order_row.credit_amount,
    payment_row.currency, payment_row.payment_key_hash;
end;
$$;

create function public.mark_payment_refund_reconciliation_required(
  target_refund_id uuid
)
returns public.payment_refund_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.payment_refund_status;
begin
  select status into current_status from public.payment_refunds
  where id = target_refund_id for update;
  if not found then raise exception 'payment refund does not exist'; end if;
  if current_status = 'pending' then
    update public.payment_refunds
    set status = 'reconciliation_required'
    where id = target_refund_id;
    return 'reconciliation_required';
  end if;
  return current_status;
end;
$$;

create function public.fail_payment_refund(
  target_refund_id uuid,
  safe_failure_code text
)
returns public.payment_refund_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.payment_refund_status;
begin
  if safe_failure_code !~ '^[A-Z0-9_]{1,64}$' then
    raise exception 'refund failure code is invalid';
  end if;
  select status into current_status from public.payment_refunds
  where id = target_refund_id for update;
  if not found then raise exception 'payment refund does not exist'; end if;
  if current_status in ('pending', 'reconciliation_required') then
    update public.payment_refunds
    set
      status = 'failed',
      failure_code = safe_failure_code,
      completed_at = now()
    where id = target_refund_id;
    return 'failed';
  end if;
  return current_status;
end;
$$;

create function public.apply_verified_payment_refund(
  target_refund_id uuid,
  verified_payment_key_hash text,
  verified_order_number text,
  verified_amount integer,
  verified_currency text,
  verified_status text,
  verified_balance_amount integer,
  verified_provider_transaction_hash text,
  verified_canceled_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  refund_row public.payment_refunds%rowtype;
  payment_row public.payments%rowtype;
  order_row public.payment_orders%rowtype;
  ledger_id uuid;
begin
  select * into refund_row from public.payment_refunds
  where id = target_refund_id for update;
  if not found then raise exception 'payment refund does not exist'; end if;
  select * into payment_row from public.payments
  where id = refund_row.payment_id for update;
  select * into order_row from public.payment_orders
  where id = payment_row.order_id for update;
  perform 1 from public.credit_accounts
  where user_id = refund_row.user_id for update;

  if (
    verified_payment_key_hash <> payment_row.payment_key_hash
    or verified_order_number <> order_row.order_number
    or verified_amount <> refund_row.amount
    or verified_currency <> refund_row.currency
    or verified_status <> 'CANCELED'
    or verified_balance_amount <> 0
    or verified_provider_transaction_hash !~ '^[a-f0-9]{64}$'
    or verified_canceled_at is null
  ) then
    raise exception 'verified refund does not match the payment';
  end if;

  if refund_row.status = 'succeeded' then
    if (
      refund_row.provider_transaction_hash
        <> verified_provider_transaction_hash
    ) then
      raise exception 'completed refund verification does not match';
    end if;
    return refund_row.ledger_entry_id;
  end if;
  if refund_row.status not in ('pending', 'reconciliation_required') then
    raise exception 'payment refund cannot be completed';
  end if;

  insert into public.credit_ledger_entries (
    user_id, transaction_type, amount, idempotency_key, policy_version,
    reference_id, reversal_of, reason_code
  )
  values (
    refund_row.user_id, 'payment_refund_reversal',
    -refund_row.credit_amount, refund_row.id, refund_row.policy_version,
    refund_row.id, payment_row.ledger_entry_id, refund_row.reason_code
  )
  returning id into ledger_id;

  update public.payment_refunds
  set
    status = 'succeeded',
    provider_transaction_hash = verified_provider_transaction_hash,
    ledger_entry_id = ledger_id,
    completed_at = verified_canceled_at,
    failure_code = null
  where id = refund_row.id;
  return ledger_id;
end;
$$;

create function public.reconcile_verified_toss_payment(
  target_user_id uuid,
  target_payment_id uuid,
  provider_snapshot_hash text,
  verified_payment_key_hash text,
  verified_order_number text,
  verified_amount integer,
  verified_currency text,
  verified_status text,
  verified_balance_amount integer,
  verified_refund_amount integer,
  verified_provider_transaction_hash text,
  verified_canceled_at timestamptz
)
returns table (
  reconciliation_id uuid,
  reconciliation_outcome public.payment_reconciliation_outcome,
  refund_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.payments%rowtype;
  order_row public.payment_orders%rowtype;
  refund_row public.payment_refunds%rowtype;
  existing_result public.payment_reconciliation_results%rowtype;
  new_result_id uuid;
  outcome public.payment_reconciliation_outcome;
  balance_total bigint;
  generation_reserved bigint;
begin
  if provider_snapshot_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'provider snapshot hash is invalid';
  end if;
  select * into payment_row from public.payments
  where id = target_payment_id and user_id = target_user_id
  for update;
  if not found then raise exception 'payment does not exist'; end if;
  select * into order_row from public.payment_orders
  where id = payment_row.order_id for update;
  if (
    verified_payment_key_hash <> payment_row.payment_key_hash
    or verified_order_number <> order_row.order_number
    or verified_amount <> payment_row.amount
    or verified_currency <> payment_row.currency
    or verified_balance_amount < 0
    or verified_refund_amount < 0
    or verified_balance_amount + verified_refund_amount <> payment_row.amount
  ) then
    raise exception 'provider payment does not match local payment';
  end if;

  select * into existing_result from public.payment_reconciliation_results
  where payment_id = payment_row.id
    and payment_reconciliation_results.provider_snapshot_hash
      = reconcile_verified_toss_payment.provider_snapshot_hash;
  if found then
    return query select
      existing_result.id, existing_result.outcome, existing_result.refund_id;
    return;
  end if;

  select * into refund_row from public.payment_refunds
  where payment_id = payment_row.id
    and status in ('pending', 'reconciliation_required', 'succeeded')
  order by requested_at desc
  limit 1
  for update;

  if (
    verified_status = 'DONE'
    and verified_balance_amount = payment_row.amount
    and verified_refund_amount = 0
  ) then
    if found and refund_row.status in ('pending', 'reconciliation_required') then
      update public.payment_refunds
      set
        status = 'failed',
        failure_code = 'PROVIDER_NOT_CANCELED',
        completed_at = now()
      where id = refund_row.id;
      outcome := 'repaired';
    elsif found and refund_row.status = 'succeeded' then
      outcome := 'review_required';
    else
      outcome := 'in_sync';
    end if;
  elsif (
    verified_status = 'CANCELED'
    and verified_balance_amount = 0
    and verified_refund_amount = payment_row.amount
    and verified_provider_transaction_hash ~ '^[a-f0-9]{64}$'
    and verified_canceled_at is not null
  ) then
    if found and refund_row.status = 'succeeded' then
      if (
        refund_row.provider_transaction_hash
          = verified_provider_transaction_hash
      ) then
        outcome := 'in_sync';
      else
        outcome := 'review_required';
      end if;
    else
      if not found then
        select coalesce(sum(amount), 0) into balance_total
        from public.credit_ledger_entries where user_id = target_user_id;
        select coalesce(sum(amount), 0) into generation_reserved
        from public.credit_reservations
        where user_id = target_user_id and status = 'reserved';
        if balance_total - generation_reserved < order_row.credit_amount then
          outcome := 'review_required';
        else
          insert into public.payment_refunds (
            payment_id, user_id, idempotency_key, amount, credit_amount,
            currency, reason_code, policy_version, status
          )
          values (
            payment_row.id, target_user_id, payment_row.id,
            payment_row.amount, order_row.credit_amount, payment_row.currency,
            'PROVIDER_RECONCILIATION', order_row.product_version,
            'reconciliation_required'
          )
          returning * into refund_row;
        end if;
      end if;
      if outcome is null then
        perform public.apply_verified_payment_refund(
          refund_row.id, verified_payment_key_hash, verified_order_number,
          verified_amount, verified_currency, verified_status,
          verified_balance_amount, verified_provider_transaction_hash,
          verified_canceled_at
        );
        outcome := 'repaired';
      end if;
    end if;
  else
    outcome := 'review_required';
  end if;

  insert into public.payment_reconciliation_results (
    payment_id, provider_snapshot_hash, observed_status,
    observed_balance_amount, observed_refund_amount, outcome, refund_id
  )
  values (
    payment_row.id, provider_snapshot_hash, verified_status,
    verified_balance_amount, verified_refund_amount, outcome,
    case when refund_row.id is null then null else refund_row.id end
  )
  returning id into new_result_id;
  return query select new_result_id, outcome, refund_row.id;
end;
$$;

revoke all on function public.guard_payment_refund_mutation() from public;
revoke all on function public.deny_payment_reconciliation_mutation() from public;
revoke all on function public.begin_payment_refund(uuid, uuid, uuid, text)
  from public;
revoke all on function public.mark_payment_refund_reconciliation_required(uuid)
  from public;
revoke all on function public.fail_payment_refund(uuid, text) from public;
revoke all on function public.apply_verified_payment_refund(
  uuid, text, text, integer, text, text, integer, text, timestamptz
) from public;
revoke all on function public.reconcile_verified_toss_payment(
  uuid, uuid, text, text, text, integer, text, text, integer, integer,
  text, timestamptz
) from public;

grant execute on function public.begin_payment_refund(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.mark_payment_refund_reconciliation_required(uuid)
  to service_role;
grant execute on function public.fail_payment_refund(uuid, text)
  to service_role;
grant execute on function public.apply_verified_payment_refund(
  uuid, text, text, integer, text, text, integer, text, timestamptz
) to service_role;
grant execute on function public.reconcile_verified_toss_payment(
  uuid, uuid, text, text, text, integer, text, text, integer, integer,
  text, timestamptz
) to service_role;
