begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select no_plan();

select has_function(
  'public',
  'ensure_session',
  array['uuid', 'text', 'text', 'text', 'text', 'text'],
  'the ownership-safe session ensure RPC exists'
);

select has_function(
  'public',
  'ensure_feed_instance',
  array['uuid'],
  'the ownership-safe feed ensure RPC exists'
);

select has_function(
  'public',
  'append_feed_batch',
  array['uuid', 'text', 'integer'],
  'the deterministic feed append RPC exists'
);

select has_function(
  'public',
  'record_qualified_feed_position',
  array['uuid', 'uuid', 'uuid', 'integer'],
  'the qualified feed-depth RPC exists'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'ensure_session',
        'ensure_feed_instance',
        'append_feed_batch',
        'record_qualified_feed_position'
      )
      and pg_proc.prosecdef
      and pg_proc.provolatile = 'v'
      and 'search_path=""' = any(pg_proc.proconfig)
      and pg_get_userbyid(pg_proc.proowner) = 'postgres'
  ),
  4::bigint,
  'all four P11A RPCs are volatile security-definer functions with postgres ownership and an empty search path'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and (
        (
          pg_proc.proname in (
            'current_app_environment',
            'feed_batch_response'
          )
          and pg_proc.provolatile = 's'
        )
        or (
          pg_proc.proname = 'feed_cursor_token'
          and pg_proc.provolatile = 'i'
        )
      )
      and not pg_proc.prosecdef
      and 'search_path=""' = any(pg_proc.proconfig)
      and pg_get_userbyid(pg_proc.proowner) = 'postgres'
  ),
  3::bigint,
  'P11A private helpers have the correct volatility, invoker security, owner, and search path'
);

select is(
  (
    with expected(signature) as (
      values
        ('public.ensure_session(uuid,text,text,text,text,text)'),
        ('public.ensure_feed_instance(uuid)'),
        ('public.append_feed_batch(uuid,text,integer)'),
        (
          'public.record_qualified_feed_position(uuid,uuid,uuid,integer)'
        )
    )
    select count(*)
    from expected
    join pg_catalog.pg_proc
      on pg_proc.oid = to_regprocedure(expected.signature)
    where has_function_privilege(
        'authenticated',
        pg_proc.oid,
        'EXECUTE'
      )
      and not has_function_privilege('anon', pg_proc.oid, 'EXECUTE')
      and not exists (
        select 1
        from pg_catalog.aclexplode(
          coalesce(
            pg_proc.proacl,
            pg_catalog.acldefault('f', pg_proc.proowner)
          )
        ) as function_acl
        where function_acl.grantee = 0
          and function_acl.privilege_type = 'EXECUTE'
      )
  ),
  4::bigint,
  'only authenticated clients can execute each intended P11A RPC signature'
);

select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE')
  and not has_schema_privilege('anon', 'private', 'USAGE')
  and not has_table_privilege(
    'authenticated',
    'private.feed_batch_requests',
    'SELECT'
  ),
  'the private feed replay ledger and helpers remain inaccessible to clients'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname in ('public', 'private')
      and pg_proc.proname in (
        'current_app_environment',
        'feed_cursor_token',
        'feed_batch_response',
        'ensure_session',
        'ensure_feed_instance',
        'append_feed_batch',
        'record_qualified_feed_position'
      )
      and lower(pg_proc.prosrc) ~ '(^|[^a-z])execute([^a-z]|$)'
  ),
  'P11A functions contain no dynamic SQL'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'ensure_session',
        'ensure_feed_instance',
        'append_feed_batch',
        'record_qualified_feed_position'
      )
      and pg_proc.proargnames
        && array[
          'anonymous_user_id',
          'user_id',
          'wardrobe_id',
          'environment',
          'is_test'
        ]::text[]
  ),
  'P11A RPC signatures expose no ownership or trusted environment fields'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'ensure_session',
        'ensure_feed_instance',
        'append_feed_batch',
        'record_qualified_feed_position'
      )
  ),
  4::bigint,
  'each public P11A RPC name has exactly one unambiguous signature'
);

select has_table(
  'private',
  'feed_batch_requests',
  'the private deterministic replay ledger exists'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where pg_constraint.conrelid =
        'public.feed_instances'::regclass
      and pg_constraint.conname =
        'feed_instances_session_order_version_key'
      and pg_constraint.contype = 'u'
  ),
  'one logical feed exists for each session and order version'
);

insert into auth.users (id, is_anonymous)
values
  ('91000000-0000-4000-8000-000000000001', true),
  ('91000000-0000-4000-8000-000000000002', true);

insert into public.anonymous_users (
  id,
  auth_user_id,
  is_test
)
values
  (
    '91100000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    false
  ),
  (
    '91100000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000002',
    true
  );

insert into public.onboarding_states (
  anonymous_user_id,
  status,
  onboarding_version,
  preference_set_version,
  preference_ids,
  completion_operation_id,
  skip_operation_id,
  started_at,
  completed_at,
  state_revision
)
values
  (
    '91100000-0000-4000-8000-000000000001',
    'completed_with_preferences',
    'onboarding-style-v1',
    'onboarding-style-v1',
    array['street', 'minimal'],
    '91200000-0000-4000-8000-000000000001',
    null,
    '2026-07-24 08:00:00+00',
    '2026-07-24 08:01:00+00',
    1
  ),
  (
    '91100000-0000-4000-8000-000000000002',
    'skipped',
    'onboarding-style-v1',
    null,
    '{}'::text[],
    null,
    '91200000-0000-4000-8000-000000000002',
    '2026-07-24 08:00:00+00',
    '2026-07-24 08:01:00+00',
    1
  );

insert into public.products (
  id,
  external_source,
  external_id,
  name,
  brand,
  category,
  catalog_version,
  is_active
)
select
  (
    'd1100000-0000-4000-8000-'
      || lpad(product_number::text, 12, '0')
  )::uuid,
  'p11a-test',
  'active-' || product_number::text,
  'P11A Product ' || product_number::text,
  'P11A',
  case
    when product_number % 2 = 0 then 'top'
    else 'bottom'
  end,
  'p11a-catalog-v1',
  true
from generate_series(1, 12) as product_number;

insert into public.products (
  id,
  external_source,
  external_id,
  name,
  brand,
  category,
  catalog_version,
  is_active
)
values (
  'd1100000-0000-4000-8000-000000000999',
  'p11a-test',
  'inactive',
  'P11A Inactive Product',
  'P11A',
  'top',
  'p11a-catalog-v1',
  false
);

select throws_ok(
  $$
    select public.ensure_session(
      '91300000-0000-4000-8000-000000000099',
      'p11a-test',
      'web_mobile',
      '/discover',
      null,
      null
    )
  $$,
  '28000',
  'anonymous authentication required',
  'ensure_session rejects an unauthenticated call'
);

select throws_ok(
  $$
    select public.ensure_feed_instance(
      '91300000-0000-4000-8000-000000000099'
    )
  $$,
  '28000',
  'anonymous authentication required',
  'ensure_feed_instance rejects an unauthenticated call'
);

select throws_ok(
  $$
    select public.append_feed_batch(
      '91400000-0000-4000-8000-000000000099',
      null,
      5
    )
  $$,
  '28000',
  'anonymous authentication required',
  'append_feed_batch rejects an unauthenticated call'
);

select throws_ok(
  $$
    select public.record_qualified_feed_position(
      '91300000-0000-4000-8000-000000000099',
      '91400000-0000-4000-8000-000000000099',
      'd1100000-0000-4000-8000-000000000001',
      1
    )
  $$,
  '28000',
  'anonymous authentication required',
  'record_qualified_feed_position rejects an unauthenticated call'
);

set local role authenticated;
set local "request.jwt.claim.sub" =
  '91000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" =
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$
    select public.ensure_session(
      '91300000-0000-4000-8000-000000000001',
      'p11a-test',
      'web_mobile',
      '/discover',
      'p11a',
      'cohort-a'
    )
  $$,
  'user A creates an owned analytics session'
);

select is(
  (
    public.ensure_session(
      '91300000-0000-4000-8000-000000000001',
      'p11a-test',
      'web_mobile',
      '/discover',
      'p11a',
      'cohort-a'
    ) ->> 'session_id'
  )::uuid,
  '91300000-0000-4000-8000-000000000001'::uuid,
  'repeated ensure_session recovers the same logical session'
);

select is(
  (
    public.ensure_session(
      '91300000-0000-4000-8000-000000000011',
      'p11a-test',
      'web_mobile',
      '/discover',
      'p11a',
      'cohort-a'
    ) ->> 'session_id'
  )::uuid,
  '91300000-0000-4000-8000-000000000001'::uuid,
  'a concurrent-like second session claim inside thirty minutes converges on the active session'
);

reset role;

select is(
  (
    select count(*)
    from public.sessions
    where sessions.anonymous_user_id =
      '91100000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'session convergence creates no duplicate session number'
);

select ok(
  (
    select sessions.session_number = 1
      and not sessions.is_return_session
      and sessions.environment = 'local'
      and not sessions.is_test
      and sessions.entry_route = '/discover'
      and sessions.traffic_source = 'p11a'
      and sessions.cohort_id = 'cohort-a'
    from public.sessions
    where sessions.id =
      '91300000-0000-4000-8000-000000000001'
  ),
  'the first session derives canonical identity, environment, test classification, and session number'
);

set local role authenticated;
set local "request.jwt.claim.sub" =
  '91000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" =
  '{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok(
  $$
    select public.ensure_session(
      '91300000-0000-4000-8000-000000000002',
      'p11a-test',
      'web_mobile',
      '/discover',
      null,
      null
    )
  $$,
  'user B creates a separate owned session'
);

reset role;

select is(
  (
    select count(distinct sessions.anonymous_user_id)
    from public.sessions
    where sessions.id in (
      '91300000-0000-4000-8000-000000000001',
      '91300000-0000-4000-8000-000000000002'
    )
  ),
  2::bigint,
  'user A and user B sessions resolve to separate owners'
);

select ok(
  (
    select sessions.is_test
    from public.sessions
    where sessions.id =
      '91300000-0000-4000-8000-000000000002'
  ),
  'session test classification is derived from the canonical identity'
);

update public.sessions
set
  started_at = statement_timestamp() - interval '2 hours',
  last_activity_at = statement_timestamp() - interval '31 minutes'
where sessions.id =
  '91300000-0000-4000-8000-000000000001';

set local role authenticated;
set local "request.jwt.claim.sub" =
  '91000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" =
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}';

select ok(
  (
    select
      (session_result ->> 'session_id')::uuid =
        '91300000-0000-4000-8000-000000000003'::uuid
      and (session_result ->> 'session_number')::integer = 2
      and (session_result ->> 'is_return_session')::boolean
    from (
      select public.ensure_session(
        '91300000-0000-4000-8000-000000000003',
        'p11a-test',
        'web_mobile',
        '/discover',
        'p11a',
        'cohort-a'
      ) as session_result
    ) as ensured
  ),
  'a session after the thirty-minute boundary receives the next number and return classification'
);

select lives_ok(
  $$
    select public.ensure_feed_instance(
      '91300000-0000-4000-8000-000000000003'
    )
  $$,
  'user A creates a feed for the current owned session'
);

select is(
  (
    select public.ensure_feed_instance(
      '91300000-0000-4000-8000-000000000003'
    ) ->> 'feed_instance_id'
  ),
  (
    select public.ensure_feed_instance(
      '91300000-0000-4000-8000-000000000003'
    ) ->> 'feed_instance_id'
  ),
  'repeated and concurrent-like feed ensure calls converge on one feed instance'
);

select is(
  public.ensure_feed_instance(
    '91300000-0000-4000-8000-000000000003'
  ) -> 'preference_ids',
  '["minimal", "street"]'::jsonb,
  'feed preference IDs are persisted in deterministic canonical order'
);

select throws_ok(
  $$
    select public.ensure_feed_instance(
      '91300000-0000-4000-8000-000000000002'
    )
  $$,
  '42501',
  'owned session not found',
  'user A cannot create or recover a feed for user B session'
);

reset role;

select is(
  (
    select count(*)
    from public.feed_instances
    where feed_instances.session_id =
      '91300000-0000-4000-8000-000000000003'
  ),
  1::bigint,
  'the feed uniqueness constraint prevents duplicate logical feeds'
);

set local role authenticated;
set local "request.jwt.claim.sub" =
  '91000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" =
  '{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok(
  $$
    select public.ensure_feed_instance(
      '91300000-0000-4000-8000-000000000002'
    )
  $$,
  'user B creates a separate owned feed'
);

select lives_ok(
  $$
    select public.append_feed_batch(
      (
        select feed_instances.id
        from public.feed_instances
        where feed_instances.session_id =
          '91300000-0000-4000-8000-000000000002'
      ),
      null,
      5
    )
  $$,
  'user B appends an independent first feed batch'
);

reset role;

create temporary table p11a_state (
  state_key text primary key,
  state_value text not null
) on commit drop;

insert into p11a_state (state_key, state_value)
select 'feed_a', feed_instances.id::text
from public.feed_instances
where feed_instances.session_id =
  '91300000-0000-4000-8000-000000000003'
union all
select 'feed_b', feed_instances.id::text
from public.feed_instances
where feed_instances.session_id =
  '91300000-0000-4000-8000-000000000002'
union all
select 'cursor_b', feed_instances.last_cursor
from public.feed_instances
where feed_instances.session_id =
  '91300000-0000-4000-8000-000000000002';

grant select on table p11a_state to authenticated;

set local role authenticated;
set local "request.jwt.claim.sub" =
  '91000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" =
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  (select count(*) from public.feed_instances),
  1::bigint,
  'user A can read only their own feed instance'
);

select throws_ok(
  $$
    select public.append_feed_batch(
      (
        select state_value::uuid
        from pg_temp.p11a_state
        where state_key = 'feed_b'
      ),
      null,
      5
    )
  $$,
  '42501',
  'owned feed instance not found',
  'user A cannot append user B feed'
);

select throws_ok(
  $$
    select public.append_feed_batch(
      (
        select state_value::uuid
        from pg_temp.p11a_state
        where state_key = 'feed_a'
      ),
      null,
      25
    )
  $$,
  '22023',
  'feed batch limit must be between 1 and 24',
  'the LR-001 feed batch maximum is enforced'
);

select lives_ok(
  $$
    select public.append_feed_batch(
      (
        select state_value::uuid
        from pg_temp.p11a_state
        where state_key = 'feed_a'
      ),
      null,
      5
    )
  $$,
  'user A appends the deterministic first batch'
);

select ok(
  (
    select
      (batch_result ->> 'batch_number')::integer = 1
      and (batch_result ->> 'returned_count')::integer = 5
      and jsonb_array_length(batch_result -> 'products') = 5
    from (
      select public.append_feed_batch(
        (
          select state_value::uuid
          from pg_temp.p11a_state
          where state_key = 'feed_a'
        ),
        null,
        5
      ) as batch_result
    ) as replayed
  ),
  'the first batch returns five products and database-owned batch number one'
);

select is(
  (
    select array_agg(
      (product ->> 'position')::integer
      order by (product ->> 'position')::integer
    )
    from jsonb_array_elements(
      public.append_feed_batch(
        (
          select state_value::uuid
          from pg_temp.p11a_state
          where state_key = 'feed_a'
        ),
        null,
        5
      ) -> 'products'
    ) as product
  ),
  array[1, 2, 3, 4, 5],
  'first-batch absolute positions are contiguous and one-based'
);

select is(
  (
    select array_agg(
      feed_instance_products.product_id
      order by feed_instance_products.position
    )
    from public.feed_instance_products
    where feed_instance_products.feed_instance_id = (
      select state_value::uuid
      from pg_temp.p11a_state
      where state_key = 'feed_a'
    )
      and feed_instance_products.batch_number = 1
  ),
  (
    select array_agg(ordered_products.id order by ordered_products.id)
    from (
      select products.id
      from public.products
      where products.is_active
      order by products.id
      limit 5
    ) as ordered_products
  ),
  'the first batch uses stable active-catalog product-ID ordering'
);

select is(
  (
    select count(*)
    from public.feed_instance_products
    join public.products
      on products.id = feed_instance_products.product_id
    where feed_instance_products.feed_instance_id = (
      select state_value::uuid
      from pg_temp.p11a_state
      where state_key = 'feed_a'
    )
      and not products.is_active
  ),
  0::bigint,
  'feed append persists active products only'
);

select is(
  public.append_feed_batch(
    (
      select state_value::uuid
      from pg_temp.p11a_state
      where state_key = 'feed_a'
    ),
    null,
    5
  ),
  public.append_feed_batch(
    (
      select state_value::uuid
      from pg_temp.p11a_state
      where state_key = 'feed_a'
    ),
    null,
    5
  ),
  'repeating the same first-page cursor returns the exact canonical replay'
);

select throws_ok(
  $$
    select public.append_feed_batch(
      (
        select state_value::uuid
        from pg_temp.p11a_state
        where state_key = 'feed_a'
      ),
      null,
      6
    )
  $$,
  '22023',
  'feed cursor request conflict',
  'reusing a cursor with a conflicting page size fails'
);

select lives_ok(
  $$
    select public.append_feed_batch(
      (
        select state_value::uuid
        from pg_temp.p11a_state
        where state_key = 'feed_a'
      ),
      (
        select feed_instances.last_cursor
        from public.feed_instances
        where feed_instances.id = (
          select state_value::uuid
          from pg_temp.p11a_state
          where state_key = 'feed_a'
        )
      ),
      5
    )
  $$,
  'the second page appends from the database-owned next cursor'
);

select is(
  (
    select array_agg(
      feed_instance_products.position
      order by feed_instance_products.position
    )
    from public.feed_instance_products
    where feed_instance_products.feed_instance_id = (
      select state_value::uuid
      from pg_temp.p11a_state
      where state_key = 'feed_a'
    )
      and feed_instance_products.batch_number = 2
  ),
  array[6, 7, 8, 9, 10],
  'the second page continues with no skipped absolute positions'
);

select is(
  (
    select count(distinct feed_instance_products.product_id)
      = count(*)
    from public.feed_instance_products
    where feed_instance_products.feed_instance_id = (
      select state_value::uuid
      from pg_temp.p11a_state
      where state_key = 'feed_a'
    )
  ),
  true,
  'adjacent pages contain no duplicate products'
);

select ok(
  (
    select feed_instances.max_loaded_position = 10
      and feed_instances.last_cursor
        ~ '^lr001-feed-cursor-v1\.[0-9a-f]{64}$'
    from public.feed_instances
    where feed_instances.id = (
      select state_value::uuid
      from pg_temp.p11a_state
      where state_key = 'feed_a'
    )
  ),
  'second-page append atomically advances loaded depth and the versioned opaque cursor'
);

select throws_ok(
  $$
    select public.append_feed_batch(
      (
        select state_value::uuid
        from pg_temp.p11a_state
        where state_key = 'feed_a'
      ),
      'not-a-cursor',
      5
    )
  $$,
  '22023',
  'invalid feed cursor',
  'a malformed cursor fails deterministically'
);

select throws_ok(
  $$
    select public.append_feed_batch(
      (
        select state_value::uuid
        from pg_temp.p11a_state
        where state_key = 'feed_a'
      ),
      (
        select state_value
        from pg_temp.p11a_state
        where state_key = 'cursor_b'
      ),
      5
    )
  $$,
  '22023',
  'invalid or stale feed cursor',
  'a valid opaque cursor bound to another feed is rejected'
);

select lives_ok(
  $$
    do $block$
    declare
      current_cursor text;
      feed_exhausted boolean;
      owned_feed_id uuid := (
        select state_value::uuid
        from pg_temp.p11a_state
        where state_key = 'feed_a'
      );
    begin
      loop
        select
          feed_instances.last_cursor,
          feed_instances.is_exhausted
        into current_cursor, feed_exhausted
        from public.feed_instances
        where feed_instances.id = owned_feed_id;

        exit when feed_exhausted;

        perform public.append_feed_batch(
          owned_feed_id,
          current_cursor,
          5
        );
      end loop;
    end;
    $block$
  $$,
  'successive canonical cursors exhaust the unchanged active catalog'
);

select ok(
  (
    select feed_instances.is_exhausted
      and feed_instances.last_cursor is null
      and feed_instances.max_loaded_position = (
        select count(*)::integer
        from public.products
        where products.is_active
      )
    from public.feed_instances
    where feed_instances.id = (
      select state_value::uuid
      from pg_temp.p11a_state
      where state_key = 'feed_a'
    )
  ),
  'terminal append records exact loaded depth, explicit exhaustion, and no next cursor'
);

select is(
  (
    select count(*)
    from public.feed_instance_products
    where feed_instance_products.feed_instance_id = (
      select state_value::uuid
      from pg_temp.p11a_state
      where state_key = 'feed_a'
    )
  ),
  (
    select count(*)
    from public.products
    where products.is_active
  ),
  'exhaustion persists every active product exactly once without catalog-size constants'
);

select is(
  (
    public.record_qualified_feed_position(
      '91300000-0000-4000-8000-000000000003',
      (
        select state_value::uuid
        from pg_temp.p11a_state
        where state_key = 'feed_a'
      ),
      (
        select feed_instance_products.product_id
        from public.feed_instance_products
        where feed_instance_products.feed_instance_id = (
          select state_value::uuid
          from pg_temp.p11a_state
          where state_key = 'feed_a'
        )
          and feed_instance_products.position = 3
      ),
      3
    ) ->> 'max_qualified_position'
  )::integer,
  3,
  'a valid qualified impression persists its canonical absolute position'
);

select is(
  (
    public.record_qualified_feed_position(
      '91300000-0000-4000-8000-000000000003',
      (
        select state_value::uuid
        from pg_temp.p11a_state
        where state_key = 'feed_a'
      ),
      (
        select feed_instance_products.product_id
        from public.feed_instance_products
        where feed_instance_products.feed_instance_id = (
          select state_value::uuid
          from pg_temp.p11a_state
          where state_key = 'feed_a'
        )
          and feed_instance_products.position = 8
      ),
      8
    ) ->> 'max_qualified_position'
  )::integer,
  8,
  'qualified depth increases monotonically to a later position'
);

select is(
  (
    public.record_qualified_feed_position(
      '91300000-0000-4000-8000-000000000003',
      (
        select state_value::uuid
        from pg_temp.p11a_state
        where state_key = 'feed_a'
      ),
      (
        select feed_instance_products.product_id
        from public.feed_instance_products
        where feed_instance_products.feed_instance_id = (
          select state_value::uuid
          from pg_temp.p11a_state
          where state_key = 'feed_a'
        )
          and feed_instance_products.position = 3
      ),
      3
    ) ->> 'max_qualified_position'
  )::integer,
  8,
  'scroll-back qualification cannot reduce canonical depth'
);

select is(
  (
    public.record_qualified_feed_position(
      '91300000-0000-4000-8000-000000000003',
      (
        select state_value::uuid
        from pg_temp.p11a_state
        where state_key = 'feed_a'
      ),
      (
        select feed_instance_products.product_id
        from public.feed_instance_products
        where feed_instance_products.feed_instance_id = (
          select state_value::uuid
          from pg_temp.p11a_state
          where state_key = 'feed_a'
        )
          and feed_instance_products.position = 8
      ),
      8
    ) ->> 'max_qualified_position'
  )::integer,
  8,
  'repeated qualification is idempotent'
);

select throws_ok(
  $$
    select public.record_qualified_feed_position(
      '91300000-0000-4000-8000-000000000003',
      (
        select state_value::uuid
        from pg_temp.p11a_state
        where state_key = 'feed_a'
      ),
      (
        select feed_instance_products.product_id
        from public.feed_instance_products
        where feed_instance_products.feed_instance_id = (
          select state_value::uuid
          from pg_temp.p11a_state
          where state_key = 'feed_a'
        )
          and feed_instance_products.position = 3
      ),
      4
    )
  $$,
  '22023',
  'qualified feed membership mismatch',
  'a supplied absolute position must match canonical feed membership'
);

select throws_ok(
  $$
    select public.record_qualified_feed_position(
      '91300000-0000-4000-8000-000000000003',
      (
        select state_value::uuid
        from pg_temp.p11a_state
        where state_key = 'feed_a'
      ),
      'd1100000-0000-4000-8000-000000000999',
      1
    )
  $$,
  '22023',
  'qualified feed membership mismatch',
  'a product outside the feed cannot update qualified depth'
);

select throws_like(
  $$
    insert into public.sessions (
      id,
      anonymous_user_id,
      session_number,
      started_at,
      last_activity_at,
      app_version,
      platform,
      environment
    )
    values (
      '91300000-0000-4000-8000-000000000099',
      '91100000-0000-4000-8000-000000000001',
      99,
      statement_timestamp(),
      statement_timestamp(),
      'tampered',
      'web_mobile',
      'local'
    )
  $$,
  '%permission denied%',
  'authenticated clients still cannot insert sessions directly'
);

select throws_like(
  $$
    update public.feed_instances
    set max_loaded_position = max_loaded_position + 1
  $$,
  '%permission denied%',
  'authenticated clients still cannot update feed state directly'
);

select throws_like(
  $$
    insert into public.feed_instance_products (
      feed_instance_id,
      product_id,
      position,
      batch_number
    )
    values (
      (
        select state_value::uuid
        from pg_temp.p11a_state
        where state_key = 'feed_a'
      ),
      'd1100000-0000-4000-8000-000000000999',
      999,
      999
    )
  $$,
  '%permission denied%',
  'authenticated clients still cannot append feed membership directly'
);

reset role;

set local role authenticated;
set local "request.jwt.claim.sub" =
  '91000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" =
  '{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$
    select public.record_qualified_feed_position(
      '91300000-0000-4000-8000-000000000003',
      (
        select state_value::uuid
        from pg_temp.p11a_state
        where state_key = 'feed_a'
      ),
      (
        select feed_instance_products.product_id
        from public.feed_instance_products
        where feed_instance_products.position = 3
        order by
          feed_instance_products.feed_instance_id,
          feed_instance_products.product_id
        limit 1
      ),
      3
    )
  $$,
  '42501',
  'owned feed session not found',
  'user B cannot qualify a position in user A feed'
);

select is(
  (select count(*) from public.feed_instances),
  1::bigint,
  'user B can read only their own feed instance'
);

reset role;

select * from finish();

rollback;
