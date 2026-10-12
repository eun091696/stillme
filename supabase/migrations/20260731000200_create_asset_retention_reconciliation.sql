create function public.list_expired_asset_cleanup(
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
      when asset.retention_class = 'quarantine_7d' then 'QUARANTINE_EXPIRED'
      else 'TEMPORARY_ASSET_EXPIRED'
    end,
    asset.created_at
  from public.assets as asset
  where (
    asset.retention_class = 'quarantine_7d'
    and asset.created_at <= as_of - interval '7 days'
  )
  or (
    asset.retention_class in ('temporary_24h', 'active')
    and asset.status in ('allocated', 'uploading', 'validating', 'failed')
    and asset.created_at <= as_of - interval '24 hours'
  )
  order by asset.created_at asc, asset.id asc;
$$;

revoke all on function public.list_expired_asset_cleanup(timestamptz) from public;
grant execute on function public.list_expired_asset_cleanup(timestamptz)
  to service_role;
