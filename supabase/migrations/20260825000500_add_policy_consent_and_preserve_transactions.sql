alter table public.credit_accounts
  drop constraint credit_accounts_user_id_fkey,
  add column account_deleted_at timestamptz;

alter table public.payment_orders
  drop constraint payment_orders_user_id_fkey,
  add constraint payment_orders_credit_account_fkey
    foreign key (user_id) references public.credit_accounts (user_id)
    on delete restrict;

alter table public.payments
  drop constraint payments_user_id_fkey,
  add constraint payments_credit_account_fkey
    foreign key (user_id) references public.credit_accounts (user_id)
    on delete restrict;

alter table public.payment_refunds
  drop constraint payment_refunds_user_id_fkey,
  add constraint payment_refunds_credit_account_fkey
    foreign key (user_id) references public.credit_accounts (user_id)
    on delete restrict;

-- A customer may appear as the subject of a support lookup or a Credit
-- correction. Preserve those audit records under the retained internal UUID
-- without making deletion of that customer's Auth identity impossible.
alter table public.operator_lookup_audit_events
  drop constraint operator_lookup_audit_events_target_user_id_fkey,
  add constraint operator_lookup_target_credit_account_fkey
    foreign key (target_user_id) references public.credit_accounts (user_id)
    on delete restrict;

alter table public.operator_credit_adjustment_requests
  drop constraint operator_credit_adjustment_requests_target_user_id_fkey,
  add constraint operator_credit_target_credit_account_fkey
    foreign key (target_user_id) references public.credit_accounts (user_id)
    on delete restrict;

create table public.policy_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  policy_type text not null,
  policy_version text not null,
  agreed_at timestamptz not null default now(),
  constraint policy_consents_type_supported
    check (policy_type in ('terms', 'privacy')),
  constraint policy_consents_version_format
    check (policy_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  constraint policy_consents_unique
    unique (user_id, policy_type, policy_version)
);

create index policy_consents_user_idx
  on public.policy_consents (user_id, agreed_at desc);

alter table public.policy_consents enable row level security;
alter table public.policy_consents force row level security;
revoke all on table public.policy_consents
  from anon, authenticated, service_role;
grant select on table public.policy_consents to authenticated, service_role;

create policy "policy_consents_select_own"
  on public.policy_consents
  for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.record_required_policy_consents(
  target_user_id uuid,
  target_policy_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_user_id is null or not exists (
    select 1 from auth.users where id = target_user_id
  ) then
    raise exception 'policy consent user does not exist';
  end if;
  if target_policy_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'policy consent version is invalid';
  end if;
  insert into public.policy_consents (user_id, policy_type, policy_version)
  values
    (target_user_id, 'terms', target_policy_version),
    (target_user_id, 'privacy', target_policy_version)
  on conflict (user_id, policy_type, policy_version) do nothing;
end;
$$;

create or replace function public.deny_credit_account_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  if (
    tg_op = 'UPDATE'
    and old.account_deleted_at is null
    and new.account_deleted_at is not null
    and new.user_id = old.user_id
    and new.created_at = old.created_at
  ) then
    return new;
  end if;
  raise exception 'credit accounts are immutable';
end;
$$;

create function public.prepare_account_deletion(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_user_id is null then
    raise exception 'account deletion user is required';
  end if;
  if exists (
    select 1 from public.generation_jobs
    where user_id = target_user_id and status in ('queued', 'processing')
  ) then
    raise exception 'generation is still active';
  end if;
  if exists (
    select 1 from public.assets
    where user_id = target_user_id and status <> 'deleted'
  ) then
    raise exception 'stored assets still exist';
  end if;
  update public.credit_accounts
  set account_deleted_at = coalesce(account_deleted_at, now())
  where user_id = target_user_id;
  if not found then raise exception 'credit account does not exist'; end if;
end;
$$;

revoke all on function public.record_required_policy_consents(uuid, text)
  from public;
grant execute on function public.record_required_policy_consents(uuid, text)
  to service_role;
revoke all on function public.prepare_account_deletion(uuid) from public;
grant execute on function public.prepare_account_deletion(uuid)
  to service_role;
