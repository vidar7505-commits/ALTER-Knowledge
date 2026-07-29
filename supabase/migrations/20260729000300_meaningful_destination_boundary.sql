begin;

create function public.record_meaningful_destination(
  p_session_id uuid,
  p_destination text,
  p_operation_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner_id uuid := private.current_anonymous_user_id();
  owner_row public.anonymous_users%rowtype;
  session_row public.sessions%rowtype;
  fingerprint jsonb;
  replay_result jsonb;
  response jsonb;
  observed_at timestamptz := statement_timestamp();
begin
  if
    p_session_id is null
    or p_session_id = '00000000-0000-0000-0000-000000000000'::uuid
  then
    raise exception 'meaningful_destination_session_invalid'
      using errcode = '22023';
  end if;

  if
    p_destination is null
    or p_destination not in ('discover', 'wardrobe', 'challenge')
  then
    raise exception 'meaningful_destination_invalid'
      using errcode = '22023';
  end if;

  fingerprint := jsonb_build_object(
    'anonymous_user_id',
    owner_id,
    'destination',
    p_destination,
    'rpc',
    'record_meaningful_destination',
    'session_id',
    p_session_id
  );

  replay_result := private.claim_mutation_operation(
    p_operation_id,
    owner_id,
    'record_meaningful_destination',
    fingerprint
  );

  if replay_result is not null then
    return replay_result;
  end if;

  select anonymous_users.*
  into strict owner_row
  from public.anonymous_users
  where anonymous_users.id = owner_id
  for update;

  select sessions.*
  into session_row
  from public.sessions
  where sessions.id = p_session_id
  for update;

  if not found then
    raise exception 'meaningful_destination_session_not_found'
      using errcode = '22023';
  end if;

  if session_row.anonymous_user_id <> owner_id then
    raise exception 'meaningful_destination_session_forbidden'
      using errcode = '42501';
  end if;

  if
    session_row.ended_at is not null
    or session_row.last_activity_at <
      observed_at - interval '30 minutes'
  then
    raise exception 'meaningful_destination_session_inactive'
      using errcode = '22023';
  end if;

  update public.anonymous_users
  set
    last_meaningful_destination = p_destination,
    state_revision = state_revision + 1
  where anonymous_users.id = owner_id
  returning * into strict owner_row;

  response := jsonb_build_object(
    'ok',
    true,
    'operation_id',
    p_operation_id,
    'state_revision',
    owner_row.state_revision,
    'data',
    jsonb_build_object(
      'destination',
      owner_row.last_meaningful_destination,
      'session_id',
      session_row.id,
      'recorded_at',
      owner_row.updated_at
    )
  );

  update private.mutation_operations
  set
    result = response,
    completed_at = observed_at
  where mutation_operations.operation_id = p_operation_id;

  return response;
end;
$$;

alter function public.record_meaningful_destination(uuid, text, uuid)
owner to postgres;

revoke all on function public.record_meaningful_destination(
  uuid,
  text,
  uuid
) from public, anon, authenticated;

grant execute on function public.record_meaningful_destination(
  uuid,
  text,
  uuid
) to authenticated;

commit;
