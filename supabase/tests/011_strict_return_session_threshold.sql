begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select no_plan();

select has_function(
  'public',
  'ensure_session',
  array['uuid', 'text', 'text', 'text', 'text', 'text'],
  'the canonical ensure_session signature exists'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname = 'ensure_session'
  ),
  1::bigint,
  'ensure_session has exactly one unambiguous signature'
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
      'public.ensure_session(uuid,text,text,text,text,text)'
    )
  ),
  'ensure_session is postgres-owned, volatile, security definer, and uses an empty search path'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.ensure_session(uuid,text,text,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.ensure_session(uuid,text,text,text,text,text)',
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
        'public.ensure_session(uuid,text,text,text,text,text)'
      )
      and function_acl.grantee = 0
      and function_acl.privilege_type = 'EXECUTE'
  ),
  'only authenticated clients can execute ensure_session'
);

select ok(
  (
    select pg_proc.proargnames =
      array[
        'p_session_id',
        'p_app_version',
        'p_platform',
        'p_entry_route',
        'p_traffic_source',
        'p_cohort_id'
      ]::text[]
    from pg_catalog.pg_proc
    where pg_proc.oid = to_regprocedure(
      'public.ensure_session(uuid,text,text,text,text,text)'
    )
  ),
  'the signature exposes no caller-controlled owner or identity input'
);

select ok(
  (
    select lower(pg_proc.prosrc)
      !~ '(^|[^a-z])execute([^a-z]|$)'
    from pg_catalog.pg_proc
    where pg_proc.oid = to_regprocedure(
      'public.ensure_session(uuid,text,text,text,text,text)'
    )
  ),
  'ensure_session contains no dynamic SQL'
);

select ok(
  (
    select
      pg_proc.prosrc ~
        'session_row\.last_activity_at[[:space:]]*<[[:space:]]*observed_at[[:space:]]*-[[:space:]]*interval ''30 minutes'''
      and pg_proc.prosrc ~
        'latest_session\.last_activity_at[[:space:]]*>=[[:space:]]*observed_at[[:space:]]*-[[:space:]]*interval ''30 minutes'''
      and pg_proc.prosrc !~
        'session_row\.last_activity_at[[:space:]]*<=[[:space:]]*observed_at'
      and pg_proc.prosrc !~
        'latest_session\.last_activity_at[[:space:]]*>[[:space:]]*observed_at'
    from pg_catalog.pg_proc
    where pg_proc.oid = to_regprocedure(
      'public.ensure_session(uuid,text,text,text,text,text)'
    )
  ),
  'the implementation uses strict expiration and inclusive reuse operators'
);

select ok(
  (
    select
      pg_proc.prosrc ~
        'observed_at timestamptz := statement_timestamp\(\)'
      and pg_proc.prosrc ~
        'order by sessions\.session_number desc'
    from pg_catalog.pg_proc
    where pg_proc.oid = to_regprocedure(
      'public.ensure_session(uuid,text,text,text,text,text)'
    )
  ),
  'server statement time and deterministic session-number ordering remain authoritative'
);

insert into auth.users (id, is_anonymous)
values
  ('a1500000-0000-4000-8000-000000000001', true),
  ('a1500000-0000-4000-8000-000000000002', true);

insert into public.anonymous_users (id, auth_user_id)
values
  (
    'a1510000-0000-4000-8000-000000000001',
    'a1500000-0000-4000-8000-000000000001'
  ),
  (
    'a1510000-0000-4000-8000-000000000002',
    'a1500000-0000-4000-8000-000000000002'
  );

insert into public.onboarding_states (
  anonymous_user_id,
  status,
  onboarding_version,
  preference_set_version,
  preference_ids,
  completion_operation_id,
  started_at,
  completed_at,
  state_revision
)
values
  (
    'a1510000-0000-4000-8000-000000000001',
    'completed_without_preferences',
    'onboarding-style-v1',
    'onboarding-style-v1',
    '{}'::text[],
    'a1520000-0000-4000-8000-000000000001',
    '2026-07-29 00:00:00+00',
    '2026-07-29 00:01:00+00',
    1
  ),
  (
    'a1510000-0000-4000-8000-000000000002',
    'completed_without_preferences',
    'onboarding-style-v1',
    'onboarding-style-v1',
    '{}'::text[],
    'a1520000-0000-4000-8000-000000000002',
    '2026-07-29 00:00:00+00',
    '2026-07-29 00:01:00+00',
    1
  );

create function public.p15a_test_ensure_at_offset(
  p_existing_session_id uuid,
  p_candidate_session_id uuid,
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
  ensured jsonb;
  stored_last_activity_at timestamptz;
begin
  update public.sessions
  set
    started_at = test_observed_at - interval '2 hours',
    last_activity_at = test_observed_at - p_inactivity
  where sessions.id = p_existing_session_id;

  if not found then
    raise exception 'test session not found';
  end if;

  ensured := public.ensure_session(
    p_candidate_session_id,
    'p15a-test',
    'web_mobile',
    '/discover',
    'p15a',
    'strict-threshold'
  );

  select sessions.last_activity_at
  into strict stored_last_activity_at
  from public.sessions
  where sessions.id = p_existing_session_id;

  return jsonb_build_object(
    'session',
    ensured,
    'observed_at',
    test_observed_at,
    'stored_last_activity_at',
    stored_last_activity_at
  );
end;
$$;

create function public.p15a_test_ensure_twice_at_offset(
  p_existing_session_id uuid,
  p_first_candidate_session_id uuid,
  p_second_candidate_session_id uuid,
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
  first_result jsonb;
  second_result jsonb;
begin
  update public.sessions
  set
    started_at = test_observed_at - interval '2 hours',
    last_activity_at = test_observed_at - p_inactivity
  where sessions.id = p_existing_session_id;

  if not found then
    raise exception 'test session not found';
  end if;

  first_result := public.ensure_session(
    p_first_candidate_session_id,
    'p15a-test',
    'web_mobile',
    '/discover',
    'p15a',
    'strict-threshold'
  );
  second_result := public.ensure_session(
    p_second_candidate_session_id,
    'p15a-test',
    'web_mobile',
    '/discover',
    'p15a',
    'strict-threshold'
  );

  return jsonb_build_object(
    'first',
    first_result,
    'second',
    second_result
  );
end;
$$;

revoke all on function public.p15a_test_ensure_at_offset(
  uuid,
  uuid,
  interval
) from public, anon;
grant execute on function public.p15a_test_ensure_at_offset(
  uuid,
  uuid,
  interval
) to authenticated;

revoke all on function public.p15a_test_ensure_twice_at_offset(
  uuid,
  uuid,
  uuid,
  interval
) from public, anon;
grant execute on function public.p15a_test_ensure_twice_at_offset(
  uuid,
  uuid,
  uuid,
  interval
) to authenticated;

set local role authenticated;
set local "request.jwt.claim.sub" =
  'a1500000-0000-4000-8000-000000000001';
set local "request.jwt.claims" =
  '{"sub":"a1500000-0000-4000-8000-000000000001","role":"authenticated"}';

select ok(
  (
    select
      (ensured ->> 'session_id')::uuid =
        'a1530000-0000-4000-8000-000000000001'::uuid
      and (ensured ->> 'session_number')::integer = 1
      and not (ensured ->> 'is_return_session')::boolean
    from (
      select public.ensure_session(
        'a1530000-0000-4000-8000-000000000001',
        'p15a-test',
        'web_mobile',
        '/discover',
        'p15a',
        'strict-threshold'
      ) as ensured
    ) as first_session
  ),
  'no prior session creates non-return session number one'
);

reset role;

select ok(
  (
    select
      sessions.anonymous_user_id =
        'a1510000-0000-4000-8000-000000000001'::uuid
      and sessions.started_at = sessions.last_activity_at
      and sessions.session_number = 1
      and not sessions.is_return_session
    from public.sessions
    where sessions.id =
      'a1530000-0000-4000-8000-000000000001'
  ),
  'the first session belongs to the authenticated identity and uses server time'
);

set local role authenticated;
set local "request.jwt.claim.sub" =
  'a1500000-0000-4000-8000-000000000001';
set local "request.jwt.claims" =
  '{"sub":"a1500000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$
    select public.ensure_feed_instance(
      'a1530000-0000-4000-8000-000000000001'
    )
  $$,
  'the first session remains compatible with feed-instance creation'
);

select ok(
  (
    select
      (result -> 'session' ->> 'session_id')::uuid =
        'a1530000-0000-4000-8000-000000000001'::uuid
      and (result -> 'session' ->> 'session_number')::integer = 1
      and (
        (result ->> 'observed_at')::timestamptz
        - (result ->> 'stored_last_activity_at')::timestamptz
      ) = interval '29 minutes 59 seconds'
    from (
      select public.p15a_test_ensure_at_offset(
        'a1530000-0000-4000-8000-000000000001',
        'a1530000-0000-4000-8000-000000000002',
        interval '29 minutes 59 seconds'
      ) as result
    ) as less_than_boundary
  ),
  '29 minutes 59 seconds reuses the same session without incrementing'
);

select ok(
  (
    select
      (result -> 'session' ->> 'session_id')::uuid =
        'a1530000-0000-4000-8000-000000000001'::uuid
      and (result -> 'session' ->> 'session_number')::integer = 1
    from (
      select public.p15a_test_ensure_at_offset(
        'a1530000-0000-4000-8000-000000000001',
        'a1530000-0000-4000-8000-000000000003',
        interval '29 minutes 59.999999 seconds'
      ) as result
    ) as microsecond_below
  ),
  'one microsecond below the threshold reuses the same session'
);

select ok(
  (
    select
      (result -> 'session' ->> 'session_id')::uuid =
        'a1530000-0000-4000-8000-000000000001'::uuid
      and (result -> 'session' ->> 'session_number')::integer = 1
      and not (result -> 'session' ->> 'is_return_session')::boolean
      and (
        (result ->> 'observed_at')::timestamptz
        - (result ->> 'stored_last_activity_at')::timestamptz
      ) = interval '30 minutes'
    from (
      select public.p15a_test_ensure_at_offset(
        'a1530000-0000-4000-8000-000000000001',
        'a1530000-0000-4000-8000-000000000001',
        interval '30 minutes'
      ) as result
    ) as exact_existing
  ),
  'exactly 30 minutes reuses the explicitly supplied existing session'
);

select ok(
  (
    select
      (result -> 'session' ->> 'session_id')::uuid =
        'a1530000-0000-4000-8000-000000000001'::uuid
      and (result -> 'session' ->> 'session_number')::integer = 1
    from (
      select public.p15a_test_ensure_at_offset(
        'a1530000-0000-4000-8000-000000000001',
        'a1530000-0000-4000-8000-000000000004',
        interval '30 minutes'
      ) as result
    ) as exact_latest
  ),
  'exactly 30 minutes makes a new candidate converge on the latest session'
);

select is(
  (
    select count(*)
    from public.sessions
    where sessions.anonymous_user_id =
      'a1510000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'exactly 30 minutes creates no second session row'
);

select is(
  (
    select public.ensure_feed_instance(
      'a1530000-0000-4000-8000-000000000001'
    ) ->> 'feed_instance_id'
  ),
  (
    select feed_instances.id::text
    from public.feed_instances
    where feed_instances.session_id =
      'a1530000-0000-4000-8000-000000000001'
  ),
  'exactly 30 minutes preserves the existing session-bound feed instance'
);

select ok(
  (
    select
      (result -> 'first' ->> 'session_id')::uuid =
        'a1530000-0000-4000-8000-000000000005'::uuid
      and (result -> 'second' ->> 'session_id')::uuid =
        'a1530000-0000-4000-8000-000000000005'::uuid
      and (result -> 'first' ->> 'session_number')::integer = 2
      and (result -> 'second' ->> 'session_number')::integer = 2
      and (result -> 'first' ->> 'is_return_session')::boolean
      and (result -> 'second' ->> 'is_return_session')::boolean
    from (
      select public.p15a_test_ensure_twice_at_offset(
        'a1530000-0000-4000-8000-000000000001',
        'a1530000-0000-4000-8000-000000000005',
        'a1530000-0000-4000-8000-000000000006',
        interval '30 minutes 0.000001 seconds'
      ) as result
    ) as above_boundary
  ),
  'one microsecond above the threshold creates one return session and repeated calls converge'
);

select is(
  (
    select count(*)
    from public.sessions
    where sessions.anonymous_user_id =
      'a1510000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'greater-than-30-minute convergence creates no duplicate session number'
);

select ok(
  exists (
    select 1
    from public.sessions
    where sessions.id =
        'a1530000-0000-4000-8000-000000000001'
      and sessions.session_number = 1
  )
  and exists (
    select 1
    from public.sessions
    where sessions.id =
        'a1530000-0000-4000-8000-000000000005'
      and sessions.session_number = 2
      and sessions.is_return_session
  ),
  'the prior session remains intact and the new session increments exactly once'
);

select lives_ok(
  $$
    select public.ensure_feed_instance(
      'a1530000-0000-4000-8000-000000000005'
    )
  $$,
  'the greater-than-30-minute return session supports its canonical feed'
);

select isnt(
  (
    select feed_instances.id
    from public.feed_instances
    where feed_instances.session_id =
      'a1530000-0000-4000-8000-000000000001'
  ),
  (
    select feed_instances.id
    from public.feed_instances
    where feed_instances.session_id =
      'a1530000-0000-4000-8000-000000000005'
  ),
  'a true return session receives a distinct session-bound feed instance'
);

select is(
  (
    public.ensure_session(
      'a1530000-0000-4000-8000-000000000007',
      'p15a-test',
      'web_mobile',
      '/discover',
      'p15a',
      'strict-threshold'
    ) ->> 'session_id'
  )::uuid,
  'a1530000-0000-4000-8000-000000000005'::uuid,
  'a later repeated call reuses session two instead of creating session three'
);

select throws_ok(
  $$
    select public.ensure_session(
      'a1530000-0000-4000-8000-000000000005',
      'p15a-test',
      'web_mobile',
      '/discover',
      null,
      null
    )
  $$,
  '42501',
  'session ownership mismatch',
  'user B cannot reuse user A session'
);

reset role;

set local role authenticated;
set local "request.jwt.claim.sub" =
  'a1500000-0000-4000-8000-000000000002';
set local "request.jwt.claims" =
  '{"sub":"a1500000-0000-4000-8000-000000000002","role":"authenticated"}';

select ok(
  (
    select
      (ensured ->> 'session_id')::uuid =
        'a1530000-0000-4000-8000-000000000008'::uuid
      and (ensured ->> 'session_number')::integer = 1
      and not (ensured ->> 'is_return_session')::boolean
    from (
      select public.ensure_session(
        'a1530000-0000-4000-8000-000000000008',
        'p15a-test',
        'web_mobile',
        '/discover',
        null,
        null
      ) as ensured
    ) as user_b_first
  ),
  'user B starts an isolated non-return session number one'
);

reset role;

select is(
  (
    select count(*)
    from public.sessions
    where sessions.anonymous_user_id =
      'a1510000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'user A threshold transitions do not affect user B'
);

select * from finish();

rollback;
