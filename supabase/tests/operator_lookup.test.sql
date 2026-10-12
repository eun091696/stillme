begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

select has_table(
  'public',
  'operator_lookup_audit_events',
  'operator lookup audit table exists'
);
select is(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.operator_lookup_audit_events'::regclass
  ),
  true,
  'operator lookup audit events enable RLS'
);
select is(
  (
    select relforcerowsecurity
    from pg_class
    where oid = 'public.operator_lookup_audit_events'::regclass
  ),
  true,
  'operator lookup audit events force RLS'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'lookup-admin@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Lookup Admin"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'lookup-approver@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Lookup Approver"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'lookup-target@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Lookup Target"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'lookup-ordinary@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Lookup Ordinary"}'::jsonb, now(), now()
  );

insert into public.operator_role_assignments (
  user_id, role, granted_by, approved_by, grant_reason_code
)
values (
  '91000000-0000-4000-8000-000000000001',
  'admin',
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  'LOOKUP_TEST_BOOTSTRAP'
);

insert into public.credit_ledger_entries (
  user_id,
  transaction_type,
  amount,
  idempotency_key,
  policy_version,
  reference_id
)
values (
  '91000000-0000-4000-8000-000000000003',
  'trial_grant',
  20,
  '92000000-0000-4000-8000-000000000001',
  'lookup-test-v1',
  '93000000-0000-4000-8000-000000000001'
);

insert into public.payment_orders (
  id,
  order_number,
  user_id,
  product_code,
  product_version,
  amount,
  credit_amount,
  currency,
  idempotency_key,
  status
)
values (
  '94000000-0000-4000-8000-000000000001',
  'aps_94000000000040008000000000000001',
  '91000000-0000-4000-8000-000000000003',
  'STARTER-3',
  'commercial-v2',
  4900,
  3,
  'KRW',
  '95000000-0000-4000-8000-000000000001',
  'pending'
);

insert into public.generation_jobs (
  id,
  user_id,
  idempotency_key,
  prompt,
  style,
  aspect_ratio,
  model_id,
  provider_model,
  adapter_version,
  prompt_template_version
)
values (
  '96000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000003',
  '97000000-0000-4000-8000-000000000001',
  'private customer prompt',
  'photographic',
  '1:1',
  'imagen-4-fast',
  'imagen-4.0-fast-generate-001',
  'adapter-v1',
  'prompt-v1'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  (
    select display_name
    from public.operator_lookup_user(
      '91000000-0000-4000-8000-000000000003',
      '98000000-0000-4000-8000-000000000001'
    )
  ),
  'Lookup Target',
  'authorized user lookup returns the minimum profile'
);
select ok(
  (
    select not (to_jsonb(result) ? 'email')
    from public.operator_lookup_user(
      '91000000-0000-4000-8000-000000000003',
      '98000000-0000-4000-8000-000000000001'
    ) as result
  ),
  'user lookup does not expose email'
);
select is(
  (
    select balance
    from public.operator_lookup_credit(
      '91000000-0000-4000-8000-000000000003',
      '98000000-0000-4000-8000-000000000002'
    )
  ),
  20::bigint,
  'credit lookup derives balance from the ledger'
);
select ok(
  (
    select count(*) = 1
      and bool_and(not (to_jsonb(result) ? 'payment_key_hash'))
    from public.operator_lookup_payments(
      '91000000-0000-4000-8000-000000000003',
      '98000000-0000-4000-8000-000000000003'
    ) as result
  ),
  'payment lookup returns recent orders without payment keys'
);
select ok(
  (
    select count(*) = 1
      and bool_and(not (to_jsonb(result) ? 'prompt'))
    from public.operator_lookup_generations(
      '91000000-0000-4000-8000-000000000003',
      '98000000-0000-4000-8000-000000000004'
    ) as result
  ),
  'generation lookup returns job state without prompts'
);

reset role;

select is(
  (
    select count(*)
    from public.operator_lookup_audit_events
    where actor_user_id = '91000000-0000-4000-8000-000000000001'
      and target_user_id = '91000000-0000-4000-8000-000000000003'
  ),
  4::bigint,
  'each successful domain lookup records one audit event'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  (
    select display_name
    from public.operator_lookup_user(
      '91000000-0000-4000-8000-000000000003',
      '98000000-0000-4000-8000-000000000001'
    )
  ),
  'Lookup Target',
  'lookup audit request replay is idempotent'
);
select throws_ok(
  $$
    select * from public.operator_lookup_user(
      '91000000-0000-4000-8000-000000000004',
      '98000000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'operator lookup request id was reused',
  'lookup request id cannot authorize a changed target'
);

reset role;

select is(
  (
    select count(*)
    from public.operator_lookup_audit_events
    where request_id = '98000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'lookup replay preserves one audit event'
);

delete from public.operator_role_permissions
where role = 'admin' and permission = 'payment.read';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select throws_ok(
  $$
    select * from public.operator_lookup_payments(
      '91000000-0000-4000-8000-000000000003',
      '98000000-0000-4000-8000-000000000005'
    )
  $$,
  'P0001',
  'operator payment lookup is not authorized',
  'payment lookup enforces its own domain permission'
);
select is(
  (
    select display_name
    from public.operator_lookup_user(
      '91000000-0000-4000-8000-000000000003',
      '98000000-0000-4000-8000-000000000006'
    )
  ),
  'Lookup Target',
  'removing payment permission does not remove user lookup permission'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
select throws_ok(
  $$
    select * from public.operator_lookup_user(
      '91000000-0000-4000-8000-000000000003',
      '98000000-0000-4000-8000-000000000007'
    )
  $$,
  'P0001',
  'operator user lookup is not authorized',
  'operator lookup requires MFA'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',
  true
);
select throws_ok(
  $$
    select * from public.operator_lookup_credit(
      '91000000-0000-4000-8000-000000000003',
      '98000000-0000-4000-8000-000000000008'
    )
  $$,
  'P0001',
  'operator credit lookup is not authorized',
  'ordinary users cannot perform operator lookups'
);
select throws_ok(
  'select count(*) from public.operator_lookup_audit_events',
  '42501',
  'permission denied for table operator_lookup_audit_events',
  'operators cannot read raw lookup audit events directly'
);

set local role anon;
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  $$
    select * from public.operator_lookup_user(
      '91000000-0000-4000-8000-000000000003',
      '98000000-0000-4000-8000-000000000009'
    )
  $$,
  '42501',
  null,
  'anonymous callers cannot execute operator lookup functions'
);
select throws_ok(
  $$
    select public.record_operator_lookup(
      '91000000-0000-4000-8000-000000000003',
      'user',
      '98000000-0000-4000-8000-000000000009'
    )
  $$,
  '42501',
  null,
  'callers cannot execute the private audit helper'
);

select * from finish();
rollback;
