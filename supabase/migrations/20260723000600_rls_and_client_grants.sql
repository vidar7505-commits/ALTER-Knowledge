begin;

alter table public.anonymous_users enable row level security;
alter table public.users enable row level security;
alter table public.onboarding_states enable row level security;
alter table public.sessions enable row level security;
alter table public.products enable row level security;
alter table public.wardrobes enable row level security;
alter table public.saved_products enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_progress enable row level security;
alter table public.challenge_progress_items enable row level security;
alter table public.challenge_completions enable row level security;
alter table public.feed_instances enable row level security;
alter table public.feed_instance_products enable row level security;
alter table public.events enable row level security;
alter table public.event_quarantine enable row level security;

create policy anonymous_users_select_own
on public.anonymous_users
for select
to authenticated
using (auth_user_id = auth.uid());

create policy users_select_own
on public.users
for select
to authenticated
using (id = auth.uid());

create policy onboarding_states_select_own
on public.onboarding_states
for select
to authenticated
using (
  exists (
    select 1
    from public.anonymous_users
    where anonymous_users.id = onboarding_states.anonymous_user_id
      and anonymous_users.auth_user_id = auth.uid()
  )
);

create policy sessions_select_own
on public.sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.anonymous_users
    where anonymous_users.id = sessions.anonymous_user_id
      and anonymous_users.auth_user_id = auth.uid()
  )
);

create policy products_select_active
on public.products
for select
to authenticated
using (is_active);

create policy wardrobes_select_own
on public.wardrobes
for select
to authenticated
using (
  exists (
    select 1
    from public.anonymous_users
    where anonymous_users.id = wardrobes.anonymous_user_id
      and anonymous_users.auth_user_id = auth.uid()
  )
);

create policy saved_products_select_own
on public.saved_products
for select
to authenticated
using (
  exists (
    select 1
    from public.anonymous_users
    where anonymous_users.id = saved_products.anonymous_user_id
      and anonymous_users.auth_user_id = auth.uid()
  )
);

create policy challenges_select_active
on public.challenges
for select
to authenticated
using (
  is_active
  and active_from <= now()
  and (active_until is null or active_until > now())
);

create policy challenge_progress_select_own
on public.challenge_progress
for select
to authenticated
using (
  exists (
    select 1
    from public.anonymous_users
    where anonymous_users.id = challenge_progress.anonymous_user_id
      and anonymous_users.auth_user_id = auth.uid()
  )
);

create policy challenge_progress_items_select_own
on public.challenge_progress_items
for select
to authenticated
using (
  exists (
    select 1
    from public.challenge_progress
    join public.anonymous_users
      on anonymous_users.id = challenge_progress.anonymous_user_id
    where challenge_progress.id =
      challenge_progress_items.challenge_progress_id
      and anonymous_users.auth_user_id = auth.uid()
  )
);

create policy challenge_completions_select_own
on public.challenge_completions
for select
to authenticated
using (
  exists (
    select 1
    from public.anonymous_users
    where anonymous_users.id = challenge_completions.anonymous_user_id
      and anonymous_users.auth_user_id = auth.uid()
  )
);

create policy feed_instances_select_own
on public.feed_instances
for select
to authenticated
using (
  exists (
    select 1
    from public.anonymous_users
    where anonymous_users.id = feed_instances.anonymous_user_id
      and anonymous_users.auth_user_id = auth.uid()
  )
);

create policy feed_instance_products_select_own
on public.feed_instance_products
for select
to authenticated
using (
  exists (
    select 1
    from public.feed_instances
    join public.anonymous_users
      on anonymous_users.id = feed_instances.anonymous_user_id
    where feed_instances.id = feed_instance_products.feed_instance_id
      and anonymous_users.auth_user_id = auth.uid()
  )
);

revoke all on table
  public.anonymous_users,
  public.users,
  public.onboarding_states,
  public.sessions,
  public.products,
  public.wardrobes,
  public.saved_products,
  public.challenges,
  public.challenge_progress,
  public.challenge_progress_items,
  public.challenge_completions,
  public.feed_instances,
  public.feed_instance_products,
  public.events,
  public.event_quarantine
from anon, authenticated;

grant select on table
  public.anonymous_users,
  public.users,
  public.onboarding_states,
  public.sessions,
  public.products,
  public.wardrobes,
  public.saved_products,
  public.challenges,
  public.challenge_progress,
  public.challenge_progress_items,
  public.challenge_completions,
  public.feed_instances,
  public.feed_instance_products
to authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.prevent_anonymous_auth_user_id_change()
from public, anon, authenticated;
revoke execute on function public.enforce_onboarding_status_transition()
from public, anon, authenticated;
revoke execute on function public.enforce_challenge_status_transition()
from public, anon, authenticated;

commit;
