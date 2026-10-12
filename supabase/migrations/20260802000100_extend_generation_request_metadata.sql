create or replace function public.create_generation_request(
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

revoke all on function public.create_generation_request(
  uuid, uuid, text, text, text, text, text, text, text, integer, text,
  text, text, jsonb, text, text, text
) from public;

grant execute on function public.create_generation_request(
  uuid, uuid, text, text, text, text, text, text, text, integer, text,
  text, text, jsonb, text, text, text
) to service_role;
