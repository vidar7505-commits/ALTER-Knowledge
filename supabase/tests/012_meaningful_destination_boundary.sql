begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select no_plan();

select has_function(
  'public',
  'record_meaningful_destination',
  array['uuid', 'text', 'uuid'],
  'the meaningful destination RPC exists with the approved signature'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname = 'record_meaningful_destination'
  ),
  1::bigint,
  'record_meaningful_destination has exactly one unambiguous signature'
);

select is(
  (
    select pg_catalog.pg_get_function_result(pg_proc.oid)
    from pg_catalog.pg_proc
    where pg_proc.oid = to_regprocedure(
      'public.record_meaningful_destination(uuid,text,uuid)'
    )
  ),
  'jsonb',
  'record_meaningful_destination returns jsonb'
);

select ok(
  (
    select
      pg_catalog.pg_get_userbyid(pg_proc.proowner) = 'postgres'
      and pg_proc.prosecdef
      and pg_proc.provolatile = 'v'
      and 'search_path=""' = any(pg_proc.proconfig)
    from pg_catalog.pg_proc
    where pg_proc.oid = to_regprocedure(
      'public.record_meaningful_destination(uuid,text,uuid)'
    )
  ),
  'the RPC is postgres-owned, volatile, security definer, and uses an empty search path'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.record_meaningful_destination(uuid,text,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.record_meaningful_destination(uuid,text,uuid)',
    'EXECUTE'
  )
  and not exists (
    select 1
    from pg_catalog.pg_proc
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        pg_proc.proacl,
        pg_catalog.acldefault('f', pg_proc.proowner)
      )
    ) as function_acl
    where pg_proc.oid = to_regprocedure(
        'public.record_meaningful_destination(uuid,text,uuid)'
      )
      and function_acl.grantee = 0
      and function_acl.privilege_type = 'EXECUTE'
  ),
  'only authenticated clients can execute the RPC'
);

select ok(
  (
    select pg_proc.proargnames =
      array[
        'p_session_id',
        'p_destination',
        'p_operation_id'
      ]::text[]
    from pg_catalog.pg_proc
    where pg_proc.oid = to_regprocedure(
      'public.record_meaningful_destination(uuid,text,uuid)'
    )
  ),
  'the RPC exposes no caller-controlled ownership parameter'
);

select ok(
  (
    select
      lower(pg_proc.prosrc) !~ '(^|[^a-z])execute([^a-z]|$)'
      and pg_proc.prosrc ~ (
        'session_row\.last_activity_at[[:space:]]*<[[:space:]]*'
        || 'observed_at[[:space:]]*-[[:space:]]*interval ''30 minutes'''
      )
      and pg_proc.prosrc !~ (
        'session_row\.last_activity_at[[:space:]]*<=[[:space:]]*'
        || 'observed_at'
      )
      and pg_proc.prosrc ~
        'observed_at timestamptz := statement_timestamp\(\)'
    from pg_catalog.pg_proc
    where pg_proc.oid = to_regprocedure(
      'public.record_meaningful_destination(uuid,text,uuid)'
    )
  ),
  'the RPC has no dynamic SQL and uses the strict server-time threshold'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.anonymous_users',
    'UPDATE'
  )
  and not has_table_privilege(
    'anon',
    'public.anonymous_users',
    'UPDATE'
  ),
  'direct browser UPDATE on anonymous_users remains unavailable'
);

select throws_ok(
  $$
    select public.record_meaningful_destination(
      'c5200000-0000-4000-8000-000000000001',
      'discover',
      'c5300000-0000-4000-8000-000000000001'
    )
  $$,
  '28000',
  'anonymous authentication required',
  'the RPC rejects an unauthenticated caller'
);

insert into auth.users (id, is_anonymous)
values
  ('c5000000-0000-4000-8000-000000000001', true),
  ('c5000000-0000-4000-8000-000000000002', true);

insert into public.anonymous_users (
  id,
  auth_user_id,
  first_seen_at,
  last_seen_at
)
values
  (
    'c5100000-0000-4000-8000-000000000001',
    'c5000000-0000-4000-8000-000000000001',
    '2026-07-29 00:00:00+00',
    '2026-07-29 00:05:00+00'
  ),
  (
    'c5100000-0000-4000-8000-000000000002',
    'c5000000-0000-4000-8000-000000000002',
    '2026-07-29 00:00:00+00',
    '2026-07-29 00:05:00+00'
  );

insert into public.sessions (
  id,
  anonymous_user_id,
  session_number,
  started_at,
  last_activity_at,
  ended_at,
  is_return_session,
  entry_route,
  app_version,
  platform,
  environment
)
values
  (
    'c5200000-0000-4000-8000-000000000001',
    'c5100000-0000-4000-8000-000000000001',
    1,
    statement_timestamp() - interval '10 minutes',
    statement_timestamp(),
    null,
    false,
    '/discover',
    'p15c-test',
    'web_mobile',
    'local'
  ),
  (
    'c5200000-0000-4000-8000-000000000002',
    'c5100000-0000-4000-8000-000000000002',
    1,
    statement_timestamp() - interval '10 minutes',
    statement_timestamp(),
    null,
    false,
    '/wardrobe',
    'p15c-test',
    'web_mobile',
    'local'
  ),
  (
    'c5200000-0000-4000-8000-000000000003',
    'c5100000-0000-4000-8000-000000000001',
    2,
    statement_timestamp() - interval '20 minutes',
    statement_timestamp() - interval '10 minutes',
    statement_timestamp() - interval '5 minutes',
    true,
    '/challenge',
    'p15c-test',
    'web_mobile',
    'local'
  ),
  (
    'c5200000-0000-4000-8000-000000000004',
    'c5100000-0000-4000-8000-000000000001',
    3,
    statement_timestamp() - interval '2 hours',
    statement_timestamp() - interval '31 minutes',
    null,
    true,
    '/discover',
    'p15c-test',
    'web_mobile',
    'local'
  ),
  (
    'c5200000-0000-4000-8000-000000000005',
    'c5100000-0000-4000-8000-000000000001',
    4,
    statement_timestamp() - interval '2 hours',
    statement_timestamp(),
    null,
    true,
    '/discover',
    'p15c-test',
    'web_mobile',
    'local'
  ),
  (
    'c5200000-0000-4000-8000-000000000006',
    'c5100000-0000-4000-8000-000000000001',
    5,
    statement_timestamp() - interval '2 hours',
    statement_timestamp(),
    null,
    true,
    '/discover',
    'p15c-test',
    'web_mobile',
    'local'
  ),
  (
    'c5200000-0000-4000-8000-000000000007',
    'c5100000-0000-4000-8000-000000000001',
    6,
    statement_timestamp() - interval '2 hours',
    statement_timestamp(),
    null,
    true,
    '/discover',
    'p15c-test',
    'web_mobile',
    'local'
  );

create temporary table p15c_session_snapshot as
select to_jsonb(sessions.*) as row_data
from public.sessions
where sessions.id = 'c5200000-0000-4000-8000-000000000001';

insert into public.feed_instances (
  id,
  anonymous_user_id,
  session_id,
  feed_order_version
)
values (
  'c5400000-0000-4000-8000-000000000001',
  'c5100000-0000-4000-8000-000000000001',
  'c5200000-0000-4000-8000-000000000001',
  'lr001-catalog-order-v1'
);

create temporary table p15c_feed_snapshot as
select to_jsonb(feed_instances.*) as row_data
from public.feed_instances
where feed_instances.id = 'c5400000-0000-4000-8000-000000000001';

create function public.p15c_test_record_at_offset(
  p_session_id uuid,
  p_destination text,
  p_operation_id uuid,
  p_inactivity interval
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  test_observed_at timestamptz := statement_timestamp();
  recorded jsonb;
begin
  update public.sessions
  set
    started_at = test_observed_at - interval '2 hours',
    last_activity_at = test_observed_at - p_inactivity,
    ended_at = null
  where sessions.id = p_session_id;

  if not found then
    raise exception 'test session not found';
  end if;

  recorded := public.record_meaningful_destination(
    p_session_id,
    p_destination,
    p_operation_id
  );

  return jsonb_build_object(
    'recorded',
    recorded,
    'observed_at',
    test_observed_at
  );
end;
$$;

revoke all on function public.p15c_test_record_at_offset(
  uuid,
  text,
  uuid,
  interval
) from public, anon;
grant execute on function public.p15c_test_record_at_offset(
  uuid,
  text,
  uuid,
  interval
) to authenticated;

create function public.p15c_test_return_and_record(
  p_existing_session_id uuid,
  p_candidate_session_id uuid,
  p_operation_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  test_observed_at timestamptz := statement_timestamp();
  ensured jsonb;
  recorded jsonb;
begin
  update public.sessions
  set
    started_at = test_observed_at - interval '2 hours',
    last_activity_at =
      test_observed_at - interval '30 minutes 0.000001 seconds',
    ended_at = null
  where sessions.id = p_existing_session_id;

  if not found then
    raise exception 'test session not found';
  end if;

  ensured := public.ensure_session(
    p_candidate_session_id,
    'p15c-test',
    'web_mobile',
    '/discover',
    'p15c',
    'meaningful-destination'
  );

  recorded := public.record_meaningful_destination(
    (ensured ->> 'session_id')::uuid,
    'challenge',
    p_operation_id
  );

  return jsonb_build_object(
    'recorded',
    recorded,
    'session',
    ensured
  );
end;
$$;

revoke all on function public.p15c_test_return_and_record(
  uuid,
  uuid,
  uuid
) from public, anon;
grant execute on function public.p15c_test_return_and_record(
  uuid,
  uuid,
  uuid
) to authenticated;

set local role authenticated;
set local "request.jwt.claim.sub" =
  'c5000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" =
  '{"sub":"c5000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$
    select public.record_meaningful_destination(
      'c5200000-0000-4000-8000-000000000001',
      null,
      'c5300000-0000-4000-8000-000000000002'
    )
  $$,
  '22023',
  'meaningful_destination_invalid',
  'a null destination is rejected'
);

select throws_ok(
  $$
    select public.record_meaningful_destination(
      'c5200000-0000-4000-8000-000000000001',
      '',
      'c5300000-0000-4000-8000-000000000003'
    )
  $$,
  '22023',
  'meaningful_destination_invalid',
  'an empty destination is rejected'
);

select throws_ok(
  $$
    select public.record_meaningful_destination(
      'c5200000-0000-4000-8000-000000000001',
      'product_detail',
      'c5300000-0000-4000-8000-000000000004'
    )
  $$,
  '22023',
  'meaningful_destination_invalid',
  'an unknown destination is rejected'
);

select throws_ok(
  $$
    select public.record_meaningful_destination(
      'c5200000-0000-4000-8000-000000000001',
      'Discover',
      'c5300000-0000-4000-8000-000000000005'
    )
  $$,
  '22023',
  'meaningful_destination_invalid',
  'mixed-case input is not normalized'
);

select throws_ok(
  $$
    select public.record_meaningful_destination(
      null,
      'discover',
      'c5300000-0000-4000-8000-000000000006'
    )
  $$,
  '22023',
  'meaningful_destination_session_invalid',
  'a null session ID is rejected'
);

select throws_ok(
  $$
    select public.record_meaningful_destination(
      'c5200000-0000-4000-8000-000000000001',
      'discover',
      null
    )
  $$,
  '22023',
  'a non-nil operation_id is required',
  'a null operation ID is rejected by the canonical ledger'
);

reset role;

select ok(
  (
    select
      anonymous_users.last_meaningful_destination is null
      and anonymous_users.state_revision = 0
    from public.anonymous_users
    where anonymous_users.id =
      'c5100000-0000-4000-8000-000000000001'
  ),
  'invalid destinations change no identity state'
);

select is(
  (
    select count(*)
    from private.mutation_operations
    where mutation_operations.operation_id in (
      'c5300000-0000-4000-8000-000000000002',
      'c5300000-0000-4000-8000-000000000003',
      'c5300000-0000-4000-8000-000000000004',
      'c5300000-0000-4000-8000-000000000005'
    )
  ),
  0::bigint,
  'invalid destinations leave no successful mutation result'
);

set local role authenticated;
set local "request.jwt.claim.sub" =
  'c5000000-0000-4000-8000-000000000001';
set local "request.jwt.claims" =
  '{"sub":"c5000000-0000-4000-8000-000000000001","role":"authenticated"}';

create temporary table p15c_results (
  result_name text primary key,
  result jsonb not null
);

insert into p15c_results
values (
  'discover',
  public.record_meaningful_destination(
    'c5200000-0000-4000-8000-000000000001',
    'discover',
    'c5300000-0000-4000-8000-000000000010'
  )
);

insert into p15c_results
values (
  'discover_replay',
  public.record_meaningful_destination(
    'c5200000-0000-4000-8000-000000000001',
    'discover',
    'c5300000-0000-4000-8000-000000000010'
  )
);

select is(
  (select result from p15c_results where result_name = 'discover_replay'),
  (select result from p15c_results where result_name = 'discover'),
  'identical replay returns the original canonical result'
);

select ok(
  (
    select
      (result ->> 'ok')::boolean
      and (result ->> 'operation_id')::uuid =
        'c5300000-0000-4000-8000-000000000010'::uuid
      and (result ->> 'state_revision')::bigint = 1
      and result -> 'data' ->> 'destination' = 'discover'
      and (result -> 'data' ->> 'session_id')::uuid =
        'c5200000-0000-4000-8000-000000000001'::uuid
      and (result -> 'data' ->> 'recorded_at')::timestamptz is not null
      and not (result ? 'anonymous_user_id')
      and not (result -> 'data' ? 'anonymous_user_id')
      and not (result -> 'data' ? 'auth_user_id')
    from p15c_results
    where result_name = 'discover'
  ),
  'the return payload is stable, complete, and contains no ownership identifier'
);

select is(
  (
    select anonymous_users.state_revision
    from public.anonymous_users
    where anonymous_users.id =
      'c5100000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'replay does not increment state revision twice'
);

select throws_ok(
  $$
    select public.record_meaningful_destination(
      'c5200000-0000-4000-8000-000000000001',
      'wardrobe',
      'c5300000-0000-4000-8000-000000000010'
    )
  $$,
  '22023',
  'operation_id conflict',
  'the same operation ID with another destination conflicts'
);

select throws_ok(
  $$
    select public.record_meaningful_destination(
      'c5200000-0000-4000-8000-000000000005',
      'discover',
      'c5300000-0000-4000-8000-000000000010'
    )
  $$,
  '22023',
  'operation_id conflict',
  'the same operation ID with another session conflicts'
);

insert into p15c_results
values (
  'wardrobe',
  public.record_meaningful_destination(
    'c5200000-0000-4000-8000-000000000001',
    'wardrobe',
    'c5300000-0000-4000-8000-000000000011'
  )
);

insert into p15c_results
values (
  'challenge',
  public.record_meaningful_destination(
    'c5200000-0000-4000-8000-000000000001',
    'challenge',
    'c5300000-0000-4000-8000-000000000012'
  )
);

select ok(
  (
    select
      (wardrobe.result ->> 'state_revision')::bigint = 2
      and wardrobe.result -> 'data' ->> 'destination' = 'wardrobe'
      and (challenge.result ->> 'state_revision')::bigint = 3
      and challenge.result -> 'data' ->> 'destination' = 'challenge'
    from p15c_results as wardrobe
    cross join p15c_results as challenge
    where wardrobe.result_name = 'wardrobe'
      and challenge.result_name = 'challenge'
  ),
  'all three allowlisted destinations record deterministically'
);

select is(
  (
    public.record_meaningful_destination(
      'c5200000-0000-4000-8000-000000000001',
      'challenge',
      'c5300000-0000-4000-8000-000000000013'
    ) ->> 'state_revision'
  )::bigint,
  4::bigint,
  'a new operation ID for the same destination succeeds normally'
);

select throws_ok(
  $$
    select public.record_meaningful_destination(
      'c5200000-0000-4000-8000-000000000002',
      'discover',
      'c5300000-0000-4000-8000-000000000020'
    )
  $$,
  '42501',
  'meaningful_destination_session_forbidden',
  'a foreign session is rejected'
);

select throws_ok(
  $$
    select public.record_meaningful_destination(
      'c5200000-0000-4000-8000-000000000099',
      'discover',
      'c5300000-0000-4000-8000-000000000021'
    )
  $$,
  '22023',
  'meaningful_destination_session_not_found',
  'a missing session is rejected'
);

select throws_ok(
  $$
    select public.record_meaningful_destination(
      'c5200000-0000-4000-8000-000000000003',
      'discover',
      'c5300000-0000-4000-8000-000000000022'
    )
  $$,
  '22023',
  'meaningful_destination_session_inactive',
  'an ended session is rejected'
);

select throws_ok(
  $$
    select public.record_meaningful_destination(
      'c5200000-0000-4000-8000-000000000004',
      'discover',
      'c5300000-0000-4000-8000-000000000023'
    )
  $$,
  '22023',
  'meaningful_destination_session_inactive',
  'a stale session is rejected'
);

select ok(
  (
    select
      (result -> 'recorded' ->> 'state_revision')::bigint = 5
      and result -> 'recorded' -> 'data' ->> 'destination' = 'discover'
    from (
      select public.p15c_test_record_at_offset(
        'c5200000-0000-4000-8000-000000000005',
        'discover',
        'c5300000-0000-4000-8000-000000000024',
        interval '30 minutes'
      ) as result
    ) as exact_boundary
  ),
  'a session exactly 30 minutes old remains active'
);

select ok(
  (
    select
      (result -> 'recorded' ->> 'state_revision')::bigint = 6
      and result -> 'recorded' -> 'data' ->> 'destination' = 'wardrobe'
    from (
      select public.p15c_test_record_at_offset(
        'c5200000-0000-4000-8000-000000000006',
        'wardrobe',
        'c5300000-0000-4000-8000-000000000025',
        interval '29 minutes 59 seconds'
      ) as result
    ) as below_boundary
  ),
  'a session 29 minutes 59 seconds old remains active'
);

select throws_ok(
  $$
    select public.p15c_test_record_at_offset(
      'c5200000-0000-4000-8000-000000000007',
      'challenge',
      'c5300000-0000-4000-8000-000000000026',
      interval '30 minutes 0.000001 seconds'
    )
  $$,
  '22023',
  'meaningful_destination_session_inactive',
  'one microsecond beyond 30 minutes is rejected'
);

select ok(
  (
    select
      (result -> 'session' ->> 'session_id')::uuid =
        'c5200000-0000-4000-8000-000000000008'::uuid
      and (result -> 'session' ->> 'session_number')::integer = 7
      and (result -> 'session' ->> 'is_return_session')::boolean
      and (result -> 'recorded' ->> 'state_revision')::bigint = 7
      and result -> 'recorded' -> 'data' ->> 'destination' = 'challenge'
      and (result -> 'recorded' -> 'data' ->> 'session_id')::uuid =
        'c5200000-0000-4000-8000-000000000008'::uuid
    from (
      select public.p15c_test_return_and_record(
        'c5200000-0000-4000-8000-000000000006',
        'c5200000-0000-4000-8000-000000000008',
        'c5300000-0000-4000-8000-000000000027'
      ) as result
    ) as return_integration
  ),
  'a greater-than-30-minute return creates a new session before recording its destination'
);

reset role;

select is(
  (
    select count(*)
    from private.mutation_operations
    where mutation_operations.operation_id in (
      'c5300000-0000-4000-8000-000000000020',
      'c5300000-0000-4000-8000-000000000021',
      'c5300000-0000-4000-8000-000000000022',
      'c5300000-0000-4000-8000-000000000023',
      'c5300000-0000-4000-8000-000000000026'
    )
  ),
  0::bigint,
  'failed session validation leaves no mutation-ledger row'
);

select is(
  (
    select to_jsonb(sessions.*)
    from public.sessions
    where sessions.id = 'c5200000-0000-4000-8000-000000000001'
  ),
  (select row_data from p15c_session_snapshot),
  'recording a destination does not mutate the session row'
);

select ok(
  (
    select
      anonymous_users.auth_user_id =
        'c5000000-0000-4000-8000-000000000001'::uuid
      and anonymous_users.first_seen_at =
        '2026-07-29 00:00:00+00'::timestamptz
      and anonymous_users.last_seen_at =
        '2026-07-29 00:05:00+00'::timestamptz
      and anonymous_users.merged_into_user_id is null
      and not anonymous_users.is_test
      and anonymous_users.preview_namespace is null
    from public.anonymous_users
    where anonymous_users.id =
      'c5100000-0000-4000-8000-000000000001'
  ),
  'no unrelated anonymous-user fields change'
);

select is(
  (
    select (
      (result -> 'data' ->> 'recorded_at')::timestamptz =
      anonymous_users.updated_at
    )
    from p15c_results
    cross join public.anonymous_users
    where p15c_results.result_name = 'challenge'
      and anonymous_users.id =
        'c5100000-0000-4000-8000-000000000001'
  ),
  true,
  'the return payload uses the canonical server audit timestamp'
);

select is(
  (
    select count(*)
    from public.sessions
    where sessions.anonymous_user_id =
      'c5100000-0000-4000-8000-000000000001'
      and sessions.session_number between 1 and 6
  ),
  6::bigint,
  'destination writes do not alter user A session-number lineage'
);

set local role authenticated;
set local "request.jwt.claim.sub" =
  'c5000000-0000-4000-8000-000000000002';
set local "request.jwt.claims" =
  '{"sub":"c5000000-0000-4000-8000-000000000002","role":"authenticated"}';

select is(
  auth.uid(),
  'c5000000-0000-4000-8000-000000000002'::uuid,
  'identity-isolation assertions run as user B'
);

select throws_ok(
  $$
    select public.record_meaningful_destination(
      'c5200000-0000-4000-8000-000000000001',
      'wardrobe',
      'c5300000-0000-4000-8000-000000000030'
    )
  $$,
  '42501',
  'meaningful_destination_session_forbidden',
  'user B cannot write through user A session'
);

select throws_ok(
  $$
    select public.record_meaningful_destination(
      'c5200000-0000-4000-8000-000000000002',
      'discover',
      'c5300000-0000-4000-8000-000000000010'
    )
  $$,
  '22023',
  'operation_id conflict',
  'user B cannot replay user A operation ID'
);

select ok(
  (
    select
      result -> 'data' ->> 'destination' = 'wardrobe'
      and (result -> 'data' ->> 'session_id')::uuid =
        'c5200000-0000-4000-8000-000000000002'::uuid
      and (result ->> 'state_revision')::bigint = 1
    from (
      select public.record_meaningful_destination(
        'c5200000-0000-4000-8000-000000000002',
        'wardrobe',
        'c5300000-0000-4000-8000-000000000031'
      ) as result
    ) as user_b_result
  ),
  'user B records only user B canonical state'
);

reset role;

select ok(
  (
    select
      user_a.last_meaningful_destination = 'challenge'
      and user_a.state_revision = 7
      and user_b.last_meaningful_destination = 'wardrobe'
      and user_b.state_revision = 1
    from public.anonymous_users as user_a
    cross join public.anonymous_users as user_b
    where user_a.id = 'c5100000-0000-4000-8000-000000000001'
      and user_b.id = 'c5100000-0000-4000-8000-000000000002'
  ),
  'user B write leaves user A state unchanged'
);

select ok(
  (
    select
      count(*) filter (
        where sessions.anonymous_user_id =
          'c5100000-0000-4000-8000-000000000001'
      ) = 7
      and count(*) filter (
        where sessions.anonymous_user_id =
          'c5100000-0000-4000-8000-000000000002'
      ) = 1
      and max(sessions.session_number) filter (
        where sessions.anonymous_user_id =
          'c5100000-0000-4000-8000-000000000002'
      ) = 1
    from public.sessions
  ),
  'session-number lineages remain identity-scoped'
);

select ok(
  (
    select to_jsonb(feed_instances.*)
    from public.feed_instances
    where feed_instances.id =
      'c5400000-0000-4000-8000-000000000001'
  ) = (select row_data from p15c_feed_snapshot)
  and not exists (
    select 1
    from public.feed_instance_products
  ),
  'meaningful destination recording preserves P11 feed ownership and state'
);

select * from finish();

rollback;
