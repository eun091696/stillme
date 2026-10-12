begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

select has_table(
  'public',
  'operator_credit_adjustment_requests',
  'operator credit adjustment requests table exists'
);
select is(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.operator_credit_adjustment_requests'::regclass
  ),
  true,
  'operator credit adjustment requests enable RLS'
);
select is(
  (
    select relforcerowsecurity
    from pg_class
    where oid = 'public.operator_credit_adjustment_requests'::regclass
  ),
  true,
  'operator credit adjustment requests force RLS'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'adjust-support@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Adjustment Support"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'adjust-admin-one@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Adjustment Admin One"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'adjust-admin-two@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Adjustment Admin Two"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'adjust-target@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Adjustment Target"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000000-0000-4000-8000-000000000005',
    'authenticated', 'authenticated', 'adjust-ordinary@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Adjustment Ordinary"}'::jsonb, now(), now()
  );

insert into public.operator_role_assignments (
  user_id, role, granted_by, approved_by, grant_reason_code
)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    'support',
    'a1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000003',
    'ADJUSTMENT_TEST_SUPPORT'
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'admin',
    'a1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000003',
    'ADJUSTMENT_TEST_ADMIN'
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'admin',
    'a1000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000002',
    'ADJUSTMENT_TEST_ADMIN'
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
  'a1000000-0000-4000-8000-000000000004',
  'trial_grant',
  20,
  'a2000000-0000-4000-8000-000000000001',
  'adjustment-test-v1',
  'a3000000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select public.request_operator_credit_adjustment(
  'a1000000-0000-4000-8000-000000000004',
  10,
  'SERVICE_RECOVERY',
  'SUPPORT-2026-001',
  'a4000000-0000-4000-8000-000000000001'
) as support_request_id \gset

select ok(
  :'support_request_id'::uuid is not null,
  'MFA support can request a bounded credit correction'
);
select is(
  public.request_operator_credit_adjustment(
    'a1000000-0000-4000-8000-000000000004',
    10,
    'SERVICE_RECOVERY',
    'SUPPORT-2026-001',
    'a4000000-0000-4000-8000-000000000001'
  ),
  :'support_request_id'::uuid,
  'credit adjustment request replay is idempotent'
);
select throws_ok(
  $$
    select public.request_operator_credit_adjustment(
      'a1000000-0000-4000-8000-000000000004',
      11,
      'SERVICE_RECOVERY',
      'SUPPORT-2026-001',
      'a4000000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'operator credit adjustment idempotency key was reused',
  'idempotency key cannot authorize a changed amount'
);
select throws_ok(
  $$
    select public.request_operator_credit_adjustment(
      'a1000000-0000-4000-8000-000000000004',
      151,
      'SERVICE_RECOVERY',
      'SUPPORT-2026-002',
      'a4000000-0000-4000-8000-000000000002'
    )
  $$,
  'P0001',
  'operator credit adjustment amount is invalid',
  'one request cannot exceed the approved 150 credit limit'
);
select throws_ok(
  $$
    select public.request_operator_credit_adjustment(
      'a1000000-0000-4000-8000-000000000004',
      10,
      'SERVICE_RECOVERY',
      'customer@example.test',
      'a4000000-0000-4000-8000-000000000003'
    )
  $$,
  'P0001',
  'operator support case reference is invalid',
  'personal data is rejected as a support case reference'
);
select throws_ok(
  $$
    select public.request_operator_credit_adjustment(
      'a1000000-0000-4000-8000-000000000001',
      10,
      'SUPPORT_CORRECTION',
      'SUPPORT-2026-003',
      'a4000000-0000-4000-8000-000000000004'
    )
  $$,
  'P0001',
  'operator cannot request an adjustment for self',
  'operators cannot request credit for themselves'
);
select is(
  (
    select count(*)
    from public.operator_list_credit_adjustments()
  ),
  1::bigint,
  'support can track only its own adjustment request'
);
select throws_ok(
  format(
    'select public.approve_operator_credit_adjustment(%L)',
    :'support_request_id'
  ),
  'P0001',
  'operator credit adjustment approval is not authorized',
  'support cannot approve a credit adjustment'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  (
    select count(*)
    from public.operator_list_credit_adjustments()
  ),
  1::bigint,
  'admin approval queue includes the support request'
);
select public.approve_operator_credit_adjustment(
  :'support_request_id'::uuid
) as support_ledger_id \gset
select ok(
  :'support_ledger_id'::uuid is not null,
  'an independent MFA admin approves the support request'
);

reset role;

select is(
  (
    select balance
    from public.credit_balances
    where user_id = 'a1000000-0000-4000-8000-000000000004'
  ),
  30::bigint,
  'approved correction changes the ledger-derived balance'
);
select ok(
  (
    select
      transaction_type = 'manual_adjustment'
      and amount = 10
      and reason_code = 'SERVICE_RECOVERY'
      and requested_by = 'a1000000-0000-4000-8000-000000000001'
      and approved_by = 'a1000000-0000-4000-8000-000000000002'
    from public.credit_ledger_entries
    where id = :'support_ledger_id'::uuid
  ),
  'manual ledger entry preserves amount, reason, requester and approver'
);
select is(
  (
    select count(*)
    from public.operator_credit_adjustment_requests
    where id = :'support_request_id'::uuid
      and status = 'applied'
      and ledger_entry_id = :'support_ledger_id'::uuid
  ),
  1::bigint,
  'applied request links to its immutable ledger entry'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  public.approve_operator_credit_adjustment(:'support_request_id'::uuid),
  :'support_ledger_id'::uuid,
  'approval replay returns the original ledger entry'
);

reset role;

select is(
  (
    select count(*)
    from public.credit_ledger_entries
    where reference_id = :'support_request_id'::uuid
  ),
  1::bigint,
  'approval replay does not duplicate the economic effect'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);

select public.request_operator_credit_adjustment(
  'a1000000-0000-4000-8000-000000000004',
  -10,
  'SUPPORT_CORRECTION',
  'ROLLBACK-SUPPORT-2026-001',
  'a4000000-0000-4000-8000-000000000005'
) as rollback_request_id \gset

select ok(
  :'rollback_request_id'::uuid is not null,
  'admin can request a compensating correction'
);
select throws_ok(
  format(
    'select public.approve_operator_credit_adjustment(%L)',
    :'rollback_request_id'
  ),
  'P0001',
  'operator credit adjustment requires independent approval',
  'requester cannot approve the same correction'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);

select ok(
  public.approve_operator_credit_adjustment(
    :'rollback_request_id'::uuid
  ) is not null,
  'a second admin approves the compensating correction'
);

reset role;

select is(
  (
    select balance
    from public.credit_balances
    where user_id = 'a1000000-0000-4000-8000-000000000004'
  ),
  20::bigint,
  'compensating correction restores balance without rewriting history'
);
select is(
  (
    select count(*)
    from public.credit_ledger_entries
    where user_id = 'a1000000-0000-4000-8000-000000000004'
      and transaction_type = 'manual_adjustment'
  ),
  2::bigint,
  'correction and rollback remain separate immutable ledger entries'
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
  'a6000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000004',
  'a6000000-0000-4000-8000-000000000002',
  'reserved credit adjustment test',
  'photographic',
  '1:1',
  'imagen-4-fast',
  'imagen-4.0-fast-generate-001',
  'adapter-v1',
  'prompt-v1'
);

select public.reserve_generation_credits(
  'a6000000-0000-4000-8000-000000000001',
  15,
  'a6000000-0000-4000-8000-000000000003',
  'adjustment-test-v1'
) as reserved_credit_id \gset

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select public.request_operator_credit_adjustment(
  'a1000000-0000-4000-8000-000000000004',
  -10,
  'SUPPORT_CORRECTION',
  'SUPPORT-2026-004',
  'a4000000-0000-4000-8000-000000000006'
) as overdraft_request_id \gset

select ok(
  :'overdraft_request_id'::uuid is not null,
  'negative correction remains pending until approval'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);
select throws_ok(
  format(
    'select public.approve_operator_credit_adjustment(%L)',
    :'overdraft_request_id'
  ),
  'P0001',
  'credit available balance cannot be negative',
  'approval cannot consume credits reserved by an active generation'
);

reset role;

select is(
  (
    select count(*)
    from public.operator_credit_adjustment_requests
    where id = :'overdraft_request_id'::uuid
      and status = 'pending'
      and ledger_entry_id is null
  ),
  1::bigint,
  'failed approval leaves the request and ledger unchanged'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
select throws_ok(
  $$
    select public.request_operator_credit_adjustment(
      'a1000000-0000-4000-8000-000000000004',
      1,
      'SUPPORT_CORRECTION',
      'SUPPORT-2026-005',
      'a4000000-0000-4000-8000-000000000007'
    )
  $$,
  'P0001',
  'operator credit adjustment request is not authorized',
  'credit corrections require MFA'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',
  true
);
select throws_ok(
  $$
    select public.request_operator_credit_adjustment(
      'a1000000-0000-4000-8000-000000000004',
      1,
      'SUPPORT_CORRECTION',
      'SUPPORT-2026-006',
      'a4000000-0000-4000-8000-000000000008'
    )
  $$,
  'P0001',
  'operator credit adjustment request is not authorized',
  'ordinary users cannot request credit corrections'
);
select throws_ok(
  'select count(*) from public.operator_credit_adjustment_requests',
  '42501',
  'permission denied for table operator_credit_adjustment_requests',
  'operators cannot access raw adjustment requests'
);

set local role anon;
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  $$
    select public.request_operator_credit_adjustment(
      'a1000000-0000-4000-8000-000000000004',
      1,
      'SUPPORT_CORRECTION',
      'SUPPORT-2026-007',
      'a4000000-0000-4000-8000-000000000009'
    )
  $$,
  '42501',
  null,
  'anonymous callers cannot execute credit correction functions'
);

reset role;

insert into public.operator_credit_adjustment_requests (
  id,
  target_user_id,
  adjustment_amount,
  reason_code,
  support_case_reference,
  idempotency_key,
  requested_by,
  requested_at,
  expires_at
)
values (
  'a5000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000004',
  1,
  'SUPPORT_CORRECTION',
  'SUPPORT-2026-EXPIRED',
  'a4000000-0000-4000-8000-000000000010',
  'a1000000-0000-4000-8000-000000000001',
  now() - interval '2 days',
  now() - interval '1 day'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);
select throws_ok(
  $$
    select public.approve_operator_credit_adjustment(
      'a5000000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'operator credit adjustment request expired',
  'expired credit corrections cannot be approved'
);

reset role;

select is(
  (
    select count(*)
    from public.credit_ledger_entries
    where reference_id = 'a5000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'expired correction creates no ledger entry'
);

select * from finish();
rollback;
