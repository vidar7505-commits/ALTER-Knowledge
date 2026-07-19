# A L T E R . — LR-001 Database Schema

**Document ID:** DATA-DB-LR-001  
**Work package:** WP-004 Data Foundation  
**Target:** Supabase PostgreSQL  
**Status:** Implementation-ready  
**Last updated:** 2026-07-19

---

## 1. Architecture principles

- Supabase Anonymous Auth provides the authorization root.
- `auth.users.id` is mapped to a stable analytical anonymous identity.
- PostgreSQL is canonical for persistent product state.
- Raw behavioral events are append-only.
- State-changing operations are idempotent.
- UUID primary keys and UTC `timestamptz` are mandatory.
- JSONB is limited to extensible event payloads and immutable snapshots; core state remains relational.
- RLS is required for user-owned state.
- Client-generated owner UUIDs are not trusted.
- No sensitive personal data is required for LR-001.

This specification includes the schema corrections accepted in WP-005: `auth_user_id` mapping, canonical onboarding persistence, challenge `start_operation_id`, immutable completions, and server-derived telemetry context.

## 2. Extensions and schemas

```sql
create extension if not exists pgcrypto;
create schema if not exists analytics;
```

## 3. Enums

```sql
create type public.onboarding_status as enum (
  'not_started',
  'in_progress',
  'completed_with_preferences',
  'completed_without_preferences',
  'skipped',
  'recoverable_error'
);

create type public.challenge_status as enum (
  'not_started',
  'in_progress',
  'ready_to_complete',
  'completed',
  'invalidated'
);

create type public.app_environment as enum (
  'local', 'preview', 'staging', 'production'
);
```

## 4. Identity and onboarding

### 4.1 Anonymous analytical identity

```sql
create table public.anonymous_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_meaningful_destination text,
  state_revision bigint not null default 0 check (state_revision >= 0),
  merged_into_user_id uuid,
  is_test boolean not null default false,
  preview_namespace text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`auth_user_id` is immutable and is the only client authorization mapping. Browser storage contains the Supabase session, not an owner UUID used for authorization.

### 4.2 Future upgraded account profile

```sql
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  primary_anonymous_user_id uuid references public.anonymous_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_test boolean not null default false
);
```

Identity merge is one-way and auditable. Historical events retain original anonymous identity; certified analysis may apply a versioned identity map.

### 4.3 Canonical onboarding state

```sql
create table public.onboarding_states (
  anonymous_user_id uuid primary key references public.anonymous_users(id) on delete cascade,
  user_id uuid references public.users(id),
  status public.onboarding_status not null default 'not_started',
  onboarding_version text,
  preference_set_version text,
  preference_ids text[] not null default '{}',
  completion_operation_id uuid unique,
  skip_operation_id uuid unique,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  state_revision bigint not null default 0 check (state_revision >= 0),
  check (
    status not in ('completed_with_preferences','completed_without_preferences','skipped')
    or onboarding_version is not null
  )
);
```

## 5. Sessions

```sql
create table public.sessions (
  id uuid primary key,
  anonymous_user_id uuid not null references public.anonymous_users(id) on delete cascade,
  user_id uuid references public.users(id),
  session_number integer not null check (session_number > 0),
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
  unique (anonymous_user_id, session_number),
  check (last_activity_at >= started_at),
  check (ended_at is null or ended_at >= started_at)
);
```

## 6. Raw events and quarantine

```sql
create table public.events (
  event_id uuid primary key,
  event_name text not null,
  event_version integer not null check (event_version > 0),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  anonymous_user_id uuid not null references public.anonymous_users(id) on delete cascade,
  user_id uuid references public.users(id),
  session_id uuid not null references public.sessions(id) on delete cascade,
  release_id text not null,
  app_version text not null,
  platform text not null,
  environment public.app_environment not null,
  surface text not null,
  source_surface text,
  client_sequence bigint not null check (client_sequence >= 0),
  properties jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  validation_status text not null default 'valid',
  validation_errors jsonb not null default '[]'::jsonb,
  inserted_at timestamptz not null default now(),
  preview_namespace text
);

create table public.event_quarantine (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  raw_payload jsonb not null,
  error_codes text[] not null,
  source_ip_hash text,
  environment public.app_environment not null,
  preview_namespace text,
  resolved_at timestamptz
);
```

Clients receive no direct insert/select privilege on `events` or `event_quarantine`; controlled server ingestion is mandatory.

## 7. Product catalog

```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  external_source text,
  external_id text,
  name text not null,
  brand text,
  category text not null,
  subcategory text,
  description text,
  image_urls text[] not null default '{}',
  image_metadata jsonb not null default '{}'::jsonb,
  price_amount numeric(12,2),
  price_currency char(3),
  attributes jsonb not null default '{}'::jsonb,
  slot_eligibility text[] not null default '{}',
  is_active boolean not null default true,
  catalog_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (external_source, external_id)
);
```

Product catalog is server-managed and client read-only when active.

## 8. Wardrobe and saved products

```sql
create table public.wardrobes (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_id uuid not null unique references public.anonymous_users(id) on delete cascade,
  user_id uuid references public.users(id),
  name text not null default 'My Wardrobe',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_products (
  id uuid primary key default gen_random_uuid(),
  wardrobe_id uuid not null references public.wardrobes(id) on delete cascade,
  anonymous_user_id uuid not null references public.anonymous_users(id) on delete cascade,
  user_id uuid references public.users(id),
  product_id uuid not null references public.products(id),
  saved_at timestamptz not null default now(),
  removed_at timestamptz,
  source_surface text not null,
  save_operation_id uuid not null unique,
  remove_operation_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (removed_at is null or removed_at >= saved_at)
);

create unique index saved_products_active_unique
  on public.saved_products (anonymous_user_id, product_id)
  where removed_at is null;
```

A re-save after removal creates a new row, preserving history.

## 9. Challenge definition and state

```sql
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  challenge_key text not null,
  version text not null,
  title text not null,
  context_copy text not null,
  required_slots jsonb not null,
  completion_rules jsonb not null,
  active_from timestamptz not null,
  active_until timestamptz,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (challenge_key, version)
);

create unique index one_active_challenge
  on public.challenges ((is_active))
  where is_active = true;

create table public.challenge_progress (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_id uuid not null references public.anonymous_users(id) on delete cascade,
  user_id uuid references public.users(id),
  challenge_id uuid not null references public.challenges(id),
  status public.challenge_status not null default 'not_started',
  start_operation_id uuid not null unique,
  started_at timestamptz,
  last_interacted_at timestamptz,
  invalidated_at timestamptz,
  invalidation_reason text,
  state_revision bigint not null default 0 check (state_revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (anonymous_user_id, challenge_id)
);

create table public.challenge_progress_items (
  id uuid primary key default gen_random_uuid(),
  challenge_progress_id uuid not null references public.challenge_progress(id) on delete cascade,
  slot_id text not null,
  product_id uuid not null references public.products(id),
  selection_operation_id uuid not null unique,
  selected_at timestamptz not null default now(),
  removed_at timestamptz,
  removal_operation_id uuid unique,
  check (removed_at is null or removed_at >= selected_at)
);

create unique index challenge_active_slot_unique
  on public.challenge_progress_items (challenge_progress_id, slot_id)
  where removed_at is null;

create table public.challenge_completions (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_id uuid not null references public.anonymous_users(id) on delete cascade,
  user_id uuid references public.users(id),
  challenge_id uuid not null references public.challenges(id),
  challenge_progress_id uuid not null unique references public.challenge_progress(id),
  completion_operation_id uuid not null unique,
  selected_products_snapshot jsonb not null,
  challenge_snapshot jsonb not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
```

Completed records are immutable. Product removal or catalog mutation never rewrites historical snapshots.

## 10. Feed persistence

```sql
create table public.feed_instances (
  id uuid primary key,
  anonymous_user_id uuid not null references public.anonymous_users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  feed_order_version text not null,
  onboarding_version text,
  preference_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_cursor text,
  max_loaded_position integer not null default 0 check (max_loaded_position >= 0),
  max_qualified_position integer not null default 0 check (max_qualified_position >= 0),
  is_exhausted boolean not null default false,
  preview_namespace text
);

create table public.feed_instance_products (
  feed_instance_id uuid not null references public.feed_instances(id) on delete cascade,
  product_id uuid not null references public.products(id),
  position integer not null check (position > 0),
  batch_number integer not null check (batch_number > 0),
  primary key (feed_instance_id, position),
  unique (feed_instance_id, product_id)
);
```

## 11. Optional continuation persistence

Cross-session dismissal is not required by default. Add this table only if Product confirms persistent dismissal:

```sql
create table public.continuation_preferences (
  anonymous_user_id uuid primary key references public.anonymous_users(id) on delete cascade,
  dismissed_cue_key text,
  dismissed_at timestamptz,
  operation_id uuid unique,
  updated_at timestamptz not null default now()
);
```

Session-only dismissal remains browser/session state and requires no table.

## 12. Required indexes

```sql
create index sessions_identity_started_idx
  on public.sessions (anonymous_user_id, started_at desc);

create index sessions_return_idx
  on public.sessions (is_return_session, started_at)
  where is_test = false;

create index events_identity_time_idx
  on public.events (anonymous_user_id, occurred_at);

create index events_session_time_idx
  on public.events (session_id, occurred_at, client_sequence);

create index events_name_time_idx
  on public.events (event_name, occurred_at);

create index events_product_idx
  on public.events ((properties->>'product_id'), occurred_at)
  where properties ? 'product_id';

create index events_challenge_idx
  on public.events ((properties->>'challenge_id'), occurred_at)
  where properties ? 'challenge_id';

create index events_properties_gin_idx
  on public.events using gin (properties jsonb_path_ops);

create index products_active_category_idx
  on public.products (category, id)
  where is_active = true;

create index saved_products_wardrobe_saved_idx
  on public.saved_products (wardrobe_id, saved_at desc)
  where removed_at is null;

create index challenge_progress_identity_idx
  on public.challenge_progress (anonymous_user_id, updated_at desc);

create index feed_instances_session_idx
  on public.feed_instances (session_id);
```

## 13. Triggers and immutability

Engineering migrations must implement:

- standard `updated_at` trigger for mutable tables;
- rejection of `anonymous_users.auth_user_id` updates;
- rejection of UPDATE/DELETE on `events` except controlled retention/anonymization procedures;
- rejection of UPDATE/DELETE on `challenge_completions` under application roles;
- validation that event/session identities match;
- server-derived environment/test/namespace fields.

## 14. Validation rules

- Future event skew greater than 5 minutes is flagged; greater than 24 hours is quarantined.
- Offline events older than 30 days require explicit replay classification.
- Event session identity must match the session owner.
- `release_id` must be allow-listed and equal `LR-001` for this release.
- Completed/skipped onboarding requires an onboarding version.
- `product_saved` requires an active canonical row with matching operation ID.
- Challenge selection product must satisfy the slot eligibility at mutation time.
- `challenge_completed` requires every required slot exactly once and matching challenge version.
- Completion snapshots cover product ID, name, category, image reference, slot, and challenge definition.

## 15. RLS ownership model

Ownership is resolved by:

```sql
select id
from public.anonymous_users
where auth_user_id = auth.uid();
```

Rules:

- each user may select only their own user-state rows;
- direct inserts/updates/deletes on protected state tables are revoked from client roles;
- state mutations use narrowly granted `security definer` RPCs;
- every RPC sets a fixed `search_path`, resolves `auth.uid()`, and checks target ownership explicitly;
- clients cannot pass owner IDs as authoritative inputs;
- product catalog and active challenge definitions are read-only;
- raw event reads, quarantine, identity merge, certified views, and retention jobs are server/service-role only;
- two-user isolation tests are release blockers.

## 16. Transactional RPC boundaries

Required RPCs:

- `ensure_anonymous_identity()`
- `ensure_session(...)`
- `complete_onboarding(...)`
- `skip_onboarding(...)`
- `save_product(...)`
- `remove_product(...)`
- `start_challenge(...)`
- `select_challenge_item(...)`
- `remove_challenge_item(...)`
- `complete_challenge(...)`
- `ingest_events(...)` or controlled ingestion function called by server endpoint.

Each state RPC validates identity, validates the domain operation, performs the state mutation, emits the canonical success event after successful persistence within the same transaction when applicable, and returns canonical state. Expected domain rejection returns structured failure; unexpected database errors roll back.

## 17. Migration order

1. extensions and schemas;
2. enums and shared trigger functions;
3. identity and onboarding;
4. sessions;
5. catalog;
6. Wardrobe/save state;
7. challenge state/completions;
8. feed persistence;
9. events/quarantine;
10. indexes and constraints;
11. RLS and grants;
12. transactional RPCs;
13. certified analytics views;
14. seed data;
15. pgTAP ownership/idempotency tests.

## 18. Retention

- Core state: retained while identity is active, then deleted/anonymized under lifecycle policy.
- Raw production events: provisional maximum 24 months.
- Preview/test events: short-lived and automatically cleaned by namespace.
- Quarantine: 30 days unless required for an active incident.
- Completion snapshots follow identity deletion/anonymization policy.
- A legal/privacy review is mandatory before public-scale launch.
