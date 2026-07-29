begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select no_plan();

select is(
  (
    select count(*)
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'select_challenge_item',
        'remove_challenge_item',
        'complete_challenge'
      )
  ),
  3::bigint,
  'the three Challenge mutation names each have one unambiguous signature'
);

select ok(
  to_regprocedure(
    'public.select_challenge_item(uuid,text,uuid,bigint,uuid)'
  ) is not null
  and to_regprocedure(
    'public.remove_challenge_item(uuid,bigint,uuid)'
  ) is not null
  and to_regprocedure(
    'public.complete_challenge(uuid,bigint,uuid)'
  ) is not null,
  'the revision-aware Challenge signatures exist'
);

select ok(
  to_regprocedure(
    'public.select_challenge_item(uuid,text,uuid,uuid)'
  ) is null
  and to_regprocedure(
    'public.remove_challenge_item(uuid,uuid)'
  ) is null
  and to_regprocedure(
    'public.complete_challenge(uuid,uuid)'
  ) is null,
  'the obsolete revision-bypass signatures are absent'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc
    where pg_proc.oid in (
      to_regprocedure(
        'public.select_challenge_item(uuid,text,uuid,bigint,uuid)'
      ),
      to_regprocedure(
        'public.remove_challenge_item(uuid,bigint,uuid)'
      ),
      to_regprocedure(
        'public.complete_challenge(uuid,bigint,uuid)'
      )
    )
      and pg_catalog.pg_get_userbyid(pg_proc.proowner) = 'postgres'
      and pg_proc.prosecdef
      and 'search_path=""' = any(pg_proc.proconfig)
  ),
  3::bigint,
  'revision-aware functions are postgres-owned security definers with empty search paths'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc
    where pg_proc.oid in (
      to_regprocedure(
        'public.select_challenge_item(uuid,text,uuid,bigint,uuid)'
      ),
      to_regprocedure(
        'public.remove_challenge_item(uuid,bigint,uuid)'
      ),
      to_regprocedure(
        'public.complete_challenge(uuid,bigint,uuid)'
      )
    )
      and lower(pg_proc.prosrc) ~ '(^|[^a-z])execute([^a-z]|$)'
  ),
  'revision-aware functions contain no dynamic SQL'
);

select ok(
  (
    select bool_and(
      has_function_privilege('authenticated', pg_proc.oid, 'EXECUTE')
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
    )
    from pg_catalog.pg_proc
    where pg_proc.oid in (
      to_regprocedure(
        'public.select_challenge_item(uuid,text,uuid,bigint,uuid)'
      ),
      to_regprocedure(
        'public.remove_challenge_item(uuid,bigint,uuid)'
      ),
      to_regprocedure(
        'public.complete_challenge(uuid,bigint,uuid)'
      )
    )
  ),
  'only authenticated clients can execute the revision-aware signatures'
);

select ok(
  (
    select bool_and(
      'expected_state_revision' = any(pg_proc.proargnames)
      and not (
        pg_proc.proargnames
        && array['anonymous_user_id', 'user_id', 'wardrobe_id']::text[]
      )
    )
    from pg_catalog.pg_proc
    where pg_proc.oid in (
      to_regprocedure(
        'public.select_challenge_item(uuid,text,uuid,bigint,uuid)'
      ),
      to_regprocedure(
        'public.remove_challenge_item(uuid,bigint,uuid)'
      ),
      to_regprocedure(
        'public.complete_challenge(uuid,bigint,uuid)'
      )
    )
  ),
  'every corrected signature requires a revision and exposes no owner argument'
);

insert into auth.users (id, is_anonymous)
values
  ('91000000-0000-4000-8000-000000000001', true),
  ('91000000-0000-4000-8000-000000000002', true);

insert into public.anonymous_users (id, auth_user_id)
values
  (
    '91100000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001'
  ),
  (
    '91100000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000002'
  );

insert into public.wardrobes (id, anonymous_user_id)
values
  (
    '91200000-0000-4000-8000-000000000001',
    '91100000-0000-4000-8000-000000000001'
  ),
  (
    '91200000-0000-4000-8000-000000000002',
    '91100000-0000-4000-8000-000000000002'
  );

insert into public.products (
  id,
  external_source,
  external_id,
  name,
  brand,
  category,
  image_urls,
  slot_eligibility,
  catalog_version,
  is_active
)
values
  (
    '91300000-0000-4000-8000-000000000001',
    'p14a-rpc',
    'top-one',
    'Revision Top One',
    'Fixture',
    'top',
    array['https://example.invalid/top-one.jpg'],
    array['top'],
    'p14a-rpc-v1',
    true
  ),
  (
    '91300000-0000-4000-8000-000000000002',
    'p14a-rpc',
    'top-two',
    'Revision Top Two',
    'Fixture',
    'top',
    array['https://example.invalid/top-two.jpg'],
    array['top'],
    'p14a-rpc-v1',
    true
  ),
  (
    '91300000-0000-4000-8000-000000000003',
    'p14a-rpc',
    'bottom',
    'Revision Bottom',
    'Fixture',
    'bottom',
    array['https://example.invalid/bottom.jpg'],
    array['bottom'],
    'p14a-rpc-v1',
    true
  ),
  (
    '91300000-0000-4000-8000-000000000004',
    'p14a-rpc',
    'shoes',
    'Revision Shoes',
    'Fixture',
    'shoes',
    array['https://example.invalid/shoes.jpg'],
    array['shoes'],
    'p14a-rpc-v1',
    true
  ),
  (
    '91300000-0000-4000-8000-000000000005',
    'p14a-rpc',
    'layer',
    'Revision Layer',
    'Fixture',
    'layer',
    array['https://example.invalid/layer.jpg'],
    array['layer_or_accessory'],
    'p14a-rpc-v1',
    true
  ),
  (
    '91300000-0000-4000-8000-000000000006',
    'p14a-rpc',
    'inactive-top',
    'Inactive Revision Top',
    'Fixture',
    'top',
    array['https://example.invalid/inactive.jpg'],
    array['top'],
    'p14a-rpc-v1',
    false
  );

update public.challenges
set is_active = false
where challenges.is_active;

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
values (
  '91400000-0000-4000-8000-000000000001',
  'after-dark-p14a',
  'challenge-evening-v1',
  'After Dark',
  'Build a look for an evening out.',
  '[
    {"slot_id":"top"},
    {"slot_id":"bottom"},
    {"slot_id":"shoes"},
    {"slot_id":"layer_or_accessory"}
  ]'::jsonb,
  '{"unique_products":true}'::jsonb,
  '2026-07-29 00:00:00+00',
  true
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
    '91500000-0000-4000-8000-000000000001',
    '91200000-0000-4000-8000-000000000001',
    '91100000-0000-4000-8000-000000000001',
    '91300000-0000-4000-8000-000000000001',
    'challenge',
    '91510000-0000-4000-8000-000000000001'
  ),
  (
    '91500000-0000-4000-8000-000000000002',
    '91200000-0000-4000-8000-000000000001',
    '91100000-0000-4000-8000-000000000001',
    '91300000-0000-4000-8000-000000000002',
    'challenge',
    '91510000-0000-4000-8000-000000000002'
  ),
  (
    '91500000-0000-4000-8000-000000000003',
    '91200000-0000-4000-8000-000000000001',
    '91100000-0000-4000-8000-000000000001',
    '91300000-0000-4000-8000-000000000003',
    'challenge',
    '91510000-0000-4000-8000-000000000003'
  ),
  (
    '91500000-0000-4000-8000-000000000004',
    '91200000-0000-4000-8000-000000000001',
    '91100000-0000-4000-8000-000000000001',
    '91300000-0000-4000-8000-000000000004',
    'challenge',
    '91510000-0000-4000-8000-000000000004'
  ),
  (
    '91500000-0000-4000-8000-000000000005',
    '91200000-0000-4000-8000-000000000001',
    '91100000-0000-4000-8000-000000000001',
    '91300000-0000-4000-8000-000000000005',
    'challenge',
    '91510000-0000-4000-8000-000000000005'
  ),
  (
    '91500000-0000-4000-8000-000000000006',
    '91200000-0000-4000-8000-000000000001',
    '91100000-0000-4000-8000-000000000001',
    '91300000-0000-4000-8000-000000000006',
    'challenge',
    '91510000-0000-4000-8000-000000000006'
  ),
  (
    '91500000-0000-4000-8000-000000000007',
    '91200000-0000-4000-8000-000000000002',
    '91100000-0000-4000-8000-000000000002',
    '91300000-0000-4000-8000-000000000001',
    'challenge',
    '91510000-0000-4000-8000-000000000007'
  );

insert into public.challenge_progress (
  id,
  anonymous_user_id,
  challenge_id,
  status,
  start_operation_id,
  started_at,
  last_interacted_at,
  state_revision
)
values
  (
    '91600000-0000-4000-8000-000000000001',
    '91100000-0000-4000-8000-000000000001',
    '91400000-0000-4000-8000-000000000001',
    'in_progress',
    '91610000-0000-4000-8000-000000000001',
    '2026-07-29 00:00:00+00',
    '2026-07-29 00:00:00+00',
    1
  ),
  (
    '91600000-0000-4000-8000-000000000002',
    '91100000-0000-4000-8000-000000000002',
    '91400000-0000-4000-8000-000000000001',
    'in_progress',
    '91610000-0000-4000-8000-000000000002',
    '2026-07-29 00:00:00+00',
    '2026-07-29 00:00:00+00',
    1
  );

set local role authenticated;
set local "request.jwt.claim.sub" =
  '91000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" =
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$
    select public.select_challenge_item(
      '91600000-0000-4000-8000-000000000001',
      'top',
      '91300000-0000-4000-8000-000000000001',
      null,
      '92000000-0000-4000-8000-000000000000'
    )
  $$,
  '22023',
  'expected_state_revision must be nonnegative',
  'a null expected revision cannot create fingerprint ambiguity'
);

select lives_ok(
  $$
    select public.select_challenge_item(
      '91600000-0000-4000-8000-000000000001',
      'top',
      '91300000-0000-4000-8000-000000000001',
      1,
      '92000000-0000-4000-8000-000000000001'
    )
  $$,
  'selection succeeds when the expected revision matches'
);

select is(
  (
    select state_revision
    from public.challenge_progress
    where id = '91600000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'selection increments the revision exactly once'
);

select throws_ok(
  $$
    select public.select_challenge_item(
      '91600000-0000-4000-8000-000000000001',
      'top',
      '91300000-0000-4000-8000-000000000002',
      1,
      '92000000-0000-4000-8000-000000000002'
    )
  $$,
  '40001',
  'challenge_revision_mismatch',
  'stale selection returns the typed revision mismatch'
);

select is(
  (
    select product_id
    from public.challenge_progress_items
    where challenge_progress_id =
        '91600000-0000-4000-8000-000000000001'
      and slot_id = 'top'
      and removed_at is null
  ),
  '91300000-0000-4000-8000-000000000001'::uuid,
  'stale selection leaves the canonical slot unchanged'
);

select is(
  (
    select state_revision
    from public.challenge_progress
    where id = '91600000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'stale selection does not increment the revision'
);

reset role;

select is(
  (
    select count(*)
    from private.mutation_operations
    where operation_id =
      '92000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'revision mismatch rolls back its provisional operation claim'
);

set local role authenticated;
set local "request.jwt.claim.sub" =
  '91000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" =
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  public.select_challenge_item(
    '91600000-0000-4000-8000-000000000001',
    'top',
    '91300000-0000-4000-8000-000000000001',
    1,
    '92000000-0000-4000-8000-000000000001'
  ),
  public.select_challenge_item(
    '91600000-0000-4000-8000-000000000001',
    'top',
    '91300000-0000-4000-8000-000000000001',
    1,
    '92000000-0000-4000-8000-000000000001'
  ),
  'selection replay returns its stored canonical result'
);

select throws_ok(
  $$
    select public.select_challenge_item(
      '91600000-0000-4000-8000-000000000001',
      'top',
      '91300000-0000-4000-8000-000000000001',
      2,
      '92000000-0000-4000-8000-000000000001'
    )
  $$,
  '22023',
  'operation_id conflict',
  'different expected revision on a completed operation is an operation conflict'
);

select throws_ok(
  $$
    select public.select_challenge_item(
      '91600000-0000-4000-8000-000000000001',
      'not_a_slot',
      '91300000-0000-4000-8000-000000000001',
      2,
      '92000000-0000-4000-8000-000000000003'
    )
  $$,
  '22023',
  'slot is not required by this challenge',
  'invalid slot validation remains intact after a revision match'
);

select throws_ok(
  $$
    select public.select_challenge_item(
      '91600000-0000-4000-8000-000000000001',
      'top',
      '91300000-0000-4000-8000-000000000006',
      2,
      '92000000-0000-4000-8000-000000000004'
    )
  $$,
  '22023',
  'product is not active and eligible for this slot',
  'inactive product validation remains intact after a revision match'
);

reset role;

set local role authenticated;
set local "request.jwt.claim.sub" =
  '91000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" =
  '{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$
    select public.select_challenge_item(
      '91600000-0000-4000-8000-000000000001',
      'top',
      '91300000-0000-4000-8000-000000000001',
      2,
      '92000000-0000-4000-8000-000000000005'
    )
  $$,
  '42501',
  'owned challenge progress not found',
  'cross-user selection remains rejected before revision comparison'
);

reset role;

set local role authenticated;
set local "request.jwt.claim.sub" =
  '91000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" =
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$
    select public.remove_challenge_item(
      (
        select id
        from public.challenge_progress_items
        where challenge_progress_id =
            '91600000-0000-4000-8000-000000000001'
          and slot_id = 'top'
          and removed_at is null
      ),
      2,
      '92100000-0000-4000-8000-000000000001'
    )
  $$,
  'removal succeeds when the expected revision matches'
);

select is(
  (
    select state_revision
    from public.challenge_progress
    where id = '91600000-0000-4000-8000-000000000001'
  ),
  3::bigint,
  'removal increments the revision exactly once'
);

select lives_ok(
  $$
    select public.select_challenge_item(
      '91600000-0000-4000-8000-000000000001',
      'top',
      '91300000-0000-4000-8000-000000000001',
      3,
      '92000000-0000-4000-8000-000000000006'
    )
  $$,
  'a new active selection establishes the concurrency sequence'
);

select lives_ok(
  $$
    select public.select_challenge_item(
      '91600000-0000-4000-8000-000000000001',
      'bottom',
      '91300000-0000-4000-8000-000000000003',
      4,
      '92000000-0000-4000-8000-000000000007'
    )
  $$,
  'another valid mutation advances the canonical revision'
);

select throws_ok(
  $$
    select public.remove_challenge_item(
      (
        select id
        from public.challenge_progress_items
        where challenge_progress_id =
            '91600000-0000-4000-8000-000000000001'
          and slot_id = 'top'
          and removed_at is null
      ),
      4,
      '92100000-0000-4000-8000-000000000002'
    )
  $$,
  '40001',
  'challenge_revision_mismatch',
  'stale removal returns the typed revision mismatch'
);

select is(
  (
    select count(*)
    from public.challenge_progress_items
    where challenge_progress_id =
        '91600000-0000-4000-8000-000000000001'
      and slot_id = 'top'
      and removed_at is null
  ),
  1::bigint,
  'stale removal leaves the progress item active'
);

select is(
  (
    select state_revision
    from public.challenge_progress
    where id = '91600000-0000-4000-8000-000000000001'
  ),
  5::bigint,
  'stale removal leaves the newer canonical revision unchanged'
);

select lives_ok(
  $$
    select public.remove_challenge_item(
      (
        select id
        from public.challenge_progress_items
        where challenge_progress_id =
            '91600000-0000-4000-8000-000000000001'
          and slot_id = 'top'
          and removed_at is null
      ),
      5,
      '92100000-0000-4000-8000-000000000002'
    )
  $$,
  'the same operation can retry after refetch because mismatch was not recorded'
);

select is(
  (
    select state_revision
    from public.challenge_progress
    where id = '91600000-0000-4000-8000-000000000001'
  ),
  6::bigint,
  'refetched removal advances N+1 to N+2 exactly'
);

select is(
  public.remove_challenge_item(
    (
      select id
      from public.challenge_progress_items
      where challenge_progress_id =
          '91600000-0000-4000-8000-000000000001'
        and slot_id = 'top'
        and removal_operation_id =
          '92100000-0000-4000-8000-000000000002'
    ),
    5,
    '92100000-0000-4000-8000-000000000002'
  ),
  public.remove_challenge_item(
    (
      select id
      from public.challenge_progress_items
      where challenge_progress_id =
          '91600000-0000-4000-8000-000000000001'
        and slot_id = 'top'
        and removal_operation_id =
          '92100000-0000-4000-8000-000000000002'
    ),
    5,
    '92100000-0000-4000-8000-000000000002'
  ),
  'removal replay returns the stored canonical result'
);

select throws_ok(
  $$
    select public.remove_challenge_item(
      (
        select id
        from public.challenge_progress_items
        where challenge_progress_id =
            '91600000-0000-4000-8000-000000000001'
          and slot_id = 'top'
          and removal_operation_id =
            '92100000-0000-4000-8000-000000000002'
      ),
      6,
      '92100000-0000-4000-8000-000000000002'
    )
  $$,
  '22023',
  'operation_id conflict',
  'removal operation conflict remains distinct from revision mismatch'
);

select throws_ok(
  $$
    select public.complete_challenge(
      '91600000-0000-4000-8000-000000000001',
      6,
      '92200000-0000-4000-8000-000000000001'
    )
  $$,
  '23514',
  'challenge is not ready to complete',
  'incomplete completion remains rejected after a revision match'
);

select lives_ok(
  $$
    do $block$
    declare
      current_revision bigint;
    begin
      select state_revision
      into strict current_revision
      from public.challenge_progress
      where id = '91600000-0000-4000-8000-000000000001';

      perform public.select_challenge_item(
        '91600000-0000-4000-8000-000000000001',
        'top',
        '91300000-0000-4000-8000-000000000001',
        current_revision,
        '92000000-0000-4000-8000-000000000008'
      );

      select state_revision
      into strict current_revision
      from public.challenge_progress
      where id = '91600000-0000-4000-8000-000000000001';

      perform public.select_challenge_item(
        '91600000-0000-4000-8000-000000000001',
        'shoes',
        '91300000-0000-4000-8000-000000000004',
        current_revision,
        '92000000-0000-4000-8000-000000000009'
      );

      select state_revision
      into strict current_revision
      from public.challenge_progress
      where id = '91600000-0000-4000-8000-000000000001';

      perform public.select_challenge_item(
        '91600000-0000-4000-8000-000000000001',
        'layer_or_accessory',
        '91300000-0000-4000-8000-000000000005',
        current_revision,
        '92000000-0000-4000-8000-000000000010'
      );
    end;
    $block$
  $$,
  'the remaining valid unique products make the Challenge ready'
);

select is(
  (
    select state_revision
    from public.challenge_progress
    where id = '91600000-0000-4000-8000-000000000001'
  ),
  9::bigint,
  'the ready outfit has the expected deterministic revision'
);

select lives_ok(
  $$
    select public.select_challenge_item(
      '91600000-0000-4000-8000-000000000001',
      'top',
      '91300000-0000-4000-8000-000000000002',
      9,
      '92000000-0000-4000-8000-000000000011'
    )
  $$,
  'a valid replacement advances the reviewed ready outfit'
);

select throws_ok(
  $$
    select public.complete_challenge(
      '91600000-0000-4000-8000-000000000001',
      9,
      '92200000-0000-4000-8000-000000000002'
    )
  $$,
  '40001',
  'challenge_revision_mismatch',
  'stale completion cannot complete a newer outfit'
);

select is(
  (
    select count(*)
    from public.challenge_completions
    where challenge_progress_id =
      '91600000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'stale completion creates no completion snapshot'
);

select is(
  (
    select status
    from public.challenge_progress
    where id = '91600000-0000-4000-8000-000000000001'
  ),
  'ready_to_complete'::public.challenge_status,
  'stale completion leaves progress active'
);

select is(
  (
    select state_revision
    from public.challenge_progress
    where id = '91600000-0000-4000-8000-000000000001'
  ),
  10::bigint,
  'stale completion does not increment the newer revision'
);

select lives_ok(
  $$
    select public.complete_challenge(
      '91600000-0000-4000-8000-000000000001',
      10,
      '92200000-0000-4000-8000-000000000002'
    )
  $$,
  'completion retry after refetch succeeds with the same operation ID'
);

select is(
  (
    select state_revision
    from public.challenge_progress
    where id = '91600000-0000-4000-8000-000000000001'
  ),
  11::bigint,
  'successful completion increments the final revision exactly once'
);

select is(
  public.complete_challenge(
    '91600000-0000-4000-8000-000000000001',
    10,
    '92200000-0000-4000-8000-000000000002'
  ),
  public.complete_challenge(
    '91600000-0000-4000-8000-000000000001',
    10,
    '92200000-0000-4000-8000-000000000002'
  ),
  'completion replay returns the stored immutable result'
);

select throws_ok(
  $$
    select public.complete_challenge(
      '91600000-0000-4000-8000-000000000001',
      11,
      '92200000-0000-4000-8000-000000000002'
    )
  $$,
  '22023',
  'operation_id conflict',
  'completion operation conflict remains distinct from revision mismatch'
);

select throws_ok(
  $$
    select public.select_challenge_item(
      '91600000-0000-4000-8000-000000000001',
      'top',
      '91300000-0000-4000-8000-000000000001',
      11,
      '92000000-0000-4000-8000-000000000012'
    )
  $$,
  '23514',
  'challenge progress does not permit selection',
  'completed Challenge selection remains rejected'
);

select throws_ok(
  $$
    select public.remove_challenge_item(
      (
        select id
        from public.challenge_progress_items
        where challenge_progress_id =
            '91600000-0000-4000-8000-000000000001'
          and slot_id = 'top'
          and removed_at is null
      ),
      11,
      '92100000-0000-4000-8000-000000000003'
    )
  $$,
  '23514',
  'challenge progress does not permit removal',
  'completed Challenge removal remains rejected'
);

select is(
  (
    select count(*)
    from public.challenge_completions
    where challenge_progress_id =
      '91600000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'completed Challenge keeps exactly one immutable snapshot'
);

reset role;

set local role authenticated;
set local "request.jwt.claim.sub" =
  '91000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" =
  '{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$
    select public.remove_challenge_item(
      (
        select id
        from public.challenge_progress_items
        where challenge_progress_id =
            '91600000-0000-4000-8000-000000000001'
          and slot_id = 'top'
          and removed_at is null
      ),
      11,
      '92300000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  'owned challenge selection not found',
  'cross-user removal remains rejected'
);

select throws_ok(
  $$
    select public.complete_challenge(
      '91600000-0000-4000-8000-000000000001',
      11,
      '92300000-0000-4000-8000-000000000002'
    )
  $$,
  '42501',
  'owned challenge progress not found',
  'cross-user completion remains rejected'
);

reset role;

select is(
  (
    select state_revision
    from public.challenge_progress
    where id = '91600000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'user B progress remains unchanged by user A operations'
);

select is(
  (
    select count(*)
    from private.mutation_operations
    where result is null
      or completed_at is null
  ),
  0::bigint,
  'failed mismatches roll back and successful operations finalize atomically'
);

select * from finish();

rollback;
