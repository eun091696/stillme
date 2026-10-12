create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_display_name text;
begin
  requested_display_name := btrim(coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'nickname', ''),
    nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'STILLME 사용자'
  ));

  if char_length(requested_display_name) > 80 then
    requested_display_name := left(requested_display_name, 80);
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, requested_display_name);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
