alter table public.profiles
  add column deletion_requested_at timestamptz;

alter table public.assets
  add column expires_at timestamptz;

update public.assets
set expires_at = case
  when status = 'available' then updated_at + interval '7 days'
  else created_at + interval '24 hours'
end;

alter table public.assets
  alter column expires_at set default (now() + interval '24 hours'),
  alter column expires_at set not null,
  add constraint assets_expiry_after_creation
    check (expires_at > created_at);

create index assets_expiry_cleanup_idx
  on public.assets (expires_at asc, id asc)
  where status in (
    'allocated', 'uploading', 'validating', 'available', 'failed', 'deleting'
  );

create function public.set_asset_expiry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.expires_at := case
      when new.status = 'available'
        then new.created_at + interval '7 days'
      else new.created_at + interval '24 hours'
    end;
  elsif new.status is distinct from old.status then
    if new.status = 'available' then
      new.expires_at := now() + interval '7 days';
    elsif new.status = 'failed' then
      new.expires_at := new.created_at + interval '24 hours';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.set_asset_expiry() from public;

create trigger assets_set_expiry
  before insert or update of status on public.assets
  for each row execute procedure public.set_asset_expiry();

create or replace function public.guard_asset_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
    new.id,
    new.generation_job_id,
    new.user_id,
    new.storage_key,
    new.object_class,
    new.created_at
  ) is distinct from (
    old.id,
    old.generation_job_id,
    old.user_id,
    old.storage_key,
    old.object_class,
    old.created_at
  ) then
    raise exception 'asset immutable fields cannot change';
  end if;

  if new.status = old.status then
    raise exception 'asset status must transition';
  end if;

  if (
    (old.status = 'allocated' and new.status in ('uploading', 'failed', 'deleting'))
    or (old.status = 'uploading' and new.status in ('validating', 'failed', 'deleting'))
    or (old.status = 'validating' and new.status in ('available', 'failed', 'deleting'))
    or (old.status = 'available' and new.status = 'deleting')
    or (old.status = 'failed' and new.status = 'deleting')
    or (old.status = 'deleting' and new.status = 'deleted')
  ) then
    if new.status = 'deleted' then
      new.deleted_at := now();
    else
      new.deleted_at := null;
    end if;
    new.updated_at := now();
    return new;
  end if;

  raise exception 'invalid asset state transition';
end;
$$;

drop policy "assets_select_own_available" on public.assets;
create policy "assets_select_own_available"
  on public.assets
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and status = 'available'
    and deleted_at is null
    and expires_at > now()
    and not exists (
      select 1
      from public.profiles as profile
      where profile.id = user_id
        and profile.deletion_requested_at is not null
    )
  );

create or replace function public.list_expired_asset_cleanup(
  as_of timestamptz default now()
)
returns table (
  asset_id uuid,
  user_id uuid,
  storage_key text,
  status public.asset_status,
  retention_class text,
  reason_code text,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    asset.id,
    asset.user_id,
    asset.storage_key,
    asset.status,
    asset.retention_class,
    case
      when asset.status = 'available' then 'ACTIVE_ASSET_EXPIRED'
      when asset.retention_class = 'quarantine_7d' then 'QUARANTINE_EXPIRED'
      else 'TEMPORARY_ASSET_EXPIRED'
    end,
    asset.created_at
  from public.assets as asset
  where asset.expires_at <= as_of
    and asset.status in (
      'allocated', 'uploading', 'validating', 'available', 'failed', 'deleting'
  )
  order by asset.expires_at asc, asset.id asc;
$$;

create function public.block_content_for_deleting_account()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.profiles as profile
    where profile.id = new.user_id
      and profile.deletion_requested_at is not null
  ) then
    raise exception 'account deletion is in progress';
  end if;
  return new;
end;
$$;

revoke all on function public.block_content_for_deleting_account() from public;

create trigger generation_jobs_block_deleting_account
  before insert on public.generation_jobs
  for each row execute procedure public.block_content_for_deleting_account();

create trigger assets_block_deleting_account
  before insert on public.assets
  for each row execute procedure public.block_content_for_deleting_account();
