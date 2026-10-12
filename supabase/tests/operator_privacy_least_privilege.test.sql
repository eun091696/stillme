begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

select is(
  (
    select array_agg(permission::text order by permission::text)
    from public.operator_role_permissions
    where role = 'support'
  ),
  array[
    'credit.adjust.request',
    'credit.read',
    'generation.read',
    'operator.read',
    'payment.read',
    'user.read'
  ]::text[],
  'support receives only lookup and correction-request permissions'
);

select is(
  (
    select array_agg(permission::text order by permission::text)
    from public.operator_role_permissions
    where role = 'admin'
  ),
  array[
    'credit.adjust.approve',
    'credit.adjust.request',
    'credit.read',
    'generation.read',
    'notice.manage',
    'operator.read',
    'payment.read',
    'role.manage',
    'user.read'
  ]::text[],
  'admin permission set is explicit and bounded'
);

select ok(
  (
    select bool_and(relrowsecurity and relforcerowsecurity)
    from pg_class
    where oid = any (
      array[
        'public.operator_role_permissions'::regclass,
        'public.operator_role_assignments'::regclass,
        'public.operator_role_change_requests'::regclass,
        'public.operator_audit_events'::regclass,
        'public.operator_lookup_audit_events'::regclass,
        'public.operator_credit_adjustment_requests'::regclass
      ]
    )
  ),
  'all operator tables enable and force RLS'
);

select ok(
  (
    select bool_and(
      not has_table_privilege('authenticated', table_oid, 'SELECT')
    )
    from unnest(
      array[
        'public.operator_role_permissions'::regclass,
        'public.operator_role_assignments'::regclass,
        'public.operator_role_change_requests'::regclass,
        'public.operator_audit_events'::regclass,
        'public.operator_lookup_audit_events'::regclass,
        'public.operator_credit_adjustment_requests'::regclass
      ]
    ) as table_oid
  ),
  'authenticated operators cannot read raw operator tables'
);

select ok(
  (
    select bool_and(
      not has_table_privilege('authenticated', table_oid, 'INSERT')
    )
    from unnest(
      array[
        'public.operator_role_permissions'::regclass,
        'public.operator_role_assignments'::regclass,
        'public.operator_role_change_requests'::regclass,
        'public.operator_audit_events'::regclass,
        'public.operator_lookup_audit_events'::regclass,
        'public.operator_credit_adjustment_requests'::regclass
      ]
    ) as table_oid
  ),
  'authenticated operators cannot insert raw operator records'
);

select ok(
  (
    select bool_and(
      not has_table_privilege('authenticated', table_oid, 'UPDATE')
    )
    from unnest(
      array[
        'public.operator_role_permissions'::regclass,
        'public.operator_role_assignments'::regclass,
        'public.operator_role_change_requests'::regclass,
        'public.operator_audit_events'::regclass,
        'public.operator_lookup_audit_events'::regclass,
        'public.operator_credit_adjustment_requests'::regclass
      ]
    ) as table_oid
  ),
  'authenticated operators cannot update raw operator records'
);

select ok(
  (
    select bool_and(
      not has_table_privilege('authenticated', table_oid, 'DELETE')
    )
    from unnest(
      array[
        'public.operator_role_permissions'::regclass,
        'public.operator_role_assignments'::regclass,
        'public.operator_role_change_requests'::regclass,
        'public.operator_audit_events'::regclass,
        'public.operator_lookup_audit_events'::regclass,
        'public.operator_credit_adjustment_requests'::regclass
      ]
    ) as table_oid
  ),
  'authenticated operators cannot delete raw operator records'
);

select ok(
  (
    select bool_and(
      not has_function_privilege('anon', function_oid, 'EXECUTE')
    )
    from unnest(
      array[
        'public.operator_has_permission(public.operator_permission)'::regprocedure,
        'public.operator_lookup_user(uuid,uuid)'::regprocedure,
        'public.operator_lookup_credit(uuid,uuid)'::regprocedure,
        'public.operator_lookup_payments(uuid,uuid)'::regprocedure,
        'public.operator_lookup_generations(uuid,uuid)'::regprocedure,
        'public.operator_list_credit_adjustments()'::regprocedure,
        'public.request_operator_role_change(uuid,public.operator_role,public.operator_role_change_action,text,uuid)'::regprocedure,
        'public.approve_operator_role_change(uuid)'::regprocedure,
        'public.request_operator_credit_adjustment(uuid,integer,public.operator_credit_adjustment_reason,text,uuid)'::regprocedure,
        'public.approve_operator_credit_adjustment(uuid)'::regprocedure
      ]
    ) as function_oid
  ),
  'anonymous callers cannot execute operator entry points'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_operator_lookup(uuid,public.operator_lookup_domain,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'operators cannot forge lookup audit events'
);

select is(
  pg_get_function_result(
    'public.operator_lookup_user(uuid,uuid)'::regprocedure
  ),
  'TABLE(user_id uuid, display_name text, joined_at timestamp with time zone)',
  'user lookup exposes only the approved minimum fields'
);

select is(
  pg_get_function_result(
    'public.operator_lookup_credit(uuid,uuid)'::regprocedure
  ),
  'TABLE(balance bigint, reserved_credits bigint, refund_reserved_credits bigint, available_balance bigint)',
  'credit lookup exposes only ledger-derived summary fields'
);

select is(
  pg_get_function_result(
    'public.operator_lookup_payments(uuid,uuid)'::regprocedure
  ),
  'TABLE(order_id uuid, order_number text, product_code text, amount integer, credit_amount integer, currency text, status payment_order_status, paid_at timestamp with time zone, created_at timestamp with time zone)',
  'payment lookup excludes provider payment keys and payloads'
);

select is(
  pg_get_function_result(
    'public.operator_lookup_generations(uuid,uuid)'::regprocedure
  ),
  'TABLE(generation_job_id uuid, status generation_job_status, style text, aspect_ratio text, model_id text, attempt_count integer, last_error_code text, created_at timestamp with time zone, updated_at timestamp with time zone)',
  'generation lookup excludes prompts and provider error bodies'
);

select ok(
  lower(
    pg_get_function_result(
      'public.operator_list_credit_adjustments()'::regprocedure
    )
  ) not like '%email%',
  'credit adjustment queue does not expose email'
);

select ok(
  lower(
    pg_get_function_result(
      'public.operator_list_credit_adjustments()'::regprocedure
    )
  ) !~ '(prompt|payment_key|provider)',
  'credit adjustment queue excludes content and provider credentials'
);

select ok(
  (
    select bool_and(
      procedure.prosecdef
      and procedure.proconfig is not null
      and 'search_path=""' = any (procedure.proconfig)
    )
    from pg_proc as procedure
    where procedure.pronamespace = 'public'::regnamespace
      and (
        procedure.proname like 'operator_%'
        or procedure.proname like '%operator_%'
      )
  ),
  'operator security-definer functions pin an empty search path'
);

select * from finish();

rollback;
