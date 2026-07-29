begin;

revoke all on function public.select_challenge_item(uuid, text, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.remove_challenge_item(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.complete_challenge(uuid, uuid)
from public, anon, authenticated;

drop function public.select_challenge_item(uuid, text, uuid, uuid);
drop function public.remove_challenge_item(uuid, uuid);
drop function public.complete_challenge(uuid, uuid);

create function public.select_challenge_item(
  challenge_progress_id uuid,
  slot_id text,
  product_id uuid,
  expected_state_revision bigint,
  operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := private.current_anonymous_user_id();
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

  if expected_state_revision is null or expected_state_revision < 0 then
    raise exception 'expected_state_revision must be nonnegative'
      using errcode = '22023';
  end if;

  fingerprint := jsonb_build_object(
    'challenge_progress_id',
    challenge_progress_id,
    'slot_id',
    slot_id,
    'product_id',
    product_id,
    'expected_state_revision',
    to_jsonb(expected_state_revision)
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
    challenge_progress.challenge_id,
    challenge_progress.status,
    challenge_progress.state_revision,
    challenges.required_slots
  into
    progress_challenge_id,
    progress_status,
    progress_revision,
    required_slots
  from public.challenge_progress
  join public.challenges
    on challenges.id = challenge_progress.challenge_id
  where challenge_progress.id =
    select_challenge_item.challenge_progress_id
    and challenge_progress.anonymous_user_id = owner_id
  for update of challenge_progress;

  if not found then
    raise exception 'owned challenge progress not found'
      using errcode = '42501';
  end if;

  if progress_revision <> expected_state_revision then
    raise exception using
      errcode = '40001',
      message = 'challenge_revision_mismatch';
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
    where required_slot.value ->> 'slot_id' =
      select_challenge_item.slot_id
  ) then
    raise exception 'slot is not required by this challenge'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.products
    where products.id = select_challenge_item.product_id
      and products.is_active
      and select_challenge_item.slot_id =
        any(products.slot_eligibility)
  ) then
    raise exception 'product is not active and eligible for this slot'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.saved_products
    where saved_products.anonymous_user_id = owner_id
      and saved_products.product_id =
        select_challenge_item.product_id
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
    and challenge_progress_items.slot_id =
      select_challenge_item.slot_id
    and challenge_progress_items.removed_at is null
  for update;

  if found and item_row.product_id = select_challenge_item.product_id then
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
    select_challenge_item.challenge_progress_id,
    select_challenge_item.slot_id,
    select_challenge_item.product_id,
    select_challenge_item.operation_id
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
    and challenge_progress_items.slot_id =
      any(products.slot_eligibility)
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
    state_revision =
      challenge_progress.state_revision + 1
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
  expected_state_revision bigint,
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
  if expected_state_revision is null or expected_state_revision < 0 then
    raise exception 'expected_state_revision must be nonnegative'
      using errcode = '22023';
  end if;

  fingerprint := jsonb_build_object(
    'challenge_progress_item_id',
    challenge_progress_item_id,
    'expected_state_revision',
    to_jsonb(expected_state_revision)
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
  where challenge_progress_items.id =
      remove_challenge_item.challenge_progress_item_id
    and challenge_progress.anonymous_user_id = owner_id
  for update of challenge_progress;

  if not found then
    raise exception 'owned challenge selection not found'
      using errcode = '42501';
  end if;

  if progress_revision <> expected_state_revision then
    raise exception using
      errcode = '40001',
      message = 'challenge_revision_mismatch';
  end if;

  select challenge_progress_items.*
  into strict item_row
  from public.challenge_progress_items
  where challenge_progress_items.id =
      remove_challenge_item.challenge_progress_item_id
    and challenge_progress_items.challenge_progress_id =
      owned_progress_id
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
    removal_operation_id = remove_challenge_item.operation_id
  where challenge_progress_items.id =
    remove_challenge_item.challenge_progress_item_id
  returning * into item_row;

  update public.challenge_progress
  set
    status = 'in_progress',
    last_interacted_at = now(),
    state_revision =
      challenge_progress.state_revision + 1
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
  expected_state_revision bigint,
  operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := private.current_anonymous_user_id();
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
  if expected_state_revision is null or expected_state_revision < 0 then
    raise exception 'expected_state_revision must be nonnegative'
      using errcode = '22023';
  end if;

  fingerprint := jsonb_build_object(
    'challenge_progress_id',
    challenge_progress_id,
    'expected_state_revision',
    to_jsonb(expected_state_revision)
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
    challenge_progress.challenge_id,
    challenge_progress.status,
    challenge_progress.state_revision
  into
    progress_challenge_id,
    progress_status,
    progress_revision
  from public.challenge_progress
  where challenge_progress.id =
    complete_challenge.challenge_progress_id
    and challenge_progress.anonymous_user_id = owner_id
  for update;

  if not found then
    raise exception 'owned challenge progress not found'
      using errcode = '42501';
  end if;

  if progress_revision <> expected_state_revision then
    raise exception using
      errcode = '40001',
      message = 'challenge_revision_mismatch';
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
    complete_challenge.challenge_progress_id,
    complete_challenge.operation_id,
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
    state_revision =
      challenge_progress.state_revision + 1
  where challenge_progress.id =
    complete_challenge.challenge_progress_id
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

alter function public.select_challenge_item(
  uuid,
  text,
  uuid,
  bigint,
  uuid
) owner to postgres;
alter function public.remove_challenge_item(uuid, bigint, uuid)
owner to postgres;
alter function public.complete_challenge(uuid, bigint, uuid)
owner to postgres;

revoke all on function public.select_challenge_item(
  uuid,
  text,
  uuid,
  bigint,
  uuid
) from public, anon;
revoke all on function public.remove_challenge_item(uuid, bigint, uuid)
from public, anon;
revoke all on function public.complete_challenge(uuid, bigint, uuid)
from public, anon;

grant execute on function public.select_challenge_item(
  uuid,
  text,
  uuid,
  bigint,
  uuid
) to authenticated;
grant execute on function public.remove_challenge_item(uuid, bigint, uuid)
to authenticated;
grant execute on function public.complete_challenge(uuid, bigint, uuid)
to authenticated;

commit;
