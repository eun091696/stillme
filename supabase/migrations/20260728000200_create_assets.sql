alter table public.generation_jobs
  add constraint generation_jobs_id_user_unique unique (id, user_id);

create type public.asset_status as enum (
  'allocated',
  'uploading',
  'validating',
  'available',
  'failed',
  'deleting',
  'deleted'
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  generation_job_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_key text not null unique,
  object_class text not null default 'original',
  status public.asset_status not null default 'allocated',
  mime_type text,
  checksum_sha256 text,
  byte_size bigint,
  width integer,
  height integer,
  retention_class text not null default 'active',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assets_generation_owner_fk
    foreign key (generation_job_id, user_id)
    references public.generation_jobs (id, user_id)
    on delete cascade,
  constraint assets_one_original_per_job
    unique (generation_job_id, object_class),
  constraint assets_original_only
    check (object_class = 'original'),
  constraint assets_retention_supported
    check (retention_class in ('active', 'temporary_24h', 'quarantine_7d')),
  constraint assets_mime_type_supported
    check (
      mime_type is null
      or mime_type in ('image/jpeg', 'image/png', 'image/webp')
    ),
  constraint assets_checksum_format
    check (
      checksum_sha256 is null
      or checksum_sha256 ~ '^[A-Za-z0-9+/]{43}=$'
    ),
  constraint assets_dimensions_valid
    check (
      (width is null and height is null)
      or (width between 1 and 8192 and height between 1 and 8192)
    ),
  constraint assets_byte_size_valid
    check (byte_size is null or byte_size between 1 and 20971520),
  constraint assets_original_key_matches_identity
    check (
      storage_key = format(
        'users/%s/generation-jobs/%s/assets/%s/original.%s',
        user_id,
        generation_job_id,
        id,
        case mime_type
          when 'image/jpeg' then 'jpg'
          when 'image/png' then 'png'
          when 'image/webp' then 'webp'
          else 'pending'
        end
      )
    ),
  constraint assets_available_metadata_complete
    check (
      status <> 'available'
      or (
        mime_type is not null
        and checksum_sha256 is not null
        and byte_size is not null
        and width is not null
        and height is not null
        and deleted_at is null
      )
    ),
  constraint assets_deleted_timestamp_consistent
    check (
      (status = 'deleted' and deleted_at is not null)
      or (status <> 'deleted' and deleted_at is null)
    )
);

comment on table public.assets is
  'Private generated image metadata; R2 remains the object-byte authority.';

create index assets_user_status_created_idx
  on public.assets (user_id, status, created_at desc, id desc);

create index assets_generation_status_idx
  on public.assets (generation_job_id, status);

alter table public.assets enable row level security;
alter table public.assets force row level security;

revoke all on table public.assets from anon;
revoke all on table public.assets from authenticated;
grant select on table public.assets to authenticated;
grant all on table public.assets to service_role;

create policy "assets_select_own_available"
  on public.assets
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and status = 'available'
    and deleted_at is null
  );

create function public.guard_asset_transition()
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
    (old.status = 'allocated' and new.status in ('uploading', 'failed'))
    or (old.status = 'uploading' and new.status in ('validating', 'failed'))
    or (old.status = 'validating' and new.status in ('available', 'failed'))
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

revoke all on function public.guard_asset_transition() from public;

create trigger assets_guard_transition
  before update on public.assets
  for each row execute procedure public.guard_asset_transition();
