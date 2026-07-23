begin;

create table public.wardrobes (
  id uuid constraint wardrobes_pkey primary key default gen_random_uuid(),
  anonymous_user_id uuid not null,
  user_id uuid,
  name text not null default 'My Wardrobe',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wardrobes_anonymous_user_id_key unique (anonymous_user_id),
  constraint wardrobes_id_anonymous_user_id_key unique (id, anonymous_user_id),
  constraint wardrobes_anonymous_user_id_fkey
    foreign key (anonymous_user_id)
    references public.anonymous_users (id)
    on delete cascade,
  constraint wardrobes_user_id_fkey
    foreign key (user_id) references public.users (id),
  constraint wardrobes_name_check check (btrim(name) <> '')
);

create table public.saved_products (
  id uuid constraint saved_products_pkey primary key default gen_random_uuid(),
  wardrobe_id uuid not null,
  anonymous_user_id uuid not null,
  user_id uuid,
  product_id uuid not null,
  saved_at timestamptz not null default now(),
  removed_at timestamptz,
  source_surface text not null,
  save_operation_id uuid not null,
  remove_operation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_products_wardrobe_owner_fkey
    foreign key (wardrobe_id, anonymous_user_id)
    references public.wardrobes (id, anonymous_user_id)
    on delete cascade,
  constraint saved_products_anonymous_user_id_fkey
    foreign key (anonymous_user_id)
    references public.anonymous_users (id)
    on delete cascade,
  constraint saved_products_user_id_fkey
    foreign key (user_id) references public.users (id),
  constraint saved_products_product_id_fkey
    foreign key (product_id) references public.products (id),
  constraint saved_products_save_operation_id_key unique (save_operation_id),
  constraint saved_products_remove_operation_id_key unique (remove_operation_id),
  constraint saved_products_removed_at_check check (
    removed_at is null
    or removed_at >= saved_at
  ),
  constraint saved_products_removal_pair_check check (
    (removed_at is null) = (remove_operation_id is null)
  ),
  constraint saved_products_source_surface_check check (
    source_surface in (
      'discover',
      'product_detail',
      'wardrobe',
      'challenge',
      'challenge_picker'
    )
  )
);

create table public.challenges (
  id uuid constraint challenges_pkey primary key default gen_random_uuid(),
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
  constraint challenges_challenge_key_version_key
    unique (challenge_key, version),
  constraint challenges_challenge_key_check check (btrim(challenge_key) <> ''),
  constraint challenges_version_check check (btrim(version) <> ''),
  constraint challenges_title_check check (btrim(title) <> ''),
  constraint challenges_context_copy_check check (btrim(context_copy) <> ''),
  constraint challenges_required_slots_check check (
    jsonb_typeof(required_slots) = 'array'
    and jsonb_array_length(required_slots) > 0
  ),
  constraint challenges_completion_rules_check check (
    jsonb_typeof(completion_rules) = 'object'
  ),
  constraint challenges_active_window_check check (
    active_until is null
    or active_until > active_from
  )
);

create table public.challenge_progress (
  id uuid
    constraint challenge_progress_pkey primary key
    default gen_random_uuid(),
  anonymous_user_id uuid not null,
  user_id uuid,
  challenge_id uuid not null,
  status public.challenge_status not null default 'not_started',
  start_operation_id uuid not null,
  started_at timestamptz,
  last_interacted_at timestamptz,
  invalidated_at timestamptz,
  invalidation_reason text,
  state_revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint challenge_progress_anonymous_user_id_fkey
    foreign key (anonymous_user_id)
    references public.anonymous_users (id)
    on delete cascade,
  constraint challenge_progress_user_id_fkey
    foreign key (user_id) references public.users (id),
  constraint challenge_progress_challenge_id_fkey
    foreign key (challenge_id) references public.challenges (id),
  constraint challenge_progress_start_operation_id_key
    unique (start_operation_id),
  constraint challenge_progress_anonymous_user_challenge_key
    unique (anonymous_user_id, challenge_id),
  constraint challenge_progress_id_owner_challenge_key
    unique (id, anonymous_user_id, challenge_id),
  constraint challenge_progress_state_revision_check check (
    state_revision >= 0
  ),
  constraint challenge_progress_started_at_check check (
    status = 'not_started'
    or started_at is not null
  ),
  constraint challenge_progress_interaction_time_check check (
    last_interacted_at is null
    or (
      started_at is not null
      and last_interacted_at >= started_at
    )
  ),
  constraint challenge_progress_invalidation_check check (
    (
      status = 'invalidated'
      and invalidated_at is not null
      and nullif(btrim(invalidation_reason), '') is not null
    )
    or (
      status <> 'invalidated'
      and invalidated_at is null
      and invalidation_reason is null
    )
  )
);

create table public.challenge_progress_items (
  id uuid
    constraint challenge_progress_items_pkey primary key
    default gen_random_uuid(),
  challenge_progress_id uuid not null,
  slot_id text not null,
  product_id uuid not null,
  selection_operation_id uuid not null,
  selected_at timestamptz not null default now(),
  removed_at timestamptz,
  removal_operation_id uuid,
  constraint challenge_progress_items_progress_id_fkey
    foreign key (challenge_progress_id)
    references public.challenge_progress (id)
    on delete cascade,
  constraint challenge_progress_items_product_id_fkey
    foreign key (product_id) references public.products (id),
  constraint challenge_progress_items_selection_operation_id_key
    unique (selection_operation_id),
  constraint challenge_progress_items_removal_operation_id_key
    unique (removal_operation_id),
  constraint challenge_progress_items_slot_id_check check (
    btrim(slot_id) <> ''
  ),
  constraint challenge_progress_items_removed_at_check check (
    removed_at is null
    or removed_at >= selected_at
  ),
  constraint challenge_progress_items_removal_pair_check check (
    (removed_at is null) = (removal_operation_id is null)
  )
);

create table public.challenge_completions (
  id uuid
    constraint challenge_completions_pkey primary key
    default gen_random_uuid(),
  anonymous_user_id uuid not null,
  user_id uuid,
  challenge_id uuid not null,
  challenge_progress_id uuid not null,
  completion_operation_id uuid not null,
  selected_products_snapshot jsonb not null,
  challenge_snapshot jsonb not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint challenge_completions_progress_owner_challenge_fkey
    foreign key (
      challenge_progress_id,
      anonymous_user_id,
      challenge_id
    )
    references public.challenge_progress (
      id,
      anonymous_user_id,
      challenge_id
    ),
  constraint challenge_completions_anonymous_user_id_fkey
    foreign key (anonymous_user_id)
    references public.anonymous_users (id)
    on delete cascade,
  constraint challenge_completions_user_id_fkey
    foreign key (user_id) references public.users (id),
  constraint challenge_completions_challenge_id_fkey
    foreign key (challenge_id) references public.challenges (id),
  constraint challenge_completions_challenge_progress_id_key
    unique (challenge_progress_id),
  constraint challenge_completions_completion_operation_id_key
    unique (completion_operation_id),
  constraint challenge_completions_selected_products_snapshot_check check (
    jsonb_typeof(selected_products_snapshot) = 'object'
    and selected_products_snapshot <> '{}'::jsonb
  ),
  constraint challenge_completions_challenge_snapshot_check check (
    jsonb_typeof(challenge_snapshot) = 'object'
    and challenge_snapshot <> '{}'::jsonb
  )
);

create unique index saved_products_active_unique
on public.saved_products (anonymous_user_id, product_id)
where removed_at is null;

create unique index one_active_challenge
on public.challenges ((is_active))
where is_active = true;

create unique index challenge_active_slot_unique
on public.challenge_progress_items (challenge_progress_id, slot_id)
where removed_at is null;

create unique index challenge_active_product_unique
on public.challenge_progress_items (challenge_progress_id, product_id)
where removed_at is null;

create trigger wardrobes_set_updated_at
before update on public.wardrobes
for each row execute function public.set_updated_at();

create trigger saved_products_set_updated_at
before update on public.saved_products
for each row execute function public.set_updated_at();

create trigger challenge_progress_set_updated_at
before update on public.challenge_progress
for each row execute function public.set_updated_at();

create trigger challenge_progress_enforce_status_transition
before update of status on public.challenge_progress
for each row execute function public.enforce_challenge_status_transition();

commit;
