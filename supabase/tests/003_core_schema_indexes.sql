begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select no_plan();

with expected_indexes(index_name) as (
  values
    ('saved_products_active_unique'),
    ('one_active_challenge'),
    ('challenge_active_slot_unique'),
    ('challenge_active_product_unique'),
    ('users_primary_anonymous_user_idx'),
    ('anonymous_users_merged_user_idx'),
    ('onboarding_states_user_idx'),
    ('sessions_identity_started_idx'),
    ('sessions_user_idx'),
    ('sessions_return_idx'),
    ('saved_products_wardrobe_saved_idx'),
    ('saved_products_anonymous_user_idx'),
    ('saved_products_user_idx'),
    ('saved_products_product_idx'),
    ('products_active_category_idx'),
    ('challenge_progress_identity_idx'),
    ('challenge_progress_user_idx'),
    ('challenge_progress_challenge_idx'),
    ('challenge_progress_items_progress_idx'),
    ('challenge_progress_items_product_idx'),
    ('challenge_completions_anonymous_user_idx'),
    ('challenge_completions_user_idx'),
    ('challenge_completions_challenge_idx'),
    ('feed_instances_session_idx'),
    ('feed_instances_anonymous_user_idx'),
    ('feed_instance_products_product_idx'),
    ('events_identity_time_idx'),
    ('events_user_idx'),
    ('events_session_time_idx'),
    ('events_name_time_idx'),
    ('events_product_idx'),
    ('events_challenge_idx'),
    ('events_properties_gin_idx')
)
select ok(
  to_regclass(format('public.%I', index_name)) is not null,
  format('index public.%I exists', index_name)
)
from expected_indexes;

with expected_unique_partial(index_name, predicate_fragment) as (
  values
    ('saved_products_active_unique', 'removed_at IS NULL'),
    ('one_active_challenge', 'is_active = true'),
    ('challenge_active_slot_unique', 'removed_at IS NULL'),
    ('challenge_active_product_unique', 'removed_at IS NULL')
)
select ok(
  exists (
    select 1
    from pg_catalog.pg_index i
    join pg_catalog.pg_class c on c.oid = i.indexrelid
    where c.relname = expected_unique_partial.index_name
      and i.indisunique
      and pg_get_expr(i.indpred, i.indrelid) ilike
        '%' || expected_unique_partial.predicate_fragment || '%'
  ),
  format(
    '%I is a unique partial index with the canonical predicate',
    index_name
  )
)
from expected_unique_partial;

select ok(
  exists (
    select 1
    from pg_catalog.pg_index i
    join pg_catalog.pg_class c on c.oid = i.indexrelid
    join pg_catalog.pg_am am on am.oid = c.relam
    where c.relname = 'events_properties_gin_idx'
      and am.amname = 'gin'
  ),
  'events properties use the required GIN index'
);

select * from finish();

rollback;
