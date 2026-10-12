alter table public.payment_webhook_receipts
  drop constraint payment_webhook_event_supported;

alter table public.payment_webhook_receipts
  add constraint payment_webhook_event_supported
    check (
      (provider = 'toss' and event_type = 'PAYMENT_STATUS_CHANGED')
      or (
        provider = 'groble'
        and event_type in ('payment.completed', 'payment.refunded')
      )
    );

create table public.groble_refund_records (
  id uuid primary key default gen_random_uuid(),
  webhook_receipt_id uuid not null
    references public.payment_webhook_receipts (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete set null,
  reconciliation_id uuid
    references public.payment_reconciliation_records (id) on delete set null,
  order_id uuid references public.payment_orders (id) on delete set null,
  merchant_uid_hash text not null,
  refund_event_hash text not null,
  refund_fingerprint_hash text not null,
  original_amount integer not null,
  refund_amount integer not null,
  currency text not null,
  partial_refund boolean not null,
  cancelled_by text not null,
  refunded_at timestamptz not null,
  status text not null,
  ledger_entry_id uuid references public.credit_ledger_entries (id),
  created_at timestamptz not null default now(),
  constraint groble_refund_target_exclusive
    check (not (payment_id is not null and reconciliation_id is not null)),
  constraint groble_refund_hashes_valid
    check (
      merchant_uid_hash ~ '^[a-f0-9]{64}$'
      and refund_event_hash ~ '^[a-f0-9]{64}$'
      and refund_fingerprint_hash ~ '^[a-f0-9]{64}$'
    ),
  constraint groble_refund_event_unique unique (refund_event_hash),
  constraint groble_refund_fingerprint_unique unique (refund_fingerprint_hash),
  constraint groble_refund_amount_valid
    check (
      original_amount > 0
      and refund_amount > 0
      and refund_amount <= original_amount
    ),
  constraint groble_refund_currency_krw check (currency = 'KRW'),
  constraint groble_refund_cancelled_by_supported
    check (cancelled_by in ('BUYER', 'SELLER', 'ADMIN')),
  constraint groble_refund_status_supported
    check (status in (
      'credit_reversed',
      'extra_payment_refunded',
      'reconciliation_required'
    )),
  constraint groble_refund_credit_result_valid
    check (
      (status = 'credit_reversed' and payment_id is not null
        and ledger_entry_id is not null and not partial_refund)
      or (status <> 'credit_reversed' and ledger_entry_id is null)
    )
);

create index groble_refund_payment_idx
  on public.groble_refund_records (payment_id, refunded_at desc)
  where payment_id is not null;
create index groble_refund_reconciliation_idx
  on public.groble_refund_records (reconciliation_id, refunded_at desc)
  where reconciliation_id is not null;
create index groble_refund_review_idx
  on public.groble_refund_records (created_at asc, id asc)
  where status = 'reconciliation_required';

alter table public.groble_refund_records enable row level security;
alter table public.groble_refund_records force row level security;
revoke all on table public.groble_refund_records
  from anon, authenticated, service_role;
grant select on table public.groble_refund_records to service_role;

create function public.guard_groble_refund_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then return old; end if;
    raise exception 'groble refund records cannot be deleted directly';
  end if;
  if (
    new.id, new.webhook_receipt_id, new.merchant_uid_hash,
    new.refund_event_hash, new.refund_fingerprint_hash,
    new.original_amount, new.refund_amount, new.currency,
    new.partial_refund, new.cancelled_by, new.refunded_at, new.created_at
  ) is distinct from (
    old.id, old.webhook_receipt_id, old.merchant_uid_hash,
    old.refund_event_hash, old.refund_fingerprint_hash,
    old.original_amount, old.refund_amount, old.currency,
    old.partial_refund, old.cancelled_by, old.refunded_at, old.created_at
  ) then
    raise exception 'groble refund identity cannot change';
  end if;
  if old.status <> 'reconciliation_required' then
    raise exception 'completed groble refund cannot change';
  end if;
  return new;
end;
$$;

create trigger groble_refunds_guard_mutation
  before update or delete on public.groble_refund_records
  for each row execute procedure public.guard_groble_refund_mutation();

create function public.process_verified_groble_refund(
  webhook_transmission_id text,
  webhook_payload_hash text,
  verified_merchant_uid_hash text,
  verified_refund_event_hash text,
  verified_refund_fingerprint_hash text,
  verified_original_amount integer,
  verified_refund_amount integer,
  verified_currency text,
  verified_partial_refund boolean,
  verified_cancelled_by text,
  verified_refunded_at timestamptz
)
returns table (
  receipt_id uuid,
  receipt_status public.payment_receipt_status,
  refund_id uuid,
  refund_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_receipt public.payment_webhook_receipts%rowtype;
  existing_refund public.groble_refund_records%rowtype;
  payment_row public.payments%rowtype;
  order_row public.payment_orders%rowtype;
  reconciliation_row public.payment_reconciliation_records%rowtype;
  purchase_entry public.credit_ledger_entries%rowtype;
  new_receipt_id uuid;
  new_refund_id uuid;
  new_refund_status text;
  new_ledger_id uuid;
  current_balance bigint;
  generation_reserved bigint;
  prior_refund_reversal bigint;
  credits_were_used boolean;
begin
  if (
    webhook_transmission_id !~ '^[a-f0-9]{64}$'
    or webhook_payload_hash !~ '^[a-f0-9]{64}$'
    or verified_merchant_uid_hash !~ '^[a-f0-9]{64}$'
    or verified_refund_event_hash !~ '^[a-f0-9]{64}$'
    or verified_refund_fingerprint_hash !~ '^[a-f0-9]{64}$'
  ) then
    raise exception 'groble refund identity is invalid';
  end if;
  if (
    verified_original_amount < 1
    or verified_refund_amount < 1
    or verified_refund_amount > verified_original_amount
    or verified_currency <> 'KRW'
    or verified_cancelled_by not in ('BUYER', 'SELLER', 'ADMIN')
    or verified_refunded_at is null
  ) then
    raise exception 'groble refund value is invalid';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('groble:delivery:' || webhook_transmission_id, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('groble:payment:' || verified_merchant_uid_hash, 0)
  );

  select * into existing_receipt
  from public.payment_webhook_receipts
  where provider = 'groble' and transmission_id = webhook_transmission_id
  for update;
  if found then
    if existing_receipt.payload_hash <> webhook_payload_hash then
      if existing_receipt.status <> 'quarantined' then
        update public.payment_webhook_receipts
        set status = 'quarantined', processed_at = now()
        where id = existing_receipt.id;
      end if;
    end if;
    select * into existing_refund
    from public.groble_refund_records
    where refund_event_hash = verified_refund_event_hash
       or refund_fingerprint_hash = verified_refund_fingerprint_hash
    order by created_at asc limit 1;
    return query select
      existing_receipt.id,
      case when existing_receipt.payload_hash = webhook_payload_hash
        then existing_receipt.status
        else 'quarantined'::public.payment_receipt_status end,
      existing_refund.id,
      coalesce(existing_refund.status, 'reconciliation_required');
    return;
  end if;

  select * into payment_row
  from public.payments
  where provider = 'groble'
    and payment_key_hash = verified_merchant_uid_hash
  for update;
  if found then
    select * into order_row from public.payment_orders
    where id = payment_row.order_id for update;
    if (
      payment_row.amount <> verified_original_amount
      or payment_row.currency <> verified_currency
    ) then
      raise exception 'groble refund does not match payment';
    end if;
  else
    select * into reconciliation_row
    from public.payment_reconciliation_records
    where provider = 'groble'
      and merchant_uid_hash = verified_merchant_uid_hash
    for update;
    if found then
      select * into order_row from public.payment_orders
      where id = reconciliation_row.order_id for update;
      if (
        reconciliation_row.received_amount <> verified_original_amount
        or reconciliation_row.currency <> verified_currency
      ) then
        raise exception 'groble refund does not match reconciliation';
      end if;
    end if;
  end if;

  insert into public.payment_webhook_receipts (
    provider, transmission_id, event_type, payload_hash, payment_key_hash,
    order_id, status, processed_at
  ) values (
    'groble', webhook_transmission_id, 'payment.refunded',
    webhook_payload_hash, verified_merchant_uid_hash,
    order_row.id, 'received', null
  ) returning id into new_receipt_id;

  select * into existing_refund
  from public.groble_refund_records
  where refund_event_hash = verified_refund_event_hash
     or refund_fingerprint_hash = verified_refund_fingerprint_hash
  order by created_at asc limit 1;
  if found then
    update public.payment_webhook_receipts
    set status = 'ignored', processed_at = now()
    where id = new_receipt_id;
    return query select new_receipt_id,
      'ignored'::public.payment_receipt_status,
      existing_refund.id, existing_refund.status;
    return;
  end if;

  new_refund_status := 'reconciliation_required';

  if payment_row.id is not null then
    select * into purchase_entry from public.credit_ledger_entries
    where id = payment_row.ledger_entry_id for update;
    perform 1 from public.credit_accounts
    where user_id = payment_row.user_id for update;
    select coalesce(sum(amount), 0) into current_balance
    from public.credit_ledger_entries where user_id = payment_row.user_id;
    select coalesce(sum(amount), 0) into generation_reserved
    from public.credit_reservations
    where user_id = payment_row.user_id and status = 'reserved';
    select coalesce(sum(amount), 0) into prior_refund_reversal
    from public.credit_ledger_entries
    where reversal_of = purchase_entry.id
      and transaction_type = 'payment_refund_reversal';
    select exists (
      select 1 from public.credit_ledger_entries
      where user_id = payment_row.user_id
        and id <> purchase_entry.id
        and amount < 0
        and created_at > purchase_entry.created_at
    ) into credits_were_used;

    if (
      not verified_partial_refund
      and verified_refund_amount = payment_row.amount
      and prior_refund_reversal = 0
      and not credits_were_used
      and current_balance - generation_reserved >= order_row.credit_amount
    ) then
      new_refund_status := 'credit_reversed';
    end if;
  elsif reconciliation_row.id is not null then
    if (
      not verified_partial_refund
      and verified_refund_amount = reconciliation_row.received_amount
    ) then
      new_refund_status := 'extra_payment_refunded';
    end if;
  end if;

  insert into public.groble_refund_records (
    webhook_receipt_id, payment_id, reconciliation_id, order_id,
    merchant_uid_hash, refund_event_hash, refund_fingerprint_hash,
    original_amount, refund_amount, currency, partial_refund,
    cancelled_by, refunded_at, status
  ) values (
    new_receipt_id, payment_row.id, reconciliation_row.id, order_row.id,
    verified_merchant_uid_hash, verified_refund_event_hash,
    verified_refund_fingerprint_hash, verified_original_amount,
    verified_refund_amount, verified_currency, verified_partial_refund,
    verified_cancelled_by, verified_refunded_at, 'reconciliation_required'
  ) returning id into new_refund_id;

  if new_refund_status = 'credit_reversed' then
    insert into public.credit_ledger_entries (
      user_id, transaction_type, amount, idempotency_key, policy_version,
      reference_id, reversal_of, reason_code
    ) values (
      payment_row.user_id, 'payment_refund_reversal',
      -order_row.credit_amount, new_refund_id, order_row.product_version,
      new_refund_id, purchase_entry.id, 'PROVIDER_REFUND'
    ) returning id into new_ledger_id;
    update public.groble_refund_records
    set status = 'credit_reversed', ledger_entry_id = new_ledger_id
    where id = new_refund_id;
  elsif new_refund_status = 'extra_payment_refunded' then
    update public.groble_refund_records
    set status = 'extra_payment_refunded'
    where id = new_refund_id;
    update public.payment_reconciliation_records
    set status = 'refunded', resolved_at = verified_refunded_at,
        resolution_note = 'GROBLE_REFUND_CONFIRMED'
    where id = reconciliation_row.id and status = 'pending';
  end if;

  update public.payment_webhook_receipts
  set status = case
      when new_refund_status = 'reconciliation_required'
        then 'quarantined'::public.payment_receipt_status
      else 'processed'::public.payment_receipt_status
    end,
    processed_at = now()
  where id = new_receipt_id;

  return query select new_receipt_id,
    case when new_refund_status = 'reconciliation_required'
      then 'quarantined'::public.payment_receipt_status
      else 'processed'::public.payment_receipt_status end,
    new_refund_id, new_refund_status;
end;
$$;

create function public.reconcile_groble_refund_after_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  refund_row public.groble_refund_records%rowtype;
  order_row public.payment_orders%rowtype;
  ledger_id uuid;
begin
  if new.provider <> 'groble' then return new; end if;
  select * into refund_row
  from public.groble_refund_records
  where merchant_uid_hash = new.payment_key_hash
    and payment_id is null
    and reconciliation_id is null
  order by refunded_at asc limit 1 for update;
  if not found then return new; end if;

  select * into order_row from public.payment_orders
  where id = new.order_id for update;
  update public.groble_refund_records
  set payment_id = new.id, order_id = new.order_id
  where id = refund_row.id;

  if (
    not refund_row.partial_refund
    and refund_row.refund_amount = new.amount
    and refund_row.original_amount = new.amount
  ) then
    insert into public.credit_ledger_entries (
      user_id, transaction_type, amount, idempotency_key, policy_version,
      reference_id, reversal_of, reason_code
    ) values (
      new.user_id, 'payment_refund_reversal', -order_row.credit_amount,
      refund_row.id, order_row.product_version, refund_row.id,
      new.ledger_entry_id, 'PROVIDER_REFUND'
    ) returning id into ledger_id;
    update public.groble_refund_records
    set status = 'credit_reversed', ledger_entry_id = ledger_id
    where id = refund_row.id;
  end if;
  return new;
end;
$$;

create trigger payments_reconcile_early_groble_refund
  after insert on public.payments
  for each row execute procedure public.reconcile_groble_refund_after_payment();

revoke all on function public.guard_groble_refund_mutation() from public;
revoke all on function public.reconcile_groble_refund_after_payment() from public;
revoke all on function public.process_verified_groble_refund(
  text, text, text, text, text, integer, integer, text, boolean, text,
  timestamptz
) from public;
grant execute on function public.process_verified_groble_refund(
  text, text, text, text, text, integer, integer, text, boolean, text,
  timestamptz
) to service_role;
