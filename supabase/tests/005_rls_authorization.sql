begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select no_plan();

select is(
  (
    select count(*)
    from pg_catalog.pg_class
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname in (
        'anonymous_users',
        'users',
        'onboarding_states',
        'sessions',
        'products',
        'wardrobes',
        'saved_products',
        'challenges',
        'challenge_progress',
        'challenge_progress_items',
        'challenge_completions',
        'feed_instances',
        'feed_instance_products',
        'events',
        'event_quarantine'
      )
      and pg_class.relrowsecurity
  ),
  15::bigint,
  'RLS is enabled on every public LR-001 domain table'
);

select ok(
  not has_table_privilege('anon', 'public.products', 'SELECT'),
  'the unauthenticated API role has no catalog read grant'
);

select ok(
  not has_table_privilege('authenticated', 'public.events', 'SELECT')
  and not has_table_privilege(
    'authenticated',
    'public.event_quarantine',
    'SELECT'
  ),
  'event and quarantine storage has no authenticated client read grant'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.onboarding_states',
    'INSERT'
  )
  and not has_table_privilege(
    'authenticated',
    'public.onboarding_states',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.onboarding_states',
    'DELETE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.saved_products',
    'INSERT'
  )
  and not has_table_privilege(
    'authenticated',
    'public.saved_products',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.saved_products',
    'DELETE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.challenge_progress',
    'INSERT'
  )
  and not has_table_privilege(
    'authenticated',
    'public.challenge_progress',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.challenge_progress',
    'DELETE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.challenge_progress_items',
    'INSERT'
  )
  and not has_table_privilege(
    'authenticated',
    'public.challenge_progress_items',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.challenge_progress_items',
    'DELETE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.challenge_completions',
    'INSERT'
  )
  and not has_table_privilege(
    'authenticated',
    'public.challenge_completions',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.challenge_completions',
    'DELETE'
  ),
  'RPC-owned state tables have no authenticated direct DML grants'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated')
      and table_schema = 'public'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
      and table_name in (
        'anonymous_users',
        'users',
        'onboarding_states',
        'sessions',
        'products',
        'wardrobes',
        'saved_products',
        'challenges',
        'challenge_progress',
        'challenge_progress_items',
        'challenge_completions',
        'feed_instances',
        'feed_instance_products',
        'events',
        'event_quarantine'
      )
  ),
  0::bigint,
  'no client role has direct DML on any public LR-001 domain table'
);

insert into auth.users (id, is_anonymous)
values
  ('71000000-0000-4000-8000-000000000001', true),
  ('71000000-0000-4000-8000-000000000002', true);

insert into public.anonymous_users (id, auth_user_id)
values
  (
    '71100000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001'
  ),
  (
    '71100000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000002'
  );

insert into public.users (id, primary_anonymous_user_id)
values
  (
    '71000000-0000-4000-8000-000000000001',
    '71100000-0000-4000-8000-000000000001'
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    '71100000-0000-4000-8000-000000000002'
  );

insert into public.wardrobes (id, anonymous_user_id)
values
  (
    '71200000-0000-4000-8000-000000000001',
    '71100000-0000-4000-8000-000000000001'
  ),
  (
    '71200000-0000-4000-8000-000000000002',
    '71100000-0000-4000-8000-000000000002'
  );

insert into public.onboarding_states (
  anonymous_user_id,
  status,
  started_at
)
values
  (
    '71100000-0000-4000-8000-000000000001',
    'in_progress',
    now()
  ),
  (
    '71100000-0000-4000-8000-000000000002',
    'in_progress',
    now()
  );

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
values
  (
    '71300000-0000-4000-8000-000000000001',
    '71100000-0000-4000-8000-000000000001',
    1,
    now(),
    now(),
    'p06-test',
    'web_mobile',
    'local'
  ),
  (
    '71300000-0000-4000-8000-000000000002',
    '71100000-0000-4000-8000-000000000002',
    1,
    now(),
    now(),
    'p06-test',
    'web_mobile',
    'local'
  );

insert into public.products (
  id,
  external_source,
  external_id,
  name,
  category,
  slot_eligibility,
  catalog_version,
  is_active
)
values
  (
    '71400000-0000-4000-8000-000000000001',
    'p06-rls',
    'active-top',
    'Active Top',
    'top',
    array['top'],
    'p06-test',
    true
  ),
  (
    '71400000-0000-4000-8000-000000000002',
    'p06-rls',
    'inactive-top',
    'Inactive Top',
    'top',
    array['top'],
    'p06-test',
    false
  );

insert into public.saved_products (
  id,
  wardrobe_id,
  anonymous_user_id,
  product_id,
  source_surface,
  save_operation_id
)
values
  (
    '71500000-0000-4000-8000-000000000001',
    '71200000-0000-4000-8000-000000000001',
    '71100000-0000-4000-8000-000000000001',
    '71400000-0000-4000-8000-000000000001',
    'discover',
    '71510000-0000-4000-8000-000000000001'
  ),
  (
    '71500000-0000-4000-8000-000000000002',
    '71200000-0000-4000-8000-000000000002',
    '71100000-0000-4000-8000-000000000002',
    '71400000-0000-4000-8000-000000000001',
    'discover',
    '71510000-0000-4000-8000-000000000002'
  );

update public.challenges
set is_active = false
where challenges.id = 'c0810000-0000-4000-8000-000000000001'
  and challenges.challenge_key = 'after-dark'
  and challenges.version = 'challenge-evening-v1'
  and challenges.is_active;

insert into public.challenges (
  id,
  challenge_key,
  version,
  title,
  context_copy,
  required_slots,
  completion_rules,
  active_from,
  is_active
)
values
  (
    '71600000-0000-4000-8000-000000000001',
    'active-p06',
    'active-p06-v1',
    'Active Challenge',
    'Build a test look.',
    '[{"slot_id":"top"}]'::jsonb,
    '{"unique_products":true}'::jsonb,
    '2026-07-23 00:00:00+00',
    true
  ),
  (
    '71600000-0000-4000-8000-000000000002',
    'inactive-p06',
    'inactive-p06-v1',
    'Inactive Challenge',
    'Do not expose this definition.',
    '[{"slot_id":"top"}]'::jsonb,
    '{"unique_products":true}'::jsonb,
    '2026-07-23 00:00:00+00',
    false
  );

insert into public.challenge_progress (
  id,
  anonymous_user_id,
  challenge_id,
  status,
  start_operation_id,
  started_at
)
values
  (
    '71700000-0000-4000-8000-000000000001',
    '71100000-0000-4000-8000-000000000001',
    '71600000-0000-4000-8000-000000000001',
    'in_progress',
    '71710000-0000-4000-8000-000000000001',
    now()
  ),
  (
    '71700000-0000-4000-8000-000000000002',
    '71100000-0000-4000-8000-000000000002',
    '71600000-0000-4000-8000-000000000001',
    'in_progress',
    '71710000-0000-4000-8000-000000000002',
    now()
  );

insert into public.challenge_progress_items (
  id,
  challenge_progress_id,
  slot_id,
  product_id,
  selection_operation_id
)
values
  (
    '71800000-0000-4000-8000-000000000001',
    '71700000-0000-4000-8000-000000000001',
    'top',
    '71400000-0000-4000-8000-000000000001',
    '71810000-0000-4000-8000-000000000001'
  ),
  (
    '71800000-0000-4000-8000-000000000002',
    '71700000-0000-4000-8000-000000000002',
    'top',
    '71400000-0000-4000-8000-000000000001',
    '71810000-0000-4000-8000-000000000002'
  );

insert into public.challenge_completions (
  id,
  anonymous_user_id,
  challenge_id,
  challenge_progress_id,
  completion_operation_id,
  selected_products_snapshot,
  challenge_snapshot
)
values
  (
    '71900000-0000-4000-8000-000000000001',
    '71100000-0000-4000-8000-000000000001',
    '71600000-0000-4000-8000-000000000001',
    '71700000-0000-4000-8000-000000000001',
    '71910000-0000-4000-8000-000000000001',
    '{"items":[{"slot_id":"top"}]}'::jsonb,
    '{"version":"active-p06-v1"}'::jsonb
  ),
  (
    '71900000-0000-4000-8000-000000000002',
    '71100000-0000-4000-8000-000000000002',
    '71600000-0000-4000-8000-000000000001',
    '71700000-0000-4000-8000-000000000002',
    '71910000-0000-4000-8000-000000000002',
    '{"items":[{"slot_id":"top"}]}'::jsonb,
    '{"version":"active-p06-v1"}'::jsonb
  );

insert into public.feed_instances (
  id,
  anonymous_user_id,
  session_id,
  feed_order_version
)
values
  (
    '72000000-0000-4000-8000-000000000001',
    '71100000-0000-4000-8000-000000000001',
    '71300000-0000-4000-8000-000000000001',
    'p06-test'
  ),
  (
    '72000000-0000-4000-8000-000000000002',
    '71100000-0000-4000-8000-000000000002',
    '71300000-0000-4000-8000-000000000002',
    'p06-test'
  );

insert into public.feed_instance_products (
  feed_instance_id,
  product_id,
  position,
  batch_number
)
values
  (
    '72000000-0000-4000-8000-000000000001',
    '71400000-0000-4000-8000-000000000001',
    1,
    1
  ),
  (
    '72000000-0000-4000-8000-000000000002',
    '71400000-0000-4000-8000-000000000001',
    1,
    1
  );

create temporary table p06_product_rls_baseline on commit drop as
select count(*) as active_product_count
from public.products
where products.is_active;

grant select on table p06_product_rls_baseline to authenticated;

set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{"role":"anon"}';

select throws_like(
  'select count(*) from public.products',
  '%permission denied%',
  'unauthenticated catalog access is denied'
);

select throws_like(
  'select count(*) from public.anonymous_users',
  '%permission denied%',
  'unauthenticated identity access is denied'
);

reset role;

set local role authenticated;
set local "request.jwt.claim.sub" =
  '71000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" =
  '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  (select count(*) from public.anonymous_users),
  1::bigint,
  'user A reads only their anonymous identity'
);

select is(
  (select auth_user_id from public.anonymous_users),
  '71000000-0000-4000-8000-000000000001'::uuid,
  'the visible identity belongs to user A'
);

select is(
  (select id from public.users),
  '71000000-0000-4000-8000-000000000001'::uuid,
  'user A reads only their own upgraded-profile placeholder'
);

select is(
  (select count(*) from public.wardrobes),
  1::bigint,
  'user A reads only their Wardrobe'
);

select is(
  (select count(*) from public.onboarding_states),
  1::bigint,
  'user A reads only their onboarding state'
);

select is(
  (select count(*) from public.sessions),
  1::bigint,
  'user A reads only their session'
);

select is(
  (select count(*) from public.saved_products),
  1::bigint,
  'user A reads only their save history'
);

select is(
  (select count(*) from public.challenge_progress),
  1::bigint,
  'user A reads only their Challenge progress'
);

select is(
  (select count(*) from public.challenge_progress_items),
  1::bigint,
  'user A reads only their Challenge selection history'
);

select is(
  (select count(*) from public.challenge_completions),
  1::bigint,
  'user A reads only their completion snapshot'
);

select is(
  (select count(*) from public.feed_instances),
  1::bigint,
  'user A reads only their feed instance'
);

select is(
  (select count(*) from public.feed_instance_products),
  1::bigint,
  'user A reads only products belonging to their feed instance'
);

select is(
  (select count(*) from public.products),
  (
    select active_product_count
    from pg_temp.p06_product_rls_baseline
  ),
  'authenticated catalog reads expose every active product'
);

select is(
  (
    select count(*)
    from public.products
    where not products.is_active
  ),
  0::bigint,
  'authenticated catalog reads expose no inactive products'
);

select is(
  (select count(*) from public.challenges),
  1::bigint,
  'authenticated Challenge reads expose only the active definition'
);

select throws_like(
  $$
    insert into public.saved_products (
      wardrobe_id,
      anonymous_user_id,
      product_id,
      source_surface,
      save_operation_id
    )
    values (
      '71200000-0000-4000-8000-000000000001',
      '71100000-0000-4000-8000-000000000001',
      '71400000-0000-4000-8000-000000000001',
      'discover',
      gen_random_uuid()
    )
  $$,
  '%permission denied%',
  'authenticated clients cannot insert RPC-owned saves directly'
);

select throws_like(
  $$
    update public.onboarding_states
    set state_revision = state_revision + 1
  $$,
  '%permission denied%',
  'authenticated clients cannot update RPC-owned onboarding state'
);

select throws_like(
  $$
    update public.challenge_completions
    set challenge_snapshot = '{"tampered":true}'::jsonb
  $$,
  '%permission denied%',
  'authenticated clients cannot modify immutable completion snapshots'
);

select throws_like(
  'delete from public.challenge_completions',
  '%permission denied%',
  'authenticated clients cannot delete immutable completion snapshots'
);

select throws_like(
  'select count(*) from public.events',
  '%permission denied%',
  'authenticated clients cannot read raw events'
);

select throws_like(
  'select count(*) from public.event_quarantine',
  '%permission denied%',
  'authenticated clients cannot read event quarantine'
);

reset role;

set local role authenticated;
set local "request.jwt.claim.sub" =
  '71000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" =
  '{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}';

select is(
  (select count(*) from public.anonymous_users),
  1::bigint,
  'user B also sees exactly one identity'
);

select is(
  (select auth_user_id from public.anonymous_users),
  '71000000-0000-4000-8000-000000000002'::uuid,
  'user B cannot see user A identity'
);

select is(
  (select id from public.users),
  '71000000-0000-4000-8000-000000000002'::uuid,
  'user B cannot see user A upgraded-profile placeholder'
);

select is(
  (select anonymous_user_id from public.wardrobes),
  '71100000-0000-4000-8000-000000000002'::uuid,
  'user B cannot see user A Wardrobe'
);

select is(
  (select anonymous_user_id from public.saved_products),
  '71100000-0000-4000-8000-000000000002'::uuid,
  'user B cannot see user A save history'
);

select is(
  (select anonymous_user_id from public.challenge_progress),
  '71100000-0000-4000-8000-000000000002'::uuid,
  'user B cannot see user A Challenge state'
);

select is(
  (select anonymous_user_id from public.challenge_completions),
  '71100000-0000-4000-8000-000000000002'::uuid,
  'user B cannot see user A completion history'
);

reset role;

select * from finish();

rollback;
