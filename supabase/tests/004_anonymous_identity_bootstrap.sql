begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select no_plan();

select has_function(
  'public',
  'ensure_anonymous_identity',
  array[]::text[],
  'the anonymous identity bootstrap RPC exists'
);

select ok(
  (
    select procedures.prosecdef
    from pg_catalog.pg_proc as procedures
    join pg_catalog.pg_namespace as namespaces
      on namespaces.oid = procedures.pronamespace
    where namespaces.nspname = 'public'
      and procedures.proname = 'ensure_anonymous_identity'
      and procedures.pronargs = 0
  ),
  'the bootstrap RPC is security definer'
);

select ok(
  (
    select 'search_path=""' = any(procedures.proconfig)
    from pg_catalog.pg_proc as procedures
    join pg_catalog.pg_namespace as namespaces
      on namespaces.oid = procedures.pronamespace
    where namespaces.nspname = 'public'
      and procedures.proname = 'ensure_anonymous_identity'
      and procedures.pronargs = 0
  ),
  'the bootstrap RPC fixes an empty search path'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.ensure_anonymous_identity()',
    'EXECUTE'
  ),
  'authenticated users may execute the bootstrap RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.ensure_anonymous_identity()',
    'EXECUTE'
  ),
  'unauthenticated API users may not execute the bootstrap RPC'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.anonymous_users',
    'INSERT'
  ),
  'authenticated clients cannot insert anonymous identities directly'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.wardrobes',
    'INSERT'
  ),
  'authenticated clients cannot insert Wardrobes directly'
);

select throws_ok(
  'select * from public.ensure_anonymous_identity()',
  '28000',
  'anonymous authentication required',
  'the bootstrap RPC rejects a missing authenticated identity'
);

insert into auth.users (id, is_anonymous)
values
  ('00000000-0000-4000-8000-000000000051', true),
  ('00000000-0000-4000-8000-000000000052', true),
  ('00000000-0000-4000-8000-000000000053', false);

set local role authenticated;
set local "request.jwt.claim.sub" =
  '00000000-0000-4000-8000-000000000051';
set local "request.jwt.claims" =
  '{"sub":"00000000-0000-4000-8000-000000000051","role":"authenticated"}';

select lives_ok(
  'select * from public.ensure_anonymous_identity()',
  'the first authenticated bootstrap succeeds'
);

select is(
  (
    select first_result.anonymous_user_id
    from public.ensure_anonymous_identity() as first_result
  ),
  (
    select repeated_result.anonymous_user_id
    from public.ensure_anonymous_identity() as repeated_result
  ),
  'repeated bootstrap returns the same anonymous identity'
);

select is(
  (
    select first_result.wardrobe_id
    from public.ensure_anonymous_identity() as first_result
  ),
  (
    select repeated_result.wardrobe_id
    from public.ensure_anonymous_identity() as repeated_result
  ),
  'repeated bootstrap returns the same Wardrobe'
);

reset role;

select is(
  (
    select count(*)
    from public.anonymous_users
    where auth_user_id = '00000000-0000-4000-8000-000000000051'
  ),
  1::bigint,
  'repeated bootstrap creates one anonymous identity row'
);

select is(
  (
    select count(*)
    from public.wardrobes
    where anonymous_user_id = (
      select anonymous_users.id
      from public.anonymous_users
      where auth_user_id = '00000000-0000-4000-8000-000000000051'
    )
  ),
  1::bigint,
  'repeated bootstrap creates one canonical Wardrobe row'
);

set local role authenticated;
set local "request.jwt.claim.sub" =
  '00000000-0000-4000-8000-000000000052';
set local "request.jwt.claims" =
  '{"sub":"00000000-0000-4000-8000-000000000052","role":"authenticated"}';

select lives_ok(
  'select * from public.ensure_anonymous_identity()',
  'a second authenticated identity can bootstrap independently'
);

reset role;

set local role authenticated;
set local "request.jwt.claim.sub" =
  '00000000-0000-4000-8000-000000000053';
set local "request.jwt.claims" =
  '{"sub":"00000000-0000-4000-8000-000000000053","role":"authenticated"}';

select throws_ok(
  'select * from public.ensure_anonymous_identity()',
  '28000',
  'anonymous authentication required',
  'a permanent account cannot use the anonymous bootstrap RPC'
);

reset role;

select is(
  (select count(*) from public.anonymous_users),
  2::bigint,
  'two authenticated users produce two isolated analytical identities'
);

select is(
  (select count(*) from public.wardrobes),
  2::bigint,
  'each analytical identity has exactly one Wardrobe'
);

select ok(
  not exists (
    select anonymous_user_id
    from public.wardrobes
    group by anonymous_user_id
    having count(*) > 1
  ),
  'the Wardrobe ownership constraint prevents duplicate roots'
);

select * from finish();

rollback;
