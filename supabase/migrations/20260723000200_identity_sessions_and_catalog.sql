begin;

create table public.anonymous_users (
  id uuid
    constraint anonymous_users_pkey primary key
    default gen_random_uuid(),
  auth_user_id uuid not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_meaningful_destination text,
  state_revision bigint not null default 0,
  merged_into_user_id uuid,
  is_test boolean not null default false,
  preview_namespace text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anonymous_users_auth_user_id_key unique (auth_user_id),
  constraint anonymous_users_auth_user_id_fkey
    foreign key (auth_user_id) references auth.users (id) on delete cascade,
  constraint anonymous_users_state_revision_check check (state_revision >= 0),
  constraint anonymous_users_seen_order_check check (
    last_seen_at >= first_seen_at
  )
);

create table public.users (
  id uuid constraint users_pkey primary key,
  primary_anonymous_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_test boolean not null default false,
  constraint users_id_fkey
    foreign key (id) references auth.users (id) on delete cascade,
  constraint users_primary_anonymous_user_id_fkey
    foreign key (primary_anonymous_user_id)
    references public.anonymous_users (id)
);

alter table public.anonymous_users
  add constraint anonymous_users_merged_into_user_id_fkey
  foreign key (merged_into_user_id) references public.users (id);

create table public.onboarding_states (
  anonymous_user_id uuid constraint onboarding_states_pkey primary key,
  user_id uuid,
  status public.onboarding_status not null default 'not_started',
  onboarding_version text,
  preference_set_version text,
  preference_ids text[] not null default '{}',
  completion_operation_id uuid,
  skip_operation_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  state_revision bigint not null default 0,
  constraint onboarding_states_anonymous_user_id_fkey
    foreign key (anonymous_user_id)
    references public.anonymous_users (id)
    on delete cascade,
  constraint onboarding_states_user_id_fkey
    foreign key (user_id) references public.users (id),
  constraint onboarding_states_completion_operation_id_key
    unique (completion_operation_id),
  constraint onboarding_states_skip_operation_id_key unique (skip_operation_id),
  constraint onboarding_states_state_revision_check check (state_revision >= 0),
  constraint onboarding_states_version_check check (
    (
      status not in (
        'completed_with_preferences',
        'completed_without_preferences',
        'skipped'
      )
    )
    or (
      onboarding_version is not null
      and btrim(onboarding_version) <> ''
    )
  ),
  constraint onboarding_states_operation_check check (
    (
      status in (
        'completed_with_preferences',
        'completed_without_preferences'
      )
      and completion_operation_id is not null
      and skip_operation_id is null
      and completed_at is not null
    )
    or (
      status = 'skipped'
      and completion_operation_id is null
      and skip_operation_id is not null
      and completed_at is not null
    )
    or (
      status not in (
        'completed_with_preferences',
        'completed_without_preferences',
        'skipped'
      )
      and completion_operation_id is null
      and skip_operation_id is null
      and completed_at is null
    )
  ),
  constraint onboarding_states_preferences_check check (
    (
      status = 'completed_with_preferences'
      and cardinality(preference_ids) > 0
    )
    or (
      status in ('completed_without_preferences', 'skipped')
      and cardinality(preference_ids) = 0
    )
    or status not in (
      'completed_with_preferences',
      'completed_without_preferences',
      'skipped'
    )
  ),
  constraint onboarding_states_started_at_check check (
    status = 'not_started'
    or started_at is not null
  )
);

create table public.sessions (
  id uuid constraint sessions_pkey primary key,
  anonymous_user_id uuid not null,
  user_id uuid,
  session_number integer not null,
  started_at timestamptz not null,
  last_activity_at timestamptz not null,
  ended_at timestamptz,
  is_return_session boolean not null default false,
  entry_route text,
  traffic_source text,
  cohort_id text,
  app_version text not null,
  platform text not null,
  environment public.app_environment not null,
  is_test boolean not null default false,
  preview_namespace text,
  recovery_status text not null default 'canonical',
  created_at timestamptz not null default now(),
  constraint sessions_anonymous_user_id_fkey
    foreign key (anonymous_user_id)
    references public.anonymous_users (id)
    on delete cascade,
  constraint sessions_user_id_fkey
    foreign key (user_id) references public.users (id),
  constraint sessions_anonymous_user_session_number_key
    unique (anonymous_user_id, session_number),
  constraint sessions_id_anonymous_user_id_key unique (id, anonymous_user_id),
  constraint sessions_session_number_check check (session_number > 0),
  constraint sessions_activity_order_check check (
    last_activity_at >= started_at
  ),
  constraint sessions_ended_at_check check (
    ended_at is null
    or ended_at >= started_at
  ),
  constraint sessions_app_version_check check (btrim(app_version) <> ''),
  constraint sessions_platform_check check (
    platform in ('web_mobile', 'web_desktop', 'ios', 'android')
  ),
  constraint sessions_return_number_check check (
    not is_return_session
    or session_number > 1
  )
);

create table public.products (
  id uuid constraint products_pkey primary key default gen_random_uuid(),
  external_source text,
  external_id text,
  name text not null,
  brand text,
  category text not null,
  subcategory text,
  description text,
  image_urls text[] not null default '{}',
  image_metadata jsonb not null default '{}'::jsonb,
  price_amount numeric(12, 2),
  price_currency character(3),
  attributes jsonb not null default '{}'::jsonb,
  slot_eligibility text[] not null default '{}',
  is_active boolean not null default true,
  catalog_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_external_source_external_id_key
    unique nulls not distinct (external_source, external_id),
  constraint products_name_check check (btrim(name) <> ''),
  constraint products_category_check check (btrim(category) <> ''),
  constraint products_catalog_version_check check (btrim(catalog_version) <> ''),
  constraint products_image_metadata_check check (
    jsonb_typeof(image_metadata) = 'object'
  ),
  constraint products_attributes_check check (
    jsonb_typeof(attributes) = 'object'
  ),
  constraint products_price_pair_check check (
    (price_amount is null) = (price_currency is null)
  ),
  constraint products_price_amount_check check (
    price_amount is null
    or price_amount >= 0
  ),
  constraint products_price_currency_check check (
    price_currency is null
    or price_currency ~ '^[A-Z]{3}$'
  )
);

create trigger anonymous_users_set_updated_at
before update on public.anonymous_users
for each row execute function public.set_updated_at();

create trigger anonymous_users_prevent_auth_user_id_change
before update of auth_user_id on public.anonymous_users
for each row execute function public.prevent_anonymous_auth_user_id_change();

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger onboarding_states_set_updated_at
before update on public.onboarding_states
for each row execute function public.set_updated_at();

create trigger onboarding_states_enforce_status_transition
before update of status on public.onboarding_states
for each row execute function public.enforce_onboarding_status_transition();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

commit;
