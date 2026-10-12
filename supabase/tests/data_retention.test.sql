begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '77777777-7777-4777-8777-777777777777',
  'authenticated', 'authenticated', 'retention-owner@example.test', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Retention Owner"}'::jsonb, now(), now()
);

insert into public.generation_jobs (
  id, user_id, idempotency_key, prompt, style, aspect_ratio, model_id,
  provider_model, adapter_version, prompt_template_version
)
values (
  '88888888-8888-4888-8888-888888888888',
  '77777777-7777-4777-8777-777777777777',
  '99999999-9999-4999-8999-999999999999',
  'synthetic retention prompt', 'photographic', '1:1',
  'google-gemini-image-v1', 'gemini-3.1-flash-image', '1', 'style-v1'
);

insert into public.assets (
  id, generation_job_id, user_id, storage_key, status
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '88888888-8888-4888-8888-888888888888',
  '77777777-7777-4777-8777-777777777777',
  'users/77777777-7777-4777-8777-777777777777/generation-jobs/88888888-8888-4888-8888-888888888888/assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/original.pending',
  'allocated'
);

insert into public.credit_ledger_entries (
  user_id, transaction_type, amount, idempotency_key, policy_version, reference_id
)
values (
  '77777777-7777-4777-8777-777777777777', 'trial_grant', 3,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'commercial-v1',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
);

select is((select count(*) from public.profiles where id = '77777777-7777-4777-8777-777777777777'), 1::bigint, 'profile exists before account deletion');
select is((select count(*) from public.credit_accounts where user_id = '77777777-7777-4777-8777-777777777777'), 1::bigint, 'credit account exists before account deletion');
select is((select count(*) from public.generation_jobs where user_id = '77777777-7777-4777-8777-777777777777'), 1::bigint, 'generation job exists before account deletion');
select is((select count(*) from public.assets where user_id = '77777777-7777-4777-8777-777777777777'), 1::bigint, 'asset metadata exists before account deletion');
select is((select balance from public.credit_balances where user_id = '77777777-7777-4777-8777-777777777777'), 3::bigint, 'credit balance exists before account deletion');

delete from auth.users where id = '77777777-7777-4777-8777-777777777777';

select is((select count(*) from public.profiles where id = '77777777-7777-4777-8777-777777777777'), 0::bigint, 'profile is removed with the account');
select is((select count(*) from public.credit_ledger_entries where user_id = '77777777-7777-4777-8777-777777777777'), 1::bigint, 'non-PII credit ledger history is preserved after account deletion');
select is((select count(*) from public.generation_jobs where user_id = '77777777-7777-4777-8777-777777777777'), 0::bigint, 'generation job is removed with the account');
select is((select count(*) from public.assets where user_id = '77777777-7777-4777-8777-777777777777'), 0::bigint, 'asset metadata is removed with the account');

select * from finish();
rollback;
