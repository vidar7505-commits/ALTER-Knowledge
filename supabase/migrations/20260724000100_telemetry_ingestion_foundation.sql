begin;

create or replace function private.telemetry_is_uuid(p_value text)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  perform p_value::uuid;
  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function private.telemetry_is_timestamptz(p_value text)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform p_value::timestamptz;
  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function private.telemetry_contract(p_event_name text)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select (
    '{
      "session_started": {
        "session_number": "positive_integer",
        "is_return_session": "boolean",
        "prior_session_ended_at": "nullable_timestamp",
        "entry_route": "route"
      },
      "app_state_restored": {
        "restore_result": "identifier",
        "restored_entities": "identifier_array",
        "state_revision": "nonnegative_integer"
      },
      "app_state_restore_failed": {
        "error_class": "error_class",
        "error_code": "identifier",
        "fallback_applied": "boolean"
      },
      "continuation_cue_viewed": {
        "cue_type": "identifier",
        "target_surface": "surface",
        "challenge_progress_count": "nonnegative_integer"
      },
      "continuation_action_selected": {
        "cue_type": "identifier",
        "target_surface": "surface"
      },
      "continuation_cue_dismissed": {
        "cue_type": "identifier",
        "persistence_scope": "identifier"
      },
      "onboarding_viewed": {
        "onboarding_version": "identifier",
        "step_id": "identifier",
        "step_index": "positive_integer",
        "total_steps": "positive_integer"
      },
      "onboarding_step_viewed": {
        "onboarding_version": "identifier",
        "step_id": "identifier",
        "step_index": "positive_integer"
      },
      "onboarding_preference_selected": {
        "onboarding_version": "identifier",
        "preference_id": "identifier",
        "preference_set_version": "identifier"
      },
      "onboarding_preference_removed": {
        "onboarding_version": "identifier",
        "preference_id": "identifier",
        "preference_set_version": "identifier"
      },
      "onboarding_completed": {
        "onboarding_version": "identifier",
        "selected_preference_ids": "identifier_array",
        "preference_count": "nonnegative_integer",
        "completion_type": "identifier",
        "operation_id": "uuid"
      },
      "onboarding_skipped": {
        "onboarding_version": "identifier",
        "step_id": "identifier",
        "selected_preference_count_before_skip": "nonnegative_integer",
        "operation_id": "uuid"
      },
      "onboarding_persistence_failed": {
        "attempted_action": "identifier",
        "operation_id": "uuid",
        "error_class": "error_class",
        "error_code": "identifier",
        "retryable": "boolean"
      },
      "discover_viewed": {
        "feed_instance_id": "uuid",
        "feed_order_version": "identifier",
        "entry_reason": "identifier"
      },
      "feed_batch_requested": {
        "feed_instance_id": "uuid",
        "batch_number": "positive_integer",
        "cursor_hash": "identifier",
        "requested_count": "count_100"
      },
      "feed_batch_loaded": {
        "feed_instance_id": "uuid",
        "batch_number": "positive_integer",
        "returned_count": "count_100_zero",
        "latency_ms": "nonnegative_integer",
        "is_terminal": "boolean"
      },
      "feed_batch_failed": {
        "feed_instance_id": "uuid",
        "batch_number": "positive_integer",
        "error_class": "error_class",
        "error_code": "identifier",
        "retryable": "boolean"
      },
      "product_impression": {
        "product_id": "uuid",
        "product_category": "identifier",
        "feed_instance_id": "uuid",
        "feed_position": "positive_integer",
        "feed_order_version": "identifier",
        "visible_ratio": "visible_ratio",
        "visible_duration_ms": "impression_duration",
        "batch_number": "positive_integer",
        "is_saved_at_impression": "boolean"
      },
      "feed_depth_reached": {
        "feed_instance_id": "uuid",
        "depth_threshold": "depth_threshold",
        "max_qualified_position": "positive_integer",
        "feed_order_version": "identifier"
      },
      "feed_exhausted": {
        "feed_instance_id": "uuid",
        "max_qualified_position": "nonnegative_integer"
      },
      "product_detail_opened": {
        "product_id": "uuid",
        "product_category": "identifier",
        "source_surface": "source_surface",
        "source_feed_position": "nullable_positive_integer",
        "is_saved": "boolean"
      },
      "product_detail_closed": {
        "product_id": "uuid",
        "close_method": "identifier",
        "dwell_ms": "nonnegative_integer",
        "resulting_saved_state": "boolean"
      },
      "product_detail_failed": {
        "product_id": "uuid",
        "error_class": "error_class",
        "error_code": "identifier",
        "recovery_route": "route"
      },
      "product_save_requested": {
        "product_id": "uuid",
        "source_surface": "source_surface",
        "prior_saved_state": "false",
        "operation_id": "uuid"
      },
      "product_saved": {
        "product_id": "uuid",
        "product_category": "identifier",
        "source_surface": "source_surface",
        "operation_id": "uuid",
        "saved_product_id": "uuid"
      },
      "product_remove_requested": {
        "product_id": "uuid",
        "source_surface": "source_surface",
        "prior_saved_state": "true",
        "operation_id": "uuid",
        "challenge_impact": "identifier"
      },
      "product_removed": {
        "product_id": "uuid",
        "source_surface": "source_surface",
        "operation_id": "uuid",
        "challenge_resolution": "identifier"
      },
      "product_save_failed": {
        "product_id": "uuid",
        "attempted_action": "identifier",
        "operation_id": "uuid",
        "error_class": "error_class",
        "error_code": "identifier",
        "retryable": "boolean"
      },
      "wardrobe_viewed": {
        "saved_product_count": "nonnegative_integer",
        "entry_reason": "identifier",
        "is_return_session": "boolean"
      },
      "wardrobe_empty_viewed": {
        "entry_reason": "identifier"
      },
      "challenge_viewed": {
        "challenge_id": "uuid",
        "challenge_version": "identifier",
        "challenge_state": "challenge_state",
        "filled_slot_count": "nonnegative_integer",
        "required_slot_count": "positive_integer"
      },
      "challenge_started": {
        "challenge_id": "uuid",
        "challenge_version": "identifier",
        "eligible_saved_count": "nonnegative_integer",
        "required_slot_count": "positive_integer",
        "operation_id": "uuid"
      },
      "challenge_slot_opened": {
        "challenge_id": "uuid",
        "slot_id": "identifier",
        "eligible_item_count": "nonnegative_integer",
        "slot_state": "identifier"
      },
      "challenge_item_selected": {
        "challenge_id": "uuid",
        "slot_id": "identifier",
        "product_id": "uuid",
        "operation_id": "uuid",
        "replaced_product_id": "nullable_uuid"
      },
      "challenge_item_removed": {
        "challenge_id": "uuid",
        "slot_id": "identifier",
        "product_id": "uuid",
        "operation_id": "uuid",
        "removal_reason": "identifier"
      },
      "challenge_discovery_redirected": {
        "challenge_id": "uuid",
        "slot_id": "identifier",
        "required_category": "identifier"
      },
      "challenge_completion_attempted": {
        "challenge_id": "uuid",
        "valid_slot_count": "nonnegative_integer",
        "required_slot_count": "positive_integer",
        "is_valid": "boolean"
      },
      "challenge_completed": {
        "challenge_id": "uuid",
        "challenge_version": "identifier",
        "completion_id": "uuid",
        "selected_product_ids_by_slot": "uuid_map",
        "duration_since_start_ms": "nonnegative_number",
        "operation_id": "uuid"
      },
      "challenge_state_invalidated": {
        "challenge_id": "uuid",
        "prior_version": "identifier",
        "current_version": "identifier",
        "reason": "identifier",
        "resolution": "identifier"
      },
      "challenge_operation_failed": {
        "challenge_id": "uuid",
        "attempted_action": "identifier",
        "operation_id": "uuid",
        "error_class": "error_class",
        "error_code": "identifier",
        "retryable": "boolean"
      }
    }'::jsonb
  ) -> p_event_name;
$$;

create or replace function private.telemetry_value_matches(
  p_value jsonb,
  p_type text
)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  scalar_text text := p_value #>> '{}';
  numeric_value numeric;
begin
  if p_type = 'nullable_uuid' then
    return p_value = 'null'::jsonb
      or (
        jsonb_typeof(p_value) = 'string'
        and private.telemetry_is_uuid(scalar_text)
      );
  elsif p_type = 'nullable_timestamp' then
    return p_value = 'null'::jsonb
      or (
        jsonb_typeof(p_value) = 'string'
        and private.telemetry_is_timestamptz(scalar_text)
        and scalar_text ~ '(Z|[+]00:00)$'
      );
  elsif p_type = 'nullable_positive_integer' then
    if p_value = 'null'::jsonb then
      return true;
    end if;
  end if;

  if p_type in (
    'positive_integer',
    'nonnegative_integer',
    'nullable_positive_integer',
    'count_100',
    'count_100_zero',
    'impression_duration',
    'depth_threshold'
  ) then
    if jsonb_typeof(p_value) <> 'number' then
      return false;
    end if;
    numeric_value := scalar_text::numeric;
    if numeric_value <> trunc(numeric_value) then
      return false;
    end if;
    if p_type in ('positive_integer', 'nullable_positive_integer') then
      return numeric_value > 0;
    elsif p_type = 'count_100' then
      return numeric_value between 1 and 100;
    elsif p_type = 'count_100_zero' then
      return numeric_value between 0 and 100;
    elsif p_type = 'impression_duration' then
      return numeric_value >= 1000;
    elsif p_type = 'depth_threshold' then
      return numeric_value in (5, 10, 20, 30, 50, 75, 100);
    end if;
    return numeric_value >= 0;
  elsif p_type in ('nonnegative_number', 'visible_ratio') then
    if jsonb_typeof(p_value) <> 'number' then
      return false;
    end if;
    numeric_value := scalar_text::numeric;
    return case
      when p_type = 'visible_ratio' then numeric_value between 0.5 and 1
      else numeric_value >= 0
    end;
  elsif p_type = 'uuid' then
    return jsonb_typeof(p_value) = 'string'
      and private.telemetry_is_uuid(scalar_text);
  elsif p_type in ('identifier', 'route') then
    return jsonb_typeof(p_value) = 'string'
      and length(scalar_text) between 1 and (
        case when p_type = 'route' then 256 else 128 end
      )
      and (
        p_type <> 'identifier'
        or scalar_text ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]*$'
      )
      and (p_type <> 'route' or position('?' in scalar_text) = 0);
  elsif p_type = 'boolean' then
    return jsonb_typeof(p_value) = 'boolean';
  elsif p_type = 'true' then
    return p_value = 'true'::jsonb;
  elsif p_type = 'false' then
    return p_value = 'false'::jsonb;
  elsif p_type = 'error_class' then
    return scalar_text in (
      'network', 'timeout', 'validation', 'not_found', 'permission',
      'conflict', 'persistence', 'schema', 'identity', 'unknown'
    );
  elsif p_type = 'surface' then
    return scalar_text in (
      'app_boot', 'onboarding', 'discover', 'product_detail', 'wardrobe',
      'challenge', 'challenge_picker', 'continuation', 'error_recovery'
    );
  elsif p_type = 'source_surface' then
    return scalar_text in (
      'discover', 'product_detail', 'wardrobe', 'challenge',
      'challenge_picker'
    );
  elsif p_type = 'challenge_state' then
    return scalar_text in (
      'not_started', 'in_progress', 'ready_to_complete', 'completed',
      'invalidated'
    );
  elsif p_type = 'identifier_array' then
    return jsonb_typeof(p_value) = 'array'
      and jsonb_array_length(p_value) <= 64
      and not exists (
        select 1
        from jsonb_array_elements(p_value) as item(value)
        where jsonb_typeof(item.value) <> 'string'
          or length(item.value #>> '{}') not between 1 and 128
          or item.value #>> '{}' !~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]*$'
      );
  elsif p_type = 'uuid_map' then
    return jsonb_typeof(p_value) = 'object'
      and exists (select 1 from jsonb_object_keys(p_value))
      and not exists (
        select 1
        from jsonb_each(p_value) as item(key, value)
        where length(item.key) not between 1 and 128
          or item.key !~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]*$'
          or jsonb_typeof(item.value) <> 'string'
          or not private.telemetry_is_uuid(item.value #>> '{}')
      );
  end if;

  return false;
exception
  when others then
    return false;
end;
$$;

create or replace function private.telemetry_redact(p_value jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if jsonb_typeof(p_value) = 'object' then
    select coalesce(
      jsonb_object_agg(
        item.key,
        case
          when lower(item.key) ~
            '(authorization|cookie|token|secret|password|service.?role|database.?url|connection.?string)'
          then '"[REDACTED]"'::jsonb
          else private.telemetry_redact(item.value)
        end
      ),
      '{}'::jsonb
    )
    into result
    from jsonb_each(p_value) as item(key, value);
    return result;
  elsif jsonb_typeof(p_value) = 'array' then
    select coalesce(
      jsonb_agg(private.telemetry_redact(item.value)),
      '[]'::jsonb
    )
    into result
    from jsonb_array_elements(p_value) as item(value);
    return result;
  end if;

  return p_value;
end;
$$;

create or replace function private.telemetry_safe_payload(p_value jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when octet_length(p_value::text) <= 16384
      then private.telemetry_redact(
        case
          when jsonb_typeof(p_value) = 'object' then p_value
          else jsonb_build_object('value', p_value)
        end
      )
    else jsonb_strip_nulls(
      jsonb_build_object(
        'event_id',
          case when jsonb_typeof(p_value) = 'object'
            then p_value -> 'event_id' end,
        'event_name',
          case when jsonb_typeof(p_value) = 'object'
            then p_value -> 'event_name' end,
        '_truncated', true,
        '_original_bytes', octet_length(p_value::text)
      )
    )
  end;
$$;

create or replace function private.telemetry_validation_errors(
  p_event jsonb,
  p_received_at timestamptz
)
returns text[]
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  errors text[] := array[]::text[];
  event_name text;
  event_version numeric;
  contract jsonb;
  properties jsonb;
  context_value jsonb;
  property_entry record;
  occurred_at timestamptz;
  allowed_envelope text[] := array[
    'event_id', 'event_name', 'event_version', 'occurred_at', 'session_id',
    'platform', 'surface', 'source_surface', 'client_sequence', 'properties',
    'context'
  ];
  forbidden_envelope text[] := array[
    'anonymous_user_id', 'user_id', 'received_at', 'release_id',
    'app_version', 'environment', 'is_test', 'preview_namespace',
    'validation_status', 'validation_errors', 'inserted_at'
  ];
begin
  if jsonb_typeof(p_event) <> 'object' then
    return array['event_not_object'];
  end if;

  if octet_length(p_event::text) > 16384 then
    errors := array_append(errors, 'payload_too_large');
  end if;

  if p_event ?| forbidden_envelope then
    errors := array_append(errors, 'forbidden_trusted_field');
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_event) as envelope_key(key)
    where not envelope_key.key = any(allowed_envelope)
  ) then
    errors := array_append(errors, 'unexpected_envelope_field');
  end if;

  event_name := p_event ->> 'event_name';
  contract := private.telemetry_contract(event_name);
  if contract is null then
    errors := array_append(errors, 'unknown_event_name');
  end if;

  if jsonb_typeof(p_event -> 'event_version') <> 'number' then
    errors := array_append(errors, 'unsupported_event_version');
  else
    begin
      event_version := (p_event ->> 'event_version')::numeric;
      if event_version <> 1 or event_version <> trunc(event_version) then
        errors := array_append(errors, 'unsupported_event_version');
      end if;
    exception when others then
      errors := array_append(errors, 'unsupported_event_version');
    end;
  end if;

  if jsonb_typeof(p_event -> 'event_id') <> 'string'
    or not private.telemetry_is_uuid(p_event ->> 'event_id') then
    errors := array_append(errors, 'invalid_envelope');
  end if;

  if jsonb_typeof(p_event -> 'session_id') <> 'string'
    or not private.telemetry_is_uuid(p_event ->> 'session_id') then
    errors := array_append(errors, 'invalid_envelope');
  end if;

  if jsonb_typeof(p_event -> 'occurred_at') <> 'string'
    or not private.telemetry_is_timestamptz(p_event ->> 'occurred_at')
    or p_event ->> 'occurred_at' !~ '(Z|[+]00:00)$' then
    errors := array_append(errors, 'invalid_envelope');
  else
    occurred_at := (p_event ->> 'occurred_at')::timestamptz;
    if occurred_at > p_received_at + interval '24 hours' then
      errors := array_append(errors, 'timestamp_future');
    elsif occurred_at < p_received_at - interval '30 days' then
      errors := array_append(errors, 'timestamp_stale');
    end if;
  end if;

  if jsonb_typeof(p_event -> 'platform') <> 'string'
    or p_event ->> 'platform' not in (
    'web_mobile', 'web_desktop', 'ios', 'android'
  ) then
    errors := array_append(errors, 'invalid_envelope');
  end if;

  if jsonb_typeof(p_event -> 'surface') <> 'string'
    or p_event ->> 'surface' not in (
    'app_boot', 'onboarding', 'discover', 'product_detail', 'wardrobe',
    'challenge', 'challenge_picker', 'continuation', 'error_recovery'
  ) then
    errors := array_append(errors, 'invalid_envelope');
  end if;

  if p_event ? 'source_surface'
    and p_event -> 'source_surface' <> 'null'::jsonb
    and p_event ->> 'source_surface' not in (
      'discover', 'product_detail', 'wardrobe', 'challenge',
      'challenge_picker'
    ) then
    errors := array_append(errors, 'invalid_envelope');
  end if;

  if jsonb_typeof(p_event -> 'client_sequence') <> 'number'
    or not private.telemetry_value_matches(
      p_event -> 'client_sequence',
      'nonnegative_integer'
    )
    or (p_event ->> 'client_sequence')::numeric >
      9223372036854775807 then
    errors := array_append(errors, 'invalid_envelope');
  end if;

  context_value := p_event -> 'context';
  if jsonb_typeof(context_value) <> 'object'
    or not (context_value ? 'timezone_offset_minutes')
    or not (context_value ? 'locale')
    or not (context_value ? 'experiment_assignments')
    or exists (
      select 1
      from jsonb_object_keys(coalesce(context_value, '{}'::jsonb))
        as context_key(key)
      where context_key.key not in (
        'timezone_offset_minutes', 'locale', 'viewport_width',
        'viewport_height', 'network_state', 'traffic_source', 'cohort_id',
        'experiment_assignments'
      )
    )
    or jsonb_typeof(context_value -> 'timezone_offset_minutes') <> 'number'
    or (context_value ->> 'timezone_offset_minutes')::numeric <>
      trunc((context_value ->> 'timezone_offset_minutes')::numeric)
    or (context_value ->> 'timezone_offset_minutes')::numeric
      not between -840 and 840
    or jsonb_typeof(context_value -> 'locale') <> 'string'
    or length(context_value ->> 'locale') not between 2 and 35
    or context_value ->> 'locale'
      !~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
    or jsonb_typeof(context_value -> 'experiment_assignments') <> 'object'
    or context_value -> 'experiment_assignments' <> '{}'::jsonb
    or (
      p_event ->> 'platform' in ('web_mobile', 'web_desktop')
      and (
        not private.telemetry_value_matches(
          context_value -> 'viewport_width',
          'positive_integer'
        )
        or not private.telemetry_value_matches(
          context_value -> 'viewport_height',
          'positive_integer'
        )
        or (context_value ->> 'viewport_width')::numeric > 16384
        or (context_value ->> 'viewport_height')::numeric > 16384
      )
    )
    or (
      context_value ? 'network_state'
      and context_value -> 'network_state' <> 'null'::jsonb
      and context_value ->> 'network_state' not in (
        'online', 'offline', 'unknown'
      )
    )
    or (
      context_value ? 'traffic_source'
      and context_value -> 'traffic_source' <> 'null'::jsonb
      and not private.telemetry_value_matches(
        context_value -> 'traffic_source',
        'identifier'
      )
    )
    or (
      context_value ? 'cohort_id'
      and context_value -> 'cohort_id' <> 'null'::jsonb
      and not private.telemetry_value_matches(
        context_value -> 'cohort_id',
        'identifier'
      )
    ) then
    errors := array_append(errors, 'invalid_envelope');
  end if;

  properties := p_event -> 'properties';
  if contract is not null then
    if jsonb_typeof(properties) <> 'object'
      or (
        select array_agg(key order by key)
        from jsonb_object_keys(coalesce(properties, '{}'::jsonb)) as key
      ) is distinct from (
        select array_agg(key order by key)
        from jsonb_object_keys(contract) as key
      ) then
      errors := array_append(errors, 'invalid_properties');
    else
      for property_entry in
        select item.key, item.value #>> '{}' as expected_type
        from jsonb_each(contract) as item(key, value)
      loop
        if not private.telemetry_value_matches(
          properties -> property_entry.key,
          property_entry.expected_type
        ) then
          errors := array_append(errors, 'invalid_properties');
          exit;
        end if;
      end loop;
    end if;
  end if;

  if event_name = 'onboarding_completed'
    and jsonb_typeof(properties) = 'object'
    and private.telemetry_value_matches(
      properties -> 'preference_count',
      'nonnegative_integer'
    )
    and jsonb_typeof(properties -> 'selected_preference_ids') = 'array'
    and (properties ->> 'preference_count')::integer <>
      jsonb_array_length(properties -> 'selected_preference_ids') then
    errors := array_append(errors, 'invalid_properties');
  end if;

  if event_name = 'challenge_viewed'
    and private.telemetry_value_matches(
      properties -> 'filled_slot_count',
      'nonnegative_integer'
    )
    and private.telemetry_value_matches(
      properties -> 'required_slot_count',
      'positive_integer'
    )
    and (properties ->> 'filled_slot_count')::integer >
      (properties ->> 'required_slot_count')::integer then
    errors := array_append(errors, 'invalid_properties');
  end if;

  if event_name = 'challenge_completion_attempted'
    and private.telemetry_value_matches(
      properties -> 'valid_slot_count',
      'nonnegative_integer'
    )
    and private.telemetry_value_matches(
      properties -> 'required_slot_count',
      'positive_integer'
    )
    and (
      (properties ->> 'valid_slot_count')::integer >
        (properties ->> 'required_slot_count')::integer
      or (
        (properties ->> 'is_valid')::boolean
        <> (
          (properties ->> 'valid_slot_count')::integer =
          (properties ->> 'required_slot_count')::integer
        )
      )
    ) then
    errors := array_append(errors, 'invalid_properties');
  end if;

  select coalesce(array_agg(distinct_code order by first_position), '{}')
  into errors
  from (
    select distinct on (error_code)
      error_code as distinct_code,
      position as first_position
    from unnest(errors) with ordinality as item(error_code, position)
    order by error_code, position
  ) as unique_errors;

  return errors;
exception
  when others then
    return array['invalid_envelope'];
end;
$$;

create or replace function public.ingest_telemetry_batch(
  p_auth_user_id uuid,
  p_session jsonb,
  p_events jsonb,
  p_environment public.app_environment,
  p_app_version text,
  p_preview_namespace text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_row public.anonymous_users%rowtype;
  resolved_user_id uuid;
  session_row public.sessions%rowtype;
  requested_session_id uuid;
  requested_platform text;
  received_at timestamptz := statement_timestamp();
  raw_event jsonb;
  event_index integer;
  canonical_event_id uuid;
  event_errors text[];
  result_errors text[];
  result_status text;
  results jsonb := '[]'::jsonb;
  inserted_received_at timestamptz;
  existing_event public.events%rowtype;
  canonical_matches boolean;
  any_activity boolean := false;
  session_error text;
begin
  if p_auth_user_id is null
    or not exists (
      select 1
      from auth.users
      where auth.users.id = p_auth_user_id
    ) then
    raise exception using
      errcode = '28000',
      message = 'authenticated identity required';
  end if;

  select anonymous_users.*
  into owner_row
  from public.anonymous_users
  where anonymous_users.auth_user_id = p_auth_user_id
  for update;

  if not found then
    raise exception using
      errcode = '28000',
      message = 'analytical identity not provisioned';
  end if;

  select users.id
  into resolved_user_id
  from public.users
  where users.id = p_auth_user_id;

  if jsonb_typeof(p_events) <> 'array'
    or jsonb_array_length(p_events) = 0 then
    raise exception using
      errcode = '22023',
      message = 'events must be a non-empty array';
  end if;

  if jsonb_array_length(p_events) > 100 then
    raise exception using
      errcode = '22023',
      message = 'batch_too_large';
  end if;

  if jsonb_typeof(p_session) <> 'object'
    or jsonb_typeof(p_session -> 'session_id') <> 'string'
    or not private.telemetry_is_uuid(p_session ->> 'session_id')
    or jsonb_typeof(p_session -> 'platform') <> 'string'
    or p_session ->> 'platform' not in (
      'web_mobile', 'web_desktop', 'ios', 'android'
    )
    or length(btrim(coalesce(p_session ->> 'entry_route', '')))
      not between 1 and 256
    or position('?' in (p_session ->> 'entry_route')) > 0
    or length(btrim(p_app_version)) = 0 then
    raise exception using
      errcode = '22023',
      message = 'invalid session descriptor';
  end if;

  requested_session_id := (p_session ->> 'session_id')::uuid;
  requested_platform := p_session ->> 'platform';

  select sessions.*
  into session_row
  from public.sessions
  where sessions.id = requested_session_id;

  if found then
    if session_row.anonymous_user_id <> owner_row.id then
      session_error := 'session_owner_mismatch';
    elsif session_row.platform <> requested_platform then
      session_error := 'session_context_conflict';
    end if;
  else
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
    select
      requested_session_id,
      owner_row.id,
      resolved_user_id,
      coalesce(max(sessions.session_number), 0) + 1,
      received_at,
      received_at,
      coalesce(max(sessions.session_number), 0) > 0,
      p_session ->> 'entry_route',
      nullif(p_session ->> 'traffic_source', ''),
      nullif(p_session ->> 'cohort_id', ''),
      p_app_version,
      requested_platform,
      p_environment,
      owner_row.is_test or coalesce(
        (select users.is_test from public.users where users.id = resolved_user_id),
        false
      ),
      case
        when p_environment = 'preview'
          then coalesce(p_preview_namespace, owner_row.preview_namespace)
        else null
      end
    from public.sessions
    where sessions.anonymous_user_id = owner_row.id
    returning * into session_row;
  end if;

  for raw_event, event_index in
    select item.value, (item.ordinality - 1)::integer
    from jsonb_array_elements(p_events) with ordinality as item(value, ordinality)
  loop
    canonical_event_id := null;
    result_errors := '{}';
    result_status := null;
    inserted_received_at := null;

    if jsonb_typeof(raw_event) = 'object'
      and jsonb_typeof(raw_event -> 'event_id') = 'string'
      and private.telemetry_is_uuid(raw_event ->> 'event_id') then
      canonical_event_id := (raw_event ->> 'event_id')::uuid;
    end if;

    if session_error is not null then
      result_errors := array[session_error];
      result_status := 'rejected';
    else
      event_errors := private.telemetry_validation_errors(
        raw_event,
        received_at
      );
      result_errors := event_errors;

      if jsonb_typeof(raw_event) = 'object'
        and (
          jsonb_typeof(raw_event -> 'session_id') <> 'string'
          or not private.telemetry_is_uuid(raw_event ->> 'session_id')
          or (raw_event ->> 'session_id')::uuid <> requested_session_id
        ) then
        result_errors := array_append(
          result_errors,
          'session_not_found'
        );
      end if;

      if jsonb_typeof(raw_event) = 'object'
        and jsonb_typeof(raw_event -> 'properties') = 'object'
        and raw_event -> 'properties' ? 'product_id'
        and private.telemetry_is_uuid(
          raw_event -> 'properties' ->> 'product_id'
        )
        and not exists (
          select 1
          from public.products
          where products.id =
            (raw_event -> 'properties' ->> 'product_id')::uuid
        ) then
        result_errors := array_append(result_errors, 'invalid_properties');
      end if;

      if jsonb_typeof(raw_event) = 'object'
        and jsonb_typeof(raw_event -> 'properties') = 'object'
        and raw_event -> 'properties' ? 'challenge_id'
        and private.telemetry_is_uuid(
          raw_event -> 'properties' ->> 'challenge_id'
        )
        and not exists (
          select 1
          from public.challenges
          where challenges.id =
            (raw_event -> 'properties' ->> 'challenge_id')::uuid
        ) then
        result_errors := array_append(result_errors, 'invalid_properties');
      end if;

      select coalesce(array_agg(distinct_code order by first_position), '{}')
      into result_errors
      from (
        select distinct on (error_code)
          error_code as distinct_code,
          position as first_position
        from unnest(result_errors) with ordinality
          as item(error_code, position)
        order by error_code, position
      ) as unique_errors;

      if cardinality(result_errors) = 0
        and canonical_event_id is not null then
        insert into public.events (
          event_id,
          event_name,
          event_version,
          occurred_at,
          received_at,
          anonymous_user_id,
          user_id,
          session_id,
          release_id,
          app_version,
          platform,
          environment,
          surface,
          source_surface,
          client_sequence,
          properties,
          context,
          validation_status,
          validation_errors,
          preview_namespace
        )
        values (
          canonical_event_id,
          raw_event ->> 'event_name',
          (raw_event ->> 'event_version')::integer,
          (raw_event ->> 'occurred_at')::timestamptz,
          received_at,
          owner_row.id,
          resolved_user_id,
          requested_session_id,
          'LR-001',
          session_row.app_version,
          session_row.platform,
          session_row.environment,
          raw_event ->> 'surface',
          nullif(raw_event ->> 'source_surface', ''),
          (raw_event ->> 'client_sequence')::bigint,
          raw_event -> 'properties',
          raw_event -> 'context',
          case
            when (raw_event ->> 'occurred_at')::timestamptz
              > received_at + interval '5 minutes'
              then 'valid_with_warnings'
            else 'valid'
          end,
          case
            when (raw_event ->> 'occurred_at')::timestamptz
              > received_at + interval '5 minutes'
              then '["timestamp_future_skew"]'::jsonb
            else '[]'::jsonb
          end,
          session_row.preview_namespace
        )
        on conflict on constraint events_pkey do nothing
        returning events.received_at into inserted_received_at;

        if inserted_received_at is not null then
          result_status := 'accepted';
          any_activity := true;
          if (raw_event ->> 'occurred_at')::timestamptz
            > received_at + interval '5 minutes' then
            result_errors := array['timestamp_future_skew'];
          end if;
        else
          select events.*
          into existing_event
          from public.events
          where events.event_id = canonical_event_id;

          canonical_matches :=
            existing_event.anonymous_user_id = owner_row.id
            and existing_event.user_id is not distinct from resolved_user_id
            and existing_event.session_id = requested_session_id
            and existing_event.event_name = raw_event ->> 'event_name'
            and existing_event.event_version =
              (raw_event ->> 'event_version')::integer
            and existing_event.occurred_at =
              (raw_event ->> 'occurred_at')::timestamptz
            and existing_event.platform = session_row.platform
            and existing_event.environment = session_row.environment
            and existing_event.surface = raw_event ->> 'surface'
            and existing_event.source_surface is not distinct from
              nullif(raw_event ->> 'source_surface', '')
            and existing_event.client_sequence =
              (raw_event ->> 'client_sequence')::bigint
            and existing_event.properties = raw_event -> 'properties'
            and existing_event.context = raw_event -> 'context';

          if canonical_matches then
            result_status := 'duplicate';
            inserted_received_at := existing_event.received_at;
            result_errors := '{}';
            any_activity := true;
          else
            result_status := 'rejected';
            result_errors := array['event_id_conflict'];
          end if;
        end if;
      else
        result_status := case
          when result_errors && array[
            'forbidden_trusted_field',
            'session_not_found'
          ] then 'rejected'
          else 'quarantined'
        end;
      end if;
    end if;

    if result_status in ('quarantined', 'rejected') then
      insert into public.event_quarantine (
        received_at,
        raw_payload,
        error_codes,
        environment,
        preview_namespace
      )
      values (
        received_at,
        private.telemetry_safe_payload(raw_event),
        result_errors,
        coalesce(session_row.environment, p_environment),
        case
          when coalesce(session_row.environment, p_environment) = 'preview'
            then coalesce(session_row.preview_namespace, p_preview_namespace)
          else null
        end
      );
    end if;

    results := results || jsonb_build_array(
      jsonb_build_object(
        'index', event_index,
        'event_id', canonical_event_id,
        'status', result_status,
        'error_codes', to_jsonb(result_errors),
        'received_at', coalesce(inserted_received_at, received_at)
      )
    );
  end loop;

  if any_activity and session_error is null then
    update public.sessions
    set last_activity_at = greatest(last_activity_at, received_at)
    where sessions.id = requested_session_id;
  end if;

  return jsonb_build_object('results', results);
end;
$$;

alter function private.telemetry_is_uuid(text) owner to postgres;
alter function private.telemetry_is_timestamptz(text) owner to postgres;
alter function private.telemetry_contract(text) owner to postgres;
alter function private.telemetry_value_matches(jsonb, text) owner to postgres;
alter function private.telemetry_redact(jsonb) owner to postgres;
alter function private.telemetry_safe_payload(jsonb) owner to postgres;
alter function private.telemetry_validation_errors(jsonb, timestamptz)
  owner to postgres;
alter function public.ingest_telemetry_batch(
  uuid,
  jsonb,
  jsonb,
  public.app_environment,
  text,
  text
) owner to postgres;

revoke all on function private.telemetry_is_uuid(text)
from public, anon, authenticated;
revoke all on function private.telemetry_is_timestamptz(text)
from public, anon, authenticated;
revoke all on function private.telemetry_contract(text)
from public, anon, authenticated;
revoke all on function private.telemetry_value_matches(jsonb, text)
from public, anon, authenticated;
revoke all on function private.telemetry_redact(jsonb)
from public, anon, authenticated;
revoke all on function private.telemetry_safe_payload(jsonb)
from public, anon, authenticated;
revoke all on function private.telemetry_validation_errors(jsonb, timestamptz)
from public, anon, authenticated;

revoke all on function public.ingest_telemetry_batch(
  uuid,
  jsonb,
  jsonb,
  public.app_environment,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.ingest_telemetry_batch(
  uuid,
  jsonb,
  jsonb,
  public.app_environment,
  text,
  text
) to service_role;

commit;
