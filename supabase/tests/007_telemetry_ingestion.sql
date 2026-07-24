begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select no_plan();

create function pg_temp.telemetry_event(
  p_event_id uuid,
  p_session_id uuid,
  p_occurred_at timestamptz default transaction_timestamp()
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'event_id', p_event_id,
    'event_name', 'session_started',
    'event_version', 1,
    'occurred_at', p_occurred_at,
    'session_id', p_session_id,
    'platform', 'web_mobile',
    'surface', 'app_boot',
    'source_surface', null,
    'client_sequence', 0,
    'properties', jsonb_build_object(
      'session_number', 1,
      'is_return_session', false,
      'prior_session_ended_at', null,
      'entry_route', '/discover'
    ),
    'context', jsonb_build_object(
      'timezone_offset_minutes', 180,
      'locale', 'tr-TR',
      'viewport_width', 390,
      'viewport_height', 844,
      'network_state', 'online',
      'experiment_assignments', '{}'::jsonb
    )
  );
$$;

select ok(
  exists (
    select 1
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname = 'ingest_telemetry_batch'
      and pg_proc.prosecdef
      and 'search_path=""' = any(pg_proc.proconfig)
      and pg_get_userbyid(pg_proc.proowner) = 'postgres'
  ),
  'trusted telemetry ingestion is postgres-owned security definer with an empty search path'
);

select ok(
  (
    select has_function_privilege('service_role', pg_proc.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', pg_proc.oid, 'EXECUTE')
      and not has_function_privilege('anon', pg_proc.oid, 'EXECUTE')
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname = 'ingest_telemetry_batch'
  ),
  'only service_role can execute trusted telemetry ingestion'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname in ('public', 'private')
      and pg_proc.proname like '%telemetry%'
      and lower(pg_proc.prosrc) ~ '(^|[^a-z])execute([^a-z]|$)'
  ),
  'telemetry functions contain no dynamic SQL'
);

select ok(
  not has_table_privilege('authenticated', 'public.events', 'INSERT')
  and not has_table_privilege(
    'authenticated',
    'public.event_quarantine',
    'INSERT'
  ),
  'authenticated has no direct event or quarantine insert privilege'
);

set local role authenticated;

select throws_like(
  $$
    insert into public.events (
      event_id,
      event_name,
      event_version,
      occurred_at,
      anonymous_user_id,
      session_id,
      release_id,
      app_version,
      platform,
      environment,
      surface,
      client_sequence
    )
    values (
      'a0000000-0000-4000-8000-000000000001',
      'session_started',
      1,
      statement_timestamp(),
      'a1000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000001',
      'LR-001',
      'test',
      'web_mobile',
      'local',
      'app_boot',
      0
    )
  $$,
  '%permission denied%',
  'direct authenticated event insert is denied behaviorally'
);

select throws_like(
  $$
    insert into public.event_quarantine (
      raw_payload,
      error_codes,
      environment
    )
    values ('{}'::jsonb, array['invalid'], 'local')
  $$,
  '%permission denied%',
  'direct authenticated quarantine insert is denied behaviorally'
);

select throws_like(
  $$
    select public.ingest_telemetry_batch(
      'a0000000-0000-4000-8000-000000000001',
      '{}'::jsonb,
      '[]'::jsonb,
      'local',
      'test',
      null
    )
  $$,
  '%permission denied%',
  'authenticated callers cannot bypass the trusted route'
);

reset role;

insert into auth.users (id, is_anonymous)
values
  ('a0000000-0000-4000-8000-000000000001', true),
  ('a0000000-0000-4000-8000-000000000002', true);

insert into public.anonymous_users (
  id,
  auth_user_id,
  is_test,
  preview_namespace
)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    false,
    null
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000002',
    true,
    'identity-preview'
  );

select throws_like(
  $$
    select public.ingest_telemetry_batch(
      null,
      '{}'::jsonb,
      '[]'::jsonb,
      'local',
      'test',
      null
    )
  $$,
  '%authenticated identity required%',
  'ingestion rejects a missing verified Auth identity'
);

select is(
  public.ingest_telemetry_batch(
    'a0000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'session_id', 'a2000000-0000-4000-8000-000000000001',
      'platform', 'web_mobile',
      'entry_route', '/discover',
      'traffic_source', 'internal-qa',
      'cohort_id', 'p07'
    ),
    jsonb_build_array(
      pg_temp.telemetry_event(
        'a3000000-0000-4000-8000-000000000001',
        'a2000000-0000-4000-8000-000000000001'
      )
    ),
    'preview',
    'p07-test',
    'branch-p07'
  ) -> 'results' -> 0 ->> 'status',
  'accepted',
  'a valid canonical event is accepted'
);

select is(
  (
    select anonymous_user_id
    from public.events
    where event_id = 'a3000000-0000-4000-8000-000000000001'
  ),
  'a1000000-0000-4000-8000-000000000001'::uuid,
  'accepted event identity is resolved from verified Auth mapping'
);

select ok(
  (
    select environment = 'preview'
      and app_version = 'p07-test'
      and preview_namespace = 'branch-p07'
      and received_at is not null
    from public.events
    where event_id = 'a3000000-0000-4000-8000-000000000001'
  ),
  'environment, app version, preview namespace, and received time are server-derived'
);

select ok(
  (
    select session_number = 1
      and not is_return_session
      and anonymous_user_id = 'a1000000-0000-4000-8000-000000000001'
      and environment = 'preview'
    from public.sessions
    where id = 'a2000000-0000-4000-8000-000000000001'
  ),
  'session ensure preserves first-session numbering and trusted ownership'
);

select is(
  public.ingest_telemetry_batch(
    'a0000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'session_id', 'a2000000-0000-4000-8000-000000000001',
      'platform', 'web_mobile',
      'entry_route', '/discover'
    ),
    jsonb_build_array(
      pg_temp.telemetry_event(
        'a3000000-0000-4000-8000-000000000001',
        'a2000000-0000-4000-8000-000000000001'
      )
    ),
    'production',
    'new-deploy',
    null
  ) -> 'results' -> 0 ->> 'status',
  'duplicate',
  'an equivalent event replay returns duplicate'
);

select is(
  (
    select count(*)
    from public.events
    where event_id = 'a3000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'equivalent replay creates no second event'
);

select is(
  public.ingest_telemetry_batch(
    'a0000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'session_id', 'a2000000-0000-4000-8000-000000000001',
      'platform', 'web_mobile',
      'entry_route', '/discover'
    ),
    jsonb_build_array(
      jsonb_set(
        pg_temp.telemetry_event(
          'a3000000-0000-4000-8000-000000000001',
          'a2000000-0000-4000-8000-000000000001'
        ),
        '{properties,entry_route}',
        '"/wardrobe"'::jsonb
      )
    ),
    'preview',
    'p07-test',
    'branch-p07'
  ) -> 'results' -> 0 ->> 'status',
  'rejected',
  'conflicting event ID reuse is rejected'
);

select is(
  (
    select error_codes[1]
    from public.event_quarantine
    order by received_at desc, id desc
    limit 1
  ),
  'event_id_conflict',
  'conflicting replay is inspectable with a stable quarantine code'
);

select is(
  public.ingest_telemetry_batch(
    'a0000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'session_id', 'a2000000-0000-4000-8000-000000000001',
      'platform', 'web_mobile',
      'entry_route', '/discover'
    ),
    jsonb_build_array(
      pg_temp.telemetry_event(
        'a3000000-0000-4000-8000-000000000002',
        'a2000000-0000-4000-8000-000000000001'
      )
    ),
    'production',
    'p07-test',
    null
  ) -> 'results' -> 0 ->> 'status',
  'rejected',
  'a second user cannot emit into a foreign session'
);

select is(
  (
    select error_codes[1]
    from public.event_quarantine
    order by received_at desc, id desc
    limit 1
  ),
  'session_owner_mismatch',
  'foreign session spoofing records the ownership error code'
);

select is(
  public.ingest_telemetry_batch(
    'a0000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'session_id', 'a2000000-0000-4000-8000-000000000001',
      'platform', 'web_mobile',
      'entry_route', '/discover'
    ),
    jsonb_build_array(
      pg_temp.telemetry_event(
        'a3000000-0000-4000-8000-000000000003',
        'a2000000-0000-4000-8000-000000000001'
      ) || jsonb_build_object(
        'anonymous_user_id',
        'a1000000-0000-4000-8000-000000000002'
      )
    ),
    'preview',
    'p07-test',
    'branch-p07'
  ) -> 'results' -> 0 ->> 'status',
  'rejected',
  'caller-supplied ownership fields are rejected'
);

select is(
  (
    select error_codes[1]
    from public.event_quarantine
    order by received_at desc, id desc
    limit 1
  ),
  'forbidden_trusted_field',
  'forged trusted ownership receives a stable error code'
);

select is(
  public.ingest_telemetry_batch(
    'a0000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'session_id', 'a2000000-0000-4000-8000-000000000001',
      'platform', 'web_mobile',
      'entry_route', '/discover'
    ),
    jsonb_build_array(
      jsonb_set(
        pg_temp.telemetry_event(
          'a3000000-0000-4000-8000-000000000004',
          'a2000000-0000-4000-8000-000000000001'
        ),
        '{event_name}',
        '"unknown_event"'::jsonb
      ),
      jsonb_set(
        pg_temp.telemetry_event(
          'a3000000-0000-4000-8000-000000000005',
          'a2000000-0000-4000-8000-000000000001'
        ),
        '{event_version}',
        '2'::jsonb
      ),
      (
        pg_temp.telemetry_event(
          'a3000000-0000-4000-8000-000000000006',
          'a2000000-0000-4000-8000-000000000001'
        ) #- '{properties,entry_route}'
      ),
      jsonb_set(
        pg_temp.telemetry_event(
          'a3000000-0000-4000-8000-000000000007',
          'a2000000-0000-4000-8000-000000000001'
        ),
        '{properties,session_number}',
        '"one"'::jsonb
      )
    ),
    'preview',
    'p07-test',
    'branch-p07'
  ) -> 'results' -> 0 ->> 'status',
  'quarantined',
  'unknown event name is quarantined'
);

select is(
  (
    select array_agg(
      result -> 'error_codes' ->> 0
      order by (result ->> 'index')::integer
    )
    from jsonb_array_elements(
      public.ingest_telemetry_batch(
        'a0000000-0000-4000-8000-000000000001',
        jsonb_build_object(
          'session_id', 'a2000000-0000-4000-8000-000000000001',
          'platform', 'web_mobile',
          'entry_route', '/discover'
        ),
        jsonb_build_array(
          jsonb_set(
            pg_temp.telemetry_event(
              'a3000000-0000-4000-8000-000000000008',
              'a2000000-0000-4000-8000-000000000001'
            ),
            '{event_version}',
            '2'::jsonb
          ),
          (
            pg_temp.telemetry_event(
              'a3000000-0000-4000-8000-000000000009',
              'a2000000-0000-4000-8000-000000000001'
            ) #- '{properties,entry_route}'
          ),
          jsonb_set(
            pg_temp.telemetry_event(
              'a3000000-0000-4000-8000-000000000010',
              'a2000000-0000-4000-8000-000000000001'
            ),
            '{properties,session_number}',
            '"one"'::jsonb
          )
        ),
        'preview',
        'p07-test',
        'branch-p07'
      ) -> 'results'
    ) as result
  ),
  array[
    'unsupported_event_version',
    'invalid_properties',
    'invalid_properties'
  ]::text[],
  'unsupported version, missing property, and wrong type map deterministically'
);

select is(
  (
    select array_agg(
      result ->> 'status'
      order by (result ->> 'index')::integer
    )
    from jsonb_array_elements(
      public.ingest_telemetry_batch(
        'a0000000-0000-4000-8000-000000000001',
        jsonb_build_object(
          'session_id', 'a2000000-0000-4000-8000-000000000001',
          'platform', 'web_mobile',
          'entry_route', '/discover'
        ),
        jsonb_build_array(
          pg_temp.telemetry_event(
            'a3000000-0000-4000-8000-000000000011',
            'a2000000-0000-4000-8000-000000000001'
          ),
          jsonb_set(
            pg_temp.telemetry_event(
              'a3000000-0000-4000-8000-000000000012',
              'a2000000-0000-4000-8000-000000000001'
            ),
            '{surface}',
            '"checkout"'::jsonb
          )
        ),
        'preview',
        'p07-test',
        'branch-p07'
      ) -> 'results'
    ) as result
  ),
  array['accepted', 'quarantined']::text[],
  'mixed batch preserves ordered per-item success and failure'
);

select is(
  public.ingest_telemetry_batch(
    'a0000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'session_id', 'a2000000-0000-4000-8000-000000000001',
      'platform', 'web_mobile',
      'entry_route', '/discover'
    ),
    jsonb_build_array(
      jsonb_set(
        pg_temp.telemetry_event(
          'a3000000-0000-4000-8000-000000000013',
          'a2000000-0000-4000-8000-000000000001'
        ),
        '{source_surface}',
        '"checkout"'::jsonb
      )
    ),
    'preview',
    'p07-test',
    'branch-p07'
  ) -> 'results' -> 0 -> 'error_codes' ->> 0,
  'invalid_envelope',
  'invalid source surface is quarantined'
);

select is(
  public.ingest_telemetry_batch(
    'a0000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'session_id', 'a2000000-0000-4000-8000-000000000001',
      'platform', 'web_mobile',
      'entry_route', '/discover'
    ),
    jsonb_build_array(
      jsonb_set(
        pg_temp.telemetry_event(
          'a3000000-0000-4000-8000-000000000014',
          'a2000000-0000-4000-8000-000000000001'
        ),
        '{client_sequence}',
        '-1'::jsonb
      )
    ),
    'preview',
    'p07-test',
    'branch-p07'
  ) -> 'results' -> 0 -> 'error_codes' ->> 0,
  'invalid_envelope',
  'negative client sequence is quarantined'
);

select is(
  public.ingest_telemetry_batch(
    'a0000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'session_id', 'a2000000-0000-4000-8000-000000000001',
      'platform', 'web_mobile',
      'entry_route', '/discover'
    ),
    jsonb_build_array(
      pg_temp.telemetry_event(
        'a3000000-0000-4000-8000-000000000015',
        'a2000000-0000-4000-8000-000000000001',
        statement_timestamp() + interval '24 hours 1 second'
      )
    ),
    'preview',
    'p07-test',
    'branch-p07'
  ) -> 'results' -> 0 -> 'error_codes' ->> 0,
  'timestamp_future',
  'timestamp beyond the 24-hour future window is quarantined'
);

select is(
  public.ingest_telemetry_batch(
    'a0000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'session_id', 'a2000000-0000-4000-8000-000000000001',
      'platform', 'web_mobile',
      'entry_route', '/discover'
    ),
    jsonb_build_array(
      pg_temp.telemetry_event(
        'a3000000-0000-4000-8000-000000000016',
        'a2000000-0000-4000-8000-000000000001',
        statement_timestamp() - interval '30 days 1 second'
      )
    ),
    'preview',
    'p07-test',
    'branch-p07'
  ) -> 'results' -> 0 -> 'error_codes' ->> 0,
  'timestamp_stale',
  'event older than 30 days is quarantined pending replay policy'
);

select is(
  public.ingest_telemetry_batch(
    'a0000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'session_id', 'a2000000-0000-4000-8000-000000000001',
      'platform', 'web_mobile',
      'entry_route', '/discover'
    ),
    jsonb_build_array(
      pg_temp.telemetry_event(
        'a3000000-0000-4000-8000-000000000017',
        'a2000000-0000-4000-8000-000000000001',
        statement_timestamp() + interval '6 minutes'
      )
    ),
    'preview',
    'p07-test',
    'branch-p07'
  ) -> 'results' -> 0 ->> 'status',
  'accepted',
  'future skew between five minutes and 24 hours remains accepted with warning'
);

select is(
  (
    select validation_status
    from public.events
    where event_id = 'a3000000-0000-4000-8000-000000000017'
  ),
  'valid_with_warnings',
  'accepted future skew is explicitly flagged in canonical storage'
);

select is(
  public.ingest_telemetry_batch(
    'a0000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'session_id', 'a2000000-0000-4000-8000-000000000002',
      'platform', 'web_desktop',
      'entry_route', '/wardrobe'
    ),
    jsonb_build_array(
      jsonb_set(
        jsonb_set(
          pg_temp.telemetry_event(
            'a3000000-0000-4000-8000-000000000018',
            'a2000000-0000-4000-8000-000000000002'
          ),
          '{platform}',
          '"web_desktop"'::jsonb
        ),
        '{context,viewport_width}',
        '1440'::jsonb
      )
    ),
    'staging',
    'p07-test',
    null
  ) -> 'results' -> 0 ->> 'status',
  'accepted',
  'a second user can ingest only into their own independent session'
);

select ok(
  (
    select anonymous_user_id = 'a1000000-0000-4000-8000-000000000002'
      and environment = 'staging'
      and is_test
    from public.sessions
    where id = 'a2000000-0000-4000-8000-000000000002'
  ),
  'two-user session state is isolated and test classification is server-derived'
);

select lives_ok(
  $$
    select public.ingest_telemetry_batch(
      'a0000000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'session_id', 'a2000000-0000-4000-8000-000000000001',
        'platform', 'web_mobile',
        'entry_route', '/discover'
      ),
      jsonb_build_array(
        pg_temp.telemetry_event(
          'a3000000-0000-4000-8000-000000000019',
          'a2000000-0000-4000-8000-000000000001'
        ) || jsonb_build_object(
          'authorization', 'Bearer should-never-be-stored'
        )
      ),
      'preview',
      'p07-test',
      'branch-p07'
    )
  $$,
  'invalid payload with a sensitive key is safely quarantined'
);

select is(
  (
    select raw_payload ->> 'authorization'
    from public.event_quarantine
    where raw_payload ? 'authorization'
    order by received_at desc, id desc
    limit 1
  ),
  '[REDACTED]',
  'quarantine redacts authorization-like fields'
);

select throws_like(
  $$
    select public.ingest_telemetry_batch(
      'a0000000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'session_id', 'a2000000-0000-4000-8000-000000000001',
        'platform', 'web_mobile',
        'entry_route', '/discover'
      ),
      (
        select jsonb_agg('{}'::jsonb)
        from generate_series(1, 101)
      ),
      'preview',
      'p07-test',
      'branch-p07'
    )
  $$,
  '%batch_too_large%',
  'database boundary independently enforces the 100-event maximum'
);

select * from finish();

rollback;
