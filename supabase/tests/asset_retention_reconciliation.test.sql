begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'authenticated', 'authenticated', 'retention-reconciliation@example.test', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Retention Reconciliation"}'::jsonb, now(), now()
);

insert into public.generation_jobs (
  id, user_id, idempotency_key, prompt, style, aspect_ratio, model_id,
  provider_model, adapter_version, prompt_template_version, created_at
)
values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'old temporary', 'photographic', '1:1', 'google-gemini-image-v1', 'gemini-3.1-flash-image', '1', 'style-v1', now() - interval '25 hours'),
  ('11111111-2222-4333-8444-555555555555', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '66666666-7777-4888-8999-000000000000', 'old quarantine', 'photographic', '1:1', 'google-gemini-image-v1', 'gemini-3.1-flash-image', '1', 'style-v1', now() - interval '8 days'),
  ('22222222-3333-4444-8555-666666666666', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '77777777-8888-4999-8000-111111111111', 'recent temporary', 'photographic', '1:1', 'google-gemini-image-v1', 'gemini-3.1-flash-image', '1', 'style-v1', now() - interval '1 hour'),
  ('88888888-9999-4aaa-8bbb-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '99999999-aaaa-4bbb-8ccc-dddddddddddd', 'old available', 'photographic', '1:1', 'google-gemini-image-v1', 'gemini-3.1-flash-image', '1', 'style-v1', now() - interval '8 days');

insert into public.assets (
  id, generation_job_id, user_id, storage_key, status, retention_class, created_at
)
values
  ('33333333-4444-4555-8666-777777777777', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'users/dddddddd-dddd-4ddd-8ddd-dddddddddddd/generation-jobs/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/assets/33333333-4444-4555-8666-777777777777/original.pending', 'failed', 'temporary_24h', now() - interval '25 hours'),
  ('44444444-5555-4666-8777-888888888888', '11111111-2222-4333-8444-555555555555', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'users/dddddddd-dddd-4ddd-8ddd-dddddddddddd/generation-jobs/11111111-2222-4333-8444-555555555555/assets/44444444-5555-4666-8777-888888888888/original.pending', 'failed', 'quarantine_7d', now() - interval '25 hours'),
  ('55555555-6666-4777-8888-999999999999', '22222222-3333-4444-8555-666666666666', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'users/dddddddd-dddd-4ddd-8ddd-dddddddddddd/generation-jobs/22222222-3333-4444-8555-666666666666/assets/55555555-6666-4777-8888-999999999999/original.pending', 'failed', 'temporary_24h', now() - interval '1 hour');

insert into public.assets (
  id, generation_job_id, user_id, storage_key, status, retention_class,
  mime_type, checksum_sha256, byte_size, width, height, created_at
)
values (
  'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  '88888888-9999-4aaa-8bbb-cccccccccccc',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'users/dddddddd-dddd-4ddd-8ddd-dddddddddddd/generation-jobs/88888888-9999-4aaa-8bbb-cccccccccccc/assets/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/original.png',
  'available', 'active', 'image/png', repeat('A', 43) || '=', 1024, 1024, 1024,
  now() - interval '8 days'
);

select is((select count(*) from public.list_expired_asset_cleanup(now())), 3::bigint, 'expired temporary, quarantine, and available assets are candidates');
select is((select count(*) from public.list_expired_asset_cleanup(now()) where reason_code = 'TEMPORARY_ASSET_EXPIRED'), 1::bigint, 'temporary candidates use bounded reason code');
select is((select count(*) from public.list_expired_asset_cleanup(now()) where reason_code = 'QUARANTINE_EXPIRED'), 1::bigint, 'quarantine candidates use bounded reason code');
select is((select count(*) from public.list_expired_asset_cleanup(now()) where reason_code = 'ACTIVE_ASSET_EXPIRED'), 1::bigint, 'available candidates use bounded reason code');
select is((select count(*) from public.list_expired_asset_cleanup(now()) where storage_key like '%/original.pending'), 2::bigint, 'candidate output contains only object identity');
select is((select count(*) from public.list_expired_asset_cleanup(now()) where asset_id = '55555555-6666-4777-8888-999999999999'), 0::bigint, 'recent temporary asset is not a candidate');
select is((select count(*) from public.list_expired_asset_cleanup(now() - interval '9 days')), 0::bigint, 'future as_of does not make newer records eligible');
select ok((select expires_at <= created_at + interval '24 hours 1 second' from public.assets where id = '44444444-5555-4666-8777-888888888888'), 'failed quarantine assets expire within 24 hours');
select ok((select expires_at >= created_at + interval '6 days 23 hours 59 minutes' from public.assets where id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'), 'available assets retain a seven-day expiry');
select is((select count(*) from pg_proc where proname = 'list_expired_asset_cleanup' and prosecdef), 1::bigint, 'reconciliation function is security definer');
select is((select count(*) from information_schema.routine_privileges where routine_name = 'list_expired_asset_cleanup' and grantee = 'service_role' and privilege_type = 'EXECUTE'), 1::bigint, 'reconciliation function is service-role only');
select is((select count(*) from pg_indexes where indexname = 'assets_expiry_cleanup_idx'), 1::bigint, 'cleanup uses an expiry index');

select * from finish();
rollback;
