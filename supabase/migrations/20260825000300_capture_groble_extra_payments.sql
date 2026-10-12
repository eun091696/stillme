create table public.payment_reconciliation_records (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  order_id uuid not null references public.payment_orders (id) on delete cascade,
  primary_payment_id uuid references public.payments (id) on delete set null,
  webhook_receipt_id uuid not null references public.payment_webhook_receipts (id)
    on delete cascade,
  merchant_uid_hash text not null,
  webhook_transmission_id_hash text not null,
  webhook_payload_hash text not null,
  reason_code text not null,
  status text not null default 'pending',
  expected_amount integer not null,
  received_amount integer not null,
  currency text not null,
  purchased_at timestamptz not null,
  credit_granted boolean not null default false,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_note text,
  constraint payment_reconciliation_provider_groble
    check (provider = 'groble'),
  constraint payment_reconciliation_merchant_unique
    unique (provider, merchant_uid_hash),
  constraint payment_reconciliation_receipt_unique
    unique (webhook_receipt_id, merchant_uid_hash),
  constraint payment_reconciliation_hashes_valid
    check (
      merchant_uid_hash ~ '^[a-f0-9]{64}$'
      and webhook_transmission_id_hash ~ '^[a-f0-9]{64}$'
      and webhook_payload_hash ~ '^[a-f0-9]{64}$'
    ),
  constraint payment_reconciliation_reason_supported
    check (reason_code in (
      'EXTRA_PAYMENT_SAME_ORDER',
      'IDEMPOTENCY_KEY_CONFLICT',
      'PAYMENT_FOR_NONPAYABLE_ORDER'
    )),
  constraint payment_reconciliation_status_supported
    check (status in ('pending', 'resolved', 'refunded')),
  constraint payment_reconciliation_amount_valid
    check (expected_amount > 0 and received_amount > 0),
  constraint payment_reconciliation_currency_krw
    check (currency = 'KRW'),
  constraint payment_reconciliation_never_grants_credit
    check (not credit_granted),
  constraint payment_reconciliation_resolution_valid
    check (
      (status = 'pending' and resolved_at is null and resolution_note is null)
      or (status in ('resolved', 'refunded') and resolved_at is not null)
    )
);

create index payment_reconciliation_pending_idx
  on public.payment_reconciliation_records (detected_at asc, id asc)
  where status = 'pending';
create index payment_reconciliation_order_idx
  on public.payment_reconciliation_records (order_id, detected_at desc);
create index payment_reconciliation_primary_payment_idx
  on public.payment_reconciliation_records (primary_payment_id)
  where primary_payment_id is not null;

alter table public.payment_reconciliation_records enable row level security;
alter table public.payment_reconciliation_records force row level security;

revoke all on table public.payment_reconciliation_records
  from anon, authenticated, service_role;
grant select on table public.payment_reconciliation_records to service_role;

create function public.guard_payment_reconciliation_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then return old; end if;
    raise exception 'payment reconciliation records cannot be deleted directly';
  end if;
  if (
    new.id, new.provider, new.order_id, new.primary_payment_id,
    new.webhook_receipt_id, new.merchant_uid_hash,
    new.webhook_transmission_id_hash, new.webhook_payload_hash,
    new.reason_code, new.expected_amount, new.received_amount,
    new.currency, new.purchased_at, new.credit_granted, new.detected_at
  ) is distinct from (
    old.id, old.provider, old.order_id, old.primary_payment_id,
    old.webhook_receipt_id, old.merchant_uid_hash,
    old.webhook_transmission_id_hash, old.webhook_payload_hash,
    old.reason_code, old.expected_amount, old.received_amount,
    old.currency, old.purchased_at, old.credit_granted, old.detected_at
  ) then
    raise exception 'payment reconciliation identity cannot change';
  end if;
  if (
    old.status = 'pending'
    and new.status in ('resolved', 'refunded')
    and new.resolved_at is not null
  ) then
    return new;
  end if;
  raise exception 'invalid payment reconciliation transition';
end;
$$;

create trigger payment_reconciliation_guard_mutation
  before update or delete on public.payment_reconciliation_records
  for each row execute procedure public.guard_payment_reconciliation_mutation();

drop function public.process_verified_groble_payment(
  text, text, text, text, text, integer, text, timestamptz
);

create function public.process_verified_groble_payment(
  webhook_transmission_id text,
  webhook_event_type text,
  webhook_payload_hash text,
  verified_merchant_uid_hash text,
  verified_order_number text,
  verified_amount integer,
  verified_currency text,
  verified_purchased_at timestamptz
)
returns table (
  receipt_id uuid,
  receipt_status public.payment_receipt_status,
  processing_outcome text,
  reconciliation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.payment_orders%rowtype;
  existing_receipt public.payment_webhook_receipts%rowtype;
  existing_payment public.payments%rowtype;
  primary_payment public.payments%rowtype;
  existing_reconciliation public.payment_reconciliation_records%rowtype;
  new_receipt_id uuid;
  new_reconciliation_id uuid;
  ledger_id uuid;
  reconciliation_reason text;
begin
  if webhook_event_type <> 'payment.completed' then
    raise exception 'groble webhook event type is unsupported';
  end if;
  if (
    webhook_transmission_id !~ '^[a-f0-9]{64}$'
    or webhook_payload_hash !~ '^[a-f0-9]{64}$'
    or verified_merchant_uid_hash !~ '^[a-f0-9]{64}$'
  ) then
    raise exception 'groble webhook identity is invalid';
  end if;
  if verified_purchased_at is null then
    raise exception 'groble purchase timestamp is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('groble:delivery:' || webhook_transmission_id, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('groble:payment:' || verified_merchant_uid_hash, 0)
  );

  select * into order_row
  from public.payment_orders
  where order_number = verified_order_number
  for update;
  if not found then raise exception 'payment order does not exist'; end if;
  if (
    verified_amount <> order_row.amount
    or verified_currency <> order_row.currency
  ) then
    raise exception 'verified groble payment does not match the order';
  end if;

  select * into existing_receipt
  from public.payment_webhook_receipts
  where provider = 'groble'
    and transmission_id = webhook_transmission_id
  for update;

  if found then
    if existing_receipt.payload_hash = webhook_payload_hash then
      select * into existing_reconciliation
      from public.payment_reconciliation_records
      where provider = 'groble'
        and merchant_uid_hash = verified_merchant_uid_hash;
      return query select
        existing_receipt.id,
        existing_receipt.status,
        case
          when existing_reconciliation.id is not null
            then 'reconciliation_required'
          else 'webhook_replay'
        end,
        existing_reconciliation.id;
      return;
    end if;

    if existing_receipt.status <> 'quarantined' then
      update public.payment_webhook_receipts
      set status = 'quarantined', processed_at = now()
      where id = existing_receipt.id;
    end if;

    if existing_receipt.payment_key_hash <> verified_merchant_uid_hash then
      select * into existing_payment
      from public.payments
      where payment_key_hash = verified_merchant_uid_hash;
      select * into existing_reconciliation
      from public.payment_reconciliation_records
      where provider = 'groble'
        and merchant_uid_hash = verified_merchant_uid_hash;

      if existing_payment.id is null and existing_reconciliation.id is null then
        select * into primary_payment
        from public.payments
        where order_id = order_row.id;

        insert into public.payment_reconciliation_records (
          provider, order_id, primary_payment_id, webhook_receipt_id,
          merchant_uid_hash, webhook_transmission_id_hash,
          webhook_payload_hash, reason_code, expected_amount,
          received_amount, currency, purchased_at
        )
        values (
          'groble', order_row.id, primary_payment.id, existing_receipt.id,
          verified_merchant_uid_hash, webhook_transmission_id,
          webhook_payload_hash, 'IDEMPOTENCY_KEY_CONFLICT',
          order_row.amount, verified_amount, verified_currency,
          verified_purchased_at
        )
        returning id into new_reconciliation_id;
      else
        new_reconciliation_id := existing_reconciliation.id;
      end if;
    end if;

    return query select
      existing_receipt.id,
      'quarantined'::public.payment_receipt_status,
      case
        when new_reconciliation_id is not null
          then 'reconciliation_required'
        else 'idempotency_conflict'
      end,
      new_reconciliation_id;
    return;
  end if;

  select * into existing_payment
  from public.payments
  where payment_key_hash = verified_merchant_uid_hash;
  if found then
    insert into public.payment_webhook_receipts (
      provider, transmission_id, event_type, payload_hash,
      payment_key_hash, order_id, status, processed_at
    ) values (
      'groble', webhook_transmission_id, webhook_event_type,
      webhook_payload_hash, verified_merchant_uid_hash, order_row.id,
      case
        when existing_payment.order_id = order_row.id then 'ignored'
        else 'quarantined'
      end::public.payment_receipt_status,
      now()
    ) returning id, status into new_receipt_id, receipt_status;
    return query select
      new_receipt_id,
      receipt_status,
      case
        when existing_payment.order_id = order_row.id then 'payment_replay'
        else 'payment_identity_conflict'
      end,
      null::uuid;
    return;
  end if;

  select * into existing_reconciliation
  from public.payment_reconciliation_records
  where provider = 'groble'
    and merchant_uid_hash = verified_merchant_uid_hash;
  if found then
    insert into public.payment_webhook_receipts (
      provider, transmission_id, event_type, payload_hash,
      payment_key_hash, order_id, status, processed_at
    ) values (
      'groble', webhook_transmission_id, webhook_event_type,
      webhook_payload_hash, verified_merchant_uid_hash, order_row.id,
      case
        when existing_reconciliation.order_id = order_row.id then 'ignored'
        else 'quarantined'
      end::public.payment_receipt_status,
      now()
    ) returning id, status into new_receipt_id, receipt_status;
    return query select
      new_receipt_id,
      receipt_status,
      case
        when existing_reconciliation.order_id = order_row.id
          then 'reconciliation_replay'
        else 'payment_identity_conflict'
      end,
      existing_reconciliation.id;
    return;
  end if;

  insert into public.payment_webhook_receipts (
    provider, transmission_id, event_type, payload_hash, payment_key_hash,
    order_id
  ) values (
    'groble', webhook_transmission_id, webhook_event_type,
    webhook_payload_hash, verified_merchant_uid_hash, order_row.id
  ) returning id into new_receipt_id;

  if order_row.status in ('created', 'pending') then
    insert into public.credit_ledger_entries (
      user_id, transaction_type, amount, idempotency_key, policy_version,
      reference_id
    ) values (
      order_row.user_id, 'purchase_grant', order_row.credit_amount,
      order_row.id, order_row.product_version, order_row.id
    ) returning id into ledger_id;

    insert into public.payments (
      order_id, user_id, provider, payment_key_hash, amount, currency,
      provider_status, ledger_entry_id, approved_at
    ) values (
      order_row.id, order_row.user_id, 'groble',
      verified_merchant_uid_hash, verified_amount, verified_currency,
      'COMPLETED', ledger_id, verified_purchased_at
    );

    update public.payment_orders
    set status = 'paid', paid_at = verified_purchased_at
    where id = order_row.id;

    update public.payment_webhook_receipts
    set status = 'processed', processed_at = now()
    where id = new_receipt_id;

    return query select
      new_receipt_id,
      'processed'::public.payment_receipt_status,
      'payment_processed'::text,
      null::uuid;
    return;
  end if;

  select * into primary_payment
  from public.payments
  where order_id = order_row.id;

  reconciliation_reason := case
    when order_row.status = 'paid' then 'EXTRA_PAYMENT_SAME_ORDER'
    else 'PAYMENT_FOR_NONPAYABLE_ORDER'
  end;

  insert into public.payment_reconciliation_records (
    provider, order_id, primary_payment_id, webhook_receipt_id,
    merchant_uid_hash, webhook_transmission_id_hash, webhook_payload_hash,
    reason_code, expected_amount, received_amount, currency, purchased_at
  ) values (
    'groble', order_row.id, primary_payment.id, new_receipt_id,
    verified_merchant_uid_hash, webhook_transmission_id,
    webhook_payload_hash, reconciliation_reason, order_row.amount,
    verified_amount, verified_currency, verified_purchased_at
  ) returning id into new_reconciliation_id;

  update public.payment_webhook_receipts
  set status = 'quarantined', processed_at = now()
  where id = new_receipt_id;

  return query select
    new_receipt_id,
    'quarantined'::public.payment_receipt_status,
    'reconciliation_required'::text,
    new_reconciliation_id;
  return;
end;
$$;

revoke all on function public.guard_payment_reconciliation_mutation()
  from public;
revoke all on function public.process_verified_groble_payment(
  text, text, text, text, text, integer, text, timestamptz
) from public;
grant execute on function public.process_verified_groble_payment(
  text, text, text, text, text, integer, text, timestamptz
) to service_role;
