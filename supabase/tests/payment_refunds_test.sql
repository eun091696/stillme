begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'payment_refunds', 'payment refunds table exists');
select has_table(
  'public',
  'payment_reconciliation_results',
  'payment reconciliation results table exists'
);
select is(
  (
    select count(*) from information_schema.columns
    where table_schema = 'public'
      and table_name in ('payment_refunds', 'payment_reconciliation_results')
      and column_name in ('payment_key', 'transaction_key', 'raw_payload')
  ),
  0::bigint,
  'refund and reconciliation records persist no raw provider secret identity'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'bbbbbbbb-9999-4999-8999-999999999999',
    'authenticated', 'authenticated', 'refund-owner@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Refund Owner"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'cccccccc-9999-4999-8999-999999999999',
    'authenticated', 'authenticated', 'refund-other@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Refund Other"}'::jsonb, now(), now()
  );

create temporary table refund_test_payments (
  label text primary key,
  order_id uuid not null,
  order_number text not null,
  payment_id uuid not null,
  payment_key_hash text not null
);

insert into refund_test_payments
select
  'direct',
  payment_order.id,
  payment_order.order_number,
  public.record_verified_toss_payment(
    'bbbbbbbb-9999-4999-8999-999999999999',
    payment_order.id,
    repeat('1', 64),
    payment_order.order_number,
    4900, 'KRW', 'DONE', now()
  ),
  repeat('1', 64)
from public.create_payment_order(
  'bbbbbbbb-9999-4999-8999-999999999999',
  'STARTER-3',
  'b0000000-0000-4000-8000-000000000001'
) as payment_order;

create temporary table refund_test_intents as
select *
from public.begin_payment_refund(
  'bbbbbbbb-9999-4999-8999-999999999999',
  (select payment_id from refund_test_payments where label = 'direct'),
  'b1000000-0000-4000-8000-000000000001',
  'CUSTOMER_REQUEST'
);

select is(
  (select refund_status from refund_test_intents),
  'pending'::public.payment_refund_status,
  'eligible full refund creates a pending intent'
);
select results_eq(
  $$
    select refund_id, refund_status
    from public.begin_payment_refund(
      'bbbbbbbb-9999-4999-8999-999999999999',
      (select payment_id from refund_test_payments where label = 'direct'),
      'b1000000-0000-4000-8000-000000000001',
      'CUSTOMER_REQUEST'
    )
  $$,
  $$ select refund_id, refund_status from refund_test_intents $$,
  'refund initiation retry returns the same intent'
);
select is(
  (
    select refund_reserved_credits from public.credit_balances
    where user_id = 'bbbbbbbb-9999-4999-8999-999999999999'
  ),
  3::bigint,
  'pending refund reserves the credits before provider cancellation'
);
select is(
  (
    select available_balance from public.credit_balances
    where user_id = 'bbbbbbbb-9999-4999-8999-999999999999'
  ),
  0::bigint,
  'refund reservation removes credits from available balance'
);
select throws_ok(
  $$
    select public.begin_payment_refund(
      'cccccccc-9999-4999-8999-999999999999',
      (select payment_id from refund_test_payments where label = 'direct'),
      'b1000000-0000-4000-8000-000000000002',
      'CUSTOMER_REQUEST'
    )
  $$,
  'P0001',
  'payment does not exist',
  'another user cannot initiate an owner refund'
);
select throws_ok(
  $$
    insert into public.credit_ledger_entries (
      user_id, transaction_type, amount, idempotency_key,
      policy_version, reference_id
    ) values (
      'bbbbbbbb-9999-4999-8999-999999999999',
      'generation_consume', -1, gen_random_uuid(),
      'commercial-v1', gen_random_uuid()
    )
  $$,
  'P0001',
  'credit balance is reserved for a refund',
  'new debits cannot consume refund-reserved credits'
);
select throws_ok(
  $$
    select public.apply_verified_payment_refund(
      (select refund_id from refund_test_intents),
      repeat('1', 64),
      (select order_number from refund_test_payments where label = 'direct'),
      4901, 'KRW', 'CANCELED', 0, repeat('a', 64), now()
    )
  $$,
  'P0001',
  'verified refund does not match the payment',
  'provider amount mismatch cannot reverse credits'
);

select lives_ok(
  $$
    select public.apply_verified_payment_refund(
      (select refund_id from refund_test_intents),
      repeat('1', 64),
      (select order_number from refund_test_payments where label = 'direct'),
      4900, 'KRW', 'CANCELED', 0, repeat('a', 64), now()
    )
  $$,
  'exact verified full refund is applied'
);
select is(
  (
    select status from public.payment_refunds
    where id = (select refund_id from refund_test_intents)
  ),
  'succeeded'::public.payment_refund_status,
  'verified refund reaches succeeded'
);
select is(
  (
    select balance from public.credit_balances
    where user_id = 'bbbbbbbb-9999-4999-8999-999999999999'
  ),
  0::bigint,
  'full refund reverses the original purchase credits'
);
select is(
  (
    select count(*) from public.credit_ledger_entries
    where transaction_type = 'payment_refund_reversal'
      and reference_id = (select refund_id from refund_test_intents)
  ),
  1::bigint,
  'refund creates exactly one reversal ledger entry'
);
select lives_ok(
  $$
    select public.apply_verified_payment_refund(
      (select refund_id from refund_test_intents),
      repeat('1', 64),
      (select order_number from refund_test_payments where label = 'direct'),
      4900, 'KRW', 'CANCELED', 0, repeat('a', 64), now()
    )
  $$,
  'verified refund retry is idempotent'
);
select is(
  (
    select count(*) from public.credit_ledger_entries
    where transaction_type = 'payment_refund_reversal'
      and reference_id = (select refund_id from refund_test_intents)
  ),
  1::bigint,
  'verified refund retry adds no second reversal'
);
select results_eq(
  $$
    select reconciliation_outcome
    from public.reconcile_verified_toss_payment(
      'bbbbbbbb-9999-4999-8999-999999999999',
      (select payment_id from refund_test_payments where label = 'direct'),
      repeat('9', 64), repeat('1', 64),
      (select order_number from refund_test_payments where label = 'direct'),
      4900, 'KRW', 'DONE', 4900, 0, null, null
    )
  $$,
  $$ values ('review_required'::public.payment_reconciliation_outcome) $$,
  'provider payment without cancellation never overwrites a local refund'
);

insert into refund_test_payments
select
  'reconcile-failed',
  payment_order.id,
  payment_order.order_number,
  public.record_verified_toss_payment(
    'bbbbbbbb-9999-4999-8999-999999999999',
    payment_order.id, repeat('2', 64), payment_order.order_number,
    9900, 'KRW', 'DONE', now()
  ),
  repeat('2', 64)
from public.create_payment_order(
  'bbbbbbbb-9999-4999-8999-999999999999',
  'STANDARD-7',
  'b0000000-0000-4000-8000-000000000002'
) as payment_order;

select lives_ok(
  $$
    select public.begin_payment_refund(
      'bbbbbbbb-9999-4999-8999-999999999999',
      (select payment_id from refund_test_payments where label = 'reconcile-failed'),
      'b1000000-0000-4000-8000-000000000002',
      'CUSTOMER_REQUEST'
    )
  $$,
  'a second paid order can reserve a refund'
);
select results_eq(
  $$
    select reconciliation_outcome
    from public.reconcile_verified_toss_payment(
      'bbbbbbbb-9999-4999-8999-999999999999',
      (select payment_id from refund_test_payments where label = 'reconcile-failed'),
      repeat('b', 64), repeat('2', 64),
      (select order_number from refund_test_payments where label = 'reconcile-failed'),
      9900, 'KRW', 'DONE', 9900, 0, null, null
    )
  $$,
  $$ values ('repaired'::public.payment_reconciliation_outcome) $$,
  'reconciliation releases an intent when provider shows no cancellation'
);
select is(
  (
    select status from public.payment_refunds
    where payment_id = (
      select payment_id from refund_test_payments where label = 'reconcile-failed'
    )
  ),
  'failed'::public.payment_refund_status,
  'provider-not-canceled refund becomes failed'
);

insert into refund_test_payments
select
  'external-cancel',
  payment_order.id,
  payment_order.order_number,
  public.record_verified_toss_payment(
    'bbbbbbbb-9999-4999-8999-999999999999',
    payment_order.id, repeat('3', 64), payment_order.order_number,
    19900, 'KRW', 'DONE', now()
  ),
  repeat('3', 64)
from public.create_payment_order(
  'bbbbbbbb-9999-4999-8999-999999999999',
  'PRO-16',
  'b0000000-0000-4000-8000-000000000003'
) as payment_order;

select results_eq(
  $$
    select reconciliation_outcome
    from public.reconcile_verified_toss_payment(
      'bbbbbbbb-9999-4999-8999-999999999999',
      (select payment_id from refund_test_payments where label = 'external-cancel'),
      repeat('c', 64), repeat('3', 64),
      (select order_number from refund_test_payments where label = 'external-cancel'),
      19900, 'KRW', 'CANCELED', 0, 19900, repeat('d', 64), now()
    )
  $$,
  $$ values ('repaired'::public.payment_reconciliation_outcome) $$,
  'verified external cancellation creates and applies a missing refund'
);
select is(
  (
    select count(*) from public.payment_refunds
    where payment_id = (
      select payment_id from refund_test_payments where label = 'external-cancel'
    )
      and status = 'succeeded'
  ),
  1::bigint,
  'external cancellation converges to one successful local refund'
);
select results_eq(
  $$
    select reconciliation_id, reconciliation_outcome
    from public.reconcile_verified_toss_payment(
      'bbbbbbbb-9999-4999-8999-999999999999',
      (select payment_id from refund_test_payments where label = 'external-cancel'),
      repeat('c', 64), repeat('3', 64),
      (select order_number from refund_test_payments where label = 'external-cancel'),
      19900, 'KRW', 'CANCELED', 0, 19900, repeat('d', 64), now()
    )
  $$,
  $$
    select id, outcome from public.payment_reconciliation_results
    where payment_id = (
      select payment_id from refund_test_payments where label = 'external-cancel'
    )
  $$,
  'same provider snapshot returns the existing reconciliation result'
);

insert into refund_test_payments
select
  'partial',
  payment_order.id,
  payment_order.order_number,
  public.record_verified_toss_payment(
    'bbbbbbbb-9999-4999-8999-999999999999',
    payment_order.id, repeat('4', 64), payment_order.order_number,
    4900, 'KRW', 'DONE', now()
  ),
  repeat('4', 64)
from public.create_payment_order(
  'bbbbbbbb-9999-4999-8999-999999999999',
  'STARTER-3',
  'b0000000-0000-4000-8000-000000000004'
) as payment_order;

select results_eq(
  $$
    select reconciliation_outcome
    from public.reconcile_verified_toss_payment(
      'bbbbbbbb-9999-4999-8999-999999999999',
      (select payment_id from refund_test_payments where label = 'partial'),
      repeat('e', 64), repeat('4', 64),
      (select order_number from refund_test_payments where label = 'partial'),
      4900, 'KRW', 'PARTIAL_CANCELED', 2450, 2450, repeat('f', 64), now()
    )
  $$,
  $$ values ('review_required'::public.payment_reconciliation_outcome) $$,
  'partial provider cancellation is routed to review instead of automatic reversal'
);
select is(
  (
    select count(*) from public.payment_refunds
    where payment_id = (
      select payment_id from refund_test_payments where label = 'partial'
    )
  ),
  0::bigint,
  'review-only partial cancellation does not create an automatic refund'
);

insert into refund_test_payments
select
  'consumed',
  payment_order.id,
  payment_order.order_number,
  public.record_verified_toss_payment(
    'cccccccc-9999-4999-8999-999999999999',
    payment_order.id, repeat('5', 64), payment_order.order_number,
    4900, 'KRW', 'DONE', now()
  ),
  repeat('5', 64)
from public.create_payment_order(
  'cccccccc-9999-4999-8999-999999999999',
  'STARTER-3',
  'b0000000-0000-4000-8000-000000000005'
) as payment_order;
insert into public.credit_ledger_entries (
  user_id, transaction_type, amount, idempotency_key,
  policy_version, reference_id, created_at
)
values (
  'cccccccc-9999-4999-8999-999999999999',
  'generation_consume', -1, gen_random_uuid(),
  'commercial-v1', gen_random_uuid(), now() + interval '1 second'
);
select throws_ok(
  $$
    select public.begin_payment_refund(
      'cccccccc-9999-4999-8999-999999999999',
      (select payment_id from refund_test_payments where label = 'consumed'),
      'b1000000-0000-4000-8000-000000000005',
      'CUSTOMER_REQUEST'
    )
  $$,
  'P0001',
  'refundable purchase credits cannot be proven unused',
  'automatic full refund is blocked after post-purchase consumption'
);

insert into refund_test_payments
select
  'expired',
  payment_order.id,
  payment_order.order_number,
  public.record_verified_toss_payment(
    'bbbbbbbb-9999-4999-8999-999999999999',
    payment_order.id, repeat('6', 64), payment_order.order_number,
    4900, 'KRW', 'DONE', now() - interval '8 days'
  ),
  repeat('6', 64)
from public.create_payment_order(
  'bbbbbbbb-9999-4999-8999-999999999999',
  'STARTER-3',
  'b0000000-0000-4000-8000-000000000006'
) as payment_order;
select throws_ok(
  $$
    select public.begin_payment_refund(
      'bbbbbbbb-9999-4999-8999-999999999999',
      (select payment_id from refund_test_payments where label = 'expired'),
      'b1000000-0000-4000-8000-000000000006',
      'CUSTOMER_REQUEST'
    )
  $$,
  'P0001',
  'refund eligibility period has expired',
  'automatic refund enforces the approved seven-day eligibility period'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-9999-4999-8999-999999999999","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.payment_refunds),
  3::bigint,
  'owner can read their refund summaries'
);
select throws_ok(
  $$
    insert into public.payment_refunds (
      payment_id, user_id, idempotency_key, amount, credit_amount,
      currency, reason_code, policy_version
    ) values (
      (select payment_id from refund_test_payments limit 1),
      'bbbbbbbb-9999-4999-8999-999999999999',
      gen_random_uuid(), 1, 1, 'KRW', 'CUSTOMER_REQUEST', 'commercial-v1'
    )
  $$,
  '42501',
  'permission denied for table payment_refunds',
  'authenticated user cannot write refund state directly'
);
select throws_ok(
  'select count(*) from public.payment_reconciliation_results',
  '42501',
  'permission denied for table payment_reconciliation_results',
  'authenticated user cannot read internal reconciliation evidence'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-9999-4999-8999-999999999999","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.payment_refunds),
  0::bigint,
  'other user cannot read owner refunds'
);

reset role;
select throws_ok(
  $$
    update public.payment_refunds
    set amount = 1
    where id = (select refund_id from refund_test_intents)
  $$,
  'P0001',
  'payment refund identity cannot change',
  'refund economic identity is immutable'
);
select throws_ok(
  'delete from public.payment_reconciliation_results',
  'P0001',
  'payment reconciliation results are immutable',
  'reconciliation evidence is immutable'
);

select * from finish();
rollback;
