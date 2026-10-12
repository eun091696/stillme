create type public.operator_role as enum ('admin', 'support');

create type public.operator_permission as enum (
  'operator.read',
  'user.read',
  'payment.read',
  'credit.read',
  'generation.read',
  'credit.adjust.request',
  'credit.adjust.approve',
  'notice.manage',
  'role.manage'
);

create type public.operator_role_change_action as enum ('grant', 'revoke');
create type public.operator_role_change_status as enum (
  'pending',
  'applied',
  'expired'
);

create table public.operator_role_permissions (
  role public.operator_role not null,
  permission public.operator_permission not null,
  primary key (role, permission)
);

insert into public.operator_role_permissions (role, permission)
values
  ('admin', 'operator.read'),
  ('admin', 'user.read'),
  ('admin', 'payment.read'),
  ('admin', 'credit.read'),
  ('admin', 'generation.read'),
  ('admin', 'credit.adjust.request'),
  ('admin', 'credit.adjust.approve'),
  ('admin', 'notice.manage'),
  ('admin', 'role.manage'),
  ('support', 'operator.read'),
  ('support', 'user.read'),
  ('support', 'payment.read'),
  ('support', 'credit.read'),
  ('support', 'generation.read'),
  ('support', 'credit.adjust.request');

create table public.operator_role_assignments (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.operator_role not null,
  granted_by uuid not null references auth.users (id) on delete restrict,
  approved_by uuid not null references auth.users (id) on delete restrict,
  grant_reason_code text not null,
  granted_at timestamptz not null default now(),
  revoked_by uuid references auth.users (id) on delete restrict,
  revoke_approved_by uuid references auth.users (id) on delete restrict,
  revocation_reason_code text,
  revoked_at timestamptz,
  primary key (user_id, role),
  constraint operator_role_assignments_grant_dual_control
    check (granted_by <> approved_by),
  constraint operator_role_assignments_grant_reason
    check (grant_reason_code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  constraint operator_role_assignments_revocation_complete
    check (
      (
        revoked_at is null
        and revoked_by is null
        and revoke_approved_by is null
        and revocation_reason_code is null
      )
      or
      (
        revoked_at is not null
        and revoked_by is not null
        and revoke_approved_by is not null
        and revoked_by <> revoke_approved_by
        and revocation_reason_code ~ '^[A-Z][A-Z0-9_]{2,63}$'
      )
    )
);

create index operator_role_assignments_active_role_idx
  on public.operator_role_assignments (role, user_id)
  where revoked_at is null;

create table public.operator_role_change_requests (
  id uuid primary key default gen_random_uuid(),
  action public.operator_role_change_action not null,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  target_role public.operator_role not null,
  reason_code text not null,
  idempotency_key uuid not null,
  requested_by uuid not null references auth.users (id) on delete restrict,
  status public.operator_role_change_status not null default 'pending',
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  approved_by uuid references auth.users (id) on delete restrict,
  applied_at timestamptz,
  constraint operator_role_change_requests_reason
    check (reason_code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  constraint operator_role_change_requests_expiry
    check (expires_at > requested_at),
  constraint operator_role_change_requests_completion
    check (
      (status = 'pending' and approved_by is null and applied_at is null)
      or
      (status = 'applied' and approved_by is not null and applied_at is not null)
      or
      (status = 'expired' and approved_by is null and applied_at is null)
    ),
  unique (requested_by, idempotency_key)
);

create index operator_role_change_requests_pending_idx
  on public.operator_role_change_requests (status, expires_at);

create table public.operator_audit_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique
    references public.operator_role_change_requests (id) on delete restrict,
  event_type public.operator_role_change_action not null,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  approver_user_id uuid not null references auth.users (id) on delete restrict,
  target_user_id uuid not null references auth.users (id) on delete restrict,
  target_role public.operator_role not null,
  reason_code text not null,
  created_at timestamptz not null default now(),
  constraint operator_audit_events_dual_control
    check (
      actor_user_id <> approver_user_id
      and approver_user_id <> target_user_id
    ),
  constraint operator_audit_events_reason
    check (reason_code ~ '^[A-Z][A-Z0-9_]{2,63}$')
);

comment on table public.operator_role_assignments is
  'Server-owned active and revoked operator role assignments.';
comment on table public.operator_role_change_requests is
  'MFA-authenticated dual-control requests for operator role changes.';
comment on table public.operator_audit_events is
  'Immutable audit evidence for applied operator role changes.';

alter table public.operator_role_permissions enable row level security;
alter table public.operator_role_permissions force row level security;
alter table public.operator_role_assignments enable row level security;
alter table public.operator_role_assignments force row level security;
alter table public.operator_role_change_requests enable row level security;
alter table public.operator_role_change_requests force row level security;
alter table public.operator_audit_events enable row level security;
alter table public.operator_audit_events force row level security;

revoke all on table public.operator_role_permissions from public;
revoke all on table public.operator_role_assignments from public;
revoke all on table public.operator_role_change_requests from public;
revoke all on table public.operator_audit_events from public;

create function public.operator_has_permission(
  required_permission public.operator_permission
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
      select 1
      from public.operator_role_assignments assignment
      join public.operator_role_permissions permission
        on permission.role = assignment.role
      where assignment.user_id = auth.uid()
        and assignment.revoked_at is null
        and permission.permission = required_permission
    );
$$;

create function public.request_operator_role_change(
  target_user_id uuid,
  target_role public.operator_role,
  requested_action public.operator_role_change_action,
  request_reason_code text,
  request_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  existing_request public.operator_role_change_requests%rowtype;
  new_request_id uuid;
begin
  if not public.operator_has_permission('role.manage') then
    raise exception 'operator role management is not authorized';
  end if;
  if target_user_id is null or not exists (
    select 1 from auth.users where id = target_user_id
  ) then
    raise exception 'target user does not exist';
  end if;
  if request_idempotency_key is null then
    raise exception 'operator request idempotency key is required';
  end if;
  if (
    request_reason_code is null
    or request_reason_code !~ '^[A-Z][A-Z0-9_]{2,63}$'
  ) then
    raise exception 'operator request reason code is invalid';
  end if;

  perform 1 from auth.users
  where id = actor_user_id
  for update;

  select * into existing_request
  from public.operator_role_change_requests
  where requested_by = actor_user_id
    and idempotency_key = request_idempotency_key;
  if found then
    if (
      existing_request.target_user_id <> target_user_id
      or existing_request.target_role <> target_role
      or existing_request.action <> requested_action
      or existing_request.reason_code <> request_reason_code
    ) then
      raise exception 'operator request idempotency key was reused';
    end if;
    return existing_request.id;
  end if;

  if requested_action = 'grant' and exists (
    select 1 from public.operator_role_assignments
    where user_id = target_user_id
      and role = target_role
      and revoked_at is null
  ) then
    raise exception 'operator role is already active';
  end if;
  if requested_action = 'revoke' and not exists (
    select 1 from public.operator_role_assignments
    where user_id = target_user_id
      and role = target_role
      and revoked_at is null
  ) then
    raise exception 'operator role is not active';
  end if;

  insert into public.operator_role_change_requests (
    action,
    target_user_id,
    target_role,
    reason_code,
    idempotency_key,
    requested_by
  )
  values (
    requested_action,
    target_user_id,
    target_role,
    request_reason_code,
    request_idempotency_key,
    actor_user_id
  )
  returning id into new_request_id;

  return new_request_id;
end;
$$;

create function public.approve_operator_role_change(
  target_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  approver_user_id uuid := auth.uid();
  role_request public.operator_role_change_requests%rowtype;
begin
  if not public.operator_has_permission('role.manage') then
    raise exception 'operator role approval is not authorized';
  end if;

  select * into role_request
  from public.operator_role_change_requests
  where id = target_request_id
  for update;
  if not found then
    raise exception 'operator role request does not exist';
  end if;
  if role_request.status = 'applied' then
    return role_request.id;
  end if;
  if role_request.status <> 'pending' then
    raise exception 'operator role request is not pending';
  end if;
  if role_request.expires_at <= now() then
    raise exception 'operator role request expired';
  end if;
  if (
    approver_user_id = role_request.requested_by
    or approver_user_id = role_request.target_user_id
  ) then
    raise exception 'operator role change requires independent approval';
  end if;

  perform 1 from auth.users
  where id = role_request.target_user_id
  for update;

  if role_request.action = 'grant' then
    if exists (
      select 1 from public.operator_role_assignments
      where user_id = role_request.target_user_id
        and role = role_request.target_role
        and revoked_at is null
    ) then
      raise exception 'operator role is already active';
    end if;

    insert into public.operator_role_assignments (
      user_id,
      role,
      granted_by,
      approved_by,
      grant_reason_code
    )
    values (
      role_request.target_user_id,
      role_request.target_role,
      role_request.requested_by,
      approver_user_id,
      role_request.reason_code
    )
    on conflict (user_id, role) do update
    set
      granted_by = excluded.granted_by,
      approved_by = excluded.approved_by,
      grant_reason_code = excluded.grant_reason_code,
      granted_at = now(),
      revoked_by = null,
      revoke_approved_by = null,
      revocation_reason_code = null,
      revoked_at = null;
  else
    if role_request.target_role = 'admin' then
      perform 1
      from public.operator_role_assignments
      where role = 'admin' and revoked_at is null
      for update;
      if (
        select count(*)
        from public.operator_role_assignments
        where role = 'admin' and revoked_at is null
      ) <= 1 then
        raise exception 'the final active admin cannot be revoked';
      end if;
    end if;

    update public.operator_role_assignments
    set
      revoked_by = role_request.requested_by,
      revoke_approved_by = approver_user_id,
      revocation_reason_code = role_request.reason_code,
      revoked_at = now()
    where user_id = role_request.target_user_id
      and role = role_request.target_role
      and revoked_at is null;
    if not found then
      raise exception 'operator role is not active';
    end if;
  end if;

  insert into public.operator_audit_events (
    request_id,
    event_type,
    actor_user_id,
    approver_user_id,
    target_user_id,
    target_role,
    reason_code
  )
  values (
    role_request.id,
    role_request.action,
    role_request.requested_by,
    approver_user_id,
    role_request.target_user_id,
    role_request.target_role,
    role_request.reason_code
  );

  update public.operator_role_change_requests
  set
    status = 'applied',
    approved_by = approver_user_id,
    applied_at = now()
  where id = role_request.id;

  return role_request.id;
end;
$$;

revoke all on function public.operator_has_permission(
  public.operator_permission
) from public;
revoke all on function public.request_operator_role_change(
  uuid,
  public.operator_role,
  public.operator_role_change_action,
  text,
  uuid
) from public;
revoke all on function public.approve_operator_role_change(uuid) from public;

grant execute on function public.operator_has_permission(
  public.operator_permission
) to authenticated;
grant execute on function public.request_operator_role_change(
  uuid,
  public.operator_role,
  public.operator_role_change_action,
  text,
  uuid
) to authenticated;
grant execute on function public.approve_operator_role_change(uuid)
  to authenticated;
