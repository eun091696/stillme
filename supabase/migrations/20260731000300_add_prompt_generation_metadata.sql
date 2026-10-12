alter table public.generation_jobs
  add column prompt_id text,
  add column prompt_version text,
  add column prompt_modules jsonb not null default '[]'::jsonb,
  add column model_key text,
  add column resolution text,
  add column source_image_key text,
  add column result_image_key text,
  add column generation_time_ms integer,
  add column provider_error_code text,
  add column error_message text,
  add column actual_width integer,
  add column actual_height integer;

alter table public.generation_jobs
  add constraint generation_jobs_prompt_id_safe
    check (prompt_id is null or prompt_id ~ '^[a-z0-9.-]{1,120}$'),
  add constraint generation_jobs_prompt_version_safe
    check (prompt_version is null or prompt_version ~ '^[A-Za-z0-9._-]{1,40}$'),
  add constraint generation_jobs_prompt_modules_array
    check (jsonb_typeof(prompt_modules) = 'array'),
  add constraint generation_jobs_model_key_supported
    check (model_key is null or model_key in ('flash', 'pro')),
  add constraint generation_jobs_resolution_supported
    check (resolution is null or resolution in ('1K', '2K', '4K')),
  add constraint generation_jobs_generation_time_valid
    check (generation_time_ms is null or generation_time_ms between 0 and 86_400_000),
  add constraint generation_jobs_dimensions_valid
    check (
      (actual_width is null and actual_height is null)
      or (actual_width between 1 and 32_768 and actual_height between 1 and 32_768)
    );

comment on column public.generation_jobs.prompt is
  'Legacy bounded request marker. Full generated prompt text is not persisted.';
comment on column public.generation_jobs.prompt_modules is
  'Prompt module ids only; never stores the full prompt text.';
