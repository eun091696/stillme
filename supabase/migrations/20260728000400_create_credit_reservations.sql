create type public.credit_reservation_status as enum (
  'reserved',
  'settled',
  'released'
);

create table public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  generation_job_id uuid not null unique
    references public.generation_jobs (id) on delete cascade,
  user_id uuid not null references public.credit_accounts (user_id) on delete cascade,
  amount integer not null,
  idempotency_key uuid not null,
  policy_version text not null,
  status public.credit_reservation_status not null default 'reserved',
  ledger_entry_id uuid,
  release_reason_code text,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  released_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint credit_reservations_id_user_unique unique (id, user_id),
  constraint credit_reservations_idempotency_unique unique (user_id, idempotency_key),
  constraint credit_reservations_ledger_owner_fk
    foreign key (ledger_entry_id, user_id)
    references public.credit_ledger_entries (id, user_id),
  constraint credit_reservations_amount_bounded
    check (amount between 1 and 1000000),
  constraint credit_reservations_policy_version_format
    check (policy_version ~ '^[a-z0-9][a-z0-9._-]{0,39}$'),
  constraint credit_reservations_release_reason_format
    check (
      release_reason_code is null
      or release_reason_code ~ '^[A-Z0-9_]{1,64}$'
    ),
  constraint credit_reservations_terminal_state_valid
    check (
      (
        status = 'reserved'
        and ledger_entry_id is null
        and release_reason_code is null
        and settled_at is null
        and released_at is null
      )
      or (
        status = 'settled'
        and ledger_entry_id is not null
        and release_reason_code is null
        and settled_at is not null
        and released_at is null
      )
      or (
        status = 'released'
        and ledger_entry_id is null
        and release_reason_code is not null
        and settled_at is null
        and released_at is not null
      )
    )
);

create index credit_reservations_user_status_idx
  on public.credit_reservations (user_id, status, created_at);

alter table public.credit_reservations enable row level security;
alter table public.credit_reservations force row level security;

revoke all on table public.credit_reservations from anon;
revoke all on table public.credit_reservations from authenticated;
revoke all on table public.credit_reservations from service_role;
grant select on table public.credit_reservations to authenticated;
grant select on table public.credit_reservations to service_role;

create policy "credit_reservations_select_own"
  on public.credit_reservations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create function public.guard_credit_reservation_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  settled_entry public.credit_ledger_entries%rowtype;
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then
      return old;
    end if;
    raise exception 'credit reservations cannot be deleted directly';
  end if;

  if (
    new.id,
    new.generation_job_id,
    new.user_id,
    new.amount,
    new.idempotency_key,
    new.policy_version,
    new.created_at
  ) is distinct from (
    old.id,
    old.generation_job_id,
    old.user_id,
    old.amount,
    old.idempotency_key,
    old.policy_version,
    old.created_at
  ) then
    raise exception 'credit reservation immutable fields cannot change';
  end if;

  if old.status <> 'reserved' or new.status not in ('settled', 'released') then
    raise exception 'invalid credit reservation state transition';
  end if;

  if new.status = 'settled' then
    select *
    into settled_entry
    from public.credit_ledger_entries
    where id = new.ledger_entry_id
      and user_id = new.user_id;

    if (
      not found
      or settled_entry.transaction_type <> 'generation_consume'
      or settled_entry.amount <> -new.amount
      or settled_entry.reference_id <> new.generation_job_id
      or settled_entry.policy_version <> new.policy_version
    ) then
      raise exception 'reservation settlement requires its matching ledger entry';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger credit_reservations_guard_mutation
  before update or delete on public.credit_reservations
  for each row execute procedure public.guard_credit_reservation_mutation();

create or replace view public.credit_balances
with (security_invoker = true)
as
with ledger_totals as (
  select user_id, sum(amount)::bigint as balance
  from public.credit_ledger_entries
  group by user_id
),
reservation_totals as (
  select user_id, sum(amount)::bigint as reserved_credits
  from public.credit_reservations
  where status = 'reserved'
  group by user_id
)
select
  account.user_id,
  coalesce(ledger.balance, 0)::bigint as balance,
  coalesce(reservation.reserved_credits, 0)::bigint as reserved_credits,
  (
    coalesce(ledger.balance, 0)
    - coalesce(reservation.reserved_credits, 0)
  )::bigint as available_balance
from public.credit_accounts as account
left join ledger_totals as ledger on ledger.user_id = account.user_id
left join reservation_totals as reservation on reservation.user_id = account.user_id;

revoke all on table public.credit_balances from anon;
revoke all on table public.credit_balances from authenticated;
grant select on table public.credit_balances to authenticated;
grant select on table public.credit_balances to service_role;

create function public.reserve_generation_credits(
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

  select user_id, status
  into job_user_id, job_status
  from public.generation_jobs
  where id = target_generation_job_id
  for update;

  if not found then
    raise exception 'generation job does not exist';
  end if;

  perform 1
  from public.credit_accounts
  where user_id = job_user_id
  for update;

  if not found then
    raise exception 'credit account does not exist';
  end if;

  select *
  into existing_reservation
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

  select *
  into existing_reservation
  from public.credit_reservations
  where generation_job_id = target_generation_job_id
  for update;

  if found then
    raise exception 'generation job already has a credit reservation';
  end if;

  if job_status <> 'queued' then
    raise exception 'credits can only be reserved for a queued generation job';
  end if;

  select coalesce(sum(amount), 0)
  into current_balance
  from public.credit_ledger_entries
  where user_id = job_user_id;

  select coalesce(sum(amount), 0)
  into reserved_total
  from public.credit_reservations
  where user_id = job_user_id
    and status = 'reserved';

  if current_balance - reserved_total < credit_amount then
    raise exception 'available credit balance is insufficient';
  end if;

  insert into public.credit_reservations (
    generation_job_id,
    user_id,
    amount,
    idempotency_key,
    policy_version
  )
  values (
    target_generation_job_id,
    job_user_id,
    credit_amount,
    request_idempotency_key,
    credit_policy_version
  )
  returning id into reservation_id;

  return reservation_id;
end;
$$;

create function public.settle_generation_credits(target_reservation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_user_id uuid;
  reservation_row public.credit_reservations%rowtype;
  job_status public.generation_job_status;
  settlement_entry_id uuid;
begin
  select user_id
  into reservation_user_id
  from public.credit_reservations
  where id = target_reservation_id;

  if not found then
    raise exception 'credit reservation does not exist';
  end if;

  perform 1
  from public.credit_accounts
  where user_id = reservation_user_id
  for update;

  select *
  into reservation_row
  from public.credit_reservations
  where id = target_reservation_id
  for update;

  if reservation_row.status = 'settled' then
    return reservation_row.ledger_entry_id;
  end if;
  if reservation_row.status <> 'reserved' then
    raise exception 'released credit reservation cannot be settled';
  end if;

  select status
  into job_status
  from public.generation_jobs
  where id = reservation_row.generation_job_id;

  if job_status <> 'succeeded' then
    raise exception 'credits can only be settled for a succeeded generation job';
  end if;

  insert into public.credit_ledger_entries (
    user_id,
    transaction_type,
    amount,
    idempotency_key,
    policy_version,
    reference_id
  )
  values (
    reservation_row.user_id,
    'generation_consume',
    -reservation_row.amount,
    reservation_row.id,
    reservation_row.policy_version,
    reservation_row.generation_job_id
  )
  returning id into settlement_entry_id;

  update public.credit_reservations
  set
    status = 'settled',
    ledger_entry_id = settlement_entry_id,
    settled_at = now()
  where id = reservation_row.id;

  return settlement_entry_id;
end;
$$;

create function public.release_generation_credits(
  target_reservation_id uuid,
  failure_reason_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_user_id uuid;
  reservation_row public.credit_reservations%rowtype;
  job_status public.generation_job_status;
  job_retryable boolean;
begin
  if (
    failure_reason_code is null
    or failure_reason_code !~ '^[A-Z0-9_]{1,64}$'
  ) then
    raise exception 'credit reservation release reason is invalid';
  end if;

  select user_id
  into reservation_user_id
  from public.credit_reservations
  where id = target_reservation_id;

  if not found then
    raise exception 'credit reservation does not exist';
  end if;

  perform 1
  from public.credit_accounts
  where user_id = reservation_user_id
  for update;

  select *
  into reservation_row
  from public.credit_reservations
  where id = target_reservation_id
  for update;

  if reservation_row.status = 'released' then
    if reservation_row.release_reason_code <> failure_reason_code then
      raise exception 'credit reservation release reason does not match';
    end if;
    return reservation_row.id;
  end if;
  if reservation_row.status <> 'reserved' then
    raise exception 'settled credit reservation cannot be released';
  end if;

  select status, retryable
  into job_status, job_retryable
  from public.generation_jobs
  where id = reservation_row.generation_job_id;

  if not (
    job_status = 'cancelled'
    or (job_status = 'failed' and not job_retryable)
  ) then
    raise exception 'credits can only be released after terminal failure or cancellation';
  end if;

  update public.credit_reservations
  set
    status = 'released',
    release_reason_code = failure_reason_code,
    released_at = now()
  where id = reservation_row.id;

  return reservation_row.id;
end;
$$;

revoke all on function public.guard_credit_reservation_mutation() from public;
revoke all on function public.reserve_generation_credits(uuid, integer, uuid, text)
  from public;
revoke all on function public.settle_generation_credits(uuid) from public;
revoke all on function public.release_generation_credits(uuid, text) from public;

grant execute
  on function public.reserve_generation_credits(uuid, integer, uuid, text)
  to service_role;
grant execute
  on function public.settle_generation_credits(uuid)
  to service_role;
grant execute
  on function public.release_generation_credits(uuid, text)
  to service_role;
