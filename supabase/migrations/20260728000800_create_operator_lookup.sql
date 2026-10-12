create type public.operator_lookup_domain as enum (
  'user',
  'payment',
  'credit',
  'generation'
);

create table public.operator_lookup_audit_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  target_user_id uuid not null references auth.users (id) on delete restrict,
  domain public.operator_lookup_domain not null,
  created_at timestamptz not null default now(),
  unique (actor_user_id, target_user_id, domain, request_id)
);

comment on table public.operator_lookup_audit_events is
  'Immutable audit evidence for successful operator lookups.';

alter table public.operator_lookup_audit_events enable row level security;
alter table public.operator_lookup_audit_events force row level security;

revoke all on table public.operator_lookup_audit_events from public;

create function public.record_operator_lookup(
  target_user_id uuid,
  lookup_domain public.operator_lookup_domain,
  lookup_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_event public.operator_lookup_audit_events%rowtype;
begin
  if target_user_id is null or not exists (
    select 1 from auth.users where id = target_user_id
  ) then
    raise exception 'target user does not exist';
  end if;
  if lookup_request_id is null then
    raise exception 'operator lookup request id is required';
  end if;

  select * into existing_event
  from public.operator_lookup_audit_events
  where request_id = lookup_request_id;
  if found then
    if (
      existing_event.actor_user_id <> auth.uid()
      or existing_event.target_user_id <> target_user_id
      or existing_event.domain <> lookup_domain
    ) then
      raise exception 'operator lookup request id was reused';
    end if;
    return;
  end if;

  insert into public.operator_lookup_audit_events (
    request_id,
    actor_user_id,
    target_user_id,
    domain
  )
  values (
    lookup_request_id,
    auth.uid(),
    target_user_id,
    lookup_domain
  );
end;
$$;

create function public.operator_lookup_user(
  target_user_id uuid,
  lookup_request_id uuid
)
returns table (
  user_id uuid,
  display_name text,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.operator_has_permission('user.read') then
    raise exception 'operator user lookup is not authorized';
  end if;

  perform public.record_operator_lookup(
    target_user_id,
    'user',
    lookup_request_id
  );

  return query
  select profile.id, profile.display_name, profile.created_at
  from public.profiles as profile
  where profile.id = target_user_id;
end;
$$;

create function public.operator_lookup_credit(
  target_user_id uuid,
  lookup_request_id uuid
)
returns table (
  balance bigint,
  reserved_credits bigint,
  refund_reserved_credits bigint,
  available_balance bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.operator_has_permission('credit.read') then
    raise exception 'operator credit lookup is not authorized';
  end if;

  perform public.record_operator_lookup(
    target_user_id,
    'credit',
    lookup_request_id
  );

  return query
  select
    credit.balance,
    credit.reserved_credits,
    credit.refund_reserved_credits,
    credit.available_balance
  from public.credit_balances as credit
  where credit.user_id = target_user_id;
end;
$$;

create function public.operator_lookup_payments(
  target_user_id uuid,
  lookup_request_id uuid
)
returns table (
  order_id uuid,
  order_number text,
  product_code text,
  amount integer,
  credit_amount integer,
  currency text,
  status public.payment_order_status,
  paid_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.operator_has_permission('payment.read') then
    raise exception 'operator payment lookup is not authorized';
  end if;

  perform public.record_operator_lookup(
    target_user_id,
    'payment',
    lookup_request_id
  );

  return query
  select
    payment_order.id,
    payment_order.order_number,
    payment_order.product_code,
    payment_order.amount,
    payment_order.credit_amount,
    payment_order.currency,
    payment_order.status,
    payment_order.paid_at,
    payment_order.created_at
  from public.payment_orders as payment_order
  where payment_order.user_id = target_user_id
  order by payment_order.created_at desc, payment_order.id desc
  limit 10;
end;
$$;

create function public.operator_lookup_generations(
  target_user_id uuid,
  lookup_request_id uuid
)
returns table (
  generation_job_id uuid,
  status public.generation_job_status,
  style text,
  aspect_ratio text,
  model_id text,
  attempt_count integer,
  last_error_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.operator_has_permission('generation.read') then
    raise exception 'operator generation lookup is not authorized';
  end if;

  perform public.record_operator_lookup(
    target_user_id,
    'generation',
    lookup_request_id
  );

  return query
  select
    generation.id,
    generation.status,
    generation.style,
    generation.aspect_ratio,
    generation.model_id,
    generation.attempt_count,
    generation.last_error_code,
    generation.created_at,
    generation.updated_at
  from public.generation_jobs as generation
  where generation.user_id = target_user_id
  order by generation.created_at desc, generation.id desc
  limit 10;
end;
$$;

revoke all on function public.record_operator_lookup(
  uuid,
  public.operator_lookup_domain,
  uuid
) from public;
revoke all on function public.operator_lookup_user(uuid, uuid) from public;
revoke all on function public.operator_lookup_credit(uuid, uuid) from public;
revoke all on function public.operator_lookup_payments(uuid, uuid) from public;
revoke all on function public.operator_lookup_generations(uuid, uuid) from public;

grant execute on function public.operator_lookup_user(uuid, uuid)
  to authenticated;
grant execute on function public.operator_lookup_credit(uuid, uuid)
  to authenticated;
grant execute on function public.operator_lookup_payments(uuid, uuid)
  to authenticated;
grant execute on function public.operator_lookup_generations(uuid, uuid)
  to authenticated;
