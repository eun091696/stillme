create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length
    check (char_length(display_name) between 1 and 80),
  constraint profiles_display_name_trimmed
    check (display_name = btrim(display_name))
);

comment on table public.profiles is
  'User-owned public profile data. Authentication credentials remain in auth.users.';

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select, update (display_name) on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create function public.set_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_profile_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_display_name text;
begin
  requested_display_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));

  if char_length(requested_display_name) not between 1 and 80 then
    raise exception 'A valid display name is required';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, requested_display_name);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.set_profile_updated_at() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
