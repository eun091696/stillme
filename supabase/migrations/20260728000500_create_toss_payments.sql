create type public.payment_order_status as enum (
  'created',
  'pending',
  'paid',
  'failed',
  'cancelled'
);

create type public.payment_receipt_status as enum (
  'received',
  'processed',
  'ignored',
  'quarantined'
);

create table public.credit_products (
  code text primary key,
  version text not null,
  display_name text not null,
  amount integer not null,
  credit_amount integer not null,
  currency text not null default 'KRW',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint credit_products_code_format
    check (code ~ '^[A-Z0-9-]{3,32}$'),
  constraint credit_products_version_format
    check (version ~ '^[a-z0-9][a-z0-9._-]{0,39}$'),
  constraint credit_products_amount_positive
    check (amount > 0 and credit_amount > 0),
  constraint credit_products_currency_krw check (currency = 'KRW')
);

insert into public.credit_products (
  code, version, display_name, amount, credit_amount
)
values
  ('STARTER-20', 'commercial-v1', 'Starter 20', 4900, 20),
  ('CREATOR-60', 'commercial-v1', 'Creator 60', 11900, 60),
  ('STUDIO-150', 'commercial-v1', 'Studio 150', 24900, 150);

create table public.payment_orders (
  id uuid primary key,
  order_number text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  product_code text not null references public.credit_products (code),
  product_version text not null,
  amount integer not null,
  credit_amount integer not null,
  currency text not null,
  idempotency_key uuid not null,
  status public.payment_order_status not null default 'created',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint payment_orders_user_idempotency_unique
    unique (user_id, idempotency_key),
  constraint payment_orders_number_format
    check (order_number ~ '^aps_[0-9a-f]{32}$'),
  constraint payment_orders_amount_positive
    check (amount > 0 and credit_amount > 0),
  constraint payment_orders_currency_krw check (currency = 'KRW'),
  constraint payment_orders_paid_state_valid
    check (
      (status = 'paid' and paid_at is not null)
      or (status <> 'paid' and paid_at is null)
    )
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.payment_orders (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'toss',
  payment_key_hash text not null unique,
  amount integer not null,
  currency text not null,
  provider_status text not null,
  ledger_entry_id uuid not null,
  approved_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint payments_id_user_unique unique (id, user_id),
  constraint payments_ledger_owner_fk
    foreign key (ledger_entry_id, user_id)
    references public.credit_ledger_entries (id, user_id),
  constraint payments_provider_toss check (provider = 'toss'),
  constraint payments_key_hash_format
    check (payment_key_hash ~ '^[a-f0-9]{64}$'),
  constraint payments_amount_positive check (amount > 0),
  constraint payments_currency_krw check (currency = 'KRW'),
  constraint payments_provider_status_done check (provider_status = 'DONE')
);

create table public.payment_webhook_receipts (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'toss',
  transmission_id text not null,
  event_type text not null,
  payload_hash text not null,
  payment_key_hash text not null,
  order_id uuid references public.payment_orders (id) on delete set null,
  status public.payment_receipt_status not null default 'received',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint payment_webhook_provider_transmission_unique
    unique (provider, transmission_id),
  constraint payment_webhook_provider_toss check (provider = 'toss'),
  constraint payment_webhook_transmission_format
    check (transmission_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
  constraint payment_webhook_event_supported
    check (event_type = 'PAYMENT_STATUS_CHANGED'),
  constraint payment_webhook_payload_hash_format
    check (payload_hash ~ '^[a-f0-9]{64}$'),
  constraint payment_webhook_payment_hash_format
    check (payment_key_hash ~ '^[a-f0-9]{64}$'),
  constraint payment_webhook_terminal_state_valid
    check (
      (status = 'received' and processed_at is null)
      or (status <> 'received' and processed_at is not null)
    )
);

create index payment_orders_user_created_idx
  on public.payment_orders (user_id, created_at desc);
create index payments_user_created_idx
  on public.payments (user_id, created_at desc);
create index payment_webhook_order_idx
  on public.payment_webhook_receipts (order_id, received_at desc)
  where order_id is not null;

alter table public.credit_products enable row level security;
alter table public.credit_products force row level security;
alter table public.payment_orders enable row level security;
alter table public.payment_orders force row level security;
alter table public.payments enable row level security;
alter table public.payments force row level security;
alter table public.payment_webhook_receipts enable row level security;
alter table public.payment_webhook_receipts force row level security;

revoke all on table public.credit_products from anon, authenticated, service_role;
revoke all on table public.payment_orders from anon, authenticated, service_role;
revoke all on table public.payments from anon, authenticated, service_role;
revoke all on table public.payment_webhook_receipts
  from anon, authenticated, service_role;
grant select on table public.credit_products to authenticated, service_role;
grant select on table public.payment_orders to authenticated, service_role;
grant select on table public.payments to authenticated, service_role;
grant select on table public.payment_webhook_receipts to service_role;

create policy "credit_products_select_active"
  on public.credit_products
  for select
  to authenticated
  using (active);

create policy "payment_orders_select_own"
  on public.payment_orders
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "payments_select_own"
  on public.payments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create function public.guard_payment_order_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then return old; end if;
    raise exception 'payment orders cannot be deleted directly';
  end if;
  if (
    new.id, new.order_number, new.user_id, new.product_code,
    new.product_version, new.amount, new.credit_amount, new.currency,
    new.idempotency_key, new.created_at
  ) is distinct from (
    old.id, old.order_number, old.user_id, old.product_code,
    old.product_version, old.amount, old.credit_amount, old.currency,
    old.idempotency_key, old.created_at
  ) then
    raise exception 'payment order immutable fields cannot change';
  end if;
  if old.status not in ('created', 'pending') or new.status <> 'paid' then
    raise exception 'invalid payment order state transition';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create function public.deny_payment_record_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  raise exception 'payment records are immutable';
end;
$$;

create function public.guard_payment_webhook_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then return old; end if;
    raise exception 'payment webhook receipts are immutable';
  end if;
  if (
    pg_trigger_depth() > 1
    and old.order_id is not null
    and new.order_id is null
    and (
      new.id, new.provider, new.transmission_id, new.event_type,
      new.payment_key_hash, new.received_at
    ) is not distinct from (
      old.id, old.provider, old.transmission_id, old.event_type,
      old.payment_key_hash, old.received_at
    )
  ) then
    return new;
  end if;
  if (
    new.id, new.provider, new.transmission_id, new.event_type,
    new.payment_key_hash, new.order_id, new.received_at
  ) is distinct from (
    old.id, old.provider, old.transmission_id, old.event_type,
    old.payment_key_hash, old.order_id, old.received_at
  ) then
    raise exception 'payment webhook identity cannot change';
  end if;
  if old.status = 'received' and new.status in ('processed', 'ignored') then
    return new;
  end if;
  if new.status = 'quarantined' and old.status <> 'quarantined' then
    return new;
  end if;
  raise exception 'invalid payment webhook receipt transition';
end;
$$;

create trigger payment_orders_guard_mutation
  before update or delete on public.payment_orders
  for each row execute procedure public.guard_payment_order_mutation();
create trigger payments_deny_mutation
  before update or delete on public.payments
  for each row execute procedure public.deny_payment_record_mutation();
create trigger payment_webhooks_guard_mutation
  before update or delete on public.payment_webhook_receipts
  for each row execute procedure public.guard_payment_webhook_mutation();

create function public.create_payment_order(
  target_user_id uuid,
  target_product_code text,
  request_idempotency_key uuid
)
returns table (
  id uuid,
  order_number text,
  amount integer,
  credit_amount integer,
  currency text,
  status public.payment_order_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_row public.credit_products%rowtype;
  existing_order public.payment_orders%rowtype;
  new_order_id uuid;
begin
  if target_user_id is null or request_idempotency_key is null then
    raise exception 'payment order identity is required';
  end if;

  select * into product_row
  from public.credit_products
  where code = target_product_code and active;
  if not found then raise exception 'credit product is unavailable'; end if;

  perform 1 from public.credit_accounts
  where user_id = target_user_id
  for update;
  if not found then raise exception 'credit account does not exist'; end if;

  select * into existing_order
  from public.payment_orders
  where user_id = target_user_id
    and idempotency_key = request_idempotency_key
  for update;

  if found then
    if (
      existing_order.product_code <> product_row.code
      or existing_order.product_version <> product_row.version
    ) then
      raise exception 'payment order idempotency key was reused';
    end if;
    return query select
      existing_order.id, existing_order.order_number, existing_order.amount,
      existing_order.credit_amount, existing_order.currency,
      existing_order.status;
    return;
  end if;

  new_order_id := gen_random_uuid();
  insert into public.payment_orders (
    id, order_number, user_id, product_code, product_version, amount,
    credit_amount, currency, idempotency_key, status
  )
  values (
    new_order_id,
    'aps_' || replace(new_order_id::text, '-', ''),
    target_user_id,
    product_row.code,
    product_row.version,
    product_row.amount,
    product_row.credit_amount,
    product_row.currency,
    request_idempotency_key,
    'pending'
  )
  returning
    payment_orders.id, payment_orders.order_number, payment_orders.amount,
    payment_orders.credit_amount, payment_orders.currency, payment_orders.status
  into id, order_number, amount, credit_amount, currency, status;
  return next;
end;
$$;

create function public.apply_verified_toss_payment(
  target_order_id uuid,
  verified_payment_key_hash text,
  verified_order_number text,
  verified_amount integer,
  verified_currency text,
  verified_status text,
  verified_approved_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.payment_orders%rowtype;
  existing_payment public.payments%rowtype;
  ledger_id uuid;
  payment_id uuid;
begin
  if verified_payment_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'payment key hash is invalid';
  end if;

  select * into order_row
  from public.payment_orders
  where id = target_order_id
  for update;
  if not found then raise exception 'payment order does not exist'; end if;

  if (
    verified_order_number <> order_row.order_number
    or verified_amount <> order_row.amount
    or verified_currency <> order_row.currency
    or verified_status <> 'DONE'
    or verified_approved_at is null
  ) then
    raise exception 'verified payment does not match the order';
  end if;

  if order_row.status = 'paid' then
    select * into existing_payment
    from public.payments
    where order_id = order_row.id;
    if (
      not found
      or existing_payment.payment_key_hash <> verified_payment_key_hash
      or existing_payment.amount <> verified_amount
    ) then
      raise exception 'paid order verification does not match';
    end if;
    return existing_payment.id;
  end if;

  if order_row.status not in ('created', 'pending') then
    raise exception 'payment order cannot be paid';
  end if;

  insert into public.credit_ledger_entries (
    user_id, transaction_type, amount, idempotency_key, policy_version,
    reference_id
  )
  values (
    order_row.user_id,
    'purchase_grant',
    order_row.credit_amount,
    order_row.id,
    order_row.product_version,
    order_row.id
  )
  returning credit_ledger_entries.id into ledger_id;

  insert into public.payments (
    order_id, user_id, payment_key_hash, amount, currency, provider_status,
    ledger_entry_id, approved_at
  )
  values (
    order_row.id, order_row.user_id, verified_payment_key_hash,
    verified_amount, verified_currency, verified_status, ledger_id,
    verified_approved_at
  )
  returning payments.id into payment_id;

  update public.payment_orders
  set status = 'paid', paid_at = verified_approved_at
  where payment_orders.id = order_row.id;

  return payment_id;
end;
$$;

create function public.record_verified_toss_payment(
  target_user_id uuid,
  target_order_id uuid,
  verified_payment_key_hash text,
  verified_order_number text,
  verified_amount integer,
  verified_currency text,
  verified_status text,
  verified_approved_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.payment_orders
    where id = target_order_id and user_id = target_user_id
  ) then
    raise exception 'payment order does not exist';
  end if;
  return public.apply_verified_toss_payment(
    target_order_id, verified_payment_key_hash, verified_order_number,
    verified_amount, verified_currency, verified_status, verified_approved_at
  );
end;
$$;

create function public.process_verified_toss_webhook(
  webhook_transmission_id text,
  webhook_event_type text,
  webhook_payload_hash text,
  verified_payment_key_hash text,
  verified_order_number text,
  verified_amount integer,
  verified_currency text,
  verified_status text,
  verified_approved_at timestamptz
)
returns table (receipt_id uuid, receipt_status public.payment_receipt_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.payment_orders%rowtype;
  existing_receipt public.payment_webhook_receipts%rowtype;
  new_receipt_id uuid;
begin
  if webhook_event_type <> 'PAYMENT_STATUS_CHANGED' then
    raise exception 'payment webhook event type is unsupported';
  end if;
  if webhook_payload_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'payment webhook payload hash is invalid';
  end if;

  select * into existing_receipt
  from public.payment_webhook_receipts
  where provider = 'toss'
    and transmission_id = webhook_transmission_id
  for update;

  if found then
    if existing_receipt.payload_hash <> webhook_payload_hash then
      update public.payment_webhook_receipts
      set status = 'quarantined', processed_at = now()
      where id = existing_receipt.id;
      return query select existing_receipt.id, 'quarantined'::public.payment_receipt_status;
    else
      return query select existing_receipt.id, existing_receipt.status;
    end if;
    return;
  end if;

  select * into order_row
  from public.payment_orders
  where order_number = verified_order_number;
  if not found then raise exception 'payment order does not exist'; end if;
  if (
    verified_amount <> order_row.amount
    or verified_currency <> order_row.currency
  ) then
    raise exception 'verified payment does not match the order';
  end if;

  insert into public.payment_webhook_receipts (
    transmission_id, event_type, payload_hash, payment_key_hash, order_id
  )
  values (
    webhook_transmission_id, webhook_event_type, webhook_payload_hash,
    verified_payment_key_hash, order_row.id
  )
  returning id into new_receipt_id;

  if verified_status = 'DONE' then
    perform public.apply_verified_toss_payment(
      order_row.id, verified_payment_key_hash, verified_order_number,
      verified_amount, verified_currency, verified_status, verified_approved_at
    );
    update public.payment_webhook_receipts
    set status = 'processed', processed_at = now()
    where id = new_receipt_id;
    receipt_status := 'processed';
  else
    update public.payment_webhook_receipts
    set status = 'ignored', processed_at = now()
    where id = new_receipt_id;
    receipt_status := 'ignored';
  end if;

  receipt_id := new_receipt_id;
  return next;
end;
$$;

revoke all on function public.guard_payment_order_mutation() from public;
revoke all on function public.deny_payment_record_mutation() from public;
revoke all on function public.guard_payment_webhook_mutation() from public;
revoke all on function public.apply_verified_toss_payment(
  uuid, text, text, integer, text, text, timestamptz
) from public;
revoke all on function public.create_payment_order(uuid, text, uuid) from public;
revoke all on function public.record_verified_toss_payment(
  uuid, uuid, text, text, integer, text, text, timestamptz
) from public;
revoke all on function public.process_verified_toss_webhook(
  text, text, text, text, text, integer, text, text, timestamptz
) from public;

grant execute on function public.create_payment_order(uuid, text, uuid)
  to service_role;
grant execute on function public.record_verified_toss_payment(
  uuid, uuid, text, text, integer, text, text, timestamptz
) to service_role;
grant execute on function public.process_verified_toss_webhook(
  text, text, text, text, text, integer, text, text, timestamptz
) to service_role;
