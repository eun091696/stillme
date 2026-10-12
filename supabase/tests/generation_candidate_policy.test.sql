begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '81000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'candidate-owner@example.test', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Candidate Owner"}'::jsonb, now(), now()
);

insert into public.generation_jobs (
  id, user_id, idempotency_key, prompt, style, aspect_ratio, status,
  model_id, provider_model, adapter_version, prompt_template_version,
  generated_image_count, completed_at
)
values (
  '82000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  'id-photo.resume-id', 'photographic', '1:1', 'succeeded',
  'google-gemini-image-v1', 'gemini-3.1-flash-image', '1', 'style-v1',
  3, now()
);

select is(
  public.claim_free_regeneration(
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001'
  ),
  2,
  'an owned completed production can claim exactly two free candidates'
);

select throws_ok(
  $$
    select public.claim_free_regeneration(
      '82000000-0000-4000-8000-000000000001',
      '81000000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'free regeneration is unavailable',
  'the same production cannot claim free candidates twice'
);

select is(
  public.release_free_regeneration_claim(
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001'
  ),
  '82000000-0000-4000-8000-000000000001'::uuid,
  'a failed free batch can release its server claim'
);

select is(
  public.claim_free_regeneration(
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001'
  ),
  2,
  'a released failed batch can be retried once'
);

select throws_ok(
  $$
    update public.generation_jobs
    set generated_image_count = 6
    where id = '82000000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  'generation job status must transition',
  'the database rejects more than five generated candidates'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select throws_ok(
  $$
    select public.claim_free_regeneration(
      '82000000-0000-4000-8000-000000000001',
      '81000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  'permission denied for function claim_free_regeneration',
  'the client cannot call the free regeneration claim RPC'
);

select * from finish();
rollback;
