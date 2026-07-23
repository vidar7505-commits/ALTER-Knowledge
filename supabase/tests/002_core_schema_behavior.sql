begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select no_plan();

insert into auth.users (id, is_anonymous)
values
  ('00000000-0000-4000-8000-000000000001', true),
  ('00000000-0000-4000-8000-000000000002', true);

select lives_ok(
  $$
    insert into public.anonymous_users (
      id,
      auth_user_id,
      first_seen_at,
      last_seen_at
    )
    values (
      '10000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
      '2026-07-23 09:00:00+00',
      '2026-07-23 09:00:00+00'
    )
  $$,
  'a canonical anonymous identity can be inserted'
);

insert into public.anonymous_users (
  id,
  auth_user_id,
  first_seen_at,
  last_seen_at
)
values (
  '10000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000002',
  '2026-07-23 09:00:00+00',
  '2026-07-23 09:00:00+00'
);

select throws_like(
  $$
    update public.anonymous_users
    set auth_user_id = '00000000-0000-4000-8000-000000000002'
    where id = '10000000-0000-4000-8000-000000000001'
  $$,
  '%anonymous_users.auth_user_id is immutable%',
  'the auth identity mapping cannot be changed'
);

insert into public.onboarding_states (anonymous_user_id)
values ('10000000-0000-4000-8000-000000000001');

select lives_ok(
  $$
    update public.onboarding_states
    set
      status = 'in_progress',
      started_at = '2026-07-23 09:01:00+00'
    where anonymous_user_id = '10000000-0000-4000-8000-000000000001'
  $$,
  'onboarding can move from not started to in progress'
);

select throws_like(
  $$
    update public.onboarding_states
    set
      status = 'completed_with_preferences',
      onboarding_version = 'onboarding-style-v1',
      completion_operation_id = '11000000-0000-4000-8000-000000000001',
      completed_at = '2026-07-23 09:02:00+00'
    where anonymous_user_id = '10000000-0000-4000-8000-000000000001'
  $$,
  '%onboarding_states_preferences_check%',
  'completed-with-preferences requires at least one preference'
);

select lives_ok(
  $$
    update public.onboarding_states
    set
      status = 'completed_with_preferences',
      onboarding_version = 'onboarding-style-v1',
      preference_set_version = 'onboarding-style-v1',
      preference_ids = array['minimal'],
      completion_operation_id = '11000000-0000-4000-8000-000000000001',
      completed_at = '2026-07-23 09:02:00+00'
    where anonymous_user_id = '10000000-0000-4000-8000-000000000001'
  $$,
  'valid onboarding completion is accepted'
);

select throws_like(
  $$
    update public.onboarding_states
    set status = 'in_progress'
    where anonymous_user_id = '10000000-0000-4000-8000-000000000001'
  $$,
  '%invalid onboarding status transition%',
  'a terminal onboarding state cannot return to in progress'
);

select lives_ok(
  $$
    insert into public.sessions (
      id,
      anonymous_user_id,
      session_number,
      started_at,
      last_activity_at,
      is_return_session,
      entry_route,
      app_version,
      platform,
      environment
    )
    values (
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      1,
      '2026-07-23 09:00:00+00',
      '2026-07-23 09:05:00+00',
      false,
      '/discover',
      'p04-test',
      'web_desktop',
      'local'
    )
  $$,
  'a valid first session can be inserted'
);

select throws_like(
  $$
    insert into public.sessions (
      id,
      anonymous_user_id,
      session_number,
      started_at,
      last_activity_at,
      is_return_session,
      app_version,
      platform,
      environment
    )
    values (
      '20000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000002',
      1,
      '2026-07-23 10:00:00+00',
      '2026-07-23 10:01:00+00',
      true,
      'p04-test',
      'web_mobile',
      'local'
    )
  $$,
  '%sessions_return_number_check%',
  'session one cannot be classified as a return session'
);

select lives_ok(
  $$
    insert into public.products (
      id,
      external_source,
      external_id,
      name,
      category,
      image_urls,
      price_amount,
      price_currency,
      slot_eligibility,
      catalog_version
    )
    values
      (
        '30000000-0000-4000-8000-000000000001',
        'fixture',
        'top-1',
        'Test Top',
        'top',
        array['https://example.invalid/top.jpg'],
        10.00,
        'USD',
        array['top'],
        'catalog-test-v1'
      ),
      (
        '30000000-0000-4000-8000-000000000002',
        'fixture',
        'bottom-1',
        'Test Bottom',
        'bottom',
        array['https://example.invalid/bottom.jpg'],
        null,
        null,
        array['bottom'],
        'catalog-test-v1'
      )
  $$,
  'valid canonical products can be inserted without seed data'
);

select throws_like(
  $$
    insert into public.products (
      name,
      category,
      price_amount,
      price_currency,
      catalog_version
    )
    values ('Invalid Price', 'top', 10.00, 'usd', 'catalog-test-v1')
  $$,
  '%products_price_currency_check%',
  'lowercase currency codes are rejected'
);

insert into public.wardrobes (
  id,
  anonymous_user_id
)
values (
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001'
);

select lives_ok(
  $$
    insert into public.saved_products (
      id,
      wardrobe_id,
      anonymous_user_id,
      product_id,
      source_surface,
      save_operation_id
    )
    values (
      '41000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      'discover',
      '42000000-0000-4000-8000-000000000001'
    )
  $$,
  'a valid saved product can be inserted'
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
      '40000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      'wardrobe',
      '42000000-0000-4000-8000-000000000002'
    )
  $$,
  '%saved_products_active_unique%',
  'one identity cannot have duplicate active saves for one product'
);

select lives_ok(
  $$
    update public.saved_products
    set
      removed_at = '2026-07-23 09:10:00+00',
      remove_operation_id = '42000000-0000-4000-8000-000000000003'
    where id = '41000000-0000-4000-8000-000000000001'
  $$,
  'a saved product can be soft removed with its operation ID'
);

select lives_ok(
  $$
    insert into public.saved_products (
      wardrobe_id,
      anonymous_user_id,
      product_id,
      source_surface,
      save_operation_id
    )
    values (
      '40000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      'wardrobe',
      '42000000-0000-4000-8000-000000000004'
    )
  $$,
  'a removed product can be saved again as a new history row'
);

select throws_like(
  $$
    insert into public.saved_products (
      wardrobe_id,
      anonymous_user_id,
      product_id,
      removed_at,
      source_surface,
      save_operation_id
    )
    values (
      '40000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002',
      '2026-07-23 09:10:00+00',
      'wardrobe',
      '42000000-0000-4000-8000-000000000005'
    )
  $$,
  '%saved_products_removal_pair_check%',
  'removed saved-product history requires a removal operation ID'
);

select lives_ok(
  $$
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
      '50000000-0000-4000-8000-000000000001',
      'after-dark',
      'challenge-evening-v1',
      'After Dark',
      'Build a look for an evening out.',
      '[{"slot_id":"top"},{"slot_id":"bottom"}]'::jsonb,
      '{"unique_products":true}'::jsonb,
      '2026-07-23 00:00:00+00',
      true
    )
  $$,
  'a valid challenge definition can be inserted'
);

select throws_like(
  $$
    insert into public.challenges (
      challenge_key,
      version,
      title,
      context_copy,
      required_slots,
      completion_rules,
      active_from
    )
    values (
      'invalid',
      'invalid-v1',
      'Invalid',
      'Invalid.',
      '[]'::jsonb,
      '{}'::jsonb,
      '2026-07-23 00:00:00+00'
    )
  $$,
  '%challenges_required_slots_check%',
  'a challenge must define at least one slot'
);

insert into public.challenge_progress (
  id,
  anonymous_user_id,
  challenge_id,
  start_operation_id
)
values (
  '60000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001'
);

select throws_like(
  $$
    update public.challenge_progress
    set
      status = 'ready_to_complete',
      started_at = '2026-07-23 09:15:00+00'
    where id = '60000000-0000-4000-8000-000000000001'
  $$,
  '%invalid challenge status transition%',
  'challenge progress cannot skip directly to ready'
);

select lives_ok(
  $$
    update public.challenge_progress
    set
      status = 'in_progress',
      started_at = '2026-07-23 09:15:00+00',
      last_interacted_at = '2026-07-23 09:15:00+00'
    where id = '60000000-0000-4000-8000-000000000001'
  $$,
  'challenge progress can start'
);

insert into public.challenge_progress_items (
  challenge_progress_id,
  slot_id,
  product_id,
  selection_operation_id
)
values (
  '60000000-0000-4000-8000-000000000001',
  'top',
  '30000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000001'
);

select throws_like(
  $$
    insert into public.challenge_progress_items (
      challenge_progress_id,
      slot_id,
      product_id,
      selection_operation_id
    )
    values (
      '60000000-0000-4000-8000-000000000001',
      'top',
      '30000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000002'
    )
  $$,
  '%challenge_active_slot_unique%',
  'one active product is allowed per challenge slot'
);

select throws_like(
  $$
    insert into public.challenge_progress_items (
      challenge_progress_id,
      slot_id,
      product_id,
      selection_operation_id
    )
    values (
      '60000000-0000-4000-8000-000000000001',
      'bottom',
      '30000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000003'
    )
  $$,
  '%challenge_active_product_unique%',
  'one product cannot occupy two active challenge slots'
);

insert into public.challenge_progress_items (
  challenge_progress_id,
  slot_id,
  product_id,
  selection_operation_id
)
values (
  '60000000-0000-4000-8000-000000000001',
  'bottom',
  '30000000-0000-4000-8000-000000000002',
  '62000000-0000-4000-8000-000000000004'
);

update public.challenge_progress
set
  status = 'ready_to_complete',
  last_interacted_at = '2026-07-23 09:20:00+00'
where id = '60000000-0000-4000-8000-000000000001';

update public.challenge_progress
set
  status = 'completed',
  last_interacted_at = '2026-07-23 09:21:00+00'
where id = '60000000-0000-4000-8000-000000000001';

select lives_ok(
  $$
    insert into public.challenge_completions (
      id,
      anonymous_user_id,
      challenge_id,
      challenge_progress_id,
      completion_operation_id,
      selected_products_snapshot,
      challenge_snapshot,
      completed_at
    )
    values (
      '63000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000001',
      '{"top":{"product_id":"30000000-0000-4000-8000-000000000001"},"bottom":{"product_id":"30000000-0000-4000-8000-000000000002"}}'::jsonb,
      '{"version":"challenge-evening-v1"}'::jsonb,
      '2026-07-23 09:21:00+00'
    )
  $$,
  'a valid immutable completion snapshot record can be inserted'
);

select lives_ok(
  $$
    insert into public.feed_instances (
      id,
      anonymous_user_id,
      session_id,
      feed_order_version,
      max_loaded_position,
      max_qualified_position
    )
    values (
      '70000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'baseline-v1',
      2,
      1
    )
  $$,
  'a valid feed instance can be inserted'
);

insert into public.feed_instance_products (
  feed_instance_id,
  product_id,
  position,
  batch_number
)
values
  (
    '70000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    1,
    1
  ),
  (
    '70000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    2,
    1
  );

select throws_like(
  $$
    update public.feed_instances
    set max_qualified_position = 3
    where id = '70000000-0000-4000-8000-000000000001'
  $$,
  '%feed_instances_max_qualified_position_check%',
  'qualified feed depth cannot exceed loaded depth'
);

select lives_ok(
  $$
    insert into public.events (
      event_id,
      event_name,
      event_version,
      occurred_at,
      received_at,
      anonymous_user_id,
      session_id,
      release_id,
      app_version,
      platform,
      environment,
      surface,
      source_surface,
      client_sequence,
      properties,
      context
    )
    values (
      '80000000-0000-4000-8000-000000000001',
      'product_impression',
      1,
      '2026-07-23 09:04:00+00',
      '2026-07-23 09:04:01+00',
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'LR-001',
      'p04-test',
      'web_desktop',
      'local',
      'discover',
      'discover',
      1,
      '{"product_id":"30000000-0000-4000-8000-000000000001"}'::jsonb,
      '{"client_sequence":1}'::jsonb
    )
  $$,
  'a valid canonical event can be inserted'
);

select throws_like(
  $$
    insert into public.events (
      event_id,
      event_name,
      event_version,
      occurred_at,
      received_at,
      anonymous_user_id,
      session_id,
      release_id,
      app_version,
      platform,
      environment,
      surface,
      client_sequence
    )
    values (
      '80000000-0000-4000-8000-000000000002',
      'session_started',
      1,
      '2026-07-23 09:04:00+00',
      '2026-07-23 09:04:01+00',
      '10000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000001',
      'LR-001',
      'p04-test',
      'web_mobile',
      'local',
      'app_boot',
      1
    )
  $$,
  '%events_session_owner_fkey%',
  'event identity must match its session identity'
);

select throws_like(
  $$
    insert into public.events (
      event_id,
      event_name,
      event_version,
      occurred_at,
      received_at,
      anonymous_user_id,
      session_id,
      release_id,
      app_version,
      platform,
      environment,
      surface,
      client_sequence
    )
    values (
      '80000000-0000-4000-8000-000000000003',
      'discover_viewed',
      1,
      '2026-07-23 09:04:00+00',
      '2026-07-23 09:04:01+00',
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'LR-999',
      'p04-test',
      'web_mobile',
      'local',
      'discover',
      2
    )
  $$,
  '%events_release_id_check%',
  'events outside LR-001 are rejected by the release constraint'
);

select throws_like(
  $$
    insert into public.event_quarantine (
      raw_payload,
      error_codes,
      environment
    )
    values ('{}'::jsonb, '{}'::text[], 'local')
  $$,
  '%event_quarantine_error_codes_check%',
  'quarantine rows require at least one error code'
);

select * from finish();

rollback;
