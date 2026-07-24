begin;

alter table public.feed_instances
add constraint feed_instances_session_order_version_key
unique (session_id, feed_order_version);

create table private.feed_batch_requests (
  feed_instance_id uuid not null,
  request_cursor text not null,
  requested_count integer not null,
  batch_number integer not null,
  returned_count integer not null,
  next_cursor text,
  is_terminal boolean not null,
  created_at timestamptz not null default now(),
  constraint feed_batch_requests_pkey
    primary key (feed_instance_id, request_cursor),
  constraint feed_batch_requests_feed_instance_id_fkey
    foreign key (feed_instance_id)
    references public.feed_instances (id)
    on delete cascade,
  constraint feed_batch_requests_request_cursor_check check (
    nullif(btrim(request_cursor), '') is not null
  ),
  constraint feed_batch_requests_requested_count_check check (
    requested_count between 1 and 24
  ),
  constraint feed_batch_requests_batch_number_check check (
    batch_number > 0
  ),
  constraint feed_batch_requests_returned_count_check check (
    returned_count between 0 and requested_count
  ),
  constraint feed_batch_requests_next_cursor_check check (
    next_cursor is null
    or nullif(btrim(next_cursor), '') is not null
  ),
  constraint feed_batch_requests_terminal_cursor_check check (
    not is_terminal
    or next_cursor is null
  ),
  constraint feed_batch_requests_feed_batch_key
    unique (feed_instance_id, batch_number)
);

create function private.current_app_environment()
returns public.app_environment
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  configured_environment text := nullif(
    btrim(current_setting('app.settings.environment', true)),
    ''
  );
begin
  if configured_environment is null then
    return 'local'::public.app_environment;
  end if;

  if configured_environment not in (
    'local',
    'preview',
    'staging',
    'production'
  ) then
    raise exception 'invalid database application environment'
      using errcode = '22023';
  end if;

  return configured_environment::public.app_environment;
end;
$$;

create function private.feed_cursor_token(
  p_feed_instance_id uuid,
  p_next_position integer
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select 'lr001-feed-cursor-v1.' || pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(
        'lr001-feed-cursor-v1:'
          || p_feed_instance_id::text
          || ':'
          || p_next_position::text,
        'UTF8'
      )
    ),
    'hex'
  );
$$;

create function private.feed_batch_response(
  p_feed_instance_id uuid,
  p_request_cursor text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'feed_instance_id',
    feed_batch_requests.feed_instance_id,
    'batch_number',
    feed_batch_requests.batch_number,
    'returned_count',
    feed_batch_requests.returned_count,
    'next_cursor',
    feed_batch_requests.next_cursor,
    'is_exhausted',
    feed_batch_requests.is_terminal,
    'products',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'product_id',
            products.id,
            'position',
            feed_instance_products.position,
            'batch_number',
            feed_instance_products.batch_number,
            'name',
            products.name,
            'brand',
            products.brand,
            'category',
            products.category,
            'subcategory',
            products.subcategory,
            'image_urls',
            products.image_urls,
            'image_metadata',
            products.image_metadata,
            'price_amount',
            products.price_amount,
            'price_currency',
            products.price_currency,
            'catalog_version',
            products.catalog_version
          )
          order by feed_instance_products.position
        )
        from public.feed_instance_products
        join public.products
          on products.id = feed_instance_products.product_id
        where feed_instance_products.feed_instance_id =
          feed_batch_requests.feed_instance_id
          and feed_instance_products.batch_number =
            feed_batch_requests.batch_number
      ),
      '[]'::jsonb
    )
  )
  from private.feed_batch_requests
  where feed_batch_requests.feed_instance_id = p_feed_instance_id
    and feed_batch_requests.request_cursor = p_request_cursor;
$$;

alter function private.current_app_environment() owner to postgres;
alter function private.feed_cursor_token(uuid, integer) owner to postgres;
alter function private.feed_batch_response(uuid, text) owner to postgres;

revoke all on table private.feed_batch_requests
from public, anon, authenticated;
revoke all on function private.current_app_environment()
from public, anon, authenticated;
revoke all on function private.feed_cursor_token(uuid, integer)
from public, anon, authenticated;
revoke all on function private.feed_batch_response(uuid, text)
from public, anon, authenticated;

create function public.ensure_session(
  p_session_id uuid,
  p_app_version text,
  p_platform text,
  p_entry_route text,
  p_traffic_source text default null,
  p_cohort_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner_row public.anonymous_users%rowtype;
  resolved_user_id uuid;
  session_row public.sessions%rowtype;
  latest_session public.sessions%rowtype;
  observed_at timestamptz := statement_timestamp();
  next_session_number integer;
  canonical_environment public.app_environment;
  canonical_traffic_source text := nullif(btrim(p_traffic_source), '');
  canonical_cohort_id text := nullif(btrim(p_cohort_id), '');
begin
  if
    p_session_id is null
    or p_session_id = '00000000-0000-0000-0000-000000000000'::uuid
    or nullif(btrim(p_app_version), '') is null
    or length(btrim(p_app_version)) > 128
    or p_platform is null
    or p_platform not in (
      'web_mobile',
      'web_desktop',
      'ios',
      'android'
    )
    or length(btrim(coalesce(p_entry_route, ''))) not between 1 and 256
    or position('?' in p_entry_route) > 0
    or (
      canonical_traffic_source is not null
      and (
        length(canonical_traffic_source) > 128
        or canonical_traffic_source
          !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
      )
    )
    or (
      canonical_cohort_id is not null
      and (
        length(canonical_cohort_id) > 128
        or canonical_cohort_id
          !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
      )
    )
  then
    raise exception 'invalid session descriptor'
      using errcode = '22023';
  end if;

  select anonymous_users.*
  into strict owner_row
  from public.anonymous_users
  where anonymous_users.id = private.current_anonymous_user_id()
  for update;

  select users.id
  into resolved_user_id
  from public.users
  where users.id = owner_row.auth_user_id;

  select sessions.*
  into session_row
  from public.sessions
  where sessions.id = p_session_id;

  if found then
    if session_row.anonymous_user_id <> owner_row.id then
      raise exception 'session ownership mismatch'
        using errcode = '42501';
    end if;

    if
      session_row.ended_at is not null
      or session_row.last_activity_at <= observed_at - interval '30 minutes'
    then
      raise exception 'session has expired'
        using errcode = '22023';
    end if;

    if session_row.platform <> p_platform then
      raise exception 'session context conflict'
        using errcode = '22023';
    end if;

    return jsonb_build_object(
      'session_id',
      session_row.id,
      'session_number',
      session_row.session_number,
      'is_return_session',
      session_row.is_return_session,
      'started_at',
      session_row.started_at
    );
  end if;

  select sessions.*
  into latest_session
  from public.sessions
  where sessions.anonymous_user_id = owner_row.id
  order by sessions.session_number desc
  limit 1;

  if
    found
    and latest_session.ended_at is null
    and latest_session.last_activity_at > observed_at - interval '30 minutes'
  then
    if latest_session.platform <> p_platform then
      raise exception 'session context conflict'
        using errcode = '22023';
    end if;

    return jsonb_build_object(
      'session_id',
      latest_session.id,
      'session_number',
      latest_session.session_number,
      'is_return_session',
      latest_session.is_return_session,
      'started_at',
      latest_session.started_at
    );
  end if;

  select coalesce(max(sessions.session_number), 0) + 1
  into next_session_number
  from public.sessions
  where sessions.anonymous_user_id = owner_row.id;

  canonical_environment := private.current_app_environment();

  insert into public.sessions (
    id,
    anonymous_user_id,
    user_id,
    session_number,
    started_at,
    last_activity_at,
    is_return_session,
    entry_route,
    traffic_source,
    cohort_id,
    app_version,
    platform,
    environment,
    is_test,
    preview_namespace
  )
  values (
    p_session_id,
    owner_row.id,
    resolved_user_id,
    next_session_number,
    observed_at,
    observed_at,
    next_session_number > 1,
    btrim(p_entry_route),
    canonical_traffic_source,
    canonical_cohort_id,
    btrim(p_app_version),
    p_platform,
    canonical_environment,
    owner_row.is_test or coalesce(
      (
        select users.is_test
        from public.users
        where users.id = resolved_user_id
      ),
      false
    ),
    case
      when canonical_environment = 'preview'
        then owner_row.preview_namespace
      else null
    end
  )
  returning * into session_row;

  return jsonb_build_object(
    'session_id',
    session_row.id,
    'session_number',
    session_row.session_number,
    'is_return_session',
    session_row.is_return_session,
    'started_at',
    session_row.started_at
  );
end;
$$;

create function public.ensure_feed_instance(p_session_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner_id uuid := private.current_anonymous_user_id();
  session_row public.sessions%rowtype;
  onboarding_row public.onboarding_states%rowtype;
  feed_row public.feed_instances%rowtype;
  canonical_preference_ids text[] := '{}'::text[];
  canonical_feed_order_version constant text :=
    'lr001-catalog-order-v1';
begin
  select sessions.*
  into session_row
  from public.sessions
  where sessions.id = p_session_id;

  if not found or session_row.anonymous_user_id <> owner_id then
    raise exception 'owned session not found'
      using errcode = '42501';
  end if;

  select onboarding_states.*
  into onboarding_row
  from public.onboarding_states
  where onboarding_states.anonymous_user_id = owner_id;

  if
    not found
    or onboarding_row.status not in (
      'completed_with_preferences',
      'completed_without_preferences',
      'skipped'
    )
  then
    raise exception 'terminal onboarding state required'
      using errcode = '22023';
  end if;

  select coalesce(
    array_agg(distinct preference_id order by preference_id),
    '{}'::text[]
  )
  into canonical_preference_ids
  from unnest(onboarding_row.preference_ids)
    as preference_values(preference_id);

  insert into public.feed_instances (
    id,
    anonymous_user_id,
    session_id,
    feed_order_version,
    onboarding_version,
    preference_ids,
    preview_namespace
  )
  values (
    gen_random_uuid(),
    owner_id,
    session_row.id,
    canonical_feed_order_version,
    onboarding_row.onboarding_version,
    canonical_preference_ids,
    session_row.preview_namespace
  )
  on conflict on constraint feed_instances_session_order_version_key
  do nothing;

  select feed_instances.*
  into strict feed_row
  from public.feed_instances
  where feed_instances.session_id = session_row.id
    and feed_instances.feed_order_version =
      canonical_feed_order_version;

  if feed_row.anonymous_user_id <> owner_id then
    raise exception 'feed ownership mismatch'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'feed_instance_id',
    feed_row.id,
    'last_cursor',
    feed_row.last_cursor,
    'max_loaded_position',
    feed_row.max_loaded_position,
    'max_qualified_position',
    feed_row.max_qualified_position,
    'is_exhausted',
    feed_row.is_exhausted,
    'feed_order_version',
    feed_row.feed_order_version,
    'onboarding_version',
    feed_row.onboarding_version,
    'preference_ids',
    to_jsonb(feed_row.preference_ids)
  );
end;
$$;

create function public.append_feed_batch(
  p_feed_instance_id uuid,
  p_cursor text default null,
  p_limit integer default 24
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner_id uuid := private.current_anonymous_user_id();
  feed_row public.feed_instances%rowtype;
  canonical_request_cursor text := coalesce(p_cursor, '__initial__');
  replay_request private.feed_batch_requests%rowtype;
  replay_result jsonb;
  next_batch_number integer;
  inserted_count integer;
  new_max_loaded_position integer;
  has_more boolean;
  canonical_next_cursor text;
begin
  if p_limit is null or p_limit not between 1 and 24 then
    raise exception 'feed batch limit must be between 1 and 24'
      using errcode = '22023';
  end if;

  if p_cursor is not null
    and p_cursor !~ '^lr001-feed-cursor-v1\.[0-9a-f]{64}$' then
    raise exception 'invalid feed cursor'
      using errcode = '22023';
  end if;

  select feed_instances.*
  into feed_row
  from public.feed_instances
  where feed_instances.id = p_feed_instance_id
  for update;

  if not found or feed_row.anonymous_user_id <> owner_id then
    raise exception 'owned feed instance not found'
      using errcode = '42501';
  end if;

  select feed_batch_requests.*
  into replay_request
  from private.feed_batch_requests
  where feed_batch_requests.feed_instance_id = feed_row.id
    and feed_batch_requests.request_cursor = canonical_request_cursor;

  if found then
    if replay_request.requested_count <> p_limit then
      raise exception 'feed cursor request conflict'
        using errcode = '22023';
    end if;

    replay_result := private.feed_batch_response(
      feed_row.id,
      canonical_request_cursor
    );

    if replay_result is null then
      raise exception 'feed batch replay is unavailable'
        using errcode = '40001';
    end if;

    return replay_result;
  end if;

  if feed_row.is_exhausted then
    raise exception 'feed is already exhausted'
      using errcode = '22023';
  end if;

  if
    (feed_row.max_loaded_position = 0 and p_cursor is not null)
    or (
      feed_row.max_loaded_position > 0
      and p_cursor is distinct from feed_row.last_cursor
    )
  then
    raise exception 'invalid or stale feed cursor'
      using errcode = '22023';
  end if;

  select coalesce(max(feed_batch_requests.batch_number), 0) + 1
  into next_batch_number
  from private.feed_batch_requests
  where feed_batch_requests.feed_instance_id = feed_row.id;

  with candidates as (
    select
      products.id,
      row_number() over (order by products.id) as relative_position
    from public.products
    where products.is_active
      and not exists (
        select 1
        from public.feed_instance_products
        where feed_instance_products.feed_instance_id = feed_row.id
          and feed_instance_products.product_id = products.id
      )
    order by products.id
    limit p_limit
  ),
  inserted_rows as (
    insert into public.feed_instance_products (
      feed_instance_id,
      product_id,
      position,
      batch_number
    )
    select
      feed_row.id,
      candidates.id,
      feed_row.max_loaded_position + candidates.relative_position::integer,
      next_batch_number
    from candidates
    order by candidates.relative_position
    returning 1
  )
  select count(*)::integer
  into inserted_count
  from inserted_rows;

  new_max_loaded_position := feed_row.max_loaded_position + inserted_count;

  select exists (
    select 1
    from public.products
    where products.is_active
      and not exists (
        select 1
        from public.feed_instance_products
        where feed_instance_products.feed_instance_id = feed_row.id
          and feed_instance_products.product_id = products.id
      )
  )
  into has_more;

  canonical_next_cursor := case
    when has_more
      then private.feed_cursor_token(
        feed_row.id,
        new_max_loaded_position + 1
      )
    else null
  end;

  update public.feed_instances
  set
    last_cursor = canonical_next_cursor,
    max_loaded_position = new_max_loaded_position,
    is_exhausted = not has_more
  where feed_instances.id = feed_row.id;

  insert into private.feed_batch_requests (
    feed_instance_id,
    request_cursor,
    requested_count,
    batch_number,
    returned_count,
    next_cursor,
    is_terminal
  )
  values (
    feed_row.id,
    canonical_request_cursor,
    p_limit,
    next_batch_number,
    inserted_count,
    canonical_next_cursor,
    not has_more
  );

  return private.feed_batch_response(
    feed_row.id,
    canonical_request_cursor
  );
end;
$$;

create function public.record_qualified_feed_position(
  p_session_id uuid,
  p_feed_instance_id uuid,
  p_product_id uuid,
  p_position integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner_id uuid := private.current_anonymous_user_id();
  feed_row public.feed_instances%rowtype;
  canonical_position integer;
  canonical_max_qualified_position integer;
begin
  if p_position is null or p_position <= 0 then
    raise exception 'qualified feed position must be positive'
      using errcode = '22023';
  end if;

  select feed_instances.*
  into feed_row
  from public.feed_instances
  where feed_instances.id = p_feed_instance_id
  for update;

  if
    not found
    or feed_row.anonymous_user_id <> owner_id
    or feed_row.session_id <> p_session_id
  then
    raise exception 'owned feed session not found'
      using errcode = '42501';
  end if;

  select feed_instance_products.position
  into canonical_position
  from public.feed_instance_products
  where feed_instance_products.feed_instance_id = feed_row.id
    and feed_instance_products.product_id = p_product_id;

  if not found or canonical_position <> p_position then
    raise exception 'qualified feed membership mismatch'
      using errcode = '22023';
  end if;

  update public.feed_instances
  set max_qualified_position = greatest(
    feed_instances.max_qualified_position,
    canonical_position
  )
  where feed_instances.id = feed_row.id
  returning feed_instances.max_qualified_position
  into canonical_max_qualified_position;

  return jsonb_build_object(
    'feed_instance_id',
    feed_row.id,
    'session_id',
    feed_row.session_id,
    'max_qualified_position',
    canonical_max_qualified_position
  );
end;
$$;

alter function public.ensure_session(
  uuid,
  text,
  text,
  text,
  text,
  text
) owner to postgres;
alter function public.ensure_feed_instance(uuid) owner to postgres;
alter function public.append_feed_batch(uuid, text, integer)
owner to postgres;
alter function public.record_qualified_feed_position(
  uuid,
  uuid,
  uuid,
  integer
) owner to postgres;

revoke all on function public.ensure_session(
  uuid,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;
revoke all on function public.ensure_feed_instance(uuid)
from public, anon, authenticated;
revoke all on function public.append_feed_batch(uuid, text, integer)
from public, anon, authenticated;
revoke all on function public.record_qualified_feed_position(
  uuid,
  uuid,
  uuid,
  integer
) from public, anon, authenticated;

grant execute on function public.ensure_session(
  uuid,
  text,
  text,
  text,
  text,
  text
) to authenticated;
grant execute on function public.ensure_feed_instance(uuid)
to authenticated;
grant execute on function public.append_feed_batch(uuid, text, integer)
to authenticated;
grant execute on function public.record_qualified_feed_position(
  uuid,
  uuid,
  uuid,
  integer
) to authenticated;

commit;
