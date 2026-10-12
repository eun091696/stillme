begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '88888888-8888-4888-8888-888888888888',
  'authenticated', 'authenticated', 'refund-owner@example.test', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, now(), now()
);

create temporary table refund_test_orders (
  label text primary key,
  id uuid not null,
  order_number text not null,
  merchant_hash text not null
);

insert into refund_test_orders
select 'unused', id, order_number, repeat('1', 64)
from public.create_payment_order(
  '88888888-8888-4888-8888-888888888888', 'STARTER-3',
  '81000000-0000-4000-8000-000000000001'
);

select * from public.process_verified_groble_payment(
  repeat('2', 64), 'payment.completed', repeat('3', 64), repeat('1', 64),
  (select order_number from refund_test_orders where label = 'unused'),
  4900, 'KRW', '2026-08-25T10:00:00+09:00'
);

select is(
  (select refund_status from public.process_verified_groble_refund(
    repeat('4', 64), repeat('5', 64), repeat('1', 64), repeat('6', 64),
    repeat('7', 64), 4900, 4900, 'KRW', false, 'BUYER',
    '2026-08-25T11:00:00+09:00'
  )),
  'credit_reversed',
  'a full refund reverses an entirely unused purchase grant'
);

select is(
  (select available_balance from public.credit_balances
   where user_id = '88888888-8888-4888-8888-888888888888'),
  0::bigint,
  'the unused refunded package leaves a zero balance'
);

select is(
  (select count(*) from public.credit_ledger_entries
   where user_id = '88888888-8888-4888-8888-888888888888'
     and transaction_type = 'payment_refund_reversal'),
  1::bigint,
  'the full refund creates exactly one Credit reversal'
);

select is(
  (select refund_status from public.process_verified_groble_refund(
    repeat('4', 64), repeat('5', 64), repeat('1', 64), repeat('6', 64),
    repeat('7', 64), 4900, 4900, 'KRW', false, 'BUYER',
    '2026-08-25T11:00:00+09:00'
  )),
  'credit_reversed',
  'the same refund delivery is an idempotent success'
);

select is(
  (select count(*) from public.credit_ledger_entries
   where user_id = '88888888-8888-4888-8888-888888888888'
     and transaction_type = 'payment_refund_reversal'),
  1::bigint,
  'a replay cannot reverse Credit twice'
);

insert into refund_test_orders
select 'used', id, order_number, repeat('8', 64)
from public.create_payment_order(
  '88888888-8888-4888-8888-888888888888', 'STANDARD-7',
  '81000000-0000-4000-8000-000000000002'
);

select * from public.process_verified_groble_payment(
  repeat('9', 64), 'payment.completed', repeat('a', 64), repeat('8', 64),
  (select order_number from refund_test_orders where label = 'used'),
  9900, 'KRW', '2026-08-25T12:00:00+09:00'
);

insert into public.credit_ledger_entries (
  user_id, transaction_type, amount, idempotency_key, policy_version,
  reference_id, reason_code
) values (
  '88888888-8888-4888-8888-888888888888', 'generation_consume', -1,
  '81000000-0000-4000-8000-000000000003', 'generation-v1',
  '81000000-0000-4000-8000-000000000003', 'GENERATION_SUCCEEDED'
);

select is(
  (select refund_status from public.process_verified_groble_refund(
    repeat('b', 64), repeat('c', 64), repeat('8', 64), repeat('d', 64),
    repeat('e', 64), 9900, 9900, 'KRW', false, 'SELLER',
    '2026-08-25T13:00:00+09:00'
  )),
  'reconciliation_required',
  'a used package is retained for reconciliation without touching other Credit'
);

select is(
  (select available_balance from public.credit_balances
   where user_id = '88888888-8888-4888-8888-888888888888'),
  6::bigint,
  'a used-package refund cannot make the balance negative or revoke another package'
);

select is(
  (select refund_status from public.process_verified_groble_refund(
    repeat('f', 64), repeat('0', 64), repeat('8', 64), repeat('1', 64),
    repeat('2', 64), 9900, 1000, 'KRW', true, 'ADMIN',
    '2026-08-25T13:10:00+09:00'
  )),
  'reconciliation_required',
  'a partial refund is durable but never converted to Credit automatically'
);

select * from public.process_verified_groble_payment(
  repeat('3', 64), 'payment.completed', repeat('4', 64), repeat('5', 64),
  (select order_number from refund_test_orders where label = 'used'),
  9900, 'KRW', '2026-08-25T14:00:00+09:00'
);

select is(
  (select refund_status from public.process_verified_groble_refund(
    repeat('6', 64), repeat('7', 64), repeat('5', 64), repeat('8', 64),
    repeat('9', 64), 9900, 9900, 'KRW', false, 'SELLER',
    '2026-08-25T15:00:00+09:00'
  )),
  'extra_payment_refunded',
  'a full refund resolves an extra payment without a Credit change'
);

select is(
  (select status from public.payment_reconciliation_records
   where merchant_uid_hash = repeat('5', 64)),
  'refunded',
  'the extra-payment reconciliation is marked refunded'
);

select is(
  (select available_balance from public.credit_balances
   where user_id = '88888888-8888-4888-8888-888888888888'),
  6::bigint,
  'an extra-payment refund never changes Credit'
);

select is(
  (select refund_status from public.process_verified_groble_refund(
    repeat('a', 64), repeat('b', 64), repeat('c', 64),
    repeat('a', 32) || repeat('d', 32),
    repeat('b', 32) || repeat('e', 32),
    4900, 4900, 'KRW', false, 'ADMIN',
    '2026-08-25T16:00:00+09:00'
  )),
  'reconciliation_required',
  'a refund received before its payment is durably quarantined'
);

insert into refund_test_orders
select 'late-payment', id, order_number, repeat('c', 64)
from public.create_payment_order(
  '88888888-8888-4888-8888-888888888888', 'STARTER-3',
  '81000000-0000-4000-8000-000000000004'
);

select * from public.process_verified_groble_payment(
  repeat('0', 32) || repeat('f', 32), 'payment.completed',
  repeat('1', 64), repeat('c', 64),
  (select order_number from refund_test_orders where label = 'late-payment'),
  4900, 'KRW', '2026-08-25T15:55:00+09:00'
);

select is(
  (select status from public.groble_refund_records
   where merchant_uid_hash = repeat('c', 64)),
  'credit_reversed',
  'payment completion reconciles an earlier full refund exactly once'
);

select is(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'groble_refund_records'
     and column_name in (
       'buyer_display_name', 'buyer_email', 'buyer_phone_number',
       'raw_payload', 'raw_merchant_uid', 'refund_reason'
     )),
  0::bigint,
  'refund storage has no buyer, raw payload, raw merchant, or reason columns'
);

select ok(
  not has_table_privilege(
    'authenticated', 'public.groble_refund_records', 'SELECT'
  ),
  'customers cannot read provider refund records directly'
);

select * from finish();
rollback;
