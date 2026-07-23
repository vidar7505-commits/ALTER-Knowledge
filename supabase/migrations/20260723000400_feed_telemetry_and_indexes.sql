begin;

create table public.feed_instances (
  id uuid constraint feed_instances_pkey primary key,
  anonymous_user_id uuid not null,
  session_id uuid not null,
  feed_order_version text not null,
  onboarding_version text,
  preference_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_cursor text,
  max_loaded_position integer not null default 0,
  max_qualified_position integer not null default 0,
  is_exhausted boolean not null default false,
  preview_namespace text,
  constraint feed_instances_session_owner_fkey
    foreign key (session_id, anonymous_user_id)
    references public.sessions (id, anonymous_user_id)
    on delete cascade,
  constraint feed_instances_anonymous_user_id_fkey
    foreign key (anonymous_user_id)
    references public.anonymous_users (id)
    on delete cascade,
  constraint feed_instances_feed_order_version_check check (
    btrim(feed_order_version) <> ''
  ),
  constraint feed_instances_max_loaded_position_check check (
    max_loaded_position >= 0
  ),
  constraint feed_instances_max_qualified_position_check check (
    max_qualified_position >= 0
    and max_qualified_position <= max_loaded_position
  )
);

create table public.feed_instance_products (
  feed_instance_id uuid not null,
  product_id uuid not null,
  position integer not null,
  batch_number integer not null,
  constraint feed_instance_products_pkey
    primary key (feed_instance_id, position),
  constraint feed_instance_products_feed_instance_product_key
    unique (feed_instance_id, product_id),
  constraint feed_instance_products_feed_instance_id_fkey
    foreign key (feed_instance_id)
    references public.feed_instances (id)
    on delete cascade,
  constraint feed_instance_products_product_id_fkey
    foreign key (product_id) references public.products (id),
  constraint feed_instance_products_position_check check (position > 0),
  constraint feed_instance_products_batch_number_check check (batch_number > 0)
);

create table public.events (
  event_id uuid constraint events_pkey primary key,
  event_name text not null,
  event_version integer not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  anonymous_user_id uuid not null,
  user_id uuid,
  session_id uuid not null,
  release_id text not null,
  app_version text not null,
  platform text not null,
  environment public.app_environment not null,
  surface text not null,
  source_surface text,
  client_sequence bigint not null,
  properties jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  validation_status text not null default 'valid',
  validation_errors jsonb not null default '[]'::jsonb,
  inserted_at timestamptz not null default now(),
  preview_namespace text,
  constraint events_session_owner_fkey
    foreign key (session_id, anonymous_user_id)
    references public.sessions (id, anonymous_user_id)
    on delete cascade,
  constraint events_anonymous_user_id_fkey
    foreign key (anonymous_user_id)
    references public.anonymous_users (id)
    on delete cascade,
  constraint events_user_id_fkey
    foreign key (user_id) references public.users (id),
  constraint events_event_name_check check (btrim(event_name) <> ''),
  constraint events_event_version_check check (event_version > 0),
  constraint events_future_skew_check check (
    occurred_at <= received_at + interval '24 hours'
  ),
  constraint events_release_id_check check (release_id = 'LR-001'),
  constraint events_app_version_check check (btrim(app_version) <> ''),
  constraint events_platform_check check (
    platform in ('web_mobile', 'web_desktop', 'ios', 'android')
  ),
  constraint events_surface_check check (
    surface in (
      'app_boot',
      'onboarding',
      'discover',
      'product_detail',
      'wardrobe',
      'challenge',
      'challenge_picker',
      'continuation',
      'error_recovery'
    )
  ),
  constraint events_source_surface_check check (
    source_surface is null
    or source_surface in (
      'discover',
      'product_detail',
      'wardrobe',
      'challenge',
      'challenge_picker'
    )
  ),
  constraint events_client_sequence_check check (client_sequence >= 0),
  constraint events_properties_check check (
    jsonb_typeof(properties) = 'object'
  ),
  constraint events_context_check check (jsonb_typeof(context) = 'object'),
  constraint events_validation_errors_check check (
    jsonb_typeof(validation_errors) = 'array'
  )
);

create table public.event_quarantine (
  id uuid
    constraint event_quarantine_pkey primary key
    default gen_random_uuid(),
  received_at timestamptz not null default now(),
  raw_payload jsonb not null,
  error_codes text[] not null,
  source_ip_hash text,
  environment public.app_environment not null,
  preview_namespace text,
  resolved_at timestamptz,
  constraint event_quarantine_raw_payload_check check (
    jsonb_typeof(raw_payload) = 'object'
  ),
  constraint event_quarantine_error_codes_check check (
    cardinality(error_codes) > 0
  ),
  constraint event_quarantine_resolved_at_check check (
    resolved_at is null
    or resolved_at >= received_at
  )
);

create index users_primary_anonymous_user_idx
on public.users (primary_anonymous_user_id);

create index anonymous_users_merged_user_idx
on public.anonymous_users (merged_into_user_id);

create index onboarding_states_user_idx
on public.onboarding_states (user_id);

create index sessions_identity_started_idx
on public.sessions (anonymous_user_id, started_at desc);

create index sessions_user_idx
on public.sessions (user_id);

create index sessions_return_idx
on public.sessions (is_return_session, started_at)
where is_test = false;

create index saved_products_wardrobe_saved_idx
on public.saved_products (wardrobe_id, saved_at desc)
where removed_at is null;

create index saved_products_anonymous_user_idx
on public.saved_products (anonymous_user_id);

create index saved_products_user_idx
on public.saved_products (user_id);

create index saved_products_product_idx
on public.saved_products (product_id);

create index products_active_category_idx
on public.products (category, id)
where is_active = true;

create index challenge_progress_identity_idx
on public.challenge_progress (anonymous_user_id, updated_at desc);

create index challenge_progress_user_idx
on public.challenge_progress (user_id);

create index challenge_progress_challenge_idx
on public.challenge_progress (challenge_id);

create index challenge_progress_items_progress_idx
on public.challenge_progress_items (challenge_progress_id);

create index challenge_progress_items_product_idx
on public.challenge_progress_items (product_id);

create index challenge_completions_anonymous_user_idx
on public.challenge_completions (anonymous_user_id);

create index challenge_completions_user_idx
on public.challenge_completions (user_id);

create index challenge_completions_challenge_idx
on public.challenge_completions (challenge_id);

create index feed_instances_session_idx
on public.feed_instances (session_id);

create index feed_instances_anonymous_user_idx
on public.feed_instances (anonymous_user_id);

create index feed_instance_products_product_idx
on public.feed_instance_products (product_id);

create index events_identity_time_idx
on public.events (anonymous_user_id, occurred_at);

create index events_user_idx
on public.events (user_id);

create index events_session_time_idx
on public.events (session_id, occurred_at, client_sequence);

create index events_name_time_idx
on public.events (event_name, occurred_at);

create index events_product_idx
on public.events ((properties ->> 'product_id'), occurred_at)
where properties ? 'product_id';

create index events_challenge_idx
on public.events ((properties ->> 'challenge_id'), occurred_at)
where properties ? 'challenge_id';

create index events_properties_gin_idx
on public.events using gin (properties jsonb_path_ops);

commit;
