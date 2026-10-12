alter table public.generation_jobs
  add column initial_image_count integer not null default 3,
  add column free_regeneration_image_limit integer not null default 2,
  add column generated_image_count integer not null default 0,
  add column free_regeneration_used integer not null default 0,
  add constraint generation_jobs_candidate_policy_fixed
    check (initial_image_count = 3 and free_regeneration_image_limit = 2),
  add constraint generation_jobs_candidate_counts_valid
    check (
      generated_image_count between 0 and 5
      and free_regeneration_used between 0 and 2
      and generated_image_count <= initial_image_count + free_regeneration_used
    );

alter table public.assets
  drop constraint if exists assets_one_original_per_job;

create or replace function public.guard_generation_job_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
    new.id,
    new.user_id,
    new.idempotency_key,
    new.prompt,
    new.style,
    new.aspect_ratio,
    new.model_id,
    new.provider_model,
    new.adapter_version,
    new.prompt_template_version,
    new.prompt_id,
    new.prompt_version,
    new.prompt_modules,
    new.model_key,
    new.resolution,
    new.source_image_key,
    new.max_attempts,
    new.initial_image_count,
    new.free_regeneration_image_limit,
    new.created_at
  ) is distinct from (
    old.id,
    old.user_id,
    old.idempotency_key,
    old.prompt,
    old.style,
    old.aspect_ratio,
    old.model_id,
    old.provider_model,
    old.adapter_version,
    old.prompt_template_version,
    old.prompt_id,
    old.prompt_version,
    old.prompt_modules,
    old.model_key,
    old.resolution,
    old.source_image_key,
    old.max_attempts,
    old.initial_image_count,
    old.free_regeneration_image_limit,
    old.created_at
  ) then
    raise exception 'generation job immutable fields cannot change';
  end if;

  if new.status = old.status then
    if (
      old.status in ('processing', 'succeeded')
      and new.generated_image_count between old.generated_image_count and 5
      and (
        new.free_regeneration_used between old.free_regeneration_used and 2
        or (
          old.generated_image_count = old.initial_image_count
          and new.generated_image_count = old.generated_image_count
          and old.free_regeneration_used = old.free_regeneration_image_limit
          and new.free_regeneration_used = 0
        )
      )
      and new.generated_image_count <= new.initial_image_count + new.free_regeneration_used
      and (
        new.attempt_count,
        new.max_attempts,
        new.retryable,
        new.next_attempt_at,
        new.last_error_code,
        new.started_at,
        new.completed_at
      ) is not distinct from (
        old.attempt_count,
        old.max_attempts,
        old.retryable,
        old.next_attempt_at,
        old.last_error_code,
        old.started_at,
        old.completed_at
      )
    ) then
      new.updated_at := now();
      return new;
    end if;
    raise exception 'generation job status must transition';
  end if;

  if old.status = 'queued' and new.status = 'processing' then
    if old.attempt_count >= old.max_attempts then
      raise exception 'generation job retry attempts exhausted';
    end if;
    new.attempt_count := old.attempt_count + 1;
    new.retryable := false;
    new.next_attempt_at := null;
    new.last_error_code := null;
    new.started_at := now();
    new.completed_at := null;
  elsif old.status = 'processing' and new.status = 'succeeded' then
    new.attempt_count := old.attempt_count;
    new.retryable := false;
    new.next_attempt_at := null;
    new.last_error_code := null;
    new.completed_at := now();
  elsif old.status = 'processing' and new.status = 'failed' then
    if new.last_error_code is null then
      raise exception 'generation job failure requires an error code';
    end if;
    new.attempt_count := old.attempt_count;
    if new.retryable and old.attempt_count >= old.max_attempts then
      raise exception 'generation job retry attempts exhausted';
    end if;
    if new.retryable and new.next_attempt_at is null then
      raise exception 'retryable generation job requires next attempt time';
    end if;
    if not new.retryable then
      new.next_attempt_at := null;
      new.completed_at := now();
    else
      new.completed_at := null;
    end if;
  elsif old.status = 'failed' and new.status = 'queued' then
    if not old.retryable or old.attempt_count >= old.max_attempts then
      raise exception 'generation job is not retryable';
    end if;
    new.attempt_count := old.attempt_count;
    new.retryable := false;
    new.next_attempt_at := null;
    new.last_error_code := null;
    new.started_at := old.started_at;
    new.completed_at := null;
  elsif old.status in ('queued', 'failed') and new.status = 'cancelled' then
    new.attempt_count := old.attempt_count;
    new.retryable := false;
    new.next_attempt_at := null;
    new.last_error_code := null;
    new.completed_at := now();
  else
    raise exception 'invalid generation job state transition';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create function public.claim_free_regeneration(
  target_generation_job_id uuid,
  target_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_count integer;
begin
  update public.generation_jobs
  set free_regeneration_used = free_regeneration_image_limit
  where id = target_generation_job_id
    and user_id = target_user_id
    and status = 'succeeded'
    and generated_image_count = initial_image_count
    and free_regeneration_used = 0
  returning free_regeneration_image_limit into claimed_count;

  if claimed_count is null then
    raise exception 'free regeneration is unavailable';
  end if;
  return claimed_count;
end;
$$;

revoke all on function public.claim_free_regeneration(uuid, uuid) from public;
grant execute on function public.claim_free_regeneration(uuid, uuid)
  to service_role;

create function public.release_free_regeneration_claim(
  target_generation_job_id uuid,
  target_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  released_job_id uuid;
begin
  update public.generation_jobs
  set free_regeneration_used = 0
  where id = target_generation_job_id
    and user_id = target_user_id
    and status = 'succeeded'
    and generated_image_count = initial_image_count
    and free_regeneration_used = free_regeneration_image_limit
  returning id into released_job_id;

  if released_job_id is null then
    raise exception 'free regeneration claim cannot be released';
  end if;
  return released_job_id;
end;
$$;

create function public.complete_generation_candidate_batch(
  target_generation_job_id uuid,
  target_user_id uuid,
  target_reservation_id uuid,
  target_asset_ids uuid[],
  target_generated_image_count integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_asset_count integer;
  published_asset_count integer;
begin
  expected_asset_count := coalesce(array_length(target_asset_ids, 1), 0);
  if expected_asset_count not in (2, 3)
    or target_generated_image_count not in (3, 5)
  then
    raise exception 'candidate batch size is invalid';
  end if;

  perform 1
  from public.generation_jobs
  where id = target_generation_job_id
    and user_id = target_user_id
    and (
      (
        target_reservation_id is not null
        and status = 'processing'
        and generated_image_count = 0
        and free_regeneration_used = 0
        and expected_asset_count = 3
        and target_generated_image_count = 3
      )
      or (
        target_reservation_id is null
        and status = 'succeeded'
        and generated_image_count = 3
        and free_regeneration_used = 2
        and expected_asset_count = 2
        and target_generated_image_count = 5
      )
    )
  for update;

  if not found then
    raise exception 'generation candidate batch cannot be completed';
  end if;

  update public.assets
  set status = 'available'
  where generation_job_id = target_generation_job_id
    and user_id = target_user_id
    and id = any(target_asset_ids)
    and status = 'validating';
  get diagnostics published_asset_count = row_count;

  if published_asset_count <> expected_asset_count then
    raise exception 'candidate assets are incomplete';
  end if;

  update public.generation_jobs
  set generated_image_count = target_generated_image_count
  where id = target_generation_job_id;

  if target_reservation_id is not null then
    perform public.complete_generation_request(
      target_generation_job_id,
      target_reservation_id
    );
  end if;

  return target_generation_job_id;
end;
$$;

revoke all on function public.release_free_regeneration_claim(uuid, uuid)
  from public;
revoke all on function public.complete_generation_candidate_batch(
  uuid, uuid, uuid, uuid[], integer
) from public;
grant execute on function public.release_free_regeneration_claim(uuid, uuid)
  to service_role;
grant execute on function public.complete_generation_candidate_batch(
  uuid, uuid, uuid, uuid[], integer
) to service_role;
