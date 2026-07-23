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
        'ensure_anonymous_identity',
        'complete_onboarding',
        'skip_onboarding',
        'save_product',
        'remove_product',
        'start_challenge',
        'select_challenge_item',
        'remove_challenge_item',
        'complete_challenge'
      )
      and pg_proc.prosecdef
      and 'search_path=""' = any(pg_proc.proconfig)
      and pg_get_userbyid(pg_proc.proowner) = 'postgres'
  ),
  9::bigint,
  'every client RPC is security definer, postgres-owned, and fixes an empty search path'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname in (
        'current_anonymous_user_id',
        'claim_mutation_operation'
      )
      and not pg_proc.prosecdef
      and 'search_path=""' = any(pg_proc.proconfig)
      and pg_get_userbyid(pg_proc.proowner) = 'postgres'
  ),
  2::bigint,
  'private helpers are security invoker, postgres-owned, and fix an empty search path'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'ensure_anonymous_identity',
        'complete_onboarding',
        'skip_onboarding',
        'save_product',
        'remove_product',
        'start_challenge',
        'select_challenge_item',
        'remove_challenge_item',
        'complete_challenge'
      )
      and has_function_privilege(
        'authenticated',
        pg_proc.oid,
        'EXECUTE'
      )
      and not has_function_privilege('anon', pg_proc.oid, 'EXECUTE')
  ),
  9::bigint,
  'only authenticated clients can execute the nine intended client RPCs'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and has_function_privilege(
        'authenticated',
        pg_proc.oid,
        'EXECUTE'
      )
  ),
  9::bigint,
  'authenticated has no public-schema function execution beyond intended RPCs'
);

select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE')
  and not has_schema_privilege('anon', 'private', 'USAGE'),
  'the private operation ledger and helper schema are inaccessible to clients'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'complete_onboarding',
        'skip_onboarding',
        'save_product',
        'remove_product',
        'start_challenge',
        'select_challenge_item',
        'remove_challenge_item',
        'complete_challenge'
      )
      and pg_proc.proargnames
        && array['anonymous_user_id', 'user_id', 'wardrobe_id']::text[]
  ),
  'mutation RPC signatures expose no caller-controlled ownership argument'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname in ('public', 'private')
      and pg_proc.proname in (
        'current_anonymous_user_id',
        'claim_mutation_operation',
        'complete_onboarding',
        'skip_onboarding',
        'save_product',
        'remove_product',
        'start_challenge',
        'select_challenge_item',
        'remove_challenge_item',
        'complete_challenge'
      )
      and lower(pg_proc.prosrc) ~ '(^|[^a-z])execute([^a-z]|$)'
  ),
  'P06 functions use no dynamic SQL'
);

insert into auth.users (id, is_anonymous)
values
  ('81000000-0000-4000-8000-000000000001', true),
  ('81000000-0000-4000-8000-000000000002', true);

insert into public.anonymous_users (id, auth_user_id)
values
  (
    '81100000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001'
  ),
  (
    '81100000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000002'
  );

insert into public.wardrobes (id, anonymous_user_id)
values
  (
    '81200000-0000-4000-8000-000000000001',
    '81100000-0000-4000-8000-000000000001'
  ),
  (
    '81200000-0000-4000-8000-000000000002',
    '81100000-0000-4000-8000-000000000002'
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
    '81300000-0000-4000-8000-000000000001',
    'p06-rpc',
    'top',
    'Test Top',
    'Fixture',
    'top',
    array['https://example.invalid/top.jpg'],
    array['top'],
    'p06-rpc-v1',
    true
  ),
  (
    '81300000-0000-4000-8000-000000000002',
    'p06-rpc',
    'bottom',
    'Test Bottom',
    'Fixture',
    'bottom',
    array['https://example.invalid/bottom.jpg'],
    array['bottom'],
    'p06-rpc-v1',
    true
  ),
  (
    '81300000-0000-4000-8000-000000000003',
    'p06-rpc',
    'shoes',
    'Test Shoes',
    'Fixture',
    'shoes',
    array['https://example.invalid/shoes.jpg'],
    array['shoes'],
    'p06-rpc-v1',
    true
  ),
  (
    '81300000-0000-4000-8000-000000000004',
    'p06-rpc',
    'layer',
    'Test Layer',
    'Fixture',
    'layer',
    array['https://example.invalid/layer.jpg'],
    array['layer_or_accessory'],
    'p06-rpc-v1',
    true
  ),
  (
    '81300000-0000-4000-8000-000000000005',
    'p06-rpc',
    'unsaved-shoes',
    'Unsaved Shoes',
    'Fixture',
    'shoes',
    array['https://example.invalid/unsaved.jpg'],
    array['shoes'],
    'p06-rpc-v1',
    true
  ),
  (
    '81300000-0000-4000-8000-000000000006',
    'p06-rpc',
    'inactive-top',
    'Inactive Top',
    'Fixture',
    'top',
    array['https://example.invalid/inactive.jpg'],
    array['top'],
    'p06-rpc-v1',
    false
  ),
  (
    '81300000-0000-4000-8000-000000000007',
    'p06-rpc',
    'isolation-accessory',
    'Isolation Accessory',
    'Fixture',
    'accessory',
    array['https://example.invalid/accessory.jpg'],
    array['layer_or_accessory'],
    'p06-rpc-v1',
    true
  );

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
  '81400000-0000-4000-8000-000000000001',
  'after-dark-p06',
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
  now() - interval '1 hour',
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
values (
  '81500000-0000-4000-8000-000000000001',
  '81200000-0000-4000-8000-000000000001',
  '81100000-0000-4000-8000-000000000001',
  '81300000-0000-4000-8000-000000000007',
  'discover',
  '81510000-0000-4000-8000-000000000001'
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
values (
  '81600000-0000-4000-8000-000000000001',
  '81100000-0000-4000-8000-000000000001',
  '81400000-0000-4000-8000-000000000001',
  'in_progress',
  '81610000-0000-4000-8000-000000000001',
  now(),
  now(),
  1
);

select throws_ok(
  $$
    select public.save_product(
      '81300000-0000-4000-8000-000000000001',
      '82000000-0000-4000-8000-000000000001',
      'discover'
    )
  $$,
  '28000',
  'anonymous authentication required',
  'RPC mutation rejects an unauthenticated call'
);

set local role authenticated;
set local "request.jwt.claim.sub" =
  '81000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" =
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$
    select public.save_product(
      '81300000-0000-4000-8000-000000000001',
      '00000000-0000-0000-0000-000000000000',
      'discover'
    )
  $$,
  '22023',
  'a non-nil operation_id is required',
  'mutation RPCs reject a nil operation ID'
);

select lives_ok(
  $$
    select public.complete_onboarding(
      '82100000-0000-4000-8000-000000000001',
      'onboarding-style-v1',
      'onboarding-style-v1',
      array['minimal', 'going_out']
    )
  $$,
  'the owner can complete onboarding'
);

select is(
  public.complete_onboarding(
    '82100000-0000-4000-8000-000000000001',
    'onboarding-style-v1',
    'onboarding-style-v1',
    array['minimal', 'going_out']
  ),
  public.complete_onboarding(
    '82100000-0000-4000-8000-000000000001',
    'onboarding-style-v1',
    'onboarding-style-v1',
    array['going_out', 'minimal']
  ),
  'onboarding completion replay returns the canonical result'
);

select throws_ok(
  $$
    select public.complete_onboarding(
      '82100000-0000-4000-8000-000000000001',
      'onboarding-style-v2',
      'onboarding-style-v2',
      array['street']
    )
  $$,
  '22023',
  'operation_id conflict',
  'conflicting onboarding operation reuse fails deterministically'
);

select throws_ok(
  $$
    select public.skip_onboarding(
      '82100000-0000-4000-8000-000000000002',
      'onboarding-style-v1'
    )
  $$,
  '23514',
  'onboarding is already complete',
  'an invalid terminal onboarding transition fails'
);

select lives_ok(
  $$
    select public.save_product(
      '81300000-0000-4000-8000-000000000001',
      '82200000-0000-4000-8000-000000000001',
      'discover'
    )
  $$,
  'the owner can save an active product'
);

select is(
  public.save_product(
    '81300000-0000-4000-8000-000000000001',
    '82200000-0000-4000-8000-000000000001',
    'discover'
  ),
  public.save_product(
    '81300000-0000-4000-8000-000000000001',
    '82200000-0000-4000-8000-000000000001',
    'discover'
  ),
  'save replay returns the same canonical result'
);

select lives_ok(
  $$
    select public.save_product(
      '81300000-0000-4000-8000-000000000001',
      '82200000-0000-4000-8000-000000000002',
      'product_detail'
    )
  $$,
  'a new logical save request recovers the existing active save'
);

select is(
  (
    select count(*)
    from public.saved_products
    where product_id = '81300000-0000-4000-8000-000000000001'
      and removed_at is null
  ),
  1::bigint,
  'duplicate active saves never create another row'
);

select throws_ok(
  $$
    select public.save_product(
      '81300000-0000-4000-8000-000000000002',
      '82200000-0000-4000-8000-000000000001',
      'discover'
    )
  $$,
  '22023',
  'operation_id conflict',
  'save operation IDs cannot be reused for another product'
);

select throws_ok(
  $$
    select public.save_product(
      '81300000-0000-4000-8000-000000000006',
      '82200000-0000-4000-8000-000000000003',
      'discover'
    )
  $$,
  '22023',
  'active product not found',
  'inactive products cannot be saved'
);

select lives_ok(
  $$
    do $block$
    begin
      perform public.save_product(
        '81300000-0000-4000-8000-000000000002',
        '82200000-0000-4000-8000-000000000004',
        'discover'
      );
      perform public.save_product(
        '81300000-0000-4000-8000-000000000003',
        '82200000-0000-4000-8000-000000000005',
        'discover'
      );
      perform public.save_product(
        '81300000-0000-4000-8000-000000000004',
        '82200000-0000-4000-8000-000000000006',
        'discover'
      );
    end;
    $block$
  $$,
  'the owner can save the remaining eligible Challenge products'
);

select lives_ok(
  $$
    select public.start_challenge(
      '81400000-0000-4000-8000-000000000001',
      '82300000-0000-4000-8000-000000000001'
    )
  $$,
  'the owner can start the active Challenge'
);

select is(
  public.start_challenge(
    '81400000-0000-4000-8000-000000000001',
    '82300000-0000-4000-8000-000000000001'
  ),
  public.start_challenge(
    '81400000-0000-4000-8000-000000000001',
    '82300000-0000-4000-8000-000000000001'
  ),
  'Challenge start is idempotent'
);

select lives_ok(
  $$
    select public.start_challenge(
      '81400000-0000-4000-8000-000000000001',
      '82300000-0000-4000-8000-000000000002'
    )
  $$,
  'a concurrent-style start operation converges on existing progress'
);

select is(
  (
    select count(*)
    from public.challenge_progress
    where challenge_id = '81400000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'start convergence preserves one progress row per owner and Challenge'
);

select throws_ok(
  $$
    select public.select_challenge_item(
      (
        select id
        from public.challenge_progress
        where challenge_id = '81400000-0000-4000-8000-000000000001'
      ),
      'not_a_slot',
      '81300000-0000-4000-8000-000000000001',
      '82400000-0000-4000-8000-000000000001'
    )
  $$,
  '22023',
  'slot is not required by this challenge',
  'Challenge selection rejects an unknown slot'
);

select throws_ok(
  $$
    select public.select_challenge_item(
      (
        select id
        from public.challenge_progress
        where challenge_id = '81400000-0000-4000-8000-000000000001'
      ),
      'shoes',
      '81300000-0000-4000-8000-000000000002',
      '82400000-0000-4000-8000-000000000002'
    )
  $$,
  '22023',
  'product is not active and eligible for this slot',
  'Challenge selection enforces product slot eligibility'
);

select throws_ok(
  $$
    select public.select_challenge_item(
      (
        select id
        from public.challenge_progress
        where challenge_id = '81400000-0000-4000-8000-000000000001'
      ),
      'shoes',
      '81300000-0000-4000-8000-000000000005',
      '82400000-0000-4000-8000-000000000003'
    )
  $$,
  '42501',
  'product is not in the caller Wardrobe',
  'Challenge selection requires an active caller-owned save'
);

select lives_ok(
  $$
    select public.select_challenge_item(
      (
        select id
        from public.challenge_progress
        where challenge_id = '81400000-0000-4000-8000-000000000001'
      ),
      'top',
      '81300000-0000-4000-8000-000000000001',
      '82400000-0000-4000-8000-000000000004'
    )
  $$,
  'the owner can select an eligible saved product'
);

select is(
  public.select_challenge_item(
    (
      select id
      from public.challenge_progress
      where challenge_id = '81400000-0000-4000-8000-000000000001'
    ),
    'top',
    '81300000-0000-4000-8000-000000000001',
    '82400000-0000-4000-8000-000000000004'
  ),
  public.select_challenge_item(
    (
      select id
      from public.challenge_progress
      where challenge_id = '81400000-0000-4000-8000-000000000001'
    ),
    'top',
    '81300000-0000-4000-8000-000000000001',
    '82400000-0000-4000-8000-000000000004'
  ),
  'Challenge selection replay is idempotent'
);

select lives_ok(
  $$
    select public.select_challenge_item(
      (
        select id
        from public.challenge_progress
        where challenge_id = '81400000-0000-4000-8000-000000000001'
      ),
      'top',
      '81300000-0000-4000-8000-000000000001',
      '82400000-0000-4000-8000-000000000012'
    )
  $$,
  'a concurrent-style duplicate selection converges on the active item'
);

select is(
  (
    select count(*)
    from public.challenge_progress_items
    where slot_id = 'top'
      and removed_at is null
  ),
  1::bigint,
  'selection convergence preserves one active item for the slot'
);

select throws_ok(
  $$
    select public.complete_challenge(
      (
        select id
        from public.challenge_progress
        where challenge_id = '81400000-0000-4000-8000-000000000001'
      ),
      '82500000-0000-4000-8000-000000000001'
    )
  $$,
  '23514',
  'challenge is not ready to complete',
  'Challenge completion fails until all required slots are valid'
);

select lives_ok(
  $$
    select public.remove_challenge_item(
      (
        select id
        from public.challenge_progress_items
        where slot_id = 'top'
          and removed_at is null
      ),
      '82400000-0000-4000-8000-000000000005'
    )
  $$,
  'the owner can remove an active Challenge selection'
);

select is(
  public.remove_challenge_item(
    (
      select id
      from public.challenge_progress_items
      where slot_id = 'top'
      order by selected_at desc
      limit 1
    ),
    '82400000-0000-4000-8000-000000000005'
  ),
  public.remove_challenge_item(
    (
      select id
      from public.challenge_progress_items
      where slot_id = 'top'
      order by selected_at desc
      limit 1
    ),
    '82400000-0000-4000-8000-000000000005'
  ),
  'Challenge removal replay returns the canonical result'
);

select lives_ok(
  $$
    do $block$
    declare
      progress_id uuid;
    begin
      select id
      into strict progress_id
      from public.challenge_progress
      where challenge_id = '81400000-0000-4000-8000-000000000001';

      perform public.select_challenge_item(
        progress_id,
        'top',
        '81300000-0000-4000-8000-000000000001',
        '82400000-0000-4000-8000-000000000006'
      );
      perform public.select_challenge_item(
        progress_id,
        'bottom',
        '81300000-0000-4000-8000-000000000002',
        '82400000-0000-4000-8000-000000000007'
      );
      perform public.select_challenge_item(
        progress_id,
        'shoes',
        '81300000-0000-4000-8000-000000000003',
        '82400000-0000-4000-8000-000000000008'
      );
      perform public.select_challenge_item(
        progress_id,
        'layer_or_accessory',
        '81300000-0000-4000-8000-000000000004',
        '82400000-0000-4000-8000-000000000009'
      );
    end;
    $block$
  $$,
  'four valid unique saved products fill all required slots'
);

select is(
  (
    select status
    from public.challenge_progress
    where challenge_id = '81400000-0000-4000-8000-000000000001'
  ),
  'ready_to_complete'::public.challenge_status,
  'valid selections transition progress to ready_to_complete'
);

select lives_ok(
  $$
    select public.remove_product(
      (
        select id
        from public.saved_products
        where product_id = '81300000-0000-4000-8000-000000000001'
          and removed_at is null
      ),
      '82600000-0000-4000-8000-000000000010'
    )
  $$,
  'Wardrobe removal atomically clears an incomplete Challenge dependency'
);

select is(
  (
    select count(*)
    from public.challenge_progress_items
    where slot_id = 'top'
      and removed_at is null
  ),
  0::bigint,
  'the dependent active Challenge selection is soft removed'
);

select is(
  (
    select status
    from public.challenge_progress
    where challenge_id = '81400000-0000-4000-8000-000000000001'
  ),
  'in_progress'::public.challenge_status,
  'dependent Wardrobe removal returns Challenge progress to in_progress'
);

select lives_ok(
  $$
    do $block$
    declare
      progress_id uuid;
    begin
      perform public.save_product(
        '81300000-0000-4000-8000-000000000001',
        '82200000-0000-4000-8000-000000000010',
        'challenge'
      );

      select id
      into strict progress_id
      from public.challenge_progress
      where challenge_id = '81400000-0000-4000-8000-000000000001';

      perform public.select_challenge_item(
        progress_id,
        'top',
        '81300000-0000-4000-8000-000000000001',
        '82400000-0000-4000-8000-000000000011'
      );
    end;
    $block$
  $$,
  'a removed product can be re-saved and selected as new history'
);

select throws_ok(
  $$
    select public.select_challenge_item(
      (
        select id
        from public.challenge_progress
        where challenge_id = '81400000-0000-4000-8000-000000000001'
      ),
      'shoes',
      '81300000-0000-4000-8000-000000000001',
      '82400000-0000-4000-8000-000000000010'
    )
  $$,
  '22023',
  'product is not active and eligible for this slot',
  'a product cannot bypass slot eligibility during replacement'
);

select lives_ok(
  $$
    select public.complete_challenge(
      (
        select id
        from public.challenge_progress
        where challenge_id = '81400000-0000-4000-8000-000000000001'
      ),
      '82500000-0000-4000-8000-000000000002'
    )
  $$,
  'the owner can complete a canonically valid Challenge'
);

select is(
  public.complete_challenge(
    (
      select id
      from public.challenge_progress
      where challenge_id = '81400000-0000-4000-8000-000000000001'
    ),
    '82500000-0000-4000-8000-000000000002'
  ),
  public.complete_challenge(
    (
      select id
      from public.challenge_progress
      where challenge_id = '81400000-0000-4000-8000-000000000001'
    ),
    '82500000-0000-4000-8000-000000000002'
  ),
  'Challenge completion replay returns the same immutable completion'
);

select lives_ok(
  $$
    select public.complete_challenge(
      (
        select id
        from public.challenge_progress
        where challenge_id = '81400000-0000-4000-8000-000000000001'
      ),
      '82500000-0000-4000-8000-000000000003'
    )
  $$,
  'a concurrent-style completion request recovers the existing completion'
);

select is(
  (select count(*) from public.challenge_completions),
  1::bigint,
  'completion convergence preserves one immutable completion'
);

select is(
  (
    select jsonb_array_length(
      selected_products_snapshot -> 'items'
    )
    from public.challenge_completions
  ),
  4,
  'the completion stores four immutable selected-product snapshots'
);

select lives_ok(
  $$
    select public.remove_product(
      (
        select id
        from public.saved_products
        where product_id = '81300000-0000-4000-8000-000000000001'
          and removed_at is null
      ),
      '82600000-0000-4000-8000-000000000001'
    )
  $$,
  'the owner can remove an active saved product'
);

select is(
  public.remove_product(
    (
      select id
      from public.saved_products
      where product_id = '81300000-0000-4000-8000-000000000001'
      order by saved_at desc
      limit 1
    ),
    '82600000-0000-4000-8000-000000000001'
  ),
  public.remove_product(
    (
      select id
      from public.saved_products
      where product_id = '81300000-0000-4000-8000-000000000001'
      order by saved_at desc
      limit 1
    ),
    '82600000-0000-4000-8000-000000000001'
  ),
  'saved-product removal replay is idempotent'
);

select is(
  (
    select jsonb_array_length(
      selected_products_snapshot -> 'items'
    )
    from public.challenge_completions
  ),
  4,
  'Wardrobe removal does not rewrite completed history'
);

reset role;

set local role authenticated;
set local "request.jwt.claim.sub" =
  '81000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" =
  '{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok(
  $$
    select public.skip_onboarding(
      '82700000-0000-4000-8000-000000000001',
      'onboarding-style-v1'
    )
  $$,
  'user B can persist their own onboarding skip'
);

select is(
  public.skip_onboarding(
    '82700000-0000-4000-8000-000000000001',
    'onboarding-style-v1'
  ),
  public.skip_onboarding(
    '82700000-0000-4000-8000-000000000001',
    'onboarding-style-v1'
  ),
  'onboarding skip replay is idempotent'
);

select throws_ok(
  $$
    select public.remove_product(
      '81500000-0000-4000-8000-000000000001',
      '82700000-0000-4000-8000-000000000002'
    )
  $$,
  '42501',
  'owned saved product not found',
  'user B cannot remove user A saved state'
);

select throws_ok(
  $$
    select public.select_challenge_item(
      '81600000-0000-4000-8000-000000000001',
      'top',
      '81300000-0000-4000-8000-000000000001',
      '82700000-0000-4000-8000-000000000003'
    )
  $$,
  '42501',
  'owned challenge progress not found',
  'user B cannot mutate user A Challenge progress'
);

reset role;

select is(
  (
    select count(*)
    from private.mutation_operations
    where result is null
      or completed_at is null
  ),
  0::bigint,
  'successful operation records are finalized atomically'
);

select * from finish();

rollback;
