begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

select has_table(
  'public',
  'operator_role_assignments',
  'operator role assignments table exists'
);
select has_table(
  'public',
  'operator_role_change_requests',
  'operator role change requests table exists'
);
select has_table(
  'public',
  'operator_audit_events',
  'operator audit events table exists'
);
select is(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.operator_role_assignments'::regclass
  ),
  true,
  'operator role assignments enable RLS'
);
select is(
  (
    select relforcerowsecurity
    from pg_class
    where oid = 'public.operator_audit_events'::regclass
  ),
  true,
  'operator audit events force RLS'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'admin-one@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Admin One"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'admin-two@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Admin Two"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'target@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Target"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'ordinary@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Ordinary"}'::jsonb, now(), now()
  );

insert into public.operator_role_assignments (
  user_id, role, granted_by, approved_by, grant_reason_code
)
values
  (
    '81000000-0000-4000-8000-000000000001',
    'admin',
    '81000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000002',
    'INITIAL_BOOTSTRAP'
  ),
  (
    '81000000-0000-4000-8000-000000000002',
    'admin',
    '81000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000001',
    'INITIAL_BOOTSTRAP'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  public.operator_has_permission('role.manage'),
  false,
  'admin permission requires MFA'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  public.operator_has_permission('role.manage'),
  true,
  'active MFA admin has role management permission'
);

select throws_ok(
  $$
    select public.request_operator_role_change(
      '81000000-0000-4000-8000-000000000003',
      'support',
      'grant',
      'invalid reason',
      '82000000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'operator request reason code is invalid',
  'free-text reasons are rejected'
);

select public.request_operator_role_change(
  '81000000-0000-4000-8000-000000000003',
  'support',
  'grant',
  'SUPPORT_ONBOARDING',
  '82000000-0000-4000-8000-000000000001'
) as grant_request_id \gset

select is(
  public.request_operator_role_change(
    '81000000-0000-4000-8000-000000000003',
    'support',
    'grant',
    'SUPPORT_ONBOARDING',
    '82000000-0000-4000-8000-000000000001'
  ),
  :'grant_request_id'::uuid,
  'role request creation is idempotent'
);

select throws_ok(
  $$
    select public.request_operator_role_change(
      '81000000-0000-4000-8000-000000000004',
      'support',
      'grant',
      'SUPPORT_ONBOARDING',
      '82000000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'operator request idempotency key was reused',
  'an idempotency key cannot authorize a changed target'
);

select throws_ok(
  format(
    'select public.approve_operator_role_change(%L)',
    :'grant_request_id'
  ),
  'P0001',
  'operator role change requires independent approval',
  'requester cannot approve the same role change'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  public.operator_has_permission('role.manage'),
  false,
  'ordinary user has no operator permission'
);

select throws_ok(
  format(
    'select public.approve_operator_role_change(%L)',
    :'grant_request_id'
  ),
  'P0001',
  'operator role approval is not authorized',
  'ordinary user cannot approve role changes'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  public.approve_operator_role_change(:'grant_request_id'::uuid),
  :'grant_request_id'::uuid,
  'second MFA admin approves the role grant'
);
select is(
  public.approve_operator_role_change(:'grant_request_id'::uuid),
  :'grant_request_id'::uuid,
  'role approval replay is idempotent'
);

reset role;

select is(
  (
    select count(*)
    from public.operator_role_assignments
    where user_id = '81000000-0000-4000-8000-000000000003'
      and role = 'support'
      and revoked_at is null
  ),
  1::bigint,
  'approved grant creates one active support assignment'
);
select is(
  (
    select count(*)
    from public.operator_audit_events
    where request_id = :'grant_request_id'::uuid
      and actor_user_id = '81000000-0000-4000-8000-000000000001'
      and approver_user_id = '81000000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'approved grant creates immutable actor and approver evidence'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  public.operator_has_permission('user.read'),
  true,
  'support receives the minimum lookup permission'
);
select is(
  public.operator_has_permission('role.manage'),
  false,
  'support cannot manage operator roles'
);
select throws_ok(
  'select count(*) from public.operator_role_assignments',
  '42501',
  'permission denied for table operator_role_assignments',
  'operators cannot read raw role assignments directly'
);
select throws_ok(
  'select count(*) from public.operator_audit_events',
  '42501',
  'permission denied for table operator_audit_events',
  'operators cannot read raw audit events directly'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select public.request_operator_role_change(
  '81000000-0000-4000-8000-000000000003',
  'support',
  'revoke',
  'SUPPORT_OFFBOARDING',
  '82000000-0000-4000-8000-000000000002'
) as revoke_request_id \gset

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  public.approve_operator_role_change(:'revoke_request_id'::uuid),
  :'revoke_request_id'::uuid,
  'second MFA admin approves role revocation'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  public.operator_has_permission('user.read'),
  false,
  'revoked support role loses permission immediately'
);

reset role;

select is(
  (
    select count(*)
    from public.operator_audit_events
    where target_user_id = '81000000-0000-4000-8000-000000000003'
  ),
  2::bigint,
  'grant and revoke each preserve one audit event'
);
select is(
  (
    select count(*)
    from public.operator_role_change_requests
    where target_user_id = '81000000-0000-4000-8000-000000000003'
      and status = 'applied'
  ),
  2::bigint,
  'both role requests preserve applied status'
);

insert into public.operator_role_change_requests (
  id,
  action,
  target_user_id,
  target_role,
  reason_code,
  idempotency_key,
  requested_by,
  requested_at,
  expires_at
)
values (
  '83000000-0000-4000-8000-000000000001',
  'grant',
  '81000000-0000-4000-8000-000000000004',
  'support',
  'EXPIRED_APPROVAL',
  '82000000-0000-4000-8000-000000000003',
  '81000000-0000-4000-8000-000000000001',
  now() - interval '2 days',
  now() - interval '1 day'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);

select throws_ok(
  $$
    select public.approve_operator_role_change(
      '83000000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'operator role request expired',
  'expired role requests cannot be approved'
);

set local role anon;
select set_config('request.jwt.claims', '{}', true);

select throws_ok(
  $$select public.operator_has_permission('user.read')$$,
  '42501',
  null,
  'anonymous caller cannot execute operator authorization'
);

select * from finish();
rollback;
