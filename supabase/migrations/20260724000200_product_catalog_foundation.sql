begin;

create table public.onboarding_preferences (
  definition_version text not null,
  preference_id text not null,
  preference_group text not null,
  label text not null,
  description text,
  display_order integer not null,
  max_selections integer,
  asset_id text not null,
  is_active boolean not null default true,
  created_at timestamptz not null,
  constraint onboarding_preferences_pkey
    primary key (definition_version, preference_id),
  constraint onboarding_preferences_group_order_key
    unique (definition_version, preference_group, display_order),
  constraint onboarding_preferences_definition_version_check
    check (nullif(btrim(definition_version), '') is not null),
  constraint onboarding_preferences_preference_id_check
    check (
      preference_id ~ '^[a-z][a-z0-9_]*$'
    ),
  constraint onboarding_preferences_group_check
    check (preference_group in ('style', 'mood')),
  constraint onboarding_preferences_label_check
    check (nullif(btrim(label), '') is not null),
  constraint onboarding_preferences_display_order_check
    check (display_order > 0),
  constraint onboarding_preferences_max_selections_check
    check (max_selections is null or max_selections > 0),
  constraint onboarding_preferences_asset_id_check
    check (nullif(btrim(asset_id), '') is not null)
);

alter table public.onboarding_preferences enable row level security;

create policy onboarding_preferences_select_active
on public.onboarding_preferences
for select
to authenticated
using (is_active);

revoke all on table public.onboarding_preferences from public, anon, authenticated;
grant select on table public.onboarding_preferences to authenticated;

create function private.import_lr001_catalog()
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  insert into public.onboarding_preferences (
    definition_version,
    preference_id,
    preference_group,
    label,
    description,
    display_order,
    max_selections,
    asset_id,
    is_active,
    created_at
  )
  values
    (
      'onboarding-style-v1',
      'minimal',
      'style',
      'Minimal',
      'Clean lines, controlled palette.',
      1,
      4,
      'onboarding-style-v1:minimal',
      true,
      '2026-07-24 00:00:00+00'
    ),
    (
      'onboarding-style-v1',
      'relaxed',
      'style',
      'Relaxed',
      'Soft layers, easy proportions.',
      2,
      4,
      'onboarding-style-v1:relaxed',
      true,
      '2026-07-24 00:00:00+00'
    ),
    (
      'onboarding-style-v1',
      'tailored',
      'style',
      'Tailored',
      'Precise structure, polished shape.',
      3,
      4,
      'onboarding-style-v1:tailored',
      true,
      '2026-07-24 00:00:00+00'
    ),
    (
      'onboarding-style-v1',
      'romantic',
      'style',
      'Romantic',
      'Fluid form, delicate detail.',
      4,
      4,
      'onboarding-style-v1:romantic',
      true,
      '2026-07-24 00:00:00+00'
    ),
    (
      'onboarding-style-v1',
      'street',
      'style',
      'Street',
      'Graphic pieces, strong silhouettes.',
      5,
      4,
      'onboarding-style-v1:street',
      true,
      '2026-07-24 00:00:00+00'
    ),
    (
      'onboarding-style-v1',
      'experimental',
      'style',
      'Experimental',
      'Unexpected shape, contrast, texture.',
      6,
      4,
      'onboarding-style-v1:experimental',
      true,
      '2026-07-24 00:00:00+00'
    ),
    (
      'onboarding-style-v1',
      'everyday_ease',
      'mood',
      'Everyday ease',
      null,
      1,
      null,
      'onboarding-style-v1:everyday_ease',
      true,
      '2026-07-24 00:00:00+00'
    ),
    (
      'onboarding-style-v1',
      'work_and_meetings',
      'mood',
      'Work and meetings',
      null,
      2,
      null,
      'onboarding-style-v1:work_and_meetings',
      true,
      '2026-07-24 00:00:00+00'
    ),
    (
      'onboarding-style-v1',
      'going_out',
      'mood',
      'Going out',
      null,
      3,
      null,
      'onboarding-style-v1:going_out',
      true,
      '2026-07-24 00:00:00+00'
    ),
    (
      'onboarding-style-v1',
      'weekends_away',
      'mood',
      'Weekends away',
      null,
      4,
      null,
      'onboarding-style-v1:weekends_away',
      true,
      '2026-07-24 00:00:00+00'
    ),
    (
      'onboarding-style-v1',
      'events_and_occasions',
      'mood',
      'Events and occasions',
      null,
      5,
      null,
      'onboarding-style-v1:events_and_occasions',
      true,
      '2026-07-24 00:00:00+00'
    ),
    (
      'onboarding-style-v1',
      'trying_something_new',
      'mood',
      'Trying something new',
      null,
      6,
      null,
      'onboarding-style-v1:trying_something_new',
      true,
      '2026-07-24 00:00:00+00'
    )
  on conflict on constraint onboarding_preferences_pkey do update
  set
    preference_group = excluded.preference_group,
    label = excluded.label,
    description = excluded.description,
    display_order = excluded.display_order,
    max_selections = excluded.max_selections,
    asset_id = excluded.asset_id,
    is_active = excluded.is_active
  where (
    public.onboarding_preferences.preference_group,
    public.onboarding_preferences.label,
    public.onboarding_preferences.description,
    public.onboarding_preferences.display_order,
    public.onboarding_preferences.max_selections,
    public.onboarding_preferences.asset_id,
    public.onboarding_preferences.is_active
  ) is distinct from (
    excluded.preference_group,
    excluded.label,
    excluded.description,
    excluded.display_order,
    excluded.max_selections,
    excluded.asset_id,
    excluded.is_active
  );

  insert into public.products (
    id,
    external_source,
    external_id,
    name,
    brand,
    category,
    subcategory,
    description,
    image_urls,
    image_metadata,
    price_amount,
    price_currency,
    attributes,
    slot_eligibility,
    is_active,
    catalog_version,
    created_at,
    updated_at
  )
  values
    (
      'c0800000-0000-4000-8000-000000000001',
      'alter_repository',
      'lr001-top-01',
      'Ivory Draped Shirt',
      'Aster Studio',
      'top',
      'shirt',
      'A softly structured shirt with a clean concealed placket.',
      array[
        'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&h=1500&q=85'
      ],
      '{"primary_index":0,"images":[{"url":"https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&h=1500&q=85","width":1200,"height":1500,"aspect_ratio":0.8,"alt":"Aster Studio Ivory Draped Shirt, top."}]}'::jsonb,
      128.00,
      'EUR',
      '{"style_tags":["minimal","relaxed"],"color":"ivory","season":["all season"],"fit":"relaxed","occasion_tags":["work_and_meetings","going_out"],"materials":["cotton"]}'::jsonb,
      array['top'],
      true,
      'lr001-catalog-v1',
      '2026-07-24 00:00:00+00',
      '2026-07-24 00:00:00+00'
    ),
    (
      'c0800000-0000-4000-8000-000000000002',
      'alter_repository',
      'lr001-top-02',
      'Graphite Rib Knit',
      'Common Form',
      'top',
      'knitwear',
      'A close rib knit with a high neckline and extended cuffs.',
      array[
        'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=900&h=1200&q=85'
      ],
      '{"primary_index":0,"images":[{"url":"https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=900&h=1200&q=85","width":900,"height":1200,"aspect_ratio":0.75,"alt":"Common Form Graphite Rib Knit, top."}]}'::jsonb,
      96.00,
      'EUR',
      '{"style_tags":["minimal","tailored"],"color":"graphite","season":["autumn","winter"],"fit":"close","occasion_tags":["work_and_meetings","going_out"],"materials":["merino wool"]}'::jsonb,
      array['top'],
      true,
      'lr001-catalog-v1',
      '2026-07-24 00:00:00+00',
      '2026-07-24 00:00:00+00'
    ),
    (
      'c0800000-0000-4000-8000-000000000003',
      'alter_repository',
      'lr001-top-03',
      'Cobalt Sculpted Blouse',
      'Vela Studio',
      'top',
      'blouse',
      'A vivid blouse shaped with an asymmetric gathered shoulder.',
      array[
        'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&h=1500&q=85'
      ],
      '{"primary_index":0,"images":[{"url":"https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&h=1500&q=85","width":1200,"height":1500,"aspect_ratio":0.8,"alt":"Vela Studio Cobalt Sculpted Blouse, top."}]}'::jsonb,
      142.00,
      'EUR',
      '{"style_tags":["romantic","experimental"],"color":"cobalt","season":["spring","summer"],"fit":"shaped","occasion_tags":["going_out","events_and_occasions"],"materials":["viscose"]}'::jsonb,
      array['top'],
      true,
      'lr001-catalog-v1',
      '2026-07-24 00:00:00+00',
      '2026-07-24 00:00:00+00'
    ),
    (
      'c0800000-0000-4000-8000-000000000004',
      'alter_repository',
      'lr001-top-04',
      'Ink Graphic Tee',
      'Night Index',
      'top',
      't-shirt',
      'A heavyweight jersey tee with a restrained abstract print.',
      array[
        'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&h=1200&q=85'
      ],
      '{"primary_index":0,"images":[{"url":"https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&h=1200&q=85","width":900,"height":1200,"aspect_ratio":0.75,"alt":"Night Index Ink Graphic Tee, top."}]}'::jsonb,
      68.00,
      'EUR',
      '{"style_tags":["street","relaxed"],"color":"ink black","season":["all season"],"fit":"oversized","occasion_tags":["everyday_ease","weekends_away"],"materials":["cotton"]}'::jsonb,
      array['top'],
      true,
      'lr001-catalog-v1',
      '2026-07-24 00:00:00+00',
      '2026-07-24 00:00:00+00'
    ),
    (
      'c0800000-0000-4000-8000-000000000005',
      'alter_repository',
      'lr001-bottom-01',
      'Charcoal Wide-Leg Trouser',
      'Arc Atelier',
      'bottom',
      'trousers',
      'Fluid tailored trousers cut with a long wide leg.',
      array[
        'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&h=1500&q=85'
      ],
      '{"primary_index":0,"images":[{"url":"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&h=1500&q=85","width":1200,"height":1500,"aspect_ratio":0.8,"alt":"Arc Atelier Charcoal Wide-Leg Trouser, bottom."}]}'::jsonb,
      156.00,
      'EUR',
      '{"style_tags":["tailored","minimal"],"color":"charcoal","season":["all season"],"fit":"wide leg","occasion_tags":["work_and_meetings","going_out"],"materials":["wool blend"]}'::jsonb,
      array['bottom'],
      true,
      'lr001-catalog-v1',
      '2026-07-24 00:00:00+00',
      '2026-07-24 00:00:00+00'
    ),
    (
      'c0800000-0000-4000-8000-000000000006',
      'alter_repository',
      'lr001-bottom-02',
      'Midnight Bias Skirt',
      'Vela Studio',
      'bottom',
      'skirt',
      'A mid-length bias skirt with a liquid midnight finish.',
      array[
        'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=900&h=1200&q=85'
      ],
      '{"primary_index":0,"images":[{"url":"https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=900&h=1200&q=85","width":900,"height":1200,"aspect_ratio":0.75,"alt":"Vela Studio Midnight Bias Skirt, bottom."}]}'::jsonb,
      118.00,
      'EUR',
      '{"style_tags":["romantic","minimal"],"color":"midnight blue","season":["all season"],"fit":"fluid","occasion_tags":["going_out","events_and_occasions"],"materials":["viscose"]}'::jsonb,
      array['bottom'],
      true,
      'lr001-catalog-v1',
      '2026-07-24 00:00:00+00',
      '2026-07-24 00:00:00+00'
    ),
    (
      'c0800000-0000-4000-8000-000000000007',
      'alter_repository',
      'lr001-bottom-03',
      'Indigo Straight Jean',
      'Common Form',
      'bottom',
      'jeans',
      'Rigid indigo denim with a clean straight-leg profile.',
      array[
        'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=1200&h=1500&q=85'
      ],
      '{"primary_index":0,"images":[{"url":"https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=1200&h=1500&q=85","width":1200,"height":1500,"aspect_ratio":0.8,"alt":"Common Form Indigo Straight Jean, bottom."}]}'::jsonb,
      110.00,
      'EUR',
      '{"style_tags":["relaxed","street"],"color":"indigo","season":["all season"],"fit":"straight","occasion_tags":["everyday_ease","weekends_away"],"materials":["denim"]}'::jsonb,
      array['bottom'],
      true,
      'lr001-catalog-v1',
      '2026-07-24 00:00:00+00',
      '2026-07-24 00:00:00+00'
    ),
    (
      'c0800000-0000-4000-8000-000000000008',
      'alter_repository',
      'lr001-bottom-04',
      'Sand Pleated Short',
      'Aster Studio',
      'bottom',
      'shorts',
      'High-waisted shorts with deep front pleats and a soft drape.',
      array[
        'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&h=1200&q=85'
      ],
      '{"primary_index":0,"images":[{"url":"https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&h=1200&q=85","width":900,"height":1200,"aspect_ratio":0.75,"alt":"Aster Studio Sand Pleated Short, bottom."}]}'::jsonb,
      88.00,
      'EUR',
      '{"style_tags":["relaxed","tailored"],"color":"sand","season":["spring","summer"],"fit":"relaxed","occasion_tags":["everyday_ease","weekends_away"],"materials":["linen blend"]}'::jsonb,
      array['bottom'],
      true,
      'lr001-catalog-v1',
      '2026-07-24 00:00:00+00',
      '2026-07-24 00:00:00+00'
    ),
    (
      'c0800000-0000-4000-8000-000000000009',
      'alter_repository',
      'lr001-shoes-01',
      'Black Square-Toe Loafer',
      'Form Step',
      'shoes',
      'loafers',
      'A polished leather loafer with a low square toe.',
      array[
        'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1200&h=1500&q=85'
      ],
      '{"primary_index":0,"images":[{"url":"https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1200&h=1500&q=85","width":1200,"height":1500,"aspect_ratio":0.8,"alt":"Form Step Black Square-Toe Loafer, shoes."}]}'::jsonb,
      164.00,
      'EUR',
      '{"style_tags":["minimal","tailored"],"color":"black","season":["all season"],"fit":"regular","occasion_tags":["work_and_meetings","going_out"],"materials":["leather"]}'::jsonb,
      array['shoes'],
      true,
      'lr001-catalog-v1',
      '2026-07-24 00:00:00+00',
      '2026-07-24 00:00:00+00'
    ),
    (
      'c0800000-0000-4000-8000-000000000010',
      'alter_repository',
      'lr001-shoes-02',
      'Oxblood Ankle Boot',
      'Form Step',
      'shoes',
      'boots',
      'A slim ankle boot with an angled heel and oxblood finish.',
      array[
        'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&h=1200&q=85'
      ],
      '{"primary_index":0,"images":[{"url":"https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&h=1200&q=85","width":900,"height":1200,"aspect_ratio":0.75,"alt":"Form Step Oxblood Ankle Boot, shoes."}]}'::jsonb,
      196.00,
      'EUR',
      '{"style_tags":["romantic","tailored"],"color":"oxblood","season":["autumn","winter"],"fit":"regular","occasion_tags":["going_out","events_and_occasions"],"materials":["leather"]}'::jsonb,
      array['shoes'],
      true,
      'lr001-catalog-v1',
      '2026-07-24 00:00:00+00',
      '2026-07-24 00:00:00+00'
    ),
    (
      'c0800000-0000-4000-8000-000000000011',
      'alter_repository',
      'lr001-shoes-03',
      'Chalk Court Sneaker',
      'Field Unit',
      'shoes',
      'sneakers',
      'A low-profile court sneaker in tonal chalk canvas.',
      array[
        'https://images.unsplash.com/photo-1495555961986-6d4c1ecb7be3?auto=format&fit=crop&w=1200&h=1500&q=85'
      ],
      '{"primary_index":0,"images":[{"url":"https://images.unsplash.com/photo-1495555961986-6d4c1ecb7be3?auto=format&fit=crop&w=1200&h=1500&q=85","width":1200,"height":1500,"aspect_ratio":0.8,"alt":"Field Unit Chalk Court Sneaker, shoes."}]}'::jsonb,
      104.00,
      'EUR',
      '{"style_tags":["relaxed","street"],"color":"chalk","season":["all season"],"fit":"regular","occasion_tags":["everyday_ease","weekends_away"],"materials":["canvas","rubber"]}'::jsonb,
      array['shoes'],
      true,
      'lr001-catalog-v1',
      '2026-07-24 00:00:00+00',
      '2026-07-24 00:00:00+00'
    ),
    (
      'c0800000-0000-4000-8000-000000000012',
      'alter_repository',
      'lr001-shoes-04',
      'Silver Slingback Heel',
      'Vela Studio',
      'shoes',
      'heels',
      'A reflective slingback with a sculpted mid-height heel.',
      array[
        'https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?auto=format&fit=crop&w=900&h=1200&q=85'
      ],
      '{"primary_index":0,"images":[{"url":"https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?auto=format&fit=crop&w=900&h=1200&q=85","width":900,"height":1200,"aspect_ratio":0.75,"alt":"Vela Studio Silver Slingback Heel, shoes."}]}'::jsonb,
      178.00,
      'EUR',
      '{"style_tags":["experimental","romantic"],"color":"silver","season":["all season"],"fit":"regular","occasion_tags":["going_out","events_and_occasions","trying_something_new"],"materials":["metallic textile"]}'::jsonb,
      array['shoes'],
      true,
      'lr001-catalog-v1',
      '2026-07-24 00:00:00+00',
      '2026-07-24 00:00:00+00'
    ),
    (
      'c0800000-0000-4000-8000-000000000013',
      'alter_repository',
      'lr001-layer-01',
      'Onyx Cropped Blazer',
      'Arc Atelier',
      'layer',
      'blazer',
      'A compact single-button blazer with a sharp cropped line.',
      array[
        'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=1200&h=1500&q=85'
      ],
      '{"primary_index":0,"images":[{"url":"https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=1200&h=1500&q=85","width":1200,"height":1500,"aspect_ratio":0.8,"alt":"Arc Atelier Onyx Cropped Blazer, layer."}]}'::jsonb,
      214.00,
      'EUR',
      '{"style_tags":["tailored","minimal"],"color":"onyx","season":["all season"],"fit":"cropped","occasion_tags":["work_and_meetings","going_out"],"materials":["wool blend"]}'::jsonb,
      array['layer_or_accessory'],
      true,
      'lr001-catalog-v1',
      '2026-07-24 00:00:00+00',
      '2026-07-24 00:00:00+00'
    ),
    (
      'c0800000-0000-4000-8000-000000000014',
      'alter_repository',
      'lr001-layer-02',
      'Olive Utility Jacket',
      'Field Unit',
      'layer',
      'jacket',
      'A washed utility layer with generous pockets and an easy shape.',
      array[
        'https://images.unsplash.com/photo-1578681994506-b8f463449011?auto=format&fit=crop&w=900&h=1200&q=85'
      ],
      '{"primary_index":0,"images":[{"url":"https://images.unsplash.com/photo-1578681994506-b8f463449011?auto=format&fit=crop&w=900&h=1200&q=85","width":900,"height":1200,"aspect_ratio":0.75,"alt":"Field Unit Olive Utility Jacket, layer."}]}'::jsonb,
      172.00,
      'EUR',
      '{"style_tags":["relaxed","street"],"color":"olive","season":["spring","autumn"],"fit":"oversized","occasion_tags":["everyday_ease","weekends_away"],"materials":["cotton twill"]}'::jsonb,
      array['layer_or_accessory'],
      true,
      'lr001-catalog-v1',
      '2026-07-24 00:00:00+00',
      '2026-07-24 00:00:00+00'
    ),
    (
      'c0800000-0000-4000-8000-000000000015',
      'alter_repository',
      'lr001-accessory-01',
      'Plum Mini Shoulder Bag',
      'Night Index',
      'accessory',
      'bag',
      'A compact shoulder bag with a curved plum silhouette.',
      array[
        'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&h=1500&q=85'
      ],
      '{"primary_index":0,"images":[{"url":"https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&h=1500&q=85","width":1200,"height":1500,"aspect_ratio":0.8,"alt":"Night Index Plum Mini Shoulder Bag, accessory."}]}'::jsonb,
      132.00,
      'EUR',
      '{"style_tags":["romantic","experimental"],"color":"plum","season":["all season"],"fit":"compact","occasion_tags":["going_out","events_and_occasions"],"materials":["leather"]}'::jsonb,
      array['layer_or_accessory'],
      true,
      'lr001-catalog-v1',
      '2026-07-24 00:00:00+00',
      '2026-07-24 00:00:00+00'
    ),
    (
      'c0800000-0000-4000-8000-000000000016',
      'alter_repository',
      'lr001-accessory-02',
      'Cobalt Silk Scarf',
      'Aster Studio',
      'accessory',
      'scarf',
      'A square silk scarf with a cobalt geometric border.',
      array[
        'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=900&h=1200&q=85'
      ],
      '{"primary_index":0,"images":[{"url":"https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=900&h=1200&q=85","width":900,"height":1200,"aspect_ratio":0.75,"alt":"Aster Studio Cobalt Silk Scarf, accessory."}]}'::jsonb,
      74.00,
      'EUR',
      '{"style_tags":["experimental","romantic"],"color":"cobalt","season":["all season"],"fit":"adjustable","occasion_tags":["going_out","trying_something_new"],"materials":["silk"]}'::jsonb,
      array['layer_or_accessory'],
      true,
      'lr001-catalog-v1',
      '2026-07-24 00:00:00+00',
      '2026-07-24 00:00:00+00'
    ),
    (
      'c0800000-0000-4000-8000-000000000017',
      'alter_repository',
      'lr001-layer-archived-01',
      'Archive Cream Trench',
      'Common Form',
      'layer',
      'trench',
      'An archived long cotton trench retained for inactive-state validation.',
      array[
        'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&h=1500&q=85'
      ],
      '{"primary_index":0,"images":[{"url":"https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&h=1500&q=85","width":1200,"height":1500,"aspect_ratio":0.8,"alt":"Common Form Archive Cream Trench, layer."}]}'::jsonb,
      238.00,
      'EUR',
      '{"style_tags":["minimal","tailored"],"color":"cream","season":["spring","autumn"],"fit":"long","occasion_tags":["work_and_meetings","weekends_away"],"materials":["cotton"]}'::jsonb,
      array['layer_or_accessory'],
      false,
      'lr001-catalog-v1',
      '2026-07-24 00:00:00+00',
      '2026-07-24 00:00:00+00'
    )
  on conflict on constraint products_pkey do update
  set
    external_source = excluded.external_source,
    external_id = excluded.external_id,
    name = excluded.name,
    brand = excluded.brand,
    category = excluded.category,
    subcategory = excluded.subcategory,
    description = excluded.description,
    image_urls = excluded.image_urls,
    image_metadata = excluded.image_metadata,
    price_amount = excluded.price_amount,
    price_currency = excluded.price_currency,
    attributes = excluded.attributes,
    slot_eligibility = excluded.slot_eligibility,
    is_active = excluded.is_active,
    catalog_version = excluded.catalog_version,
    updated_at = excluded.updated_at
  where (
    public.products.external_source,
    public.products.external_id,
    public.products.name,
    public.products.brand,
    public.products.category,
    public.products.subcategory,
    public.products.description,
    public.products.image_urls,
    public.products.image_metadata,
    public.products.price_amount,
    public.products.price_currency,
    public.products.attributes,
    public.products.slot_eligibility,
    public.products.is_active,
    public.products.catalog_version
  ) is distinct from (
    excluded.external_source,
    excluded.external_id,
    excluded.name,
    excluded.brand,
    excluded.category,
    excluded.subcategory,
    excluded.description,
    excluded.image_urls,
    excluded.image_metadata,
    excluded.price_amount,
    excluded.price_currency,
    excluded.attributes,
    excluded.slot_eligibility,
    excluded.is_active,
    excluded.catalog_version
  );

  insert into public.challenges (
    id,
    challenge_key,
    version,
    title,
    context_copy,
    required_slots,
    completion_rules,
    active_from,
    active_until,
    is_active,
    created_at
  )
  values (
    'c0810000-0000-4000-8000-000000000001',
    'after-dark',
    'challenge-evening-v1',
    'After Dark',
    'Build a look for an evening out.',
    '[
      {"slot_id":"top","label":"Top","display_order":1},
      {"slot_id":"bottom","label":"Bottom","display_order":2},
      {"slot_id":"shoes","label":"Shoes","display_order":3},
      {
        "slot_id":"layer_or_accessory",
        "label":"Layer or Accessory",
        "display_order":4
      }
    ]'::jsonb,
    '{
      "required_slot_count":4,
      "unique_products":true,
      "explicit_confirmation":true
    }'::jsonb,
    '2026-07-24 00:00:00+00',
    null,
    true,
    '2026-07-24 00:00:00+00'
  )
  on conflict on constraint challenges_challenge_key_version_key do update
  set
    title = excluded.title,
    context_copy = excluded.context_copy,
    required_slots = excluded.required_slots,
    completion_rules = excluded.completion_rules,
    active_from = excluded.active_from,
    active_until = excluded.active_until,
    is_active = excluded.is_active
  where (
    public.challenges.title,
    public.challenges.context_copy,
    public.challenges.required_slots,
    public.challenges.completion_rules,
    public.challenges.active_from,
    public.challenges.active_until,
    public.challenges.is_active
  ) is distinct from (
    excluded.title,
    excluded.context_copy,
    excluded.required_slots,
    excluded.completion_rules,
    excluded.active_from,
    excluded.active_until,
    excluded.is_active
  );

  return jsonb_build_object(
    'catalog_version',
    'lr001-catalog-v1',
    'active_product_count',
    (
      select count(*)
      from public.products as catalog_product
      where catalog_product.catalog_version = 'lr001-catalog-v1'
        and catalog_product.is_active
    ),
    'onboarding_preference_count',
    (
      select count(*)
      from public.onboarding_preferences as preference
      where preference.definition_version = 'onboarding-style-v1'
        and preference.is_active
    ),
    'challenge_id',
    'c0810000-0000-4000-8000-000000000001'
  );
end;
$$;

create function public.list_catalog_products(
  p_category text default null,
  p_subcategory text default null,
  p_slot_id text default null,
  p_after_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  name text,
  brand text,
  category text,
  subcategory text,
  description text,
  image_urls text[],
  image_metadata jsonb,
  price_amount numeric,
  price_currency character(3),
  attributes jsonb,
  slot_eligibility text[],
  is_active boolean,
  catalog_version text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 51 then
    raise exception 'catalog page size must be between 1 and 51'
      using errcode = '22023';
  end if;

  if p_category is not null and nullif(btrim(p_category), '') is null then
    raise exception 'category cannot be empty'
      using errcode = '22023';
  end if;

  if p_subcategory is not null
    and nullif(btrim(p_subcategory), '') is null
  then
    raise exception 'subcategory cannot be empty'
      using errcode = '22023';
  end if;

  if p_slot_id is not null and nullif(btrim(p_slot_id), '') is null then
    raise exception 'slot_id cannot be empty'
      using errcode = '22023';
  end if;

  return query
  select
    catalog_product.id,
    catalog_product.name,
    catalog_product.brand,
    catalog_product.category,
    catalog_product.subcategory,
    catalog_product.description,
    catalog_product.image_urls,
    catalog_product.image_metadata,
    catalog_product.price_amount,
    catalog_product.price_currency,
    catalog_product.attributes,
    catalog_product.slot_eligibility,
    catalog_product.is_active,
    catalog_product.catalog_version
  from public.products as catalog_product
  where catalog_product.is_active
    and (p_category is null or catalog_product.category = p_category)
    and (
      p_subcategory is null
      or catalog_product.subcategory = p_subcategory
    )
    and (
      p_slot_id is null
      or p_slot_id = any(catalog_product.slot_eligibility)
    )
    and (p_after_id is null or catalog_product.id > p_after_id)
  order by catalog_product.id
  limit p_limit;
end;
$$;

create function public.get_catalog_product(p_product_id uuid)
returns table (
  id uuid,
  name text,
  brand text,
  category text,
  subcategory text,
  description text,
  image_urls text[],
  image_metadata jsonb,
  price_amount numeric,
  price_currency character(3),
  attributes jsonb,
  slot_eligibility text[],
  is_active boolean,
  catalog_version text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    catalog_product.id,
    catalog_product.name,
    catalog_product.brand,
    catalog_product.category,
    catalog_product.subcategory,
    catalog_product.description,
    catalog_product.image_urls,
    catalog_product.image_metadata,
    catalog_product.price_amount,
    catalog_product.price_currency,
    catalog_product.attributes,
    catalog_product.slot_eligibility,
    catalog_product.is_active,
    catalog_product.catalog_version
  from public.products as catalog_product
  where catalog_product.id = p_product_id
    and catalog_product.is_active
$$;

create function public.list_products_for_challenge_slot(
  p_challenge_id uuid,
  p_slot_id text,
  p_after_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  name text,
  brand text,
  category text,
  subcategory text,
  description text,
  image_urls text[],
  image_metadata jsonb,
  price_amount numeric,
  price_currency character(3),
  attributes jsonb,
  slot_eligibility text[],
  is_active boolean,
  catalog_version text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 51 then
    raise exception 'catalog page size must be between 1 and 51'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_slot_id), '') is null then
    raise exception 'slot_id is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.challenges as challenge
    cross join lateral jsonb_array_elements(
      challenge.required_slots
    ) as required_slot(value)
    where challenge.id = p_challenge_id
      and challenge.is_active
      and challenge.active_from <= now()
      and (
        challenge.active_until is null
        or challenge.active_until > now()
      )
      and required_slot.value ->> 'slot_id' = p_slot_id
  ) then
    return;
  end if;

  return query
  select
    catalog_product.id,
    catalog_product.name,
    catalog_product.brand,
    catalog_product.category,
    catalog_product.subcategory,
    catalog_product.description,
    catalog_product.image_urls,
    catalog_product.image_metadata,
    catalog_product.price_amount,
    catalog_product.price_currency,
    catalog_product.attributes,
    catalog_product.slot_eligibility,
    catalog_product.is_active,
    catalog_product.catalog_version
  from public.products as catalog_product
  where catalog_product.is_active
    and p_slot_id = any(catalog_product.slot_eligibility)
    and (p_after_id is null or catalog_product.id > p_after_id)
  order by catalog_product.id
  limit p_limit;
end;
$$;

alter function private.import_lr001_catalog() owner to postgres;
alter function public.list_catalog_products(text, text, text, uuid, integer)
owner to postgres;
alter function public.get_catalog_product(uuid) owner to postgres;
alter function public.list_products_for_challenge_slot(
  uuid,
  text,
  uuid,
  integer
) owner to postgres;

revoke all on function private.import_lr001_catalog()
from public, anon, authenticated;
revoke all on function public.list_catalog_products(
  text,
  text,
  text,
  uuid,
  integer
) from public, anon;
revoke all on function public.get_catalog_product(uuid)
from public, anon;
revoke all on function public.list_products_for_challenge_slot(
  uuid,
  text,
  uuid,
  integer
) from public, anon;

grant execute on function public.list_catalog_products(
  text,
  text,
  text,
  uuid,
  integer
) to authenticated;
grant execute on function public.get_catalog_product(uuid)
to authenticated;
grant execute on function public.list_products_for_challenge_slot(
  uuid,
  text,
  uuid,
  integer
) to authenticated;

select private.import_lr001_catalog();

commit;
