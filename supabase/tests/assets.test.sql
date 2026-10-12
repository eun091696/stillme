begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

select has_table('public', 'assets', 'assets table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.assets'::regclass),
  true,
  'assets has RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.assets'::regclass),
  true,
  'assets forces RLS'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '77777777-7777-4777-8777-777777777777',
    'authenticated', 'authenticated', 'asset-owner@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Asset Owner"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '88888888-8888-4888-8888-888888888888',
    'authenticated', 'authenticated', 'asset-other@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Asset Other"}'::jsonb, now(), now()
  );

insert into public.generation_jobs (
  id, user_id, idempotency_key, prompt, style, aspect_ratio, model_id,
  provider_model, adapter_version, prompt_template_version
)
values (
  '99999999-9999-4999-8999-999999999999',
  '77777777-7777-4777-8777-777777777777',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'synthetic asset prompt', 'illustration', '1:1',
  'google-gemini-image-v1', 'gemini-3.1-flash-image', '1', 'style-v1'
);

insert into public.assets (
  id, generation_job_id, user_id, storage_key, mime_type
)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '99999999-9999-4999-8999-999999999999',
  '77777777-7777-4777-8777-777777777777',
  'users/77777777-7777-4777-8777-777777777777/generation-jobs/99999999-9999-4999-8999-999999999999/assets/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/original.png',
  'image/png'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.assets),
  0::bigint,
  'owner cannot read an unavailable asset'
);
select throws_ok(
  $$
    insert into public.assets (
      generation_job_id, user_id, storage_key, mime_type
    ) values (
      '99999999-9999-4999-8999-999999999999',
      '77777777-7777-4777-8777-777777777777',
      'invalid',
      'image/png'
    )
  $$,
  '42501',
  'permission denied for table assets',
  'authenticated users cannot create asset metadata'
);

reset role;

update public.assets set status = 'uploading'
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
update public.assets set status = 'validating'
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
update public.assets
set
  status = 'available',
  checksum_sha256 = 'YQXWzHavQAMl6U1YjOURvlv9u3O0N9xR7KQ5F9ekPj0=',
  byte_size = 5,
  width = 1,
  height = 1
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select is(
  (select status::text from public.assets),
  'available',
  'verified asset can become available'
);
select ok(
  (select expires_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour' from public.assets),
  'available assets expire seven days after publication'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.assets),
  1::bigint,
  'owner can read an available asset'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.assets),
  0::bigint,
  'other users cannot read the asset'
);

reset role;
update public.profiles
set deletion_requested_at = now()
where id = '77777777-7777-4777-8777-777777777777';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.assets),
  0::bigint,
  'account deletion request immediately blocks asset access'
);

reset role;
select throws_ok(
  $$
    insert into public.generation_jobs (
      user_id, idempotency_key, prompt, style, aspect_ratio, model_id,
      provider_model, adapter_version, prompt_template_version
    ) values (
      '77777777-7777-4777-8777-777777777777',
      '12121212-1212-4212-8212-121212121212',
      'blocked during deletion', 'photographic', '1:1',
      'google-gemini-image-v1', 'gemini-3.1-flash-image', '1', 'style-v1'
    )
  $$,
  'P0001',
  'account deletion is in progress',
  'account deletion blocks new generation content'
);
update public.profiles
set deletion_requested_at = null
where id = '77777777-7777-4777-8777-777777777777';

set local role anon;
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  'select count(*) from public.assets',
  '42501',
  'permission denied for table assets',
  'anonymous users cannot read assets'
);

reset role;

insert into public.generation_jobs (
  id, user_id, idempotency_key, prompt, style, aspect_ratio, model_id,
  provider_model, adapter_version, prompt_template_version
)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '77777777-7777-4777-8777-777777777777',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'second synthetic asset prompt', 'product', '4:5',
  'google-gemini-image-v1', 'gemini-3.1-flash-image', '1', 'style-v1'
);

select throws_ok(
  $$
    update public.assets set storage_key = 'changed'
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  $$,
  'P0001',
  'asset immutable fields cannot change',
  'asset identity and storage key are immutable'
);
select throws_ok(
  $$
    update public.assets set status = 'allocated'
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  $$,
  'P0001',
  'invalid asset state transition',
  'available asset cannot return to allocated'
);

update public.assets set status = 'deleting'
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
update public.assets set status = 'deleted'
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select isnt(
  (select deleted_at from public.assets),
  null::timestamptz,
  'deleted asset records logical deletion time'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.assets),
  0::bigint,
  'deleted asset is denied immediately'
);

reset role;

select throws_ok(
  $$
    insert into public.assets (
      id, generation_job_id, user_id, storage_key, mime_type
    ) values (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      '88888888-8888-4888-8888-888888888888',
      'users/88888888-8888-4888-8888-888888888888/generation-jobs/dddddddd-dddd-4ddd-8ddd-dddddddddddd/assets/cccccccc-cccc-4ccc-8ccc-cccccccccccc/original.png',
      'image/png'
    )
  $$,
  '23503',
  null,
  'asset owner must match the generation job owner'
);

select * from finish();
rollback;
