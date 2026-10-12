begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

select has_table('public', 'credit_accounts', 'credit_accounts table exists');
select has_table(
  'public',
  'credit_ledger_entries',
  'credit_ledger_entries table exists'
);
select has_view('public', 'credit_balances', 'credit_balances view exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.credit_accounts'::regclass),
  true,
  'credit_accounts has RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.credit_accounts'::regclass),
  true,
  'credit_accounts forces RLS'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.credit_ledger_entries'::regclass),
  true,
  'credit_ledger_entries has RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.credit_ledger_entries'::regclass),
  true,
  'credit_ledger_entries forces RLS'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-4555-8555-555555555555',
    'authenticated', 'authenticated', 'credit-owner@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Credit Owner"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '66666666-6666-4666-8666-666666666666',
    'authenticated', 'authenticated', 'credit-other@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Credit Other"}'::jsonb, now(), now()
  );

select is(
  (
    select count(*)
    from public.credit_accounts
    where user_id in (
      '55555555-5555-4555-8555-555555555555',
      '66666666-6666-4666-8666-666666666666'
    )
  ),
  2::bigint,
  'new auth users receive one credit account each'
);

insert into public.credit_ledger_entries (
  id, user_id, transaction_type, amount, idempotency_key, policy_version,
  reference_id
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '55555555-5555-4555-8555-555555555555',
    'trial_grant', 3, '10000000-0000-4000-8000-000000000001',
    'commercial-v1', '20000000-0000-4000-8000-000000000001'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '55555555-5555-4555-8555-555555555555',
    'generation_consume', -1, '10000000-0000-4000-8000-000000000002',
    'commercial-v1', '20000000-0000-4000-8000-000000000002'
  );

select is(
  (
    select balance
    from public.credit_balances
    where user_id = '55555555-5555-4555-8555-555555555555'
  ),
  2::bigint,
  'balance is derived from immutable ledger entries'
);

select throws_ok(
  $$
    insert into public.credit_ledger_entries (
      user_id, transaction_type, amount, idempotency_key, policy_version,
      reference_id
    ) values (
      '55555555-5555-4555-8555-555555555555',
      'trial_grant', 3, '10000000-0000-4000-8000-000000000001',
      'commercial-v1', '20000000-0000-4000-8000-000000000099'
    )
  $$,
  '23505',
  null,
  'idempotency key cannot create a duplicate credit effect'
);

select throws_ok(
  $$
    insert into public.credit_ledger_entries (
      user_id, transaction_type, amount, idempotency_key, policy_version,
      reference_id
    ) values (
      '55555555-5555-4555-8555-555555555555',
      'generation_consume', 1, '10000000-0000-4000-8000-000000000003',
      'commercial-v1', '20000000-0000-4000-8000-000000000003'
    )
  $$,
  '23514',
  null,
  'transaction types enforce amount direction'
);

select throws_ok(
  $$
    insert into public.credit_ledger_entries (
      user_id, transaction_type, amount, idempotency_key, policy_version,
      reference_id
    ) values (
      '55555555-5555-4555-8555-555555555555',
      'generation_consume', -3, '10000000-0000-4000-8000-000000000004',
      'commercial-v1', '20000000-0000-4000-8000-000000000004'
    )
  $$,
  'P0001',
  'credit balance cannot be negative',
  'ledger rejects a debit that would make balance negative'
);

insert into public.credit_ledger_entries (
  id, user_id, transaction_type, amount, idempotency_key, policy_version,
  reference_id, reversal_of, reason_code
)
values (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '55555555-5555-4555-8555-555555555555',
  'generation_restore', 1, '10000000-0000-4000-8000-000000000005',
  'commercial-v1', '20000000-0000-4000-8000-000000000005',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'PROVIDER_UNAVAILABLE'
);

select is(
  (
    select balance
    from public.credit_balances
    where user_id = '55555555-5555-4555-8555-555555555555'
  ),
  3::bigint,
  'generation restore reverses one full consumption'
);

select throws_ok(
  $$
    insert into public.credit_ledger_entries (
      user_id, transaction_type, amount, idempotency_key, policy_version,
      reference_id, reversal_of
    ) values (
      '55555555-5555-4555-8555-555555555555',
      'generation_restore', 1, '10000000-0000-4000-8000-000000000006',
      'commercial-v1', '20000000-0000-4000-8000-000000000006',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    )
  $$,
  '23505',
  null,
  'one generation consumption can be restored only once'
);

insert into public.credit_ledger_entries (
  id, user_id, transaction_type, amount, idempotency_key, policy_version,
  reference_id
)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '55555555-5555-4555-8555-555555555555',
  'purchase_grant', 20, '10000000-0000-4000-8000-000000000007',
  'commercial-v1', '20000000-0000-4000-8000-000000000007'
);

insert into public.credit_ledger_entries (
  user_id, transaction_type, amount, idempotency_key, policy_version,
  reference_id, reversal_of
)
values (
  '55555555-5555-4555-8555-555555555555',
  'payment_refund_reversal', -5,
  '10000000-0000-4000-8000-000000000008',
  'commercial-v1', '20000000-0000-4000-8000-000000000008',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
);

select is(
  (
    select balance
    from public.credit_balances
    where user_id = '55555555-5555-4555-8555-555555555555'
  ),
  18::bigint,
  'partial payment reversal reduces balance through the ledger'
);

select throws_ok(
  $$
    insert into public.credit_ledger_entries (
      user_id, transaction_type, amount, idempotency_key, policy_version,
      reference_id, reversal_of
    ) values (
      '55555555-5555-4555-8555-555555555555',
      'payment_refund_reversal', -16,
      '10000000-0000-4000-8000-000000000009',
      'commercial-v1', '20000000-0000-4000-8000-000000000009',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    )
  $$,
  'P0001',
  'payment refund exceeds purchase grant',
  'cumulative refunds cannot exceed the original purchase grant'
);

select throws_ok(
  $$
    insert into public.credit_ledger_entries (
      user_id, transaction_type, amount, idempotency_key, policy_version,
      reference_id, reason_code, requested_by, approved_by
    ) values (
      '55555555-5555-4555-8555-555555555555',
      'manual_adjustment', 1, '10000000-0000-4000-8000-000000000010',
      'commercial-v1', '20000000-0000-4000-8000-000000000010',
      'SUPPORT_CORRECTION',
      '55555555-5555-4555-8555-555555555555',
      '55555555-5555-4555-8555-555555555555'
    )
  $$,
  '23514',
  null,
  'manual adjustment requires separate requester and approver'
);

select throws_ok(
  $$
    update public.credit_ledger_entries
    set amount = 99
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  'P0001',
  'credit ledger entries are immutable',
  'ledger entries cannot be updated'
);

select throws_ok(
  $$
    delete from public.credit_ledger_entries
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  'P0001',
  'credit ledger entries are immutable',
  'ledger entries cannot be deleted'
);

select throws_ok(
  $$
    delete from public.credit_accounts
    where user_id = '55555555-5555-4555-8555-555555555555'
  $$,
  'P0001',
  'credit accounts are immutable',
  'service code cannot bypass ledger immutability by deleting an account'
);

select throws_ok(
  $$
    insert into public.credit_ledger_entries (
      user_id, transaction_type, amount, idempotency_key, policy_version,
      reference_id, reversal_of
    ) values (
      '66666666-6666-4666-8666-666666666666',
      'generation_restore', 1, '10000000-0000-4000-8000-000000000011',
      'commercial-v1', '20000000-0000-4000-8000-000000000011',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    )
  $$,
  'P0001',
  'credit reversal target does not exist',
  'a reversal cannot cross user ownership'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.credit_accounts),
  1::bigint,
  'owner can read their credit account'
);
select is(
  (select count(*) from public.credit_ledger_entries),
  5::bigint,
  'owner can read only their ledger entries'
);
select is(
  (select balance from public.credit_balances),
  18::bigint,
  'owner can read their computed balance'
);
select throws_ok(
  $$
    insert into public.credit_ledger_entries (
      user_id, transaction_type, amount, idempotency_key, policy_version,
      reference_id
    ) values (
      '55555555-5555-4555-8555-555555555555',
      'trial_grant', 3, '10000000-0000-4000-8000-000000000012',
      'commercial-v1', '20000000-0000-4000-8000-000000000012'
    )
  $$,
  '42501',
  'permission denied for table credit_ledger_entries',
  'authenticated users cannot write ledger entries'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.credit_ledger_entries),
  0::bigint,
  'other users cannot read owner ledger entries'
);
select is(
  (select balance from public.credit_balances),
  0::bigint,
  'other user sees only their own zero balance'
);

set local role anon;
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  'select count(*) from public.credit_ledger_entries',
  '42501',
  'permission denied for table credit_ledger_entries',
  'anonymous users cannot read ledger entries'
);
select throws_ok(
  'select count(*) from public.credit_balances',
  '42501',
  'permission denied for view credit_balances',
  'anonymous users cannot read credit balances'
);

reset role;

select is(
  (
    select count(*)
    from public.credit_ledger_entries
    where user_id = '55555555-5555-4555-8555-555555555555'
  ),
  5::bigint,
  'failed and duplicate mutations leave the ledger unchanged'
);

select * from finish();
rollback;
