begin;

create function public.ensure_anonymous_identity()
returns table (
  anonymous_user_id uuid,
  wardrobe_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := auth.uid();
  canonical_anonymous_user_id uuid;
  canonical_wardrobe_id uuid;
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

  insert into public.anonymous_users as anonymous_identity (
    auth_user_id
  )
  values (
    authenticated_user_id
  )
  on conflict (auth_user_id) do update
  set last_seen_at = greatest(
    anonymous_identity.last_seen_at,
    excluded.last_seen_at
  )
  returning id into canonical_anonymous_user_id;

  insert into public.wardrobes (
    anonymous_user_id
  )
  values (
    canonical_anonymous_user_id
  )
  on conflict on constraint wardrobes_anonymous_user_id_key do nothing
  returning id into canonical_wardrobe_id;

  if canonical_wardrobe_id is null then
    select wardrobes.id
    into strict canonical_wardrobe_id
    from public.wardrobes
    where wardrobes.anonymous_user_id = canonical_anonymous_user_id;
  end if;

  return query
  select canonical_anonymous_user_id, canonical_wardrobe_id;
end;
$$;

revoke all on function public.ensure_anonymous_identity() from public;
revoke all on function public.ensure_anonymous_identity() from anon;
grant execute on function public.ensure_anonymous_identity() to authenticated;

revoke all on table public.anonymous_users from anon, authenticated;
revoke all on table public.wardrobes from anon, authenticated;

commit;
