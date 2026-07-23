begin;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table private.mutation_operations (
  operation_id uuid constraint mutation_operations_pkey primary key,
  anonymous_user_id uuid not null,
  operation_type text not null,
  request_fingerprint jsonb not null,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint mutation_operations_anonymous_user_id_fkey
    foreign key (anonymous_user_id)
    references public.anonymous_users (id)
    on delete cascade,
  constraint mutation_operations_operation_id_check check (
    operation_id <> '00000000-0000-0000-0000-000000000000'::uuid
  ),
  constraint mutation_operations_operation_type_check check (
    nullif(btrim(operation_type), '') is not null
  ),
  constraint mutation_operations_request_fingerprint_check check (
    jsonb_typeof(request_fingerprint) = 'object'
  ),
  constraint mutation_operations_completion_pair_check check (
    (result is null) = (completed_at is null)
  )
);

create index mutation_operations_identity_created_idx
on private.mutation_operations (anonymous_user_id, created_at desc);

create function private.current_anonymous_user_id()
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  authenticated_user_id uuid := auth.uid();
  canonical_anonymous_user_id uuid;
begin
  if
    authenticated_user_id is null
    or not exists (
      select 1
      from auth.users
      where auth.users.id = authenticated_user_id
        and auth.users.is_anonymous is true
    )
  then
    raise exception 'anonymous authentication required'
      using errcode = '28000';
  end if;

  select anonymous_users.id
  into canonical_anonymous_user_id
  from public.anonymous_users
  where anonymous_users.auth_user_id = authenticated_user_id;

  if canonical_anonymous_user_id is null then
    raise exception 'anonymous identity has not been provisioned'
      using errcode = '28000';
  end if;

  return canonical_anonymous_user_id;
end;
$$;

create function private.claim_mutation_operation(
  operation_id uuid,
  anonymous_user_id uuid,
  operation_type text,
  request_fingerprint jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_operation private.mutation_operations%rowtype;
begin
  if
    operation_id is null
    or operation_id = '00000000-0000-0000-0000-000000000000'::uuid
  then
    raise exception 'a non-nil operation_id is required'
      using errcode = '22023';
  end if;

  insert into private.mutation_operations (
    operation_id,
    anonymous_user_id,
    operation_type,
    request_fingerprint
  )
  values (
    operation_id,
    anonymous_user_id,
    operation_type,
    request_fingerprint
  )
  on conflict do nothing;

  if found then
    return null;
  end if;

  select mutation_operations.*
  into strict existing_operation
  from private.mutation_operations
  where mutation_operations.operation_id =
    claim_mutation_operation.operation_id;

  if
    existing_operation.anonymous_user_id <> anonymous_user_id
    or existing_operation.operation_type <> operation_type
    or existing_operation.request_fingerprint <> request_fingerprint
  then
    raise exception 'operation_id conflict'
      using errcode = '22023';
  end if;

  if existing_operation.result is null then
    raise exception 'operation result is unavailable'
      using errcode = '40001';
  end if;

  return existing_operation.result;
end;
$$;

alter function private.current_anonymous_user_id() owner to postgres;
alter function private.claim_mutation_operation(uuid, uuid, text, jsonb)
owner to postgres;

revoke all on function private.current_anonymous_user_id()
from public, anon, authenticated;
revoke all on function private.claim_mutation_operation(
  uuid,
  uuid,
  text,
  jsonb
) from public, anon, authenticated;

create function public.complete_onboarding(
  operation_id uuid,
  onboarding_version text,
  preference_set_version text,
  preference_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := private.current_anonymous_user_id();
  normalized_preferences text[];
  fingerprint jsonb;
  replay_result jsonb;
  response jsonb;
  onboarding_row public.onboarding_states%rowtype;
  desired_status public.onboarding_status;
begin
  if nullif(btrim(onboarding_version), '') is null then
    raise exception 'onboarding_version is required'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(coalesce(preference_ids, '{}'::text[])) as preference(value)
    where nullif(btrim(preference.value), '') is null
  ) then
    raise exception 'preference_ids cannot contain blank values'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(preference.value order by preference.value), '{}')
  into normalized_preferences
  from (
    select distinct unnest(coalesce(preference_ids, '{}'::text[])) as value
  ) as preference;

  if
    cardinality(normalized_preferences) > 0
    and nullif(btrim(preference_set_version), '') is null
  then
    raise exception 'preference_set_version is required with preferences'
      using errcode = '22023';
  end if;

  desired_status := case
    when cardinality(normalized_preferences) > 0
      then 'completed_with_preferences'::public.onboarding_status
    else 'completed_without_preferences'::public.onboarding_status
  end;

  fingerprint := jsonb_build_object(
    'onboarding_version',
    onboarding_version,
    'preference_set_version',
    preference_set_version,
    'preference_ids',
    normalized_preferences
  );

  replay_result := private.claim_mutation_operation(
    operation_id,
    owner_id,
    'complete_onboarding',
    fingerprint
  );

  if replay_result is not null then
    return replay_result;
  end if;

  select onboarding_states.*
  into onboarding_row
  from public.onboarding_states
  where onboarding_states.anonymous_user_id = owner_id
  for update;

  if not found then
    insert into public.onboarding_states (
      anonymous_user_id,
      status,
      started_at,
      state_revision
    )
    values (
      owner_id,
      'in_progress',
      now(),
      1
    )
    returning * into onboarding_row;
  elsif onboarding_row.status in (
    'completed_with_preferences',
    'completed_without_preferences'
  ) then
    if
      onboarding_row.status = desired_status
      and onboarding_row.onboarding_version = onboarding_version
      and onboarding_row.preference_set_version
        is not distinct from preference_set_version
      and onboarding_row.preference_ids = normalized_preferences
    then
      response := jsonb_build_object(
        'ok', true,
        'operation_id', operation_id,
        'state_revision', onboarding_row.state_revision,
        'data', jsonb_build_object(
          'status', onboarding_row.status,
          'preference_ids', onboarding_row.preference_ids
        )
      );

      update private.mutation_operations
      set result = response, completed_at = now()
      where mutation_operations.operation_id =
        complete_onboarding.operation_id;

      return response;
    end if;

    raise exception 'onboarding is already complete'
      using errcode = '23514';
  elsif onboarding_row.status = 'skipped' then
    raise exception 'onboarding was already skipped'
      using errcode = '23514';
  elsif onboarding_row.status in ('not_started', 'recoverable_error') then
    update public.onboarding_states
    set
      status = 'in_progress',
      started_at = coalesce(started_at, now()),
      state_revision = state_revision + 1
    where anonymous_user_id = owner_id
    returning * into onboarding_row;
  end if;

  update public.onboarding_states
  set
    status = desired_status,
    onboarding_version = complete_onboarding.onboarding_version,
    preference_set_version = complete_onboarding.preference_set_version,
    preference_ids = normalized_preferences,
    completion_operation_id = operation_id,
    completed_at = now(),
    state_revision = state_revision + 1
  where anonymous_user_id = owner_id
  returning * into onboarding_row;

  response := jsonb_build_object(
    'ok', true,
    'operation_id', operation_id,
    'state_revision', onboarding_row.state_revision,
    'data', jsonb_build_object(
      'status', onboarding_row.status,
      'preference_ids', onboarding_row.preference_ids
    )
  );

  update private.mutation_operations
  set result = response, completed_at = now()
  where mutation_operations.operation_id = complete_onboarding.operation_id;

  return response;
end;
$$;

create function public.skip_onboarding(
  operation_id uuid,
  onboarding_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := private.current_anonymous_user_id();
  fingerprint jsonb;
  replay_result jsonb;
  response jsonb;
  onboarding_row public.onboarding_states%rowtype;
begin
  if nullif(btrim(onboarding_version), '') is null then
    raise exception 'onboarding_version is required'
      using errcode = '22023';
  end if;

  fingerprint := jsonb_build_object(
    'onboarding_version',
    onboarding_version
  );

  replay_result := private.claim_mutation_operation(
    operation_id,
    owner_id,
    'skip_onboarding',
    fingerprint
  );

  if replay_result is not null then
    return replay_result;
  end if;

  select onboarding_states.*
  into onboarding_row
  from public.onboarding_states
  where onboarding_states.anonymous_user_id = owner_id
  for update;

  if not found then
    insert into public.onboarding_states (
      anonymous_user_id,
      status,
      started_at,
      state_revision
    )
    values (
      owner_id,
      'in_progress',
      now(),
      1
    )
    returning * into onboarding_row;
  elsif onboarding_row.status = 'skipped' then
    if onboarding_row.onboarding_version = onboarding_version then
      response := jsonb_build_object(
        'ok', true,
        'operation_id', operation_id,
        'state_revision', onboarding_row.state_revision,
        'data', jsonb_build_object('status', onboarding_row.status)
      );

      update private.mutation_operations
      set result = response, completed_at = now()
      where mutation_operations.operation_id = skip_onboarding.operation_id;

      return response;
    end if;

    raise exception 'onboarding was already skipped with another version'
      using errcode = '23514';
  elsif onboarding_row.status in (
    'completed_with_preferences',
    'completed_without_preferences'
  ) then
    raise exception 'onboarding is already complete'
      using errcode = '23514';
  elsif onboarding_row.status in ('not_started', 'recoverable_error') then
    update public.onboarding_states
    set
      status = 'in_progress',
      started_at = coalesce(started_at, now()),
      state_revision = state_revision + 1
    where anonymous_user_id = owner_id
    returning * into onboarding_row;
  end if;

  update public.onboarding_states
  set
    status = 'skipped',
    onboarding_version = skip_onboarding.onboarding_version,
    preference_set_version = null,
    preference_ids = '{}',
    skip_operation_id = operation_id,
    completed_at = now(),
    state_revision = state_revision + 1
  where anonymous_user_id = owner_id
  returning * into onboarding_row;

  response := jsonb_build_object(
    'ok', true,
    'operation_id', operation_id,
    'state_revision', onboarding_row.state_revision,
    'data', jsonb_build_object('status', onboarding_row.status)
  );

  update private.mutation_operations
  set result = response, completed_at = now()
  where mutation_operations.operation_id = skip_onboarding.operation_id;

  return response;
end;
$$;

create function public.save_product(
  product_id uuid,
  operation_id uuid,
  source_surface text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := private.current_anonymous_user_id();
  canonical_wardrobe_id uuid;
  saved_row public.saved_products%rowtype;
  fingerprint jsonb;
  replay_result jsonb;
  response jsonb;
begin
  if source_surface not in (
    'discover',
    'product_detail',
    'wardrobe',
    'challenge',
    'challenge_picker'
  ) then
    raise exception 'invalid source_surface'
      using errcode = '22023';
  end if;

  fingerprint := jsonb_build_object(
    'product_id',
    product_id,
    'source_surface',
    source_surface
  );

  replay_result := private.claim_mutation_operation(
    operation_id,
    owner_id,
    'save_product',
    fingerprint
  );

  if replay_result is not null then
    return replay_result;
  end if;

  if not exists (
    select 1
    from public.products
    where products.id = product_id
      and products.is_active
  ) then
    raise exception 'active product not found'
      using errcode = '22023';
  end if;

  select wardrobes.id
  into canonical_wardrobe_id
  from public.wardrobes
  where wardrobes.anonymous_user_id = owner_id
  for update;

  if canonical_wardrobe_id is null then
    raise exception 'canonical Wardrobe not found'
      using errcode = '55000';
  end if;

  select saved_products.*
  into saved_row
  from public.saved_products
  where saved_products.anonymous_user_id = owner_id
    and saved_products.product_id = save_product.product_id
    and saved_products.removed_at is null
  for update;

  if not found then
    insert into public.saved_products (
      wardrobe_id,
      anonymous_user_id,
      product_id,
      source_surface,
      save_operation_id
    )
    values (
      canonical_wardrobe_id,
      owner_id,
      product_id,
      source_surface,
      operation_id
    )
    on conflict (anonymous_user_id, product_id)
      where removed_at is null
      do nothing
    returning * into saved_row;

    if not found then
      select saved_products.*
      into strict saved_row
      from public.saved_products
      where saved_products.anonymous_user_id = owner_id
        and saved_products.product_id = save_product.product_id
        and saved_products.removed_at is null;
    end if;
  end if;

  response := jsonb_build_object(
    'ok', true,
    'operation_id', operation_id,
    'data', jsonb_build_object(
      'saved_product_id', saved_row.id,
      'product_id', saved_row.product_id,
      'saved_at', saved_row.saved_at
    )
  );

  update private.mutation_operations
  set result = response, completed_at = now()
  where mutation_operations.operation_id = save_product.operation_id;

  return response;
end;
$$;

create function public.remove_product(
  saved_product_id uuid,
  operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := private.current_anonymous_user_id();
  saved_row public.saved_products%rowtype;
  fingerprint jsonb;
  replay_result jsonb;
  response jsonb;
begin
  fingerprint := jsonb_build_object('saved_product_id', saved_product_id);

  replay_result := private.claim_mutation_operation(
    operation_id,
    owner_id,
    'remove_product',
    fingerprint
  );

  if replay_result is not null then
    return replay_result;
  end if;

  select saved_products.*
  into saved_row
  from public.saved_products
  where saved_products.id = saved_product_id
    and saved_products.anonymous_user_id = owner_id
  for update;

  if not found then
    raise exception 'owned saved product not found'
      using errcode = '42501';
  end if;

  if saved_row.removed_at is not null then
    raise exception 'saved product is not active'
      using errcode = '23514';
  end if;

  with removed_items as (
    update public.challenge_progress_items
    set
      removed_at = now(),
      removal_operation_id = gen_random_uuid()
    where challenge_progress_items.product_id = saved_row.product_id
      and challenge_progress_items.removed_at is null
      and exists (
        select 1
        from public.challenge_progress
        where challenge_progress.id =
          challenge_progress_items.challenge_progress_id
          and challenge_progress.anonymous_user_id = owner_id
          and challenge_progress.status in (
            'in_progress',
            'ready_to_complete'
          )
      )
    returning challenge_progress_id
  )
  update public.challenge_progress
  set
    status = case
      when status = 'ready_to_complete'
        then 'in_progress'::public.challenge_status
      else status
    end,
    last_interacted_at = now(),
    state_revision = state_revision + 1
  where challenge_progress.id in (
    select distinct removed_items.challenge_progress_id
    from removed_items
  );

  update public.saved_products
  set
    removed_at = now(),
    remove_operation_id = operation_id
  where saved_products.id = saved_product_id
  returning * into saved_row;

  response := jsonb_build_object(
    'ok', true,
    'operation_id', operation_id,
    'data', jsonb_build_object(
      'saved_product_id', saved_row.id,
      'product_id', saved_row.product_id,
      'removed_at', saved_row.removed_at
    )
  );

  update private.mutation_operations
  set result = response, completed_at = now()
  where mutation_operations.operation_id = remove_product.operation_id;

  return response;
end;
$$;

create function public.start_challenge(
  challenge_id uuid,
  operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := private.current_anonymous_user_id();
  progress_row public.challenge_progress%rowtype;
  fingerprint jsonb;
  replay_result jsonb;
  response jsonb;
begin
  fingerprint := jsonb_build_object('challenge_id', challenge_id);

  replay_result := private.claim_mutation_operation(
    operation_id,
    owner_id,
    'start_challenge',
    fingerprint
  );

  if replay_result is not null then
    return replay_result;
  end if;

  if not exists (
    select 1
    from public.challenges
    where challenges.id = challenge_id
      and challenges.is_active
      and challenges.active_from <= now()
      and (
        challenges.active_until is null
        or challenges.active_until > now()
      )
  ) then
    raise exception 'active challenge not found'
      using errcode = '22023';
  end if;

  insert into public.challenge_progress (
    anonymous_user_id,
    challenge_id,
    status,
    start_operation_id,
    started_at,
    last_interacted_at,
    state_revision
  )
  values (
    owner_id,
    challenge_id,
    'in_progress',
    operation_id,
    now(),
    now(),
    1
  )
  on conflict (anonymous_user_id, challenge_id) do nothing
  returning * into progress_row;

  if not found then
    select challenge_progress.*
    into strict progress_row
    from public.challenge_progress
    where challenge_progress.anonymous_user_id = owner_id
      and challenge_progress.challenge_id = start_challenge.challenge_id;
  end if;

  response := jsonb_build_object(
    'ok', true,
    'operation_id', operation_id,
    'state_revision', progress_row.state_revision,
    'data', jsonb_build_object(
      'challenge_progress_id', progress_row.id,
      'status', progress_row.status
    )
  );

  update private.mutation_operations
  set result = response, completed_at = now()
  where mutation_operations.operation_id = start_challenge.operation_id;

  return response;
end;
$$;

create function public.select_challenge_item(
  challenge_progress_id uuid,
  slot_id text,
  product_id uuid,
  operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := private.current_anonymous_user_id();
  progress_owner_id uuid;
  progress_challenge_id uuid;
  progress_status public.challenge_status;
  progress_revision bigint;
  required_slots jsonb;
  required_count integer;
  active_count integer;
  valid_count integer;
  item_row public.challenge_progress_items%rowtype;
  fingerprint jsonb;
  replay_result jsonb;
  response jsonb;
begin
  if nullif(btrim(slot_id), '') is null then
    raise exception 'slot_id is required'
      using errcode = '22023';
  end if;

  fingerprint := jsonb_build_object(
    'challenge_progress_id',
    challenge_progress_id,
    'slot_id',
    slot_id,
    'product_id',
    product_id
  );

  replay_result := private.claim_mutation_operation(
    operation_id,
    owner_id,
    'select_challenge_item',
    fingerprint
  );

  if replay_result is not null then
    return replay_result;
  end if;

  select
    challenge_progress.anonymous_user_id,
    challenge_progress.challenge_id,
    challenge_progress.status,
    challenge_progress.state_revision,
    challenges.required_slots
  into
    progress_owner_id,
    progress_challenge_id,
    progress_status,
    progress_revision,
    required_slots
  from public.challenge_progress
  join public.challenges
    on challenges.id = challenge_progress.challenge_id
  where challenge_progress.id = challenge_progress_id
  for update of challenge_progress;

  if not found or progress_owner_id <> owner_id then
    raise exception 'owned challenge progress not found'
      using errcode = '42501';
  end if;

  if progress_status not in ('in_progress', 'ready_to_complete') then
    raise exception 'challenge progress does not permit selection'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.challenges
    where challenges.id = progress_challenge_id
      and challenges.is_active
      and challenges.active_from <= now()
      and (
        challenges.active_until is null
        or challenges.active_until > now()
      )
  ) then
    raise exception 'challenge definition is no longer active'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(required_slots) as required_slot(value)
    where required_slot.value ->> 'slot_id' = slot_id
  ) then
    raise exception 'slot is not required by this challenge'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.products
    where products.id = product_id
      and products.is_active
      and slot_id = any(products.slot_eligibility)
  ) then
    raise exception 'product is not active and eligible for this slot'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.saved_products
    where saved_products.anonymous_user_id = owner_id
      and saved_products.product_id = select_challenge_item.product_id
      and saved_products.removed_at is null
  ) then
    raise exception 'product is not in the caller Wardrobe'
      using errcode = '42501';
  end if;

  select challenge_progress_items.*
  into item_row
  from public.challenge_progress_items
  where challenge_progress_items.challenge_progress_id =
      select_challenge_item.challenge_progress_id
    and challenge_progress_items.slot_id = select_challenge_item.slot_id
    and challenge_progress_items.removed_at is null
  for update;

  if found and item_row.product_id = product_id then
    response := jsonb_build_object(
      'ok', true,
      'operation_id', operation_id,
      'state_revision', progress_revision,
      'data', jsonb_build_object(
        'challenge_progress_item_id', item_row.id,
        'slot_id', item_row.slot_id,
        'product_id', item_row.product_id,
        'status', progress_status
      )
    );

    update private.mutation_operations
    set result = response, completed_at = now()
    where mutation_operations.operation_id =
      select_challenge_item.operation_id;

    return response;
  end if;

  if exists (
    select 1
    from public.challenge_progress_items
    where challenge_progress_items.challenge_progress_id =
        select_challenge_item.challenge_progress_id
      and challenge_progress_items.product_id =
        select_challenge_item.product_id
      and challenge_progress_items.removed_at is null
  ) then
    raise exception 'product is already selected in another slot'
      using errcode = '23505';
  end if;

  if item_row.id is not null then
    update public.challenge_progress_items
    set
      removed_at = now(),
      removal_operation_id = gen_random_uuid()
    where challenge_progress_items.id = item_row.id;
  end if;

  insert into public.challenge_progress_items (
    challenge_progress_id,
    slot_id,
    product_id,
    selection_operation_id
  )
  values (
    challenge_progress_id,
    slot_id,
    product_id,
    operation_id
  )
  returning * into item_row;

  required_count := jsonb_array_length(required_slots);

  select count(*)::integer
  into active_count
  from public.challenge_progress_items
  where challenge_progress_items.challenge_progress_id =
      select_challenge_item.challenge_progress_id
    and challenge_progress_items.removed_at is null;

  select count(*)::integer
  into valid_count
  from public.challenge_progress_items
  join public.products
    on products.id = challenge_progress_items.product_id
  where challenge_progress_items.challenge_progress_id =
      select_challenge_item.challenge_progress_id
    and challenge_progress_items.removed_at is null
    and products.is_active
    and challenge_progress_items.slot_id = any(products.slot_eligibility)
    and exists (
      select 1
      from jsonb_array_elements(required_slots) as required_slot(value)
      where required_slot.value ->> 'slot_id' =
        challenge_progress_items.slot_id
    )
    and exists (
      select 1
      from public.saved_products
      where saved_products.anonymous_user_id = owner_id
        and saved_products.product_id =
          challenge_progress_items.product_id
        and saved_products.removed_at is null
    );

  update public.challenge_progress
  set
    status = case
      when active_count = required_count and valid_count = required_count
        then 'ready_to_complete'::public.challenge_status
      else 'in_progress'::public.challenge_status
    end,
    last_interacted_at = now(),
    state_revision = state_revision + 1
  where challenge_progress.id =
    select_challenge_item.challenge_progress_id
  returning status, state_revision
  into progress_status, progress_revision;

  response := jsonb_build_object(
    'ok', true,
    'operation_id', operation_id,
    'state_revision', progress_revision,
    'data', jsonb_build_object(
      'challenge_progress_item_id', item_row.id,
      'slot_id', item_row.slot_id,
      'product_id', item_row.product_id,
      'status', progress_status
    )
  );

  update private.mutation_operations
  set result = response, completed_at = now()
  where mutation_operations.operation_id =
    select_challenge_item.operation_id;

  return response;
end;
$$;

create function public.remove_challenge_item(
  challenge_progress_item_id uuid,
  operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := private.current_anonymous_user_id();
  owned_progress_id uuid;
  item_row public.challenge_progress_items%rowtype;
  progress_status public.challenge_status;
  progress_revision bigint;
  fingerprint jsonb;
  replay_result jsonb;
  response jsonb;
begin
  fingerprint := jsonb_build_object(
    'challenge_progress_item_id',
    challenge_progress_item_id
  );

  replay_result := private.claim_mutation_operation(
    operation_id,
    owner_id,
    'remove_challenge_item',
    fingerprint
  );

  if replay_result is not null then
    return replay_result;
  end if;

  select
    challenge_progress.id,
    challenge_progress.status,
    challenge_progress.state_revision
  into
    owned_progress_id,
    progress_status,
    progress_revision
  from public.challenge_progress
  join public.challenge_progress_items
    on challenge_progress_items.challenge_progress_id =
      challenge_progress.id
  where challenge_progress_items.id = challenge_progress_item_id
    and challenge_progress.anonymous_user_id = owner_id
  for update of challenge_progress;

  if not found then
    raise exception 'owned challenge selection not found'
      using errcode = '42501';
  end if;

  select challenge_progress_items.*
  into strict item_row
  from public.challenge_progress_items
  where challenge_progress_items.id = challenge_progress_item_id
    and challenge_progress_items.challenge_progress_id = owned_progress_id
  for update;

  if item_row.removed_at is not null then
    raise exception 'challenge selection is not active'
      using errcode = '23514';
  end if;

  if progress_status not in ('in_progress', 'ready_to_complete') then
    raise exception 'challenge progress does not permit removal'
      using errcode = '23514';
  end if;

  update public.challenge_progress_items
  set
    removed_at = now(),
    removal_operation_id = operation_id
  where challenge_progress_items.id = challenge_progress_item_id
  returning * into item_row;

  update public.challenge_progress
  set
    status = 'in_progress',
    last_interacted_at = now(),
    state_revision = state_revision + 1
  where challenge_progress.id = item_row.challenge_progress_id
  returning status, state_revision
  into progress_status, progress_revision;

  response := jsonb_build_object(
    'ok', true,
    'operation_id', operation_id,
    'state_revision', progress_revision,
    'data', jsonb_build_object(
      'challenge_progress_item_id', item_row.id,
      'slot_id', item_row.slot_id,
      'product_id', item_row.product_id,
      'removed_at', item_row.removed_at,
      'status', progress_status
    )
  );

  update private.mutation_operations
  set result = response, completed_at = now()
  where mutation_operations.operation_id =
    remove_challenge_item.operation_id;

  return response;
end;
$$;

create function public.complete_challenge(
  challenge_progress_id uuid,
  operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := private.current_anonymous_user_id();
  progress_owner_id uuid;
  progress_challenge_id uuid;
  progress_status public.challenge_status;
  progress_revision bigint;
  challenge_row public.challenges%rowtype;
  completion_row public.challenge_completions%rowtype;
  selected_snapshot jsonb;
  fingerprint jsonb;
  replay_result jsonb;
  response jsonb;
begin
  fingerprint := jsonb_build_object(
    'challenge_progress_id',
    challenge_progress_id
  );

  replay_result := private.claim_mutation_operation(
    operation_id,
    owner_id,
    'complete_challenge',
    fingerprint
  );

  if replay_result is not null then
    return replay_result;
  end if;

  select
    challenge_progress.anonymous_user_id,
    challenge_progress.challenge_id,
    challenge_progress.status,
    challenge_progress.state_revision
  into
    progress_owner_id,
    progress_challenge_id,
    progress_status,
    progress_revision
  from public.challenge_progress
  where challenge_progress.id = challenge_progress_id
  for update;

  if not found or progress_owner_id <> owner_id then
    raise exception 'owned challenge progress not found'
      using errcode = '42501';
  end if;

  select challenge_completions.*
  into completion_row
  from public.challenge_completions
  where challenge_completions.challenge_progress_id =
    complete_challenge.challenge_progress_id;

  if found then
    response := jsonb_build_object(
      'ok', true,
      'operation_id', operation_id,
      'state_revision', progress_revision,
      'data', jsonb_build_object(
        'challenge_completion_id', completion_row.id,
        'completed_at', completion_row.completed_at
      )
    );

    update private.mutation_operations
    set result = response, completed_at = now()
    where mutation_operations.operation_id =
      complete_challenge.operation_id;

    return response;
  end if;

  if progress_status <> 'ready_to_complete' then
    raise exception 'challenge is not ready to complete'
      using errcode = '23514';
  end if;

  select challenges.*
  into strict challenge_row
  from public.challenges
  where challenges.id = progress_challenge_id;

  if
    not challenge_row.is_active
    or challenge_row.active_from > now()
    or (
      challenge_row.active_until is not null
      and challenge_row.active_until <= now()
    )
  then
    raise exception 'challenge definition is no longer active'
      using errcode = '23514';
  end if;

  if (
    select count(*)
    from public.challenge_progress_items
    where challenge_progress_items.challenge_progress_id =
        complete_challenge.challenge_progress_id
      and challenge_progress_items.removed_at is null
  ) <> jsonb_array_length(challenge_row.required_slots) then
    raise exception 'required challenge slots are incomplete'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      challenge_row.required_slots
    ) as required_slot(value)
    where not exists (
      select 1
      from public.challenge_progress_items
      join public.products
        on products.id = challenge_progress_items.product_id
      join public.saved_products
        on saved_products.product_id = products.id
        and saved_products.anonymous_user_id = owner_id
        and saved_products.removed_at is null
      where challenge_progress_items.challenge_progress_id =
          complete_challenge.challenge_progress_id
        and challenge_progress_items.slot_id =
          required_slot.value ->> 'slot_id'
        and challenge_progress_items.removed_at is null
        and products.is_active
        and challenge_progress_items.slot_id =
          any(products.slot_eligibility)
    )
  ) then
    raise exception 'one or more challenge selections are invalid'
      using errcode = '23514';
  end if;

  select jsonb_build_object(
    'items',
    jsonb_agg(
      jsonb_build_object(
        'slot_id', challenge_progress_items.slot_id,
        'product_id', products.id,
        'name', products.name,
        'brand', products.brand,
        'category', products.category,
        'image_urls', products.image_urls
      )
      order by required_slot.ordinality
    )
  )
  into selected_snapshot
  from jsonb_array_elements(
    challenge_row.required_slots
  ) with ordinality as required_slot(value, ordinality)
  join public.challenge_progress_items
    on challenge_progress_items.challenge_progress_id =
      complete_challenge.challenge_progress_id
    and challenge_progress_items.slot_id =
      required_slot.value ->> 'slot_id'
    and challenge_progress_items.removed_at is null
  join public.products
    on products.id = challenge_progress_items.product_id;

  insert into public.challenge_completions (
    anonymous_user_id,
    challenge_id,
    challenge_progress_id,
    completion_operation_id,
    selected_products_snapshot,
    challenge_snapshot
  )
  values (
    owner_id,
    progress_challenge_id,
    challenge_progress_id,
    operation_id,
    selected_snapshot,
    jsonb_build_object(
      'challenge_id', challenge_row.id,
      'challenge_key', challenge_row.challenge_key,
      'version', challenge_row.version,
      'title', challenge_row.title,
      'context_copy', challenge_row.context_copy,
      'required_slots', challenge_row.required_slots,
      'completion_rules', challenge_row.completion_rules
    )
  )
  returning * into completion_row;

  update public.challenge_progress
  set
    status = 'completed',
    last_interacted_at = now(),
    state_revision = state_revision + 1
  where challenge_progress.id = challenge_progress_id
  returning state_revision into progress_revision;

  response := jsonb_build_object(
    'ok', true,
    'operation_id', operation_id,
    'state_revision', progress_revision,
    'data', jsonb_build_object(
      'challenge_completion_id', completion_row.id,
      'completed_at', completion_row.completed_at
    )
  );

  update private.mutation_operations
  set result = response, completed_at = now()
  where mutation_operations.operation_id =
    complete_challenge.operation_id;

  return response;
end;
$$;

alter function public.complete_onboarding(uuid, text, text, text[])
owner to postgres;
alter function public.skip_onboarding(uuid, text) owner to postgres;
alter function public.save_product(uuid, uuid, text) owner to postgres;
alter function public.remove_product(uuid, uuid) owner to postgres;
alter function public.start_challenge(uuid, uuid) owner to postgres;
alter function public.select_challenge_item(uuid, text, uuid, uuid)
owner to postgres;
alter function public.remove_challenge_item(uuid, uuid) owner to postgres;
alter function public.complete_challenge(uuid, uuid) owner to postgres;

revoke all on function public.complete_onboarding(uuid, text, text, text[])
from public, anon;
revoke all on function public.skip_onboarding(uuid, text)
from public, anon;
revoke all on function public.save_product(uuid, uuid, text)
from public, anon;
revoke all on function public.remove_product(uuid, uuid)
from public, anon;
revoke all on function public.start_challenge(uuid, uuid)
from public, anon;
revoke all on function public.select_challenge_item(
  uuid,
  text,
  uuid,
  uuid
) from public, anon;
revoke all on function public.remove_challenge_item(uuid, uuid)
from public, anon;
revoke all on function public.complete_challenge(uuid, uuid)
from public, anon;

grant execute on function public.complete_onboarding(uuid, text, text, text[])
to authenticated;
grant execute on function public.skip_onboarding(uuid, text)
to authenticated;
grant execute on function public.save_product(uuid, uuid, text)
to authenticated;
grant execute on function public.remove_product(uuid, uuid)
to authenticated;
grant execute on function public.start_challenge(uuid, uuid)
to authenticated;
grant execute on function public.select_challenge_item(
  uuid,
  text,
  uuid,
  uuid
) to authenticated;
grant execute on function public.remove_challenge_item(uuid, uuid)
to authenticated;
grant execute on function public.complete_challenge(uuid, uuid)
to authenticated;

commit;
