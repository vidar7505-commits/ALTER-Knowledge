begin;

create extension if not exists pgcrypto;

create schema if not exists analytics;

create type public.onboarding_status as enum (
  'not_started',
  'in_progress',
  'completed_with_preferences',
  'completed_without_preferences',
  'skipped',
  'recoverable_error'
);

create type public.challenge_status as enum (
  'not_started',
  'in_progress',
  'ready_to_complete',
  'completed',
  'invalidated'
);

create type public.app_environment as enum (
  'local',
  'preview',
  'staging',
  'production'
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.prevent_anonymous_auth_user_id_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.auth_user_id is distinct from old.auth_user_id then
    raise exception using
      errcode = 'check_violation',
      message = 'anonymous_users.auth_user_id is immutable';
  end if;

  return new;
end;
$$;

create function public.enforce_onboarding_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if
    (old.status = 'not_started' and new.status = 'in_progress')
    or (
      old.status = 'in_progress'
      and new.status in (
        'completed_with_preferences',
        'completed_without_preferences',
        'skipped',
        'recoverable_error'
      )
    )
    or (
      old.status = 'recoverable_error'
      and new.status in ('in_progress', 'skipped')
    )
  then
    return new;
  end if;

  raise exception using
    errcode = 'check_violation',
    message = format(
      'invalid onboarding status transition: %s -> %s',
      old.status,
      new.status
    );
end;
$$;

create function public.enforce_challenge_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if
    (old.status = 'not_started' and new.status = 'in_progress')
    or (
      old.status = 'in_progress'
      and new.status in ('ready_to_complete', 'invalidated')
    )
    or (
      old.status = 'ready_to_complete'
      and new.status in ('in_progress', 'completed', 'invalidated')
    )
  then
    return new;
  end if;

  raise exception using
    errcode = 'check_violation',
    message = format(
      'invalid challenge status transition: %s -> %s',
      old.status,
      new.status
    );
end;
$$;

commit;
