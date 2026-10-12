begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

select has_function(
  'public',
  'reconcile_stale_generation_credit_reservations',
  array['timestamp with time zone', 'interval', 'integer'],
  'stale generation Credit reconciliation RPC exists'
);

select is(
  (
    select count(*)
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'reconcile_stale_generation_credit_reservations'
      and grantee = 'service_role'
      and privilege_type = 'EXECUTE'
  ),
  1::bigint,
  'only service-role execution is granted explicitly'
);

select is(
  has_function_privilege(
    'anon',
    'public.reconcile_stale_generation_credit_reservations(timestamptz,interval,integer)',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot execute Credit reconciliation'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.reconcile_stale_generation_credit_reservations(timestamptz,interval,integer)',
    'EXECUTE'
  ),
  false,
  'authenticated users cannot execute Credit reconciliation'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '41414141-4141-4141-8141-414141414141',
  'authenticated', 'authenticated',
  'generation-reconciliation@example.test', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Generation Reconciliation"}'::jsonb,
  now(), now()
);

insert into public.credit_ledger_entries (
  user_id, transaction_type, amount, idempotency_key, policy_version,
  reference_id
)
values (
  '41414141-4141-4141-8141-414141414141',
  'trial_grant', 5,
  '41414141-4141-4141-8141-414141414142',
  'commercial-v1',
  '41414141-4141-4141-8141-414141414143'
);

create temporary table stale_processing_request as
select * from public.create_generation_request(
  '41414141-4141-4141-8141-414141414141',
  '41414141-4141-4141-8141-414141414144',
  'stale processing reconciliation', 'photographic', '1:1',
  'google-gemini-image-v1', 'gemini-3.1-flash-image', '1', 'style-v1',
  1, 'commercial-v1', 'id-photo.resume-id', '1.0.0',
  '["core.identity-preservation"]'::jsonb, 'flash', '1K',
  'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
);

select public.start_generation_request(generation_job_id, reservation_id)
from stale_processing_request;

select results_eq(
  $$
    select scanned_count, released_count, skipped_count, failed_count
    from public.reconcile_stale_generation_credit_reservations(
      now(), interval '30 minutes', 50
    )
  $$,
  $$ values (0, 0, 0, 0) $$,
  'an active processing generation is untouched before the stale threshold'
);

select results_eq(
  $$
    select scanned_count, released_count, skipped_count, failed_count
    from public.reconcile_stale_generation_credit_reservations(
      now() + interval '1 hour', interval '30 minutes', 50
    )
  $$,
  $$ values (1, 1, 0, 0) $$,
  'an old processing generation releases its reserved Credit'
);

select is(
  (
    select status::text from public.credit_reservations
    where id = (select reservation_id from stale_processing_request)
  ),
  'released',
  'stale processing reservation is released'
);

select is(
  (
    select status::text from public.generation_jobs
    where id = (select generation_job_id from stale_processing_request)
  ),
  'failed',
  'stale processing generation becomes terminally failed'
);

select results_eq(
  $$
    select scanned_count, released_count, skipped_count, failed_count
    from public.reconcile_stale_generation_credit_reservations(
      now() + interval '1 hour', interval '30 minutes', 50
    )
  $$,
  $$ values (0, 0, 0, 0) $$,
  'reconciliation replay cannot release Credit twice'
);

select is(
  (
    select available_balance from public.credit_balances
    where user_id = '41414141-4141-4141-8141-414141414141'
  ),
  5::bigint,
  'reconciliation restores availability without granting compensating Credit'
);

create temporary table ambiguous_processing_request as
select * from public.create_generation_request(
  '41414141-4141-4141-8141-414141414141',
  '41414141-4141-4141-8141-414141414146',
  'ambiguous published asset exclusion', 'photographic', '1:1',
  'google-gemini-image-v1', 'gemini-3.1-flash-image', '1', 'style-v1',
  1, 'commercial-v1', 'id-photo.resume-id', '1.0.0',
  '["core.identity-preservation"]'::jsonb, 'flash', '1K',
  'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
);
select public.start_generation_request(generation_job_id, reservation_id)
from ambiguous_processing_request;

insert into public.assets (
  id, generation_job_id, user_id, storage_key, status, mime_type
)
select
  '41414141-4141-4141-8141-414141414147', generation_job_id,
  '41414141-4141-4141-8141-414141414141',
  format(
    'users/%s/generation-jobs/%s/assets/%s/original.png',
    '41414141-4141-4141-8141-414141414141',
    generation_job_id,
    '41414141-4141-4141-8141-414141414147'
  ),
  'uploading', 'image/png'
from ambiguous_processing_request;

select results_eq(
  $$
    select scanned_count, released_count, skipped_count, failed_count
    from public.reconcile_stale_generation_credit_reservations(
      now() + interval '1 hour', interval '30 minutes', 50
    )
  $$,
  $$ values (1, 0, 1, 0) $$,
  'a stale request with a possibly published asset is left for manual review'
);

select is(
  (
    select status::text from public.credit_reservations
    where id = (select reservation_id from ambiguous_processing_request)
  ),
  'reserved',
  'an ambiguous request cannot automatically release Credit'
);

create temporary table settled_request as
select * from public.create_generation_request(
  '41414141-4141-4141-8141-414141414141',
  '41414141-4141-4141-8141-414141414145',
  'settled generation exclusion', 'photographic', '1:1',
  'google-gemini-image-v1', 'gemini-3.1-flash-image', '1', 'style-v1',
  1, 'commercial-v1', 'id-photo.resume-id', '1.0.0',
  '["core.identity-preservation"]'::jsonb, 'flash', '1K',
  'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
);
select public.start_generation_request(generation_job_id, reservation_id)
from settled_request;
select public.complete_generation_request(generation_job_id, reservation_id)
from settled_request;

select public.reconcile_stale_generation_credit_reservations(
  now() + interval '1 hour', interval '30 minutes', 50
);

select is(
  (
    select status::text from public.credit_reservations
    where id = (select reservation_id from settled_request)
  ),
  'settled',
  'a settled reservation is never reconciled as released'
);

insert into public.generation_jobs (
  id, user_id, idempotency_key, prompt, style, aspect_ratio, model_id,
  provider_model, adapter_version, prompt_template_version, status,
  retryable, completed_at, created_at, updated_at
)
values
(
  '41414141-4141-4141-8141-414141414150',
  '41414141-4141-4141-8141-414141414141',
  '41414141-4141-4141-8141-414141414151',
  'succeeded exclusion', 'photographic', '1:1', 'google-gemini-image-v1',
  'gemini-3.1-flash-image', '1', 'style-v1', 'succeeded', false,
  now() - interval '1 hour', now() - interval '1 hour',
  now() - interval '1 hour'
),
(
  '41414141-4141-4141-8141-414141414152',
  '41414141-4141-4141-8141-414141414141',
  '41414141-4141-4141-8141-414141414153',
  'consume ledger exclusion', 'photographic', '1:1',
  'google-gemini-image-v1', 'gemini-3.1-flash-image', '1', 'style-v1',
  'failed', false, now() - interval '1 hour', now() - interval '1 hour',
  now() - interval '1 hour'
),
(
  '41414141-4141-4141-8141-414141414154',
  '41414141-4141-4141-8141-414141414141',
  '41414141-4141-4141-8141-414141414155',
  'retryable failure exclusion', 'photographic', '1:1',
  'google-gemini-image-v1', 'gemini-3.1-flash-image', '1', 'style-v1',
  'failed', true, null, now() - interval '1 hour',
  now() - interval '1 hour'
);

insert into public.credit_ledger_entries (
  user_id, transaction_type, amount, idempotency_key, policy_version,
  reference_id
)
values (
  '41414141-4141-4141-8141-414141414141', 'generation_consume', -1,
  '41414141-4141-4141-8141-414141414156', 'commercial-v1',
  '41414141-4141-4141-8141-414141414152'
);

insert into public.credit_reservations (
  id, generation_job_id, user_id, amount, idempotency_key, policy_version,
  created_at, updated_at
)
values
(
  '41414141-4141-4141-8141-414141414160',
  '41414141-4141-4141-8141-414141414150',
  '41414141-4141-4141-8141-414141414141', 1,
  '41414141-4141-4141-8141-414141414161', 'commercial-v1',
  now() - interval '1 hour', now() - interval '1 hour'
),
(
  '41414141-4141-4141-8141-414141414162',
  '41414141-4141-4141-8141-414141414152',
  '41414141-4141-4141-8141-414141414141', 1,
  '41414141-4141-4141-8141-414141414163', 'commercial-v1',
  now() - interval '1 hour', now() - interval '1 hour'
),
(
  '41414141-4141-4141-8141-414141414164',
  '41414141-4141-4141-8141-414141414154',
  '41414141-4141-4141-8141-414141414141', 1,
  '41414141-4141-4141-8141-414141414165', 'commercial-v1',
  now() - interval '1 hour', now() - interval '1 hour'
);

select public.reconcile_stale_generation_credit_reservations(
  now(), interval '30 minutes', 50
);

select is(
  (
    select status::text from public.credit_reservations
    where id = '41414141-4141-4141-8141-414141414160'
  ),
  'reserved',
  'a succeeded generation is never released'
);
select is(
  (
    select status::text from public.credit_reservations
    where id = '41414141-4141-4141-8141-414141414162'
  ),
  'reserved',
  'a generation with a consume ledger entry is never released'
);
select is(
  (
    select status::text from public.credit_reservations
    where id = '41414141-4141-4141-8141-414141414164'
  ),
  'reserved',
  'a retryable failed generation is left for its retry policy'
);

select * from finish();

rollback;
