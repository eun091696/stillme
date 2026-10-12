create type public.credit_transaction_type as enum (
  'purchase_grant',
  'trial_grant',
  'promotion_grant',
  'generation_consume',
  'generation_restore',
  'payment_refund_reversal',
  'expiration',
  'manual_adjustment'
);

create table public.credit_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.credit_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.credit_accounts (user_id) on delete cascade,
  transaction_type public.credit_transaction_type not null,
  amount integer not null,
  idempotency_key uuid not null,
  policy_version text not null,
  reference_id uuid not null,
  reversal_of uuid,
  reason_code text,
  requested_by uuid references auth.users (id),
  approved_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint credit_ledger_id_user_unique unique (id, user_id),
  constraint credit_ledger_idempotency_unique unique (user_id, idempotency_key),
  constraint credit_ledger_reference_unique
    unique (user_id, transaction_type, reference_id),
  constraint credit_ledger_reversal_owner_fk
    foreign key (reversal_of, user_id)
    references public.credit_ledger_entries (id, user_id),
  constraint credit_ledger_amount_bounded
    check (amount <> 0 and abs(amount) <= 1000000),
  constraint credit_ledger_amount_direction
    check (
      (
        transaction_type in (
          'purchase_grant',
          'trial_grant',
          'promotion_grant',
          'generation_restore'
        )
        and amount > 0
      )
      or (
        transaction_type in (
          'generation_consume',
          'payment_refund_reversal',
          'expiration'
        )
        and amount < 0
      )
      or transaction_type = 'manual_adjustment'
    ),
  constraint credit_ledger_policy_version_format
    check (policy_version ~ '^[a-z0-9][a-z0-9._-]{0,39}$'),
  constraint credit_ledger_reason_code_format
    check (
      reason_code is null
      or reason_code ~ '^[A-Z0-9_]{1,64}$'
    ),
  constraint credit_ledger_reversal_required
    check (
      (
        transaction_type in (
          'generation_restore',
          'payment_refund_reversal'
        )
        and reversal_of is not null
      )
      or (
        transaction_type not in (
          'generation_restore',
          'payment_refund_reversal'
        )
        and reversal_of is null
      )
    ),
  constraint credit_ledger_manual_approval
    check (
      (
        transaction_type = 'manual_adjustment'
        and reason_code is not null
        and requested_by is not null
        and approved_by is not null
        and requested_by <> approved_by
      )
      or (
        transaction_type <> 'manual_adjustment'
        and requested_by is null
        and approved_by is null
      )
    )
);

create unique index credit_ledger_generation_restore_unique
  on public.credit_ledger_entries (reversal_of)
  where transaction_type = 'generation_restore';

create index credit_ledger_user_created_idx
  on public.credit_ledger_entries (user_id, created_at desc, id desc);

create index credit_ledger_reversal_idx
  on public.credit_ledger_entries (reversal_of)
  where reversal_of is not null;

alter table public.credit_accounts enable row level security;
alter table public.credit_accounts force row level security;
alter table public.credit_ledger_entries enable row level security;
alter table public.credit_ledger_entries force row level security;

revoke all on table public.credit_accounts from anon;
revoke all on table public.credit_accounts from authenticated;
revoke all on table public.credit_ledger_entries from anon;
revoke all on table public.credit_ledger_entries from authenticated;
grant select on table public.credit_accounts to authenticated;
grant select on table public.credit_ledger_entries to authenticated;
grant all on table public.credit_accounts to service_role;
grant all on table public.credit_ledger_entries to service_role;

create policy "credit_accounts_select_own"
  on public.credit_accounts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "credit_ledger_entries_select_own"
  on public.credit_ledger_entries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create function public.guard_credit_ledger_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_balance bigint;
  original_amount integer;
  original_type public.credit_transaction_type;
  prior_refund_amount bigint;
begin
  perform 1
  from public.credit_accounts
  where user_id = new.user_id
  for update;

  if not found then
    raise exception 'credit account does not exist';
  end if;

  select coalesce(sum(amount), 0)
  into current_balance
  from public.credit_ledger_entries
  where user_id = new.user_id;

  if current_balance + new.amount < 0 then
    raise exception 'credit balance cannot be negative';
  end if;

  if new.reversal_of is not null then
    select transaction_type, amount
    into original_type, original_amount
    from public.credit_ledger_entries
    where id = new.reversal_of
      and user_id = new.user_id;

    if not found then
      raise exception 'credit reversal target does not exist';
    end if;
  end if;

  if new.transaction_type = 'generation_restore' then
    if (
      original_type <> 'generation_consume'
      or new.amount <> -original_amount
    ) then
      raise exception 'generation restore must reverse one full consumption';
    end if;
  elsif new.transaction_type = 'payment_refund_reversal' then
    if original_type <> 'purchase_grant' then
      raise exception 'payment refund must reference a purchase grant';
    end if;

    select coalesce(sum(amount), 0)
    into prior_refund_amount
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

create function public.deny_credit_ledger_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'credit ledger entries are immutable';
end;
$$;

create function public.deny_credit_account_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'credit accounts are immutable';
end;
$$;

create trigger credit_ledger_guard_insert
  before insert on public.credit_ledger_entries
  for each row execute procedure public.guard_credit_ledger_insert();

create trigger credit_ledger_deny_update_delete
  before update or delete on public.credit_ledger_entries
  for each row execute procedure public.deny_credit_ledger_mutation();

create trigger credit_accounts_deny_update_delete
  before update or delete on public.credit_accounts
  for each row execute procedure public.deny_credit_account_mutation();

create function public.handle_new_credit_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.credit_accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.guard_credit_ledger_insert() from public;
revoke all on function public.deny_credit_ledger_mutation() from public;
revoke all on function public.deny_credit_account_mutation() from public;
revoke all on function public.handle_new_credit_account() from public;

create trigger on_auth_user_credit_account_created
  after insert on auth.users
  for each row execute procedure public.handle_new_credit_account();

insert into public.credit_accounts (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create view public.credit_balances
with (security_invoker = true)
as
select
  account.user_id,
  coalesce(sum(entry.amount), 0)::bigint as balance
from public.credit_accounts as account
left join public.credit_ledger_entries as entry
  on entry.user_id = account.user_id
group by account.user_id;

revoke all on table public.credit_balances from anon;
revoke all on table public.credit_balances from authenticated;
grant select on table public.credit_balances to authenticated;
grant select on table public.credit_balances to service_role;
