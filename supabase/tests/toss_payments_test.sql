begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'credit_products', 'credit product catalog exists');
select has_table('public', 'payment_orders', 'payment orders table exists');
select has_table('public', 'payments', 'verified payments table exists');
select has_table(
  'public',
  'payment_webhook_receipts',
  'payment webhook inbox exists'
);
select is(
  (select count(*) from public.credit_products where active),
  3::bigint,
  'approved commercial-v2 products are active'
);
select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('payment_orders', 'payments', 'payment_webhook_receipts')
      and column_name = 'payment_key'
  ),
  0::bigint,
  'raw payment keys are not persisted'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '99999999-9999-4999-8999-999999999999',
    'authenticated', 'authenticated', 'payment-owner@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Payment Owner"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-9999-4999-8999-999999999999',
    'authenticated', 'authenticated', 'payment-other@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Payment Other"}'::jsonb, now(), now()
  );

create temporary table test_orders (
  label text primary key,
  id uuid not null,
  order_number text not null
);

insert into test_orders
select 'confirm', id, order_number
from public.create_payment_order(
  '99999999-9999-4999-8999-999999999999',
  'STARTER-3',
  '90000000-0000-4000-8000-000000000001'
);

select is(
  (
    select id
    from public.create_payment_order(
      '99999999-9999-4999-8999-999999999999',
      'STARTER-3',
      '90000000-0000-4000-8000-000000000001'
    )
  ),
  (select id from test_orders where label = 'confirm'),
  'order creation is idempotent'
);
select throws_ok(
  $$
    select public.create_payment_order(
      '99999999-9999-4999-8999-999999999999',
      'STANDARD-7',
      '90000000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'payment order idempotency key was reused',
  'changed product cannot reuse an order idempotency key'
);

select throws_ok(
  format(
    $$
      select public.record_verified_toss_payment(
        '99999999-9999-4999-8999-999999999999',
        %L, repeat('a', 64), %L, 4901, 'KRW', 'DONE', now()
      )
    $$,
    (select id from test_orders where label = 'confirm'),
    (select order_number from test_orders where label = 'confirm')
  ),
  'P0001',
  'verified payment does not match the order',
  'amount mismatch cannot grant credits'
);
select is(
  (
    select count(*) from public.credit_ledger_entries
    where user_id = '99999999-9999-4999-8999-999999999999'
  ),
  0::bigint,
  'failed verification leaves the ledger unchanged'
);

select lives_ok(
  format(
    $$
      select public.record_verified_toss_payment(
        '99999999-9999-4999-8999-999999999999',
        %L, repeat('a', 64), %L, 4900, 'KRW', 'DONE', now()
      )
    $$,
    (select id from test_orders where label = 'confirm'),
    (select order_number from test_orders where label = 'confirm')
  ),
  'verified exact payment is recorded'
);
select is(
  (
    select public.record_verified_toss_payment(
      '99999999-9999-4999-8999-999999999999',
      (select id from test_orders where label = 'confirm'),
      repeat('a', 64),
      (select order_number from test_orders where label = 'confirm'),
      4900, 'KRW', 'DONE', now()
    )
  ),
  (
    select id from public.payments
    where order_id = (select id from test_orders where label = 'confirm')
  ),
  'payment recording retry returns the existing payment'
);
select is(
  (
    select balance from public.credit_balances
    where user_id = '99999999-9999-4999-8999-999999999999'
  ),
  3::bigint,
  'verified purchase grants the snapshotted credits once'
);
select is(
  (
    select count(*) from public.credit_ledger_entries
    where transaction_type = 'purchase_grant'
      and user_id = '99999999-9999-4999-8999-999999999999'
  ),
  1::bigint,
  'confirmation creates exactly one purchase grant'
);
select throws_ok(
  format(
    $$
      select public.record_verified_toss_payment(
        'aaaaaaaa-9999-4999-8999-999999999999',
        %L, repeat('a', 64), %L, 4900, 'KRW', 'DONE', now()
      )
    $$,
    (select id from test_orders where label = 'confirm'),
    (select order_number from test_orders where label = 'confirm')
  ),
  'P0001',
  'payment order does not exist',
  'another user cannot record an owner payment'
);

insert into test_orders
select 'webhook', id, order_number
from public.create_payment_order(
  '99999999-9999-4999-8999-999999999999',
  'STANDARD-7',
  '90000000-0000-4000-8000-000000000002'
);

select results_eq(
  format(
    $$
      select receipt_status
      from public.process_verified_toss_webhook(
        'transmission-1', 'PAYMENT_STATUS_CHANGED', repeat('b', 64),
        repeat('c', 64), %L, 9900, 'KRW', 'DONE', now()
      )
    $$,
    (select order_number from test_orders where label = 'webhook')
  ),
  $$ values ('processed'::public.payment_receipt_status) $$,
  'server-retrieved DONE webhook is processed'
);
select results_eq(
  format(
    $$
      select receipt_id, receipt_status
      from public.process_verified_toss_webhook(
        'transmission-1', 'PAYMENT_STATUS_CHANGED', repeat('b', 64),
        repeat('c', 64), %L, 9900, 'KRW', 'DONE', now()
      )
    $$,
    (select order_number from test_orders where label = 'webhook')
  ),
  $$
    select id, status
    from public.payment_webhook_receipts
    where transmission_id = 'transmission-1'
  $$,
  'duplicate webhook returns the existing receipt'
);
select is(
  (
    select count(*) from public.credit_ledger_entries
    where transaction_type = 'purchase_grant'
      and user_id = '99999999-9999-4999-8999-999999999999'
  ),
  2::bigint,
  'duplicate webhook does not duplicate a grant'
);
select results_eq(
  format(
    $$
      select receipt_status
      from public.process_verified_toss_webhook(
        'transmission-1', 'PAYMENT_STATUS_CHANGED', repeat('d', 64),
        repeat('c', 64), %L, 9900, 'KRW', 'DONE', now()
      )
    $$,
    (select order_number from test_orders where label = 'webhook')
  ),
  $$ values ('quarantined'::public.payment_receipt_status) $$,
  'same transmission ID with changed payload is quarantined'
);
select is(
  (
    select balance from public.credit_balances
    where user_id = '99999999-9999-4999-8999-999999999999'
  ),
  10::bigint,
  'confirmed and webhook payment grants total expected credits'
);

insert into test_orders
select 'cancelled', id, order_number
from public.create_payment_order(
  '99999999-9999-4999-8999-999999999999',
  'PRO-16',
  '90000000-0000-4000-8000-000000000003'
);
select results_eq(
  format(
    $$
      select receipt_status
      from public.process_verified_toss_webhook(
        'transmission-2', 'PAYMENT_STATUS_CHANGED', repeat('e', 64),
        repeat('f', 64), %L, 19900, 'KRW', 'CANCELED', null
      )
    $$,
    (select order_number from test_orders where label = 'cancelled')
  ),
  $$ values ('ignored'::public.payment_receipt_status) $$,
  'verified non-DONE webhook is durably ignored'
);
select is(
  (
    select balance from public.credit_balances
    where user_id = '99999999-9999-4999-8999-999999999999'
  ),
  10::bigint,
  'cancelled payment grants no credits'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.credit_products),
  3::bigint,
  'authenticated user can read active products'
);
select is(
  (select count(*) from public.payment_orders),
  3::bigint,
  'owner can read their payment orders'
);
select is(
  (select count(*) from public.payments),
  2::bigint,
  'owner can read only their verified payments'
);
select throws_ok(
  $$
    insert into public.payment_orders (
      id, order_number, user_id, product_code, product_version, amount,
      credit_amount, currency, idempotency_key
    ) values (
      gen_random_uuid(), 'aps_11111111111141118111111111111111',
      '99999999-9999-4999-8999-999999999999', 'STARTER-3',
      'commercial-v2', 4900, 3, 'KRW', gen_random_uuid()
    )
  $$,
  '42501',
  'permission denied for table payment_orders',
  'authenticated user cannot write an order directly'
);
select throws_ok(
  $$
    select public.create_payment_order(
      '99999999-9999-4999-8999-999999999999',
      'STARTER-3',
      gen_random_uuid()
    )
  $$,
  '42501',
  'permission denied for function create_payment_order',
  'authenticated user cannot execute service order RPC'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-9999-4999-8999-999999999999","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.payment_orders),
  0::bigint,
  'other user cannot read owner orders'
);
select is(
  (select count(*) from public.payments),
  0::bigint,
  'other user cannot read owner payments'
);
select throws_ok(
  'select count(*) from public.payment_webhook_receipts',
  '42501',
  'permission denied for table payment_webhook_receipts',
  'authenticated users cannot read webhook receipts'
);

reset role;
select throws_ok(
  $$
    update public.payments
    set amount = 1
    where user_id = '99999999-9999-4999-8999-999999999999'
  $$,
  'P0001',
  'payment records are immutable',
  'verified payment records cannot be edited'
);

select * from finish();
rollback;
