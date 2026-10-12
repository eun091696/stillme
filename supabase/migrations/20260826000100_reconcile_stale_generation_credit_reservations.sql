create index generation_jobs_stale_credit_reconciliation_idx
  on public.generation_jobs (updated_at asc, id asc)
  where status in ('queued', 'processing', 'failed', 'cancelled');

create function public.reconcile_stale_generation_credit_reservations(
  as_of timestamptz default now(),
  stale_after interval default interval '30 minutes',
  batch_limit integer default 50
)
returns table (
  scanned_count integer,
  released_count integer,
  skipped_count integer,
  failed_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate record;
  current_job public.generation_jobs%rowtype;
  current_reservation public.credit_reservations%rowtype;
  scanned integer := 0;
  released integer := 0;
  skipped integer := 0;
  failed integer := 0;
  release_reason text;
begin
  if as_of is null then
    raise exception 'reconciliation time is required';
  end if;
  if stale_after < interval '15 minutes'
    or stale_after > interval '24 hours'
  then
    raise exception 'reconciliation stale threshold is invalid';
  end if;
  if batch_limit is null or batch_limit < 1 or batch_limit > 100 then
    raise exception 'reconciliation batch limit is invalid';
  end if;

  for candidate in
    select
      job.id as generation_job_id,
      job.user_id,
      reservation.id as reservation_id
    from public.generation_jobs as job
    join public.credit_reservations as reservation
      on reservation.generation_job_id = job.id
      and reservation.user_id = job.user_id
    where reservation.status = 'reserved'
      and job.status in ('queued', 'processing', 'failed', 'cancelled')
      and greatest(job.updated_at, reservation.updated_at)
        <= as_of - stale_after
    order by job.updated_at asc, job.id asc
    limit batch_limit
    for update of job skip locked
  loop
    scanned := scanned + 1;

    begin
      perform 1
      from public.credit_accounts
      where user_id = candidate.user_id
      for update;
      if not found then
        raise exception 'generation credit account does not exist';
      end if;

      select *
      into current_reservation
      from public.credit_reservations
      where id = candidate.reservation_id
      for update;

      select *
      into current_job
      from public.generation_jobs
      where id = candidate.generation_job_id;

      if current_reservation.status <> 'reserved'
        or current_reservation.user_id <> current_job.user_id
        or current_reservation.generation_job_id <> current_job.id
        or greatest(current_job.updated_at, current_reservation.updated_at)
          > as_of - stale_after
        or current_job.status = 'succeeded'
        or exists (
          select 1
          from public.credit_ledger_entries as ledger
          where ledger.transaction_type = 'generation_consume'
            and ledger.user_id = current_reservation.user_id
            and ledger.reference_id = current_job.id
        )
        or (
          current_job.status in ('queued', 'processing')
          and exists (
            select 1
            from public.assets as asset
            where asset.generation_job_id = current_job.id
              and asset.user_id = current_job.user_id
              and asset.status in (
                'uploading', 'validating', 'available', 'deleting'
              )
          )
        )
      then
        skipped := skipped + 1;
        continue;
      end if;

      if current_job.status = 'failed' and current_job.retryable then
        skipped := skipped + 1;
        continue;
      end if;

      if current_job.status = 'processing' then
        perform public.fail_generation_request(
          current_job.id,
          current_reservation.id,
          'STALE_GENERATION_RECONCILED'
        );
      elsif current_job.status = 'queued' then
        perform public.cancel_generation_request(
          current_job.id,
          current_reservation.id,
          'STALE_GENERATION_RECONCILED'
        );
      elsif current_job.status in ('failed', 'cancelled') then
        release_reason := case
          when current_job.status = 'failed'
            and current_job.last_error_code is not null
            then current_job.last_error_code
          else 'STALE_GENERATION_RECONCILED'
        end;
        perform public.release_generation_credits(
          current_reservation.id,
          release_reason
        );
      else
        skipped := skipped + 1;
        continue;
      end if;

      released := released + 1;
    exception when others then
      failed := failed + 1;
    end;
  end loop;

  return query select scanned, released, skipped, failed;
end;
$$;

revoke execute on function public.reconcile_stale_generation_credit_reservations(
  timestamptz,
  interval,
  integer
) from public, anon, authenticated;

grant execute on function public.reconcile_stale_generation_credit_reservations(
  timestamptz,
  interval,
  integer
) to service_role;
