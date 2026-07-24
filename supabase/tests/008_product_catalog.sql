begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select no_plan();

select has_table(
  'public',
  'onboarding_preferences',
  'the versioned onboarding preference taxonomy exists'
);

select ok(
  (
    select pg_class.relrowsecurity
    from pg_catalog.pg_class
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname = 'onboarding_preferences'
  ),
  'RLS is enabled on the onboarding preference taxonomy'
);

select has_function(
  'private',
  'import_lr001_catalog',
  array[]::text[],
  'the repository catalog import function exists'
);

select has_function(
  'public',
  'list_catalog_products',
  array['text', 'text', 'text', 'uuid', 'integer'],
  'the active-product list function exists'
);

select has_function(
  'public',
  'get_catalog_product',
  array['uuid'],
  'the product-detail function exists'
);

select has_function(
  'public',
  'list_products_for_challenge_slot',
  array['uuid', 'text', 'uuid', 'integer'],
  'the Challenge slot list function exists'
);

select is(
  (
    select count(*)
    from public.products
    where products.catalog_version = 'lr001-catalog-v1'
      and products.is_active
  ),
  16::bigint,
  'the repository import creates sixteen active LR-001 products'
);

select is(
  (
    select count(*)
    from public.products
    where products.catalog_version = 'lr001-catalog-v1'
      and not products.is_active
  ),
  1::bigint,
  'the repository import includes one inactive catalog fixture'
);

select is(
  (
    select count(distinct products.id)
    from public.products
    where products.external_source = 'alter_repository'
  ),
  17::bigint,
  'every repository product has a distinct stable canonical ID'
);

select is(
  (
    select count(*)
    from public.products
    where products.external_source = 'alter_repository'
      and (
        products.external_id is null
        or nullif(btrim(products.external_id), '') is null
      )
  ),
  0::bigint,
  'every repository product has a stable external identity'
);

create temporary table p08_catalog_snapshot on commit drop as
select products.id, products.updated_at
from public.products
where products.external_source = 'alter_repository';

select lives_ok(
  'select private.import_lr001_catalog()',
  'reapplying the repository catalog import succeeds'
);

select is(
  (
    select count(*)
    from public.products
    where products.external_source = 'alter_repository'
  ),
  17::bigint,
  'reapplying the import does not duplicate products'
);

select is(
  (
    select count(*)
    from public.products
    join p08_catalog_snapshot
      on p08_catalog_snapshot.id = products.id
    where products.updated_at <> p08_catalog_snapshot.updated_at
  ),
  0::bigint,
  'an unchanged reimport preserves canonical product timestamps'
);

select throws_like(
  $$
    insert into public.products (
      id,
      external_source,
      external_id,
      name,
      category,
      catalog_version
    )
    values (
      'c0800000-0000-4000-8000-000000000099',
      'alter_repository',
      'lr001-top-01',
      'Duplicate External Identity',
      'top',
      'lr001-catalog-v1'
    )
  $$,
  '%products_external_source_external_id_key%',
  'duplicate external product identity is rejected'
);

select is(
  (
    select count(*)
    from public.products
    where products.catalog_version = 'lr001-catalog-v1'
      and products.is_active
      and (
        nullif(btrim(products.name), '') is null
        or nullif(btrim(products.brand), '') is null
        or nullif(btrim(products.category), '') is null
        or nullif(btrim(products.subcategory), '') is null
        or nullif(btrim(products.catalog_version), '') is null
        or jsonb_typeof(products.attributes) <> 'object'
        or products.attributes = '{}'::jsonb
        or cardinality(products.slot_eligibility) = 0
        or (
          products.price_amount is null
        ) <> (
          products.price_currency is null
        )
      )
  ),
  0::bigint,
  'every active product satisfies the required field-quality contract'
);

select is(
  (
    select count(*)
    from public.products
    where products.catalog_version = 'lr001-catalog-v1'
      and products.is_active
      and (
        products.name ilike '%lorem ipsum%'
        or products.description ilike '%lorem ipsum%'
      )
  ),
  0::bigint,
  'active products contain no placeholder lorem ipsum copy'
);

select is(
  (
    select count(*)
    from public.products
    where products.catalog_version = 'lr001-catalog-v1'
      and products.is_active
      and (
        cardinality(products.image_urls) = 0
        or exists (
          select 1
          from unnest(products.image_urls) as image_url
          where image_url !~
            '^https://images[.]unsplash[.]com/[A-Za-z0-9?&=_-]+$'
        )
      )
  ),
  0::bigint,
  'every active product has an HTTPS image from the catalog allow-list'
);

select is(
  (
    select count(*)
    from public.products
    where products.catalog_version = 'lr001-catalog-v1'
      and products.is_active
      and (
        jsonb_typeof(products.image_metadata -> 'images')
          is distinct from 'array'
        or coalesce(
          jsonb_array_length(products.image_metadata -> 'images'),
          0
        ) <> cardinality(products.image_urls)
        or not (
          products.image_metadata ? 'primary_index'
        )
        or exists (
          select 1
          from jsonb_array_elements(
            products.image_metadata -> 'images'
          ) as image(value)
          where nullif(btrim(image.value ->> 'url'), '') is null
            or (image.value ->> 'width')::integer <= 0
            or (image.value ->> 'height')::integer <= 0
            or (image.value ->> 'aspect_ratio')::numeric <= 0
            or nullif(btrim(image.value ->> 'alt'), '') is null
        )
      )
  ),
  0::bigint,
  'active image metadata includes valid URL, size, ratio, and alt text'
);

select is(
  (
    select count(*)
    from public.products
    where products.catalog_version = 'lr001-catalog-v1'
      and products.is_active
      and (
        not products.attributes ?& array[
          'style_tags',
          'color',
          'season',
          'fit',
          'occasion_tags',
          'materials'
        ]
        or jsonb_typeof(products.attributes -> 'style_tags')
          is distinct from 'array'
        or jsonb_typeof(products.attributes -> 'season')
          is distinct from 'array'
        or jsonb_typeof(products.attributes -> 'occasion_tags')
          is distinct from 'array'
        or jsonb_typeof(products.attributes -> 'materials')
          is distinct from 'array'
      )
  ),
  0::bigint,
  'active products expose the required UI and analytics attributes'
);

select is(
  (
    select count(*)
    from public.products
    cross join unnest(products.slot_eligibility) as eligible_slot(slot_id)
    where products.catalog_version = 'lr001-catalog-v1'
      and eligible_slot.slot_id not in (
        'top',
        'bottom',
        'shoes',
        'layer_or_accessory'
      )
  ),
  0::bigint,
  'product slot eligibility uses only the canonical Challenge slot IDs'
);

select is(
  (
    select count(*)
    from public.challenges
    where challenges.id =
      'c0810000-0000-4000-8000-000000000001'
      and challenges.challenge_key = 'after-dark'
      and challenges.version = 'challenge-evening-v1'
      and challenges.title = 'After Dark'
      and challenges.context_copy =
        'Build a look for an evening out.'
      and challenges.is_active
  ),
  1::bigint,
  'the canonical active After Dark Challenge is imported'
);

select is(
  (
    select array_agg(required_slot.value ->> 'slot_id' order by ordinality)
    from public.challenges
    cross join lateral jsonb_array_elements(
      challenges.required_slots
    ) with ordinality as required_slot(value, ordinality)
    where challenges.id =
      'c0810000-0000-4000-8000-000000000001'
  ),
  array['top', 'bottom', 'shoes', 'layer_or_accessory'],
  'the Challenge defines the four required slots in canonical order'
);

select is(
  (
    select count(*)
    from (
      select required_slot.value ->> 'slot_id' as slot_id
      from public.challenges
      cross join lateral jsonb_array_elements(
        challenges.required_slots
      ) as required_slot(value)
      where challenges.id =
        'c0810000-0000-4000-8000-000000000001'
    ) as slots
    where (
      select count(*)
      from public.products
      where products.is_active
        and slots.slot_id = any(products.slot_eligibility)
    ) < 4
  ),
  0::bigint,
  'every required Challenge slot has at least four active eligible products'
);

select is(
  (
    select count(*)
    from public.onboarding_preferences
    where onboarding_preferences.definition_version =
      'onboarding-style-v1'
      and onboarding_preferences.is_active
  ),
  12::bigint,
  'the canonical onboarding definition contains twelve active choices'
);

select is(
  (
    select count(*)
    from public.onboarding_preferences
    where onboarding_preferences.definition_version =
      'onboarding-style-v1'
      and onboarding_preferences.preference_group = 'style'
      and onboarding_preferences.max_selections = 4
  ),
  6::bigint,
  'all six style choices preserve the four-selection limit'
);

select ok(
  not has_table_privilege(
    'anon',
    'public.onboarding_preferences',
    'SELECT'
  )
  and has_table_privilege(
    'authenticated',
    'public.onboarding_preferences',
    'SELECT'
  ),
  'only authenticated browser users can read the active onboarding taxonomy'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.products',
    'INSERT'
  )
  and not has_table_privilege(
    'authenticated',
    'public.products',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.products',
    'DELETE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.challenges',
    'INSERT'
  )
  and not has_table_privilege(
    'authenticated',
    'public.challenges',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.challenges',
    'DELETE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.onboarding_preferences',
    'INSERT'
  )
  and not has_table_privilege(
    'authenticated',
    'public.onboarding_preferences',
    'UPDATE'
  )
  and not has_table_privilege(
    'authenticated',
    'public.onboarding_preferences',
    'DELETE'
  ),
  'browser roles have no catalog, Challenge, or taxonomy write privilege'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.import_lr001_catalog()',
    'EXECUTE'
  ),
  'the repository import is not browser-callable'
);

select ok(
  (
    select pg_proc.provolatile = 'v'
      and not pg_proc.prosecdef
      and pg_proc.proconfig = array['search_path=']
      and pg_get_functiondef(pg_proc.oid) !~* '\mexecute\M'
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname = 'import_lr001_catalog'
  ),
  'the catalog import is VOLATILE, invoker-rights, fixed-path, and contains no dynamic SQL'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.list_catalog_products(text,text,text,uuid,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.list_catalog_products(text,text,text,uuid,integer)',
    'EXECUTE'
  ),
  'catalog reads are granted to authenticated users and denied to anon'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_proc
    join pg_catalog.pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'list_catalog_products',
        'get_catalog_product',
        'list_products_for_challenge_slot'
      )
      and not pg_proc.prosecdef
      and pg_proc.provolatile = 's'
      and pg_proc.proconfig = array['search_path=']
  ),
  3::bigint,
  'all catalog read functions are STABLE security-invoker boundaries with empty search paths'
);

set local role authenticated;

select is(
  (select count(*) from public.products),
  16::bigint,
  'authenticated table reads expose active products only'
);

select is(
  (
    select count(*)
    from public.products
    where products.id =
      'c0800000-0000-4000-8000-000000000017'
  ),
  0::bigint,
  'the inactive product is excluded by catalog RLS'
);

select is(
  (
    select array_agg(catalog_product.id order by catalog_product.id)
    from public.list_catalog_products(
      p_limit => 5
    ) as catalog_product
  ),
  array[
    'c0800000-0000-4000-8000-000000000001'::uuid,
    'c0800000-0000-4000-8000-000000000002'::uuid,
    'c0800000-0000-4000-8000-000000000003'::uuid,
    'c0800000-0000-4000-8000-000000000004'::uuid,
    'c0800000-0000-4000-8000-000000000005'::uuid
  ],
  'active-product ordering is deterministic and independent of insertion order'
);

select is(
  (
    select count(*)
    from public.list_catalog_products(
      p_category => 'top',
      p_limit => 51
    )
  ),
  4::bigint,
  'category filtering returns only matching products'
);

select is(
  (
    select count(*)
    from public.list_catalog_products(
      p_subcategory => 'boots',
      p_limit => 51
    )
  ),
  1::bigint,
  'subcategory filtering returns only matching products'
);

select is(
  (
    select count(*)
    from public.list_catalog_products(
      p_slot_id => 'layer_or_accessory',
      p_limit => 51
    )
  ),
  4::bigint,
  'slot filtering returns every matching active layer or accessory'
);

select is(
  (
    select count(*)
    from public.get_catalog_product(
      'c0800000-0000-4000-8000-000000000001'
    )
  ),
  1::bigint,
  'product detail returns the requested active canonical product'
);

select is(
  (
    select count(*)
    from public.get_catalog_product(
      'c0800000-0000-4000-8000-000000000099'
    )
  ),
  0::bigint,
  'unknown product detail returns an empty typed result'
);

select is(
  (
    select count(*)
    from public.get_catalog_product(
      'c0800000-0000-4000-8000-000000000017'
    )
  ),
  0::bigint,
  'inactive product detail is not exposed'
);

select is(
  (
    select count(*)
    from public.list_products_for_challenge_slot(
      'c0810000-0000-4000-8000-000000000001',
      'shoes',
      null,
      51
    )
  ),
  4::bigint,
  'Challenge slot reads return eligible active products'
);

select is(
  (
    select count(*)
    from public.list_products_for_challenge_slot(
      'c0810000-0000-4000-8000-000000000001',
      'unsupported_slot',
      null,
      51
    )
  ),
  0::bigint,
  'an unknown Challenge slot returns a stable empty result'
);

select is(
  (
    with first_page as (
      select catalog_product.id
      from public.list_catalog_products(p_limit => 5) as catalog_product
    ),
    second_page as (
      select catalog_product.id
      from public.list_catalog_products(
        p_after_id =>
          'c0800000-0000-4000-8000-000000000005',
        p_limit => 5
      ) as catalog_product
    )
    select count(*)
    from first_page
    join second_page using (id)
  ),
  0::bigint,
  'adjacent keyset pages contain no duplicate products'
);

select is(
  (
    with first_page as (
      select catalog_product.id
      from public.list_catalog_products(p_limit => 5) as catalog_product
    ),
    remaining_pages as (
      select catalog_product.id
      from public.list_catalog_products(
        p_after_id =>
          'c0800000-0000-4000-8000-000000000005',
        p_limit => 51
      ) as catalog_product
    )
    select count(distinct id)
    from (
      select id from first_page
      union all
      select id from remaining_pages
    ) as paged_products
  ),
  16::bigint,
  'keyset pagination skips no products in an unchanged catalog'
);

select throws_like(
  'select * from public.list_catalog_products(p_limit => 0)',
  '%catalog page size must be between 1 and 51%',
  'invalid SQL page size fails deterministically'
);

select is(
  (
    select count(*)
    from public.list_catalog_products(
      p_category => 'not-a-category',
      p_limit => 51
    )
  ),
  0::bigint,
  'an unmatched catalog filter returns a stable empty result'
);

reset role;

select * from finish();

rollback;
