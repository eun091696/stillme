begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

select has_table('public', 'profiles', 'profiles table exists');
select col_is_pk('public', 'profiles', 'id', 'profiles.id is the primary key');
select is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true,
  'profiles has RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true,
  'profiles forces RLS'
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
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'owner@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'other@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Other"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated',
    'authenticated',
    'kakao@example.test',
    '',
    now(),
    '{"provider":"kakao","providers":["kakao"]}'::jsonb,
    '{"full_name":"카카오 사용자"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-8444-444444444444',
    'authenticated',
    'authenticated',
    'google-user@example.test',
    '',
    now(),
    '{"provider":"google","providers":["google"]}'::jsonb,
    '{"full_name":"Google 사용자"}'::jsonb,
    now(),
    now()
  );

select is(
  (
    select count(*)
    from public.profiles
    where id in (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222'
    )
  ),
  2::bigint,
  'signup trigger creates one profile per user'
);

select is(
  (select display_name from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  '카카오 사용자',
  'social signup uses provider profile metadata for its display name'
);

select is(
  (select display_name from public.profiles where id = '44444444-4444-4444-8444-444444444444'),
  'Google 사용자',
  'Google signup uses provider profile metadata for its display name'
);

select is(
  (select count(*) from public.credit_accounts where user_id in (
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444'
  )),
  2::bigint,
  'each social auth user receives exactly one credit account'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'owner can read only their profile'
);
select is(
  (select display_name from public.profiles),
  'Owner',
  'owner sees their own display name'
);

update public.profiles
set display_name = 'Updated Owner'
where id = '11111111-1111-4111-8111-111111111111';

select is(
  (select display_name from public.profiles),
  'Updated Owner',
  'owner can update their display name'
);

update public.profiles
set display_name = 'Forged'
where id = '22222222-2222-4222-8222-222222222222';

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select is(
  (select display_name from public.profiles),
  'Other',
  'cross-user update changes no rows'
);

set local role anon;
select set_config('request.jwt.claims', '{}', true);

select throws_ok(
  'select count(*) from public.profiles',
  '42501',
  'permission denied for table profiles',
  'anonymous users cannot read profiles'
);

select * from finish();
rollback;
