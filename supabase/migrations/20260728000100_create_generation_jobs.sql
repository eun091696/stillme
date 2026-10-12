create type public.generation_job_status as enum (
  'queued',
  'processing',
  'succeeded',
  'failed',
  'cancelled'
);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  idempotency_key uuid not null,
  prompt text not null,
  style text not null,
  aspect_ratio text not null,
  model_id text not null,
  provider_model text not null,
  adapter_version text not null,
  prompt_template_version text not null,
  status public.generation_job_status not null default 'queued',
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  retryable boolean not null default false,
  next_attempt_at timestamptz,
  last_error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generation_jobs_idempotency_unique
    unique (user_id, idempotency_key),
  constraint generation_jobs_prompt_length
    check (char_length(prompt) between 3 and 1000),
  constraint generation_jobs_prompt_trimmed
    check (prompt = btrim(prompt)),
  constraint generation_jobs_style_supported
    check (style in ('photographic', 'portrait', 'product', 'illustration')),
  constraint generation_jobs_aspect_ratio_supported
    check (aspect_ratio in ('1:1', '4:5', '16:9')),
  constraint generation_jobs_model_id_format
    check (model_id ~ '^[a-z0-9-]{1,80}$'),
  constraint generation_jobs_provider_model_format
    check (provider_model ~ '^[a-z0-9.-]{1,100}$'),
  constraint generation_jobs_version_format
    check (
      adapter_version ~ '^[A-Za-z0-9._-]{1,40}$'
      and prompt_template_version ~ '^[A-Za-z0-9._-]{1,40}$'
    ),
  constraint generation_jobs_attempts_valid
    check (
      max_attempts between 1 and 5
      and attempt_count between 0 and max_attempts
    ),
  constraint generation_jobs_error_code_safe
    check (
      last_error_code is null
      or last_error_code ~ '^[A-Z0-9_]{1,64}$'
    )
);

comment on table public.generation_jobs is
  'User-owned image generation commands with durable state and bounded retry metadata.';

create index generation_jobs_user_created_idx
  on public.generation_jobs (user_id, created_at desc, id desc);

create index generation_jobs_retry_due_idx
  on public.generation_jobs (next_attempt_at, id)
  where status = 'failed' and retryable = true;

alter table public.generation_jobs enable row level security;
alter table public.generation_jobs force row level security;

revoke all on table public.generation_jobs from anon;
revoke all on table public.generation_jobs from authenticated;
grant select on table public.generation_jobs to authenticated;
grant all on table public.generation_jobs to service_role;

create policy "generation_jobs_select_own"
  on public.generation_jobs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create function public.guard_generation_job_transition()
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
    new.max_attempts,
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
    old.max_attempts,
    old.created_at
  ) then
    raise exception 'generation job immutable fields cannot change';
  end if;

  if new.status = old.status then
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
  elsif (
    old.status in ('queued', 'failed')
    and new.status = 'cancelled'
  ) then
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

revoke all on function public.guard_generation_job_transition() from public;

create trigger generation_jobs_guard_transition
  before update on public.generation_jobs
  for each row execute procedure public.guard_generation_job_transition();
