update public.credit_products
set active = false
where active
  and code in ('STARTER-20', 'CREATOR-60', 'STUDIO-150');

insert into public.credit_products (
  code,
  version,
  display_name,
  amount,
  credit_amount
)
values
  ('STARTER-3', 'commercial-v2', 'Starter', 4900, 3),
  ('STANDARD-7', 'commercial-v2', 'Standard', 9900, 7),
  ('PRO-16', 'commercial-v2', 'Pro', 19900, 16)
on conflict (code) do nothing;
