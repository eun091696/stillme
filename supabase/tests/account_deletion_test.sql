begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '99999999-9999-4999-8999-999999999999',
  'authenticated', 'authenticated', 'delete-owner@example.test', '', now(),
  '{"provider":"google","providers":["google"]}'::jsonb,
  '{"display_name":"Delete Owner"}'::jsonb, now(), now()
);

select lives_ok(
  $$select public.record_required_policy_consents(
    '99999999-9999-4999-8999-999999999999', '2026-08-25'
  )$$,
  'required policy consent is recorded once'
);

select lives_ok(
  $$select public.record_required_policy_consents(
    '99999999-9999-4999-8999-999999999999', '2026-08-25'
  )$$,
  'required policy consent recording is idempotent'
);

create temporary table deletion_test_order as
select * from public.create_payment_order(
  '99999999-9999-4999-8999-999999999999', 'STARTER-3',
  '91000000-0000-4000-8000-000000000001'
);

select * from public.process_verified_groble_payment(
  repeat('1', 64), 'payment.completed', repeat('2', 64), repeat('3', 64),
  (select order_number from deletion_test_order), 4900, 'KRW',
  '2026-08-25T10:00:00+09:00'
);

select lives_ok(
  $$select public.prepare_account_deletion(
    '99999999-9999-4999-8999-999999999999'
  )$$,
  'a clean customer account is prepared for deletion'
);

select lives_ok(
  $$delete from auth.users
    where id = '99999999-9999-4999-8999-999999999999'$$,
  'Auth deletion succeeds without transaction FK failures'
);

select is(
  (select count(*) from auth.users
   where id = '99999999-9999-4999-8999-999999999999'),
  0::bigint,
  'the Auth identity and OAuth metadata are removed'
);

select is(
  (select count(*) from public.profiles
   where id = '99999999-9999-4999-8999-999999999999'),
  0::bigint,
  'the profile PII is removed'
);

select is(
  (select count(*) from public.policy_consents
   where user_id = '99999999-9999-4999-8999-999999999999'),
  0::bigint,
  'policy consent rows are removed with the Auth identity'
);

select is(
  (select count(*) from public.payment_orders
   where user_id = '99999999-9999-4999-8999-999999999999'),
  1::bigint,
  'the non-PII payment order remains intact'
);

select is(
  (select count(*) from public.payments
   where user_id = '99999999-9999-4999-8999-999999999999'),
  1::bigint,
  'the non-PII payment record remains intact'
);

select is(
  (select count(*) from public.credit_ledger_entries
   where user_id = '99999999-9999-4999-8999-999999999999'),
  1::bigint,
  'the immutable Credit ledger remains intact'
);

select ok(
  (select account_deleted_at is not null from public.credit_accounts
   where user_id = '99999999-9999-4999-8999-999999999999'),
  'the retained internal account identity is marked deleted'
);

select * from finish();
rollback;
