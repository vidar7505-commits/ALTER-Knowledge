begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select no_plan();

select ok(
  exists (
    select 1
    from pg_catalog.pg_extension
    where extname = 'pgcrypto'
  ),
  'pgcrypto extension exists'
);

select has_schema('analytics', 'analytics schema exists');

with expected_types(type_name) as (
  values
    ('onboarding_status'),
    ('challenge_status'),
    ('app_environment')
)
select ok(
  to_regtype(format('public.%I', type_name)) is not null,
  format('type public.%I exists', type_name)
)
from expected_types;

with expected_tables(table_name) as (
  values
    ('anonymous_users'),
    ('users'),
    ('onboarding_states'),
    ('sessions'),
    ('products'),
    ('wardrobes'),
    ('saved_products'),
    ('challenges'),
    ('challenge_progress'),
    ('challenge_progress_items'),
    ('challenge_completions'),
    ('feed_instances'),
    ('feed_instance_products'),
    ('events'),
    ('event_quarantine')
)
select has_table('public', table_name, format('table public.%I exists', table_name))
from expected_tables;

with expected_columns(table_name, column_name, udt_name) as (
  values
    ('anonymous_users', 'id', 'uuid'),
    ('anonymous_users', 'auth_user_id', 'uuid'),
    ('anonymous_users', 'first_seen_at', 'timestamptz'),
    ('anonymous_users', 'last_seen_at', 'timestamptz'),
    ('anonymous_users', 'last_meaningful_destination', 'text'),
    ('anonymous_users', 'state_revision', 'int8'),
    ('anonymous_users', 'merged_into_user_id', 'uuid'),
    ('anonymous_users', 'is_test', 'bool'),
    ('anonymous_users', 'preview_namespace', 'text'),
    ('anonymous_users', 'created_at', 'timestamptz'),
    ('anonymous_users', 'updated_at', 'timestamptz'),
    ('users', 'id', 'uuid'),
    ('users', 'primary_anonymous_user_id', 'uuid'),
    ('users', 'created_at', 'timestamptz'),
    ('users', 'updated_at', 'timestamptz'),
    ('users', 'is_test', 'bool'),
    ('onboarding_states', 'anonymous_user_id', 'uuid'),
    ('onboarding_states', 'user_id', 'uuid'),
    ('onboarding_states', 'status', 'onboarding_status'),
    ('onboarding_states', 'onboarding_version', 'text'),
    ('onboarding_states', 'preference_set_version', 'text'),
    ('onboarding_states', 'preference_ids', '_text'),
    ('onboarding_states', 'completion_operation_id', 'uuid'),
    ('onboarding_states', 'skip_operation_id', 'uuid'),
    ('onboarding_states', 'started_at', 'timestamptz'),
    ('onboarding_states', 'completed_at', 'timestamptz'),
    ('onboarding_states', 'updated_at', 'timestamptz'),
    ('onboarding_states', 'state_revision', 'int8'),
    ('sessions', 'id', 'uuid'),
    ('sessions', 'anonymous_user_id', 'uuid'),
    ('sessions', 'user_id', 'uuid'),
    ('sessions', 'session_number', 'int4'),
    ('sessions', 'started_at', 'timestamptz'),
    ('sessions', 'last_activity_at', 'timestamptz'),
    ('sessions', 'ended_at', 'timestamptz'),
    ('sessions', 'is_return_session', 'bool'),
    ('sessions', 'entry_route', 'text'),
    ('sessions', 'traffic_source', 'text'),
    ('sessions', 'cohort_id', 'text'),
    ('sessions', 'app_version', 'text'),
    ('sessions', 'platform', 'text'),
    ('sessions', 'environment', 'app_environment'),
    ('sessions', 'is_test', 'bool'),
    ('sessions', 'preview_namespace', 'text'),
    ('sessions', 'recovery_status', 'text'),
    ('sessions', 'created_at', 'timestamptz'),
    ('products', 'id', 'uuid'),
    ('products', 'external_source', 'text'),
    ('products', 'external_id', 'text'),
    ('products', 'name', 'text'),
    ('products', 'brand', 'text'),
    ('products', 'category', 'text'),
    ('products', 'subcategory', 'text'),
    ('products', 'description', 'text'),
    ('products', 'image_urls', '_text'),
    ('products', 'image_metadata', 'jsonb'),
    ('products', 'price_amount', 'numeric'),
    ('products', 'price_currency', 'bpchar'),
    ('products', 'attributes', 'jsonb'),
    ('products', 'slot_eligibility', '_text'),
    ('products', 'is_active', 'bool'),
    ('products', 'catalog_version', 'text'),
    ('products', 'created_at', 'timestamptz'),
    ('products', 'updated_at', 'timestamptz'),
    ('wardrobes', 'id', 'uuid'),
    ('wardrobes', 'anonymous_user_id', 'uuid'),
    ('wardrobes', 'user_id', 'uuid'),
    ('wardrobes', 'name', 'text'),
    ('wardrobes', 'created_at', 'timestamptz'),
    ('wardrobes', 'updated_at', 'timestamptz'),
    ('saved_products', 'id', 'uuid'),
    ('saved_products', 'wardrobe_id', 'uuid'),
    ('saved_products', 'anonymous_user_id', 'uuid'),
    ('saved_products', 'user_id', 'uuid'),
    ('saved_products', 'product_id', 'uuid'),
    ('saved_products', 'saved_at', 'timestamptz'),
    ('saved_products', 'removed_at', 'timestamptz'),
    ('saved_products', 'source_surface', 'text'),
    ('saved_products', 'save_operation_id', 'uuid'),
    ('saved_products', 'remove_operation_id', 'uuid'),
    ('saved_products', 'created_at', 'timestamptz'),
    ('saved_products', 'updated_at', 'timestamptz'),
    ('challenges', 'id', 'uuid'),
    ('challenges', 'challenge_key', 'text'),
    ('challenges', 'version', 'text'),
    ('challenges', 'title', 'text'),
    ('challenges', 'context_copy', 'text'),
    ('challenges', 'required_slots', 'jsonb'),
    ('challenges', 'completion_rules', 'jsonb'),
    ('challenges', 'active_from', 'timestamptz'),
    ('challenges', 'active_until', 'timestamptz'),
    ('challenges', 'is_active', 'bool'),
    ('challenges', 'created_at', 'timestamptz'),
    ('challenge_progress', 'id', 'uuid'),
    ('challenge_progress', 'anonymous_user_id', 'uuid'),
    ('challenge_progress', 'user_id', 'uuid'),
    ('challenge_progress', 'challenge_id', 'uuid'),
    ('challenge_progress', 'status', 'challenge_status'),
    ('challenge_progress', 'start_operation_id', 'uuid'),
    ('challenge_progress', 'started_at', 'timestamptz'),
    ('challenge_progress', 'last_interacted_at', 'timestamptz'),
    ('challenge_progress', 'invalidated_at', 'timestamptz'),
    ('challenge_progress', 'invalidation_reason', 'text'),
    ('challenge_progress', 'state_revision', 'int8'),
    ('challenge_progress', 'created_at', 'timestamptz'),
    ('challenge_progress', 'updated_at', 'timestamptz'),
    ('challenge_progress_items', 'id', 'uuid'),
    ('challenge_progress_items', 'challenge_progress_id', 'uuid'),
    ('challenge_progress_items', 'slot_id', 'text'),
    ('challenge_progress_items', 'product_id', 'uuid'),
    ('challenge_progress_items', 'selection_operation_id', 'uuid'),
    ('challenge_progress_items', 'selected_at', 'timestamptz'),
    ('challenge_progress_items', 'removed_at', 'timestamptz'),
    ('challenge_progress_items', 'removal_operation_id', 'uuid'),
    ('challenge_completions', 'id', 'uuid'),
    ('challenge_completions', 'anonymous_user_id', 'uuid'),
    ('challenge_completions', 'user_id', 'uuid'),
    ('challenge_completions', 'challenge_id', 'uuid'),
    ('challenge_completions', 'challenge_progress_id', 'uuid'),
    ('challenge_completions', 'completion_operation_id', 'uuid'),
    ('challenge_completions', 'selected_products_snapshot', 'jsonb'),
    ('challenge_completions', 'challenge_snapshot', 'jsonb'),
    ('challenge_completions', 'completed_at', 'timestamptz'),
    ('challenge_completions', 'created_at', 'timestamptz'),
    ('feed_instances', 'id', 'uuid'),
    ('feed_instances', 'anonymous_user_id', 'uuid'),
    ('feed_instances', 'session_id', 'uuid'),
    ('feed_instances', 'feed_order_version', 'text'),
    ('feed_instances', 'onboarding_version', 'text'),
    ('feed_instances', 'preference_ids', '_text'),
    ('feed_instances', 'created_at', 'timestamptz'),
    ('feed_instances', 'last_cursor', 'text'),
    ('feed_instances', 'max_loaded_position', 'int4'),
    ('feed_instances', 'max_qualified_position', 'int4'),
    ('feed_instances', 'is_exhausted', 'bool'),
    ('feed_instances', 'preview_namespace', 'text'),
    ('feed_instance_products', 'feed_instance_id', 'uuid'),
    ('feed_instance_products', 'product_id', 'uuid'),
    ('feed_instance_products', 'position', 'int4'),
    ('feed_instance_products', 'batch_number', 'int4'),
    ('events', 'event_id', 'uuid'),
    ('events', 'event_name', 'text'),
    ('events', 'event_version', 'int4'),
    ('events', 'occurred_at', 'timestamptz'),
    ('events', 'received_at', 'timestamptz'),
    ('events', 'anonymous_user_id', 'uuid'),
    ('events', 'user_id', 'uuid'),
    ('events', 'session_id', 'uuid'),
    ('events', 'release_id', 'text'),
    ('events', 'app_version', 'text'),
    ('events', 'platform', 'text'),
    ('events', 'environment', 'app_environment'),
    ('events', 'surface', 'text'),
    ('events', 'source_surface', 'text'),
    ('events', 'client_sequence', 'int8'),
    ('events', 'properties', 'jsonb'),
    ('events', 'context', 'jsonb'),
    ('events', 'validation_status', 'text'),
    ('events', 'validation_errors', 'jsonb'),
    ('events', 'inserted_at', 'timestamptz'),
    ('events', 'preview_namespace', 'text'),
    ('event_quarantine', 'id', 'uuid'),
    ('event_quarantine', 'received_at', 'timestamptz'),
    ('event_quarantine', 'raw_payload', 'jsonb'),
    ('event_quarantine', 'error_codes', '_text'),
    ('event_quarantine', 'source_ip_hash', 'text'),
    ('event_quarantine', 'environment', 'app_environment'),
    ('event_quarantine', 'preview_namespace', 'text'),
    ('event_quarantine', 'resolved_at', 'timestamptz')
)
select ok(
  exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = expected_columns.table_name
      and c.column_name = expected_columns.column_name
      and c.udt_name = expected_columns.udt_name
  ),
  format(
    'public.%I.%I has type %s',
    table_name,
    column_name,
    udt_name
  )
)
from expected_columns;

with expected_tables(table_name) as (
  values
    ('anonymous_users'),
    ('users'),
    ('onboarding_states'),
    ('sessions'),
    ('products'),
    ('wardrobes'),
    ('saved_products'),
    ('challenges'),
    ('challenge_progress'),
    ('challenge_progress_items'),
    ('challenge_completions'),
    ('feed_instances'),
    ('feed_instance_products'),
    ('events'),
    ('event_quarantine')
)
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class r on r.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public'
      and r.relname = expected_tables.table_name
      and c.contype = 'p'
  ),
  format('public.%I has a primary key', table_name)
)
from expected_tables;

with expected_constraints(constraint_name, constraint_type) as (
  values
    ('anonymous_users_auth_user_id_fkey', 'f'),
    ('users_id_fkey', 'f'),
    ('users_primary_anonymous_user_id_fkey', 'f'),
    ('anonymous_users_merged_into_user_id_fkey', 'f'),
    ('onboarding_states_anonymous_user_id_fkey', 'f'),
    ('onboarding_states_user_id_fkey', 'f'),
    ('sessions_anonymous_user_id_fkey', 'f'),
    ('sessions_user_id_fkey', 'f'),
    ('wardrobes_anonymous_user_id_fkey', 'f'),
    ('wardrobes_user_id_fkey', 'f'),
    ('saved_products_wardrobe_owner_fkey', 'f'),
    ('saved_products_anonymous_user_id_fkey', 'f'),
    ('saved_products_user_id_fkey', 'f'),
    ('saved_products_product_id_fkey', 'f'),
    ('challenge_progress_anonymous_user_id_fkey', 'f'),
    ('challenge_progress_user_id_fkey', 'f'),
    ('challenge_progress_challenge_id_fkey', 'f'),
    ('challenge_progress_items_progress_id_fkey', 'f'),
    ('challenge_progress_items_product_id_fkey', 'f'),
    ('challenge_completions_progress_owner_challenge_fkey', 'f'),
    ('challenge_completions_anonymous_user_id_fkey', 'f'),
    ('challenge_completions_user_id_fkey', 'f'),
    ('challenge_completions_challenge_id_fkey', 'f'),
    ('feed_instances_session_owner_fkey', 'f'),
    ('feed_instances_anonymous_user_id_fkey', 'f'),
    ('feed_instance_products_feed_instance_id_fkey', 'f'),
    ('feed_instance_products_product_id_fkey', 'f'),
    ('events_session_owner_fkey', 'f'),
    ('events_anonymous_user_id_fkey', 'f'),
    ('events_user_id_fkey', 'f'),
    ('anonymous_users_auth_user_id_key', 'u'),
    ('onboarding_states_completion_operation_id_key', 'u'),
    ('onboarding_states_skip_operation_id_key', 'u'),
    ('sessions_anonymous_user_session_number_key', 'u'),
    ('sessions_id_anonymous_user_id_key', 'u'),
    ('products_external_source_external_id_key', 'u'),
    ('wardrobes_anonymous_user_id_key', 'u'),
    ('wardrobes_id_anonymous_user_id_key', 'u'),
    ('saved_products_save_operation_id_key', 'u'),
    ('saved_products_remove_operation_id_key', 'u'),
    ('challenges_challenge_key_version_key', 'u'),
    ('challenge_progress_start_operation_id_key', 'u'),
    ('challenge_progress_anonymous_user_challenge_key', 'u'),
    ('challenge_progress_id_owner_challenge_key', 'u'),
    ('challenge_progress_items_selection_operation_id_key', 'u'),
    ('challenge_progress_items_removal_operation_id_key', 'u'),
    ('challenge_completions_challenge_progress_id_key', 'u'),
    ('challenge_completions_completion_operation_id_key', 'u'),
    ('feed_instance_products_feed_instance_product_key', 'u'),
    ('anonymous_users_state_revision_check', 'c'),
    ('onboarding_states_version_check', 'c'),
    ('onboarding_states_operation_check', 'c'),
    ('onboarding_states_preferences_check', 'c'),
    ('sessions_activity_order_check', 'c'),
    ('sessions_platform_check', 'c'),
    ('products_price_pair_check', 'c'),
    ('products_price_currency_check', 'c'),
    ('saved_products_removal_pair_check', 'c'),
    ('challenges_required_slots_check', 'c'),
    ('challenge_progress_invalidation_check', 'c'),
    ('challenge_progress_items_removal_pair_check', 'c'),
    ('challenge_completions_selected_products_snapshot_check', 'c'),
    ('feed_instances_max_qualified_position_check', 'c'),
    ('feed_instance_products_position_check', 'c'),
    ('events_release_id_check', 'c'),
    ('events_surface_check', 'c'),
    ('events_properties_check', 'c'),
    ('event_quarantine_error_codes_check', 'c')
)
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public'
      and c.conname = expected_constraints.constraint_name
      and c.contype::text = expected_constraints.constraint_type
  ),
  format(
    'constraint %I exists with type %s',
    constraint_name,
    constraint_type
  )
)
from expected_constraints;

select is(
  (select count(*) from public.anonymous_users),
  0::bigint,
  'anonymous users do not depend on seed data'
);

select is(
  (select count(*) from public.products),
  0::bigint,
  'products do not depend on seed data'
);

select is(
  (select count(*) from public.challenges),
  0::bigint,
  'challenges do not depend on seed data'
);

select is(
  (select count(*) from public.events),
  0::bigint,
  'events do not depend on seed data'
);

select * from finish();

rollback;
