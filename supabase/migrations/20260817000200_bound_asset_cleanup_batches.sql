drop function if exists public.list_expired_asset_cleanup(timestamptz);
drop function if exists public.list_expired_asset_cleanup(timestamptz, integer);

create function public.list_expired_asset_cleanup(
  as_of timestamptz default now(),
  batch_limit integer default 50
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
  order by asset.expires_at asc, asset.id asc
  limit least(greatest(batch_limit, 1), 100);
$$;

revoke all on function public.list_expired_asset_cleanup(timestamptz, integer)
  from public;
grant execute on function public.list_expired_asset_cleanup(timestamptz, integer)
  to service_role;
