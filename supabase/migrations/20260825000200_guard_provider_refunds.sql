create function public.guard_supported_payment_refund_provider()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.payments
    where id = new.payment_id
      and provider = 'toss'
  ) then
    raise exception 'payment provider refund is unsupported';
  end if;
  return new;
end;
$$;

create trigger payment_refunds_guard_provider
  before insert on public.payment_refunds
  for each row execute procedure public.guard_supported_payment_refund_provider();

revoke all on function public.guard_supported_payment_refund_provider()
  from public;
