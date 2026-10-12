alter table public.payments
  drop constraint payments_provider_toss,
  drop constraint payments_provider_status_done;

alter table public.payments
  add constraint payments_provider_supported
    check (provider in ('toss', 'groble')),
  add constraint payments_provider_status_valid
    check (
      (provider = 'toss' and provider_status = 'DONE')
      or (provider = 'groble' and provider_status = 'COMPLETED')
    );

alter table public.payment_webhook_receipts
  drop constraint payment_webhook_provider_toss,
  drop constraint payment_webhook_event_supported;

alter table public.payment_webhook_receipts
  add constraint payment_webhook_provider_supported
    check (provider in ('toss', 'groble')),
  add constraint payment_webhook_event_supported
    check (
      (provider = 'toss' and event_type = 'PAYMENT_STATUS_CHANGED')
      or (provider = 'groble' and event_type = 'payment.completed')
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
returns table (receipt_id uuid, receipt_status public.payment_receipt_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.payment_orders%rowtype;
  existing_receipt public.payment_webhook_receipts%rowtype;
  existing_payment public.payments%rowtype;
  new_receipt_id uuid;
  ledger_id uuid;
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

  select * into existing_receipt
  from public.payment_webhook_receipts
  where provider = 'groble'
    and transmission_id = webhook_transmission_id
  for update;

  if found then
    if existing_receipt.payload_hash <> webhook_payload_hash then
      update public.payment_webhook_receipts
      set status = 'quarantined', processed_at = now()
      where id = existing_receipt.id;
      return query select
        existing_receipt.id,
        'quarantined'::public.payment_receipt_status;
    else
      return query select existing_receipt.id, existing_receipt.status;
    end if;
    return;
  end if;

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

  select * into existing_payment
  from public.payments
  where payment_key_hash = verified_merchant_uid_hash;
  if found and existing_payment.order_id <> order_row.id then
    raise exception 'groble merchant uid is already assigned';
  end if;

  insert into public.payment_webhook_receipts (
    provider, transmission_id, event_type, payload_hash, payment_key_hash,
    order_id
  )
  values (
    'groble', webhook_transmission_id, webhook_event_type,
    webhook_payload_hash, verified_merchant_uid_hash, order_row.id
  )
  returning id into new_receipt_id;

  if order_row.status = 'paid' then
    select * into existing_payment
    from public.payments
    where order_id = order_row.id;
    if (
      not found
      or existing_payment.provider <> 'groble'
      or existing_payment.payment_key_hash <> verified_merchant_uid_hash
      or existing_payment.amount <> verified_amount
      or existing_payment.currency <> verified_currency
    ) then
      raise exception 'paid order verification does not match';
    end if;
  elsif order_row.status in ('created', 'pending') then
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
    returning id into ledger_id;

    insert into public.payments (
      order_id, user_id, provider, payment_key_hash, amount, currency,
      provider_status, ledger_entry_id, approved_at
    )
    values (
      order_row.id, order_row.user_id, 'groble',
      verified_merchant_uid_hash, verified_amount, verified_currency,
      'COMPLETED', ledger_id, verified_purchased_at
    );

    update public.payment_orders
    set status = 'paid', paid_at = verified_purchased_at
    where id = order_row.id;
  else
    raise exception 'payment order cannot be paid';
  end if;

  update public.payment_webhook_receipts
  set status = 'processed', processed_at = now()
  where id = new_receipt_id;

  receipt_id := new_receipt_id;
  receipt_status := 'processed';
  return next;
end;
$$;

revoke all on function public.process_verified_groble_payment(
  text, text, text, text, text, integer, text, timestamptz
) from public;

grant execute on function public.process_verified_groble_payment(
  text, text, text, text, text, integer, text, timestamptz
) to service_role;
