create or replace function public.ensure_session(
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
      or session_row.last_activity_at < observed_at - interval '30 minutes'
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
    and latest_session.last_activity_at >=
      observed_at - interval '30 minutes'
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

alter function public.ensure_session(
  uuid,
  text,
  text,
  text,
  text,
  text
) owner to postgres;

revoke all on function public.ensure_session(
  uuid,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.ensure_session(
  uuid,
  text,
  text,
  text,
  text,
  text
) to authenticated;
