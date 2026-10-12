begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

select has_function(
  'public',
  'create_generation_request',
  'generation request creation RPC exists'
);
select has_function(
  'public',
  'complete_generation_request',
  'generation completion RPC exists'
);
select has_function(
  'public',
  'fail_generation_request',
  'generation failure RPC exists'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '31313131-3131-4131-8131-313131313131',
  'authenticated',
  'authenticated',
  'generation-orchestration@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Generation Orchestration"}'::jsonb,
  now(),
  now()
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
  '31313131-3131-4131-8131-313131313131',
  'trial_grant',
  3,
  '31313131-3131-4131-8131-313131313132',
  'commercial-v1',
  '31313131-3131-4131-8131-313131313133'
);

create temporary table generation_request_result as
select *
from public.create_generation_request(
  '31313131-3131-4131-8131-313131313131',
  '31313131-3131-4131-8131-313131313134',
  'atomic generation request',
  'photographic',
  '1:1',
  'google-gemini-image-v1',
  'gemini-3.1-flash-image',
  '1',
  'style-v1',
  1,
  'commercial-v1',
  'id-photo.resume-id',
  '1.0.0',
  '["core.identity-preservation", "id-photo.restrictions"]'::jsonb,
  'flash',
  '1K',
  'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
);

select is(
  (
    select job.status::text
    from public.generation_jobs as job
    join generation_request_result as result
      on result.generation_job_id = job.id
  ),
  'queued',
  'creation leaves one queued generation job'
);

select results_eq(
  $$
    select prompt_id, prompt_version, model_key, resolution,
      source_image_key
    from public.generation_jobs
    where id = (
      select generation_job_id from generation_request_result
    )
  $$,
  $$
    values (
      'id-photo.resume-id'::text,
      '1.0.0'::text,
      'flash'::text,
      '1K'::text,
      'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'::text
    )
  $$,
  'generation request stores bounded prompt and source metadata'
);

select lives_ok(
  $$
    select public.start_generation_request(
      generation_job_id,
      reservation_id
    )
    from generation_request_result
  $$,
  'reserved generation request starts'
);

select lives_ok(
  $$
    select public.complete_generation_request(
      generation_job_id,
      reservation_id
    )
    from generation_request_result
  $$,
  'completion settles the reserved generation request'
);

select is(
  (
    select available_balance
    from public.credit_balances
    where user_id = '31313131-3131-4131-8131-313131313131'
  ),
  2::bigint,
  'successful generation consumes exactly one credit'
);

create temporary table failed_generation_request_result as
select *
from public.create_generation_request(
  '31313131-3131-4131-8131-313131313131',
  '31313131-3131-4131-8131-313131313135',
  'failed generation request',
  'illustration',
  '4:5',
  'google-gemini-image-v1',
  'gemini-3.1-flash-image',
  '1',
  'style-v1',
  1,
  'commercial-v1',
  'id-photo.profile-id',
  '1.0.0',
  '["core.identity-preservation", "id-photo.restrictions"]'::jsonb,
  'flash',
  '1K',
  'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
);

select public.start_generation_request(generation_job_id, reservation_id)
from failed_generation_request_result;

select lives_ok(
  $$
    select public.fail_generation_request(
      generation_job_id,
      reservation_id,
      'PROVIDER_ACCESS_DENIED'
    )
    from failed_generation_request_result
  $$,
  'terminal generation failure releases the reservation'
);

select is(
  (
    select last_error_code
    from public.generation_jobs
    where id = (
      select generation_job_id
      from failed_generation_request_result
    )
  ),
  'PROVIDER_ACCESS_DENIED',
  'provider failure taxonomy is stored on the failed generation'
);

select is(
  (
    select available_balance
    from public.credit_balances
    where user_id = '31313131-3131-4131-8131-313131313131'
  ),
  2::bigint,
  'failed generation does not consume a credit'
);

select throws_ok(
  $$
    select *
    from public.create_generation_request(
      '31313131-3131-4131-8131-313131313131',
      '31313131-3131-4131-8131-313131313136',
      'insufficient generation request',
      'product',
      '16:9',
      'google-gemini-image-v1',
      'gemini-3.1-flash-image',
      '1',
      'style-v1',
      3,
      'commercial-v1',
      'id-photo.student-id',
      '1.0.0',
      '["core.identity-preservation", "id-photo.restrictions"]'::jsonb,
      'flash',
      '1K',
      'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
    )
  $$,
  'available credit balance is insufficient',
  'insufficient credit rolls back job creation'
);

select is(
  (
    select count(*)
    from public.generation_jobs
    where user_id = '31313131-3131-4131-8131-313131313131'
  ),
  2::bigint,
  'failed atomic creation leaves no extra job'
);

select * from finish();

rollback;
