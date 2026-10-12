create function public.create_generation_request(
  request_user_id uuid,
  request_idempotency_key uuid,
  request_prompt text,
  request_style text,
  request_aspect_ratio text,
  request_model_id text,
  request_provider_model text,
  request_adapter_version text,
  request_prompt_template_version text,
  request_credit_amount integer,
  request_credit_policy_version text,
  request_prompt_id text,
  request_prompt_version text,
  request_prompt_modules jsonb,
  request_model_key text,
  request_resolution text,
  request_source_image_key text
)
returns table (generation_job_id uuid, reservation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_job_id uuid;
  created_reservation_id uuid;
begin
  insert into public.generation_jobs (
    user_id,
    idempotency_key,
    prompt,
    style,
    aspect_ratio,
    model_id,
    provider_model,
    adapter_version,
    prompt_template_version,
    prompt_id,
    prompt_version,
    prompt_modules,
    model_key,
    resolution,
    source_image_key
  )
  values (
    request_user_id,
    request_idempotency_key,
    request_prompt,
    request_style,
    request_aspect_ratio,
    request_model_id,
    request_provider_model,
    request_adapter_version,
    request_prompt_template_version,
    request_prompt_id,
    request_prompt_version,
    request_prompt_modules,
    request_model_key,
    request_resolution,
    request_source_image_key
  )
  returning id into created_job_id;

  created_reservation_id := public.reserve_generation_credits(
    created_job_id,
    request_credit_amount,
    request_idempotency_key,
    request_credit_policy_version
  );

  return query select created_job_id, created_reservation_id;
end;
$$;

create function public.start_generation_request(
  target_generation_job_id uuid,
  target_reservation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  started_job_id uuid;
begin
  perform 1
  from public.credit_reservations
  where id = target_reservation_id
    and generation_job_id = target_generation_job_id
    and status = 'reserved';

  if not found then
    raise exception 'generation credit reservation is not active';
  end if;

  update public.generation_jobs
  set status = 'processing'
  where id = target_generation_job_id
    and status = 'queued'
  returning id into started_job_id;

  if started_job_id is null then
    raise exception 'generation request is not queued';
  end if;

  return started_job_id;
end;
$$;

create function public.complete_generation_request(
  target_generation_job_id uuid,
  target_reservation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  completed_job_id uuid;
begin
  perform 1
  from public.credit_reservations
  where id = target_reservation_id
    and generation_job_id = target_generation_job_id
    and status in ('reserved', 'settled');

  if not found then
    raise exception 'generation credit reservation does not match';
  end if;

  update public.generation_jobs
  set status = 'succeeded'
  where id = target_generation_job_id
    and status = 'processing'
  returning id into completed_job_id;

  if completed_job_id is null then
    if exists (
      select 1
      from public.generation_jobs
      where id = target_generation_job_id
        and status = 'succeeded'
    ) then
      return public.settle_generation_credits(target_reservation_id);
    end if;
    raise exception 'generation request is not processing';
  end if;

  return public.settle_generation_credits(target_reservation_id);
end;
$$;

create function public.fail_generation_request(
  target_generation_job_id uuid,
  target_reservation_id uuid,
  failure_reason_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  failed_job_id uuid;
begin
  if (
    failure_reason_code is null
    or failure_reason_code !~ '^[A-Z0-9_]{1,64}$'
  ) then
    raise exception 'generation failure reason is invalid';
  end if;

  perform 1
  from public.credit_reservations
  where id = target_reservation_id
    and generation_job_id = target_generation_job_id
    and status in ('reserved', 'released');

  if not found then
    raise exception 'generation credit reservation does not match';
  end if;

  update public.generation_jobs
  set
    status = 'failed',
    retryable = false,
    next_attempt_at = null,
    last_error_code = failure_reason_code
  where id = target_generation_job_id
    and status = 'processing'
  returning id into failed_job_id;

  if failed_job_id is null and not exists (
    select 1
    from public.generation_jobs
    where id = target_generation_job_id
      and status = 'failed'
      and retryable = false
      and last_error_code = failure_reason_code
  ) then
    raise exception 'generation request is not processing';
  end if;

  return public.release_generation_credits(
    target_reservation_id,
    failure_reason_code
  );
end;
$$;

create function public.cancel_generation_request(
  target_generation_job_id uuid,
  target_reservation_id uuid,
  cancellation_reason_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cancelled_job_id uuid;
begin
  if (
    cancellation_reason_code is null
    or cancellation_reason_code !~ '^[A-Z0-9_]{1,64}$'
  ) then
    raise exception 'generation cancellation reason is invalid';
  end if;

  update public.generation_jobs
  set status = 'cancelled'
  where id = target_generation_job_id
    and status = 'queued'
  returning id into cancelled_job_id;

  if cancelled_job_id is null and not exists (
    select 1
    from public.generation_jobs
    where id = target_generation_job_id
      and status = 'cancelled'
  ) then
    raise exception 'generation request is not queued';
  end if;

  return public.release_generation_credits(
    target_reservation_id,
    cancellation_reason_code
  );
end;
$$;

revoke all on function public.create_generation_request(
  uuid, uuid, text, text, text, text, text, text, text, integer, text,
  text, text, jsonb, text, text, text
) from public;
revoke all on function public.start_generation_request(uuid, uuid) from public;
revoke all on function public.complete_generation_request(uuid, uuid) from public;
revoke all on function public.fail_generation_request(uuid, uuid, text) from public;
revoke all on function public.cancel_generation_request(uuid, uuid, text) from public;

grant execute on function public.create_generation_request(
  uuid, uuid, text, text, text, text, text, text, text, integer, text,
  text, text, jsonb, text, text, text
) to service_role;
grant execute on function public.start_generation_request(uuid, uuid)
  to service_role;
grant execute on function public.complete_generation_request(uuid, uuid)
  to service_role;
grant execute on function public.fail_generation_request(uuid, uuid, text)
  to service_role;
grant execute on function public.cancel_generation_request(uuid, uuid, text)
  to service_role;
