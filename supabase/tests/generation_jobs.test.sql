begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select has_table(
  'public',
  'generation_jobs',
  'generation_jobs table exists'
);
select col_is_pk(
  'public',
  'generation_jobs',
  'id',
  'generation_jobs.id is the primary key'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.generation_jobs'::regclass),
  true,
  'generation_jobs has RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.generation_jobs'::regclass),
  true,
  'generation_jobs forces RLS'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated',
    'authenticated',
    'job-owner@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Job Owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-8444-444444444444',
    'authenticated',
    'authenticated',
    'job-other@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Job Other"}'::jsonb,
    now(),
    now()
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
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '33333333-3333-4333-8333-333333333333',
  '55555555-5555-4555-8555-555555555555',
  'synthetic prompt',
  'photographic',
  '16:9',
  'google-gemini-image-v1',
  'gemini-3.1-flash-image',
  '1',
  'style-v1'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.generation_jobs),
  1::bigint,
  'owner can read their generation job'
);

select throws_ok(
  $$
    insert into public.generation_jobs (
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
      '33333333-3333-4333-8333-333333333333',
      '66666666-6666-4666-8666-666666666666',
      'client insert',
      'portrait',
      '4:5',
      'google-gemini-image-v1',
      'gemini-3.1-flash-image',
      '1',
      'style-v1'
    )
  $$,
  '42501',
  'permission denied for table generation_jobs',
  'authenticated users cannot create jobs directly'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.generation_jobs),
  0::bigint,
  'other users cannot read the owner job'
);

set local role anon;
select set_config('request.jwt.claims', '{}', true);

select throws_ok(
  'select count(*) from public.generation_jobs',
  '42501',
  'permission denied for table generation_jobs',
  'anonymous users cannot read generation jobs'
);

reset role;

update public.generation_jobs
set status = 'processing'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is(
  (
    select status::text
    from public.generation_jobs
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  'processing',
  'queued job can start processing'
);
select is(
  (
    select attempt_count
    from public.generation_jobs
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  1,
  'starting increments the attempt count once'
);

select throws_ok(
  $$
    update public.generation_jobs
    set prompt = 'changed prompt'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  'P0001',
  'generation job immutable fields cannot change',
  'job input and identity are immutable'
);

update public.generation_jobs
set
  status = 'failed',
  retryable = true,
  next_attempt_at = now(),
  last_error_code = 'PROVIDER_UNAVAILABLE'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is(
  (
    select retryable
    from public.generation_jobs
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  true,
  'retryable failure records bounded retry metadata'
);

update public.generation_jobs
set status = 'queued'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is(
  (
    select attempt_count
    from public.generation_jobs
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  1,
  'retry keeps the same job and prior attempt count'
);

select throws_ok(
  $$
    update public.generation_jobs
    set status = 'succeeded'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  'P0001',
  'invalid generation job state transition',
  'queued job cannot skip processing'
);

select throws_ok(
  $$
    insert into public.generation_jobs (
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
      '33333333-3333-4333-8333-333333333333',
      '55555555-5555-4555-8555-555555555555',
      'duplicate request',
      'photographic',
      '16:9',
      'google-gemini-image-v1',
      'gemini-3.1-flash-image',
      '1',
      'style-v1'
    )
  $$,
  '23505',
  null,
  'idempotency key cannot create a duplicate user job'
);

select * from finish();
rollback;
