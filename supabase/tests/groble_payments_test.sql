begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- Keep successful-payment fixtures inside the refund eligibility window.
-- now() is transaction-stable, so retries retain the same payment timestamp.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '77777777-7777-4777-8777-777777777777',
  'authenticated', 'authenticated', 'groble-owner@example.test', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Groble Owner"}'::jsonb, now(), now()
);

create temporary table groble_test_orders (
  label text primary key,
  id uuid not null,
  order_number text not null
);

insert into groble_test_orders
select 'paid', id, order_number
from public.create_payment_order(
  '77777777-7777-4777-8777-777777777777',
  'STARTER-3',
  '70000000-0000-4000-8000-000000000001'
);

select is(
  (
    select receipt_status::text
    from public.process_verified_groble_payment(
      repeat('1', 64), 'payment.completed', repeat('2', 64),
      repeat('3', 64),
      (select order_number from groble_test_orders where label = 'paid'),
      4900, 'KRW', (now() - interval '60 minutes')
    )
  ),
  'processed',
  'a verified Groble payment is processed'
);

select is(
  (
    select available_balance
    from public.credit_balances
    where user_id = '77777777-7777-4777-8777-777777777777'
  ),
  3::bigint,
  'credit comes from the stored product snapshot'
);

select is(
  (
    select count(*)
    from public.payments
    where provider = 'groble'
      and order_id = (select id from groble_test_orders where label = 'paid')
  ),
  1::bigint,
  'the verified Groble merchant UID creates one payment'
);

select is(
  (
    select receipt_status::text
    from public.process_verified_groble_payment(
      repeat('1', 64), 'payment.completed', repeat('2', 64),
      repeat('3', 64),
      (select order_number from groble_test_orders where label = 'paid'),
      4900, 'KRW', (now() - interval '60 minutes')
    )
  ),
  'processed',
  'the same webhook delivery is idempotent'
);

select is(
  (
    select count(*)
    from public.credit_ledger_entries
    where user_id = '77777777-7777-4777-8777-777777777777'
      and transaction_type = 'purchase_grant'
  ),
  1::bigint,
  'a duplicate delivery cannot grant credit twice'
);

select is(
  (
    select processing_outcome
    from public.process_verified_groble_payment(
      repeat('a', 64), 'payment.completed', repeat('b', 64),
      repeat('3', 64),
      (select order_number from groble_test_orders where label = 'paid'),
      4900, 'KRW', (now() - interval '59 minutes')
    )
  ),
  'payment_replay',
  'the same merchant UID on a new delivery is a payment replay'
);

select is(
  (
    select count(*)
    from public.credit_ledger_entries
    where user_id = '77777777-7777-4777-8777-777777777777'
      and transaction_type = 'purchase_grant'
  ),
  1::bigint,
  'a merchant UID replay cannot grant credit twice'
);

select ok(
  (
    select approved_at >= now() - interval '7 days'
    from public.payments
    where provider = 'groble'
      and order_id = (select id from groble_test_orders where label = 'paid')
  ),
  'the provider-refund guard fixture remains inside the eligibility window'
);

select throws_ok(
  format(
    $$
      select public.begin_payment_refund(
        '77777777-7777-4777-8777-777777777777',
        %L,
        '70000000-0000-4000-8000-000000000003',
        'CUSTOMER_REQUEST'
      )
    $$,
    (
      select id
      from public.payments
      where provider = 'groble'
        and order_id = (
          select id from groble_test_orders where label = 'paid'
        )
    )
  ),
  'P0001',
  'payment provider refund is unsupported',
  'a Groble payment cannot enter the Toss refund path'
);

select is(
  (
    select receipt_status::text
    from public.process_verified_groble_payment(
      repeat('1', 64), 'payment.completed', repeat('4', 64),
      repeat('3', 64),
      (select order_number from groble_test_orders where label = 'paid'),
      4900, 'KRW', (now() - interval '60 minutes')
    )
  ),
  'quarantined',
  'a reused delivery key with a different body is quarantined'
);

select is(
  (
    select processing_outcome
    from public.process_verified_groble_payment(
      repeat('c', 64), 'payment.completed', repeat('d', 64),
      repeat('e', 64),
      (select order_number from groble_test_orders where label = 'paid'),
      4900, 'KRW', (now() - interval '58 minutes')
    )
  ),
  'reconciliation_required',
  'a different merchant UID for a paid order is quarantined durably'
);

select is(
  (
    select count(*)
    from public.payment_reconciliation_records
    where order_id = (select id from groble_test_orders where label = 'paid')
      and merchant_uid_hash = repeat('e', 64)
      and reason_code = 'EXTRA_PAYMENT_SAME_ORDER'
      and status = 'pending'
      and not credit_granted
  ),
  1::bigint,
  'the extra real payment has one pending reconciliation record'
);

select is(
  (
    select processing_outcome
    from public.process_verified_groble_payment(
      repeat('d', 64), 'payment.completed', repeat('e', 64),
      repeat('e', 64),
      (select order_number from groble_test_orders where label = 'paid'),
      4900, 'KRW', (now() - interval '58 minutes')
    )
  ),
  'reconciliation_replay',
  'a new delivery for the quarantined merchant UID is a replay'
);

select is(
  (
    select count(*)
    from public.payment_reconciliation_records
    where merchant_uid_hash = repeat('e', 64)
  ),
  1::bigint,
  'an extra payment replay cannot duplicate its reconciliation record'
);

select is(
  (
    select available_balance
    from public.credit_balances
    where user_id = '77777777-7777-4777-8777-777777777777'
  ),
  3::bigint,
  'an extra real payment never grants a second Credit package'
);

select is(
  (
    select processing_outcome
    from public.process_verified_groble_payment(
      repeat('1', 64), 'payment.completed', repeat('f', 64),
      repeat('a', 64),
      (select order_number from groble_test_orders where label = 'paid'),
      4900, 'KRW', (now() - interval '57 minutes')
    )
  ),
  'reconciliation_required',
  'a reused delivery key with a distinct merchant UID is recorded for reconciliation'
);

select is(
  (
    select count(*)
    from public.payment_reconciliation_records
    where merchant_uid_hash = repeat('a', 64)
      and reason_code = 'IDEMPOTENCY_KEY_CONFLICT'
      and webhook_payload_hash = repeat('f', 64)
  ),
  1::bigint,
  'the conflicting payload is retained only as hashes and bounded payment facts'
);

insert into groble_test_orders
select 'other', id, order_number
from public.create_payment_order(
  '77777777-7777-4777-8777-777777777777',
  'STANDARD-7',
  '70000000-0000-4000-8000-000000000002'
);

select is(
  (
    select processing_outcome
    from public.process_verified_groble_payment(
      repeat('5', 64), 'payment.completed', repeat('6', 64),
      repeat('3', 64),
      (select order_number from groble_test_orders where label = 'other'),
      9900, 'KRW', (now() - interval '56 minutes')
    )
  ),
  'payment_identity_conflict',
  'one merchant UID cannot be reassigned to a different order'
);

select is(
  (
    select count(*)
    from public.credit_ledger_entries
    where user_id = '77777777-7777-4777-8777-777777777777'
      and transaction_type = 'purchase_grant'
  ),
  1::bigint,
  'a cross-order merchant identity conflict grants no Credit'
);

select throws_ok(
  format(
    $$
      select public.process_verified_groble_payment(
        repeat('7', 64), 'payment.completed', repeat('8', 64),
        repeat('9', 64), %L, 9901, 'KRW',
        (now() - interval '60 minutes')
      )
    $$,
    (select order_number from groble_test_orders where label = 'other')
  ),
  'P0001',
  'verified groble payment does not match the order',
  'the database rejects a mismatched verified amount'
);

select is(
  (
    select count(*)
    from public.payment_reconciliation_records
    where merchant_uid_hash = repeat('9', 64)
  ),
  0::bigint,
  'an amount validation failure is not stored as a real payment exception'
);

create function public.test_force_reconciliation_failure()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'forced reconciliation failure';
end;
$$;

create trigger test_force_reconciliation_failure
  before insert on public.payment_reconciliation_records
  for each row execute procedure public.test_force_reconciliation_failure();

select throws_ok(
  format(
    $$
      select public.process_verified_groble_payment(
        repeat('b', 64), 'payment.completed', repeat('c', 64),
        repeat('d', 64), %L, 4900, 'KRW',
        (now() - interval '55 minutes')
      )
    $$,
    (select order_number from groble_test_orders where label = 'paid')
  ),
  'P0001',
  'forced reconciliation failure',
  'a reconciliation write failure aborts the webhook transaction for retry'
);

drop trigger test_force_reconciliation_failure
  on public.payment_reconciliation_records;
drop function public.test_force_reconciliation_failure();

select is(
  (
    select count(*)
    from public.payment_webhook_receipts
    where provider = 'groble' and transmission_id = repeat('b', 64)
  ),
  0::bigint,
  'a failed reconciliation write leaves no false durable receipt'
);

select is(
  (
    select available_balance
    from public.credit_balances
    where user_id = '77777777-7777-4777-8777-777777777777'
  ),
  3::bigint,
  'a failed reconciliation write cannot change Credit'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_reconciliation_records'
      and column_name in ('buyer_email', 'buyer_phone_number', 'raw_payload')
  ),
  0::bigint,
  'reconciliation storage has no buyer or raw payload columns'
);

select ok(
  (
    select proconfig @> array['search_path=""']
    from pg_proc
    where oid = 'public.process_verified_groble_payment(text,text,text,text,text,integer,text,timestamptz)'::regprocedure
  ),
  'the Groble payment RPC keeps an empty search_path'
);

select ok(
  (
    select
      position('PG_ADVISORY_XACT_LOCK' in upper(pg_get_functiondef(oid))) > 0
      and position('FOR UPDATE' in upper(pg_get_functiondef(oid))) > 0
    from pg_proc
    where oid = 'public.process_verified_groble_payment(text,text,text,text,text,integer,text,timestamptz)'::regprocedure
  ),
  'the Groble payment RPC serializes payment identities and order settlement'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.payment_reconciliation_records',
    'SELECT'
  ),
  'customers cannot read payment reconciliation records'
);

select * from finish();
rollback;
