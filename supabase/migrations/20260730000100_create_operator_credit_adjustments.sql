create type public.operator_credit_adjustment_reason as enum (
  'DUPLICATE_DEBIT',
  'SERVICE_RECOVERY',
  'PROMOTION_CORRECTION',
  'SUPPORT_CORRECTION'
);

create type public.operator_credit_adjustment_status as enum (
  'pending',
  'applied'
);

create table public.operator_credit_adjustment_requests (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users (id) on delete restrict,
  adjustment_amount integer not null,
  reason_code public.operator_credit_adjustment_reason not null,
  support_case_reference text not null,
  idempotency_key uuid not null,
  requested_by uuid not null references auth.users (id) on delete restrict,
  status public.operator_credit_adjustment_status not null default 'pending',
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  approved_by uuid references auth.users (id) on delete restrict,
  applied_at timestamptz,
  ledger_entry_id uuid unique
    references public.credit_ledger_entries (id) on delete restrict,
  constraint operator_credit_adjustment_amount_bounded
    check (
      adjustment_amount <> 0
      and abs(adjustment_amount) <= 150
    ),
  constraint operator_credit_adjustment_case_reference
    check (
      support_case_reference = btrim(support_case_reference)
      and support_case_reference ~ '^[A-Z0-9][A-Z0-9._:-]{2,127}$'
    ),
  constraint operator_credit_adjustment_requester_not_target
    check (requested_by <> target_user_id),
  constraint operator_credit_adjustment_expiry
    check (expires_at > requested_at),
  constraint operator_credit_adjustment_completion
    check (
      (
        status = 'pending'
        and approved_by is null
        and applied_at is null
        and ledger_entry_id is null
      )
      or
      (
        status = 'applied'
        and approved_by is not null
        and approved_by <> requested_by
        and approved_by <> target_user_id
        and applied_at is not null
        and ledger_entry_id is not null
      )
    ),
  unique (requested_by, idempotency_key)
);

create index operator_credit_adjustment_pending_idx
  on public.operator_credit_adjustment_requests (status, expires_at, requested_at)
  where status = 'pending';

comment on table public.operator_credit_adjustment_requests is
  'MFA-authenticated, dual-control requests for append-only credit corrections.';

alter table public.operator_credit_adjustment_requests enable row level security;
alter table public.operator_credit_adjustment_requests force row level security;

revoke all on table public.operator_credit_adjustment_requests from public;

create function public.request_operator_credit_adjustment(
  target_user_id uuid,
  adjustment_amount integer,
  request_reason_code public.operator_credit_adjustment_reason,
  support_case_reference text,
  request_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  existing_request public.operator_credit_adjustment_requests%rowtype;
  new_request_id uuid;
begin
  if not public.operator_has_permission('credit.adjust.request') then
    raise exception 'operator credit adjustment request is not authorized';
  end if;
  if target_user_id is null or not exists (
    select 1 from public.credit_accounts where user_id = target_user_id
  ) then
    raise exception 'target credit account does not exist';
  end if;
  if actor_user_id = target_user_id then
    raise exception 'operator cannot request an adjustment for self';
  end if;
  if (
    adjustment_amount is null
    or adjustment_amount = 0
    or abs(adjustment_amount) > 150
  ) then
    raise exception 'operator credit adjustment amount is invalid';
  end if;
  if (
    support_case_reference is null
    or support_case_reference <> btrim(support_case_reference)
    or support_case_reference !~ '^[A-Z0-9][A-Z0-9._:-]{2,127}$'
  ) then
    raise exception 'operator support case reference is invalid';
  end if;
  if request_idempotency_key is null then
    raise exception 'operator credit adjustment idempotency key is required';
  end if;

  perform 1
  from auth.users
  where id = actor_user_id
  for update;

  select * into existing_request
  from public.operator_credit_adjustment_requests
  where requested_by = actor_user_id
    and idempotency_key = request_idempotency_key;
  if found then
    if (
      existing_request.target_user_id <> target_user_id
      or existing_request.adjustment_amount <> adjustment_amount
      or existing_request.reason_code <> request_reason_code
      or existing_request.support_case_reference <> support_case_reference
    ) then
      raise exception 'operator credit adjustment idempotency key was reused';
    end if;
    return existing_request.id;
  end if;

  insert into public.operator_credit_adjustment_requests (
    target_user_id,
    adjustment_amount,
    reason_code,
    support_case_reference,
    idempotency_key,
    requested_by
  )
  values (
    target_user_id,
    adjustment_amount,
    request_reason_code,
    support_case_reference,
    request_idempotency_key,
    actor_user_id
  )
  returning id into new_request_id;

  return new_request_id;
end;
$$;

create function public.approve_operator_credit_adjustment(
  target_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  approver_user_id uuid := auth.uid();
  adjustment_request public.operator_credit_adjustment_requests%rowtype;
  current_available_balance bigint;
  new_ledger_entry_id uuid;
begin
  if not public.operator_has_permission('credit.adjust.approve') then
    raise exception 'operator credit adjustment approval is not authorized';
  end if;

  select * into adjustment_request
  from public.operator_credit_adjustment_requests
  where id = target_request_id
  for update;
  if not found then
    raise exception 'operator credit adjustment request does not exist';
  end if;
  if adjustment_request.status = 'applied' then
    return adjustment_request.ledger_entry_id;
  end if;
  if adjustment_request.expires_at <= now() then
    raise exception 'operator credit adjustment request expired';
  end if;
  if (
    approver_user_id = adjustment_request.requested_by
    or approver_user_id = adjustment_request.target_user_id
  ) then
    raise exception 'operator credit adjustment requires independent approval';
  end if;

  perform 1
  from public.credit_accounts
  where user_id = adjustment_request.target_user_id
  for update;
  if not found then
    raise exception 'target credit account does not exist';
  end if;

  select available_balance
  into current_available_balance
  from public.credit_balances
  where user_id = adjustment_request.target_user_id;

  if (
    adjustment_request.adjustment_amount < 0
    and current_available_balance + adjustment_request.adjustment_amount < 0
  ) then
    raise exception 'credit available balance cannot be negative';
  end if;

  insert into public.credit_ledger_entries (
    user_id,
    transaction_type,
    amount,
    idempotency_key,
    policy_version,
    reference_id,
    reason_code,
    requested_by,
    approved_by
  )
  values (
    adjustment_request.target_user_id,
    'manual_adjustment',
    adjustment_request.adjustment_amount,
    adjustment_request.id,
    'operator-adjustment-v1',
    adjustment_request.id,
    adjustment_request.reason_code::text,
    adjustment_request.requested_by,
    approver_user_id
  )
  returning id into new_ledger_entry_id;

  update public.operator_credit_adjustment_requests
  set
    status = 'applied',
    approved_by = approver_user_id,
    applied_at = now(),
    ledger_entry_id = new_ledger_entry_id
  where id = adjustment_request.id;

  return new_ledger_entry_id;
end;
$$;

create function public.operator_list_credit_adjustments()
returns table (
  request_id uuid,
  target_user_id uuid,
  adjustment_amount integer,
  reason_code public.operator_credit_adjustment_reason,
  support_case_reference text,
  status public.operator_credit_adjustment_status,
  requested_by uuid,
  requested_at timestamptz,
  expires_at timestamptz,
  applied_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_can_approve boolean;
begin
  if not public.operator_has_permission('credit.adjust.request') then
    raise exception 'operator credit adjustment listing is not authorized';
  end if;

  actor_can_approve :=
    public.operator_has_permission('credit.adjust.approve');

  return query
  select
    request.id,
    request.target_user_id,
    request.adjustment_amount,
    request.reason_code,
    request.support_case_reference,
    request.status,
    request.requested_by,
    request.requested_at,
    request.expires_at,
    request.applied_at
  from public.operator_credit_adjustment_requests as request
  where actor_can_approve or request.requested_by = auth.uid()
  order by request.requested_at desc, request.id desc
  limit 20;
end;
$$;

revoke all on function public.request_operator_credit_adjustment(
  uuid,
  integer,
  public.operator_credit_adjustment_reason,
  text,
  uuid
) from public;
revoke all on function public.approve_operator_credit_adjustment(uuid)
  from public;
revoke all on function public.operator_list_credit_adjustments()
  from public;

grant execute on function public.request_operator_credit_adjustment(
  uuid,
  integer,
  public.operator_credit_adjustment_reason,
  text,
  uuid
) to authenticated;
grant execute on function public.approve_operator_credit_adjustment(uuid)
  to authenticated;
grant execute on function public.operator_list_credit_adjustments()
  to authenticated;
