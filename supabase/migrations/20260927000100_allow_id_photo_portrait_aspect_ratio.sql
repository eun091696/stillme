-- ID photos are delivered as 3:4 portrait images (e.g. 3x4cm resume photos).
-- Additive only: existing 1:1, 4:5 and 16:9 rows remain valid.
alter table public.generation_jobs
  drop constraint generation_jobs_aspect_ratio_supported;

alter table public.generation_jobs
  add constraint generation_jobs_aspect_ratio_supported
    check (aspect_ratio in ('1:1', '3:4', '4:5', '16:9'));
