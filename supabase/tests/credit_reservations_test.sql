begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

select has_table(
  'public',
  'credit_reservations',
  'credit_reservations table exists'
);
select has_type(
  'public',
  'credit_reservation_status',
  'credit reservation status enum exists'
);
select is(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.credit_reservations'::regclass
  ),
  true,
  'credit_reservations has RLS enabled'
);
select is(
  (
    select relforcerowsecurity
    from pg_class
    where oid = 'public.credit_reservations'::regclass
  ),
  true,
  'credit_reservations forces RLS'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '77777777-7777-4777-8777-777777777777',
    'authenticated', 'authenticated', 'reservation-owner@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Reservation Owner"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '88888888-8888-4888-8888-888888888888',
    'authenticated', 'authenticated', 'reservation-other@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Reservation Other"}'::jsonb, now(), now()
  );

insert into public.credit_ledger_entries (
  user_id, transaction_type, amount, idempotency_key, policy_version,
  reference_id
)
values (
  '77777777-7777-4777-8777-777777777777',
  'trial_grant',
  5,
  '70000000-0000-4000-8000-000000000001',
  'commercial-v1',
  '70000000-0000-4000-8000-000000000002'
);

insert into public.generation_jobs (
  id, user_id, idempotency_key, prompt, style, aspect_ratio, model_id,
  provider_model, adapter_version, prompt_template_version
)
values
  (
    '70000000-0000-4000-8000-000000000010',
    '77777777-7777-4777-8777-777777777777',
    '70000000-0000-4000-8000-000000000011',
    'successful generation', 'photographic', '1:1', 'imagen-3',
    'imagen-3.0-generate-002', 'google-v1', 'prompt-v1'
  ),
  (
    '70000000-0000-4000-8000-000000000020',
    '77777777-7777-4777-8777-777777777777',
    '70000000-0000-4000-8000-000000000021',
    'failed generation', 'photographic', '1:1', 'imagen-3',
    'imagen-3.0-generate-002', 'google-v1', 'prompt-v1'
  ),
  (
    '70000000-0000-4000-8000-000000000030',
    '77777777-7777-4777-8777-777777777777',
    '70000000-0000-4000-8000-000000000031',
    'cancelled generation', 'photographic', '1:1', 'imagen-3',
    'imagen-3.0-generate-002', 'google-v1', 'prompt-v1'
  );

select is(
  public.reserve_generation_credits(
    '70000000-0000-4000-8000-000000000010',
    2,
    '70000000-0000-4000-8000-000000000012',
    'commercial-v1'
  ),
  public.reserve_generation_credits(
    '70000000-0000-4000-8000-000000000010',
    2,
    '70000000-0000-4000-8000-000000000012',
    'commercial-v1'
  ),
  'the same reservation request is idempotent'
);

select results_eq(
  $$
    select balance, reserved_credits, available_balance
    from public.credit_balances
    where user_id = '77777777-7777-4777-8777-777777777777'
  $$,
  $$ values (5::bigint, 2::bigint, 3::bigint) $$,
  'reservation reduces available balance without changing ledger balance'
);

select throws_ok(
  $$
    select public.reserve_generation_credits(
      '70000000-0000-4000-8000-000000000010',
      3,
      '70000000-0000-4000-8000-000000000012',
      'commercial-v1'
    )
  $$,
  'P0001',
  'credit reservation idempotency key was reused',
  'idempotency key rejects a changed request fingerprint'
);

select throws_ok(
  $$
    select public.reserve_generation_credits(
      '70000000-0000-4000-8000-000000000020',
      4,
      '70000000-0000-4000-8000-000000000022',
      'commercial-v1'
    )
  $$,
  'P0001',
  'available credit balance is insufficient',
  'reservation cannot exceed available balance'
);

select throws_ok(
  $$
    select public.settle_generation_credits(
      (
        select id
        from public.credit_reservations
        where generation_job_id = '70000000-0000-4000-8000-000000000010'
      )
    )
  $$,
  'P0001',
  'credits can only be settled for a succeeded generation job',
  'reservation cannot settle before generation succeeds'
);

update public.generation_jobs
set status = 'processing'
where id = '70000000-0000-4000-8000-000000000010';
update public.generation_jobs
set status = 'succeeded'
where id = '70000000-0000-4000-8000-000000000010';

select is(
  public.settle_generation_credits(
    (
      select id
      from public.credit_reservations
      where generation_job_id = '70000000-0000-4000-8000-000000000010'
    )
  ),
  public.settle_generation_credits(
    (
      select id
      from public.credit_reservations
      where generation_job_id = '70000000-0000-4000-8000-000000000010'
    )
  ),
  'settlement retries return the same ledger entry'
);

select is(
  (
    select count(*)
    from public.credit_ledger_entries
    where transaction_type = 'generation_consume'
      and reference_id = '70000000-0000-4000-8000-000000000010'
  ),
  1::bigint,
  'successful generation creates exactly one consumption entry'
);

select results_eq(
  $$
    select balance, reserved_credits, available_balance
    from public.credit_balances
    where user_id = '77777777-7777-4777-8777-777777777777'
  $$,
  $$ values (3::bigint, 0::bigint, 3::bigint) $$,
  'settlement moves the reservation into the immutable ledger'
);

select public.reserve_generation_credits(
  '70000000-0000-4000-8000-000000000020',
  2,
  '70000000-0000-4000-8000-000000000022',
  'commercial-v1'
);
update public.generation_jobs
set status = 'processing'
where id = '70000000-0000-4000-8000-000000000020';
update public.generation_jobs
set
  status = 'failed',
  retryable = true,
  next_attempt_at = now() + interval '1 minute',
  last_error_code = 'PROVIDER_TIMEOUT'
where id = '70000000-0000-4000-8000-000000000020';

select throws_ok(
  $$
    select public.release_generation_credits(
      (
        select id
        from public.credit_reservations
        where generation_job_id = '70000000-0000-4000-8000-000000000020'
      ),
      'PROVIDER_FAILURE'
    )
  $$,
  'P0001',
  'credits can only be released after terminal failure or cancellation',
  'retryable provider failure keeps its reservation'
);

update public.generation_jobs
set status = 'cancelled'
where id = '70000000-0000-4000-8000-000000000020';

select is(
  public.release_generation_credits(
    (
      select id
      from public.credit_reservations
      where generation_job_id = '70000000-0000-4000-8000-000000000020'
    ),
    'PROVIDER_FAILURE'
  ),
  public.release_generation_credits(
    (
      select id
      from public.credit_reservations
      where generation_job_id = '70000000-0000-4000-8000-000000000020'
    ),
    'PROVIDER_FAILURE'
  ),
  'release retries return the same reservation'
);

select results_eq(
  $$
    select balance, reserved_credits, available_balance
    from public.credit_balances
    where user_id = '77777777-7777-4777-8777-777777777777'
  $$,
  $$ values (3::bigint, 0::bigint, 3::bigint) $$,
  'terminal failure restores availability without a compensating ledger entry'
);

select public.reserve_generation_credits(
  '70000000-0000-4000-8000-000000000030',
  1,
  '70000000-0000-4000-8000-000000000032',
  'commercial-v1'
);
update public.generation_jobs
set status = 'cancelled'
where id = '70000000-0000-4000-8000-000000000030';
select public.release_generation_credits(
  (
    select id
    from public.credit_reservations
    where generation_job_id = '70000000-0000-4000-8000-000000000030'
  ),
  'USER_CANCELLED'
);

select is(
  (
    select count(*)
    from public.credit_ledger_entries
    where transaction_type = 'generation_consume'
      and user_id = '77777777-7777-4777-8777-777777777777'
  ),
  1::bigint,
  'failure and cancellation do not create a credit debit'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.credit_reservations),
  3::bigint,
  'owner can read their reservations'
);
select throws_ok(
  $$
    insert into public.credit_reservations (
      generation_job_id, user_id, amount, idempotency_key, policy_version
    ) values (
      '70000000-0000-4000-8000-000000000030',
      '77777777-7777-4777-8777-777777777777',
      1,
      '70000000-0000-4000-8000-000000000099',
      'commercial-v1'
    )
  $$,
  '42501',
  'permission denied for table credit_reservations',
  'authenticated users cannot write reservations'
);
select throws_ok(
  $$
    select public.reserve_generation_credits(
      '70000000-0000-4000-8000-000000000030',
      1,
      '70000000-0000-4000-8000-000000000098',
      'commercial-v1'
    )
  $$,
  '42501',
  'permission denied for function reserve_generation_credits',
  'authenticated users cannot execute reservation mutations'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.credit_reservations),
  0::bigint,
  'other users cannot read owner reservations'
);

reset role;

select * from finish();
rollback;
