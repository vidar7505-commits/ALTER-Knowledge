# WP-006 P08 — Product Catalog Handoff

## Status

`Complete`.

The LR-001 Product Catalog foundation is implemented and validated. GitHub
Actions `Database infrastructure validation` passed: a clean reset applied all
P08 migrations and deterministic catalog data, strict database lint passed, and
all eight pgTAP suites passed. Application formatting, ESLint, TypeScript,
unit/integration tests, production build, and Playwright also passed.

Cloud migrations deployed: None.

## 1. Preflight result

- Repository root:
  `C:\ALTER_REPOSITORY_COMPLETE_WP006_READY\ALTER`.
- `package.json`: present and readable.
- Initial Git working tree: clean.
- P07: explicitly `Complete`.
- P08 plan entry: `Product catalog`.
- P08 objective: curated seed/import and read query.
- Every required canonical input existed and was readable.
- No nested `AGENTS.md` instruction file exists in the repository.
- No P04, P05, P06, or P07 migration was edited.

## 2. Canonical files read

- `00_HQ/CONSTITUTION.md`
- `00_HQ/OPERATING_SYSTEM.md`
- `00_HQ/ROADMAP.md`
- `06_RELEASES/LR-001.md`
- `docs/product/LR-001_PRD.md`
- `docs/product/WP-002_HANDOFF.md`
- `docs/design/DESIGN_SYSTEM.md`
- `docs/design/LR-001_UX_SPEC.md`
- `docs/design/LR-001_SCREEN_INVENTORY.md`
- `docs/design/WP-003_HANDOFF.md`
- `docs/data/EVENT_SPECIFICATION.md`
- `docs/data/DATABASE_SCHEMA.md`
- `docs/data/ANALYTICS_SPEC.md`
- `docs/data/DASHBOARD_SPEC.md`
- `docs/data/DATA_QUALITY.md`
- `docs/data/WP-004_HANDOFF.md`
- `docs/engineering/SUPABASE_IMPLEMENTATION.md`
- `docs/engineering/TESTING_STRATEGY.md`
- `docs/engineering/WP-006_IMPLEMENTATION_PLAN.md`
- `docs/engineering/IMPLEMENTATION_STATUS.md`
- `docs/engineering/implementation/P04_CORE_MIGRATIONS_HANDOFF.md`
- `docs/engineering/implementation/P05_ANONYMOUS_IDENTITY_HANDOFF.md`
- `docs/engineering/implementation/P06_RLS_RPC_FOUNDATION_HANDOFF.md`
- `docs/engineering/implementation/P07_TELEMETRY_FOUNDATION_HANDOFF.md`

## 3. Confirmed package name and scope

`WP-006 / P08 — Product catalog`

The frozen implementation-plan objective is `curated seed/import and read
query`, with inactive/filter/image tests. This package supplies only the
deterministic catalog, required onboarding and Challenge definitions, narrow
read boundary, validation, tests, and handoff.

## 4. Catalog architecture

```text
repository-owned migration
  -> private.import_lr001_catalog()
  -> products + onboarding_preferences + challenges
  -> active-row RLS
  -> authenticated security-invoker read RPCs
  -> SupabaseCatalogDataSource
  -> CatalogService
  -> typed pages, detail result, filters, and cursor
```

The migration owns a small immutable LR-001 fixture set and runs the private
import during clean reset. The retained import function allows idempotency to be
tested without browser or hosted credentials. Application code depends on a
three-method read-only data-source interface; UI components do not query
Supabase.

## 5. Files created

- `supabase/migrations/20260724000200_product_catalog_foundation.sql`
- `supabase/tests/008_product_catalog.sql`
- `src/features/catalog/types.ts`
- `src/features/catalog/service.ts`
- `src/features/catalog/supabase.ts`
- `src/features/catalog/test-double.ts`
- `src/features/catalog/test-fixtures.ts`
- `src/features/catalog/types.test.ts`
- `src/features/catalog/service.test.ts`
- `src/features/catalog/supabase.test.ts`
- `docs/engineering/implementation/P08_PRODUCT_CATALOG_HANDOFF.md`

## 6. Files modified

- `src/lib/supabase/browser.ts`
- `docs/engineering/IMPLEMENTATION_STATUS.md`

No package, lockfile, UI, Supabase configuration, seed harness, workflow,
canonical Product/Design/Data/Foundation/Release document, ADR, or existing
migration was modified.

## 7. Dataset inventory

- Catalog version: `lr001-catalog-v1`.
- Repository source: `alter_repository`.
- Active products: 16.
- Inactive products: 1 archived validation fixture.
- Active category distribution:
  - Top: 4.
  - Bottom: 4.
  - Shoes: 4.
  - Layer: 2.
  - Accessory: 2.
- Curated brand labels: 7.
- Active products with prices: 16; all paired with `EUR`.
- Images: one per product, with two approved presentation ratios.
- No placeholder copy, malformed JSON, duplicate canonical ID, or duplicate
  external identity is present.

The active set is sufficient for multiple deterministic pages and for four
distinct products to complete every Challenge slot.

## 8. Taxonomy inventory

Canonical Design-derived identifiers:

- Style preferences: `minimal`, `relaxed`, `tailored`, `romantic`, `street`,
  `experimental`.
- Mood/use preferences: `everyday_ease`, `work_and_meetings`, `going_out`,
  `weekends_away`, `events_and_occasions`, `trying_something_new`.
- Challenge slots: `top`, `bottom`, `shoes`, `layer_or_accessory`.

Implementation-level catalog identifiers:

- Categories: `top`, `bottom`, `shoes`, `layer`, `accessory`.
- Subcategories: `shirt`, `knitwear`, `blouse`, `t-shirt`, `trousers`, `skirt`,
  `jeans`, `shorts`, `loafers`, `boots`, `sneakers`, `heels`, `blazer`,
  `jacket`, `bag`, `scarf`, and the inactive `trench`.

The canonical documents define the display labels and Challenge slot taxonomy
but do not define normalized category/subcategory, color, season, fit, or
material vocabularies. The identifiers above are minimum implementation
constraints for LR-001, not new frozen Product decisions.

## 9. Product-field inventory

Every active product contains:

- stable canonical UUID;
- stable repository external source and external ID;
- non-empty name, brand, category, subcategory, and description;
- catalog version;
- HTTPS image URL;
- image primary index, width, height, aspect ratio, and alt text;
- paired price amount and ISO-style currency;
- strict attributes object;
- explicit Challenge slot eligibility;
- active state.

The strict attributes object contains `style_tags`, `color`, `season`, `fit`,
`occasion_tags`, and `materials`. Style and occasion tags are restricted to the
approved onboarding identifiers.

## 10. Stable identity model

Canonical product UUIDs are checked-in constants. The active sequence begins at
`c0800000-0000-4000-8000-000000000001`; the inactive fixture ends at
`c0800000-0000-4000-8000-000000000017`.

Every product also has:

- `external_source = 'alter_repository'`;
- a stable `lr001-...` external ID;
- database uniqueness across `(external_source, external_id)`.

The import targets the named primary-key constraint. Conflicting reuse of an
external identity by a different UUID fails rather than silently changing
identity.

## 11. Import and idempotency behavior

`private.import_lr001_catalog()`:

- is `VOLATILE` because it writes;
- is `SECURITY INVOKER` with empty `search_path`;
- is inaccessible to browser roles;
- upserts preferences through
  `onboarding_preferences_pkey`;
- upserts products through `products_pkey`;
- upserts the Challenge through
  `challenges_challenge_key_version_key`;
- updates every canonical mutable field explicitly;
- changes a row only when canonical data differs;
- preserves stable IDs and unchanged timestamps;
- uses fixed fixture and activation timestamps;
- does not delete unrelated records;
- requires no wall-clock value for identity or ordering.

Reapplication is exercised inside pgTAP and must retain 17 product rows without
changing unchanged `updated_at` values.

## 12. Image strategy

The catalog stores URL and responsive metadata separately:

- allow-listed host: `images.unsplash.com`;
- protocol: HTTPS only;
- dimensions: either `1200 × 1500` or `900 × 1200`;
- aspect ratios: `4:5` and `3:4`;
- primary image index: `0`;
- product-specific accessible alt text.

No image binary was downloaded or added. Tests validate URL, host, dimensions,
ratio, and alt metadata structurally and never contact the remote host. The
host allow-list is an implementation-level LR-001 constraint because no frozen
canonical host list exists.

## 13. Challenge definition

- Stable ID: `c0810000-0000-4000-8000-000000000001`.
- Key: `after-dark`.
- Version: `challenge-evening-v1`.
- Title: `After Dark`.
- Context: `Build a look for an evening out.`
- Required slots: Top, Bottom, Shoes, Layer or Accessory.
- Completion: four required slots, unique products, and explicit confirmation.
- Activation: fixed `2026-07-24 00:00:00+00`, active with no end date.

The definition matches the frozen Design handoff and is compatible with the P06
Challenge mutation RPCs.

## 14. Slot-eligibility coverage

Machine-readable product eligibility uses only:

- `top`;
- `bottom`;
- `shoes`;
- `layer_or_accessory`.

Each required slot has four active eligible products. No active product has an
empty or unsupported eligibility array. The inactive trench remains eligible in
storage but cannot appear in active reads or satisfy P06 mutation validation.

## 15. Read-query API

Database RPCs:

- `list_catalog_products(text,text,text,uuid,integer)`;
- `get_catalog_product(uuid)`;
- `list_products_for_challenge_slot(uuid,text,uuid,integer)`.

Application API:

- `listProducts(filters, cursor, limit)`;
- `getProduct(productId)`;
- `listProductsForChallengeSlot(challengeId, slotId, cursor, limit)`.

The boundary supports active listing, detail, category, subcategory, direct slot
filtering, Challenge-definition-aware slot filtering, typed empty results, and a
typed not-found result. It exposes only fields required by approved product,
image, Challenge, and analytics behavior.

## 16. Ordering and pagination model

All database list queries use:

```text
WHERE product.id > after_id
ORDER BY product.id
LIMIT requested_count
```

Stable checked-in UUIDs provide deterministic keyset order independent of
insertion order. The application requests one extra row to derive
`nextCursor`, returns at most 50 products, and encodes the cursor as:

`catalog-v1:<canonical product UUID>`

The cursor is versioned and contains no identity, token, credential, or other
secret. Invalid cursor versions or UUIDs fail with typed `invalid_cursor`.
Adjacent-page tests prove no duplicates or skipped rows against unchanged data.

## 17. Grant and revoke boundary

- `authenticated`: active product and active Challenge reads remain available
  through existing RLS.
- `authenticated`: SELECT on active onboarding preferences.
- `authenticated`: EXECUTE on the three read RPCs.
- `anon`: no catalog or taxonomy SELECT grant and no read RPC execution.
- `authenticated`: no direct INSERT, UPDATE, DELETE, or TRUNCATE on products,
  challenges, or onboarding preferences.
- `public`, `anon`, `authenticated`: no import-function execution.

All read RPCs are postgres-owned, `STABLE`, `SECURITY INVOKER`, use an empty
`search_path`, qualify identifiers, and contain no dynamic SQL. The browser
requires only the existing public Supabase URL and anon key.

## 18. Application tests

Three new suites with 16 assertions cover:

- complete canonical product parsing;
- inactive, malformed, incomplete, unsupported-taxonomy, image-host, metadata,
  and price-pair rejection;
- active deterministic listing;
- category and subcategory filtering;
- canonical detail and typed not-found behavior;
- Challenge slot filtering;
- stable cursor encoding;
- invalid cursor and request rejection before database access;
- pagination without duplicates or skipped products;
- typed empty results;
- malformed/inactive response denial;
- read-only data-source operations;
- exact narrow Supabase RPC calls;
- database-error mapping without service-role configuration.

Focused result: 3 files and 16 tests passed. Full result: 14 files and 81 tests
passed.

## 19. SQL tests

`supabase/tests/008_product_catalog.sql` behaviorally covers:

- schema and function existence;
- catalog import application and reapplication;
- stable IDs and unchanged timestamps;
- external identity uniqueness;
- active/inactive inventory;
- required product-field quality;
- placeholder-copy exclusion;
- HTTPS host allow-list and image metadata;
- attributes and slot eligibility;
- Challenge identity, content, slots, and coverage;
- onboarding taxonomy version/count/selection limit;
- RLS and grant boundaries;
- import denial to browser roles;
- read-function volatility/security/search-path configuration;
- authenticated active reads;
- inactive table/detail exclusion;
- product detail and unknown-product behavior;
- category, subcategory, and slot filters;
- deterministic ordering;
- stable keyset pagination;
- invalid page-size failure;
- stable empty filter and Challenge-slot results.

Existing P04–P07 pgTAP suites are unchanged.

## 20. Validation commands and outcomes

| Command                                               | Outcome                                                                                                                                                                          |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx.cmd supabase --version`                          | Passed: `2.109.1`; the sandboxed call could not update the user-profile telemetry file, then the unchanged command passed with permission.                                       |
| Focused catalog TypeScript/ESLint                     | Passed.                                                                                                                                                                          |
| Focused catalog Vitest                                | Passed: 3 files, 16 tests.                                                                                                                                                       |
| `npm.cmd run lint`                                    | Passed.                                                                                                                                                                          |
| `npm.cmd run typecheck`                               | Passed.                                                                                                                                                                          |
| `npm.cmd run test`                                    | Passed: 14 files, 81 tests.                                                                                                                                                      |
| `npm.cmd run build`                                   | Passed; the sandboxed build could not fetch existing Google Fonts, then the unchanged command passed with network permission.                                                    |
| `npm.cmd run test:e2e -- --reporter=line --workers=1` | Passed: 1 Chromium test in 18.0 seconds; the sandboxed run timed out while its local server remained active, then the unchanged command passed with local browser/server access. |
| `npm.cmd run format:check`                            | Passed; all matched files use Prettier style.                                                                                                                                    |
| `git diff --check`                                    | Passed; Git emitted LF-to-CRLF working-copy warnings only.                                                                                                                       |
| GitHub Actions `Database infrastructure validation`   | Passed: clean reset, all P08 migrations and deterministic catalog import, strict database lint, and all eight pgTAP suites completed successfully.                               |
| `npx.cmd supabase db reset --local`                   | Blocked: Docker Desktop Linux-engine pipe `//./pipe/dockerDesktopLinuxEngine` was not found.                                                                                     |
| `npx.cmd supabase db lint --local --fail-on warning`  | Blocked: `LegacyDbConnectError`; local PostgreSQL was unavailable.                                                                                                               |
| `npx.cmd supabase test db`                            | Blocked: `LegacyDbConnectError`; local PostgreSQL was unavailable.                                                                                                               |

No unsafe Docker workaround was attempted. No test, SQL assertion, or CI gate
was weakened.

## 21. Local Supabase runtime status

- Clean reset: not runnable because Docker Desktop's Linux-engine pipe is
  absent.
- Strict database lint: not runnable because local PostgreSQL is unavailable.
- pgTAP/RLS/RPC runtime: not runnable because local PostgreSQL is unavailable.
- Application unit/integration, production build, and browser smoke runtime:
  passed.

## 22. GitHub CI status

GitHub Actions `Database infrastructure validation` completed successfully.

- Clean database reset: passed.
- All P08 migrations and deterministic catalog data: applied successfully.
- Strict database lint: passed.
- All eight pgTAP suites: passed.
- P08 catalog, Challenge definition, RLS read boundary, and pagination tests:
  passed.
- Application formatting, ESLint, TypeScript, unit/integration tests,
  production build, and Playwright: passed.

This evidence closes P08 as `Complete`.

## 23. Cloud deployment status

- Hosted development schema updated: No.
- Cloud migrations deployed: None.
- Remote reset: not run.
- Remote push: not run.
- Remote seed push: not run.
- Supabase project linking: not changed.

## 24. Security review

- Browser roles have no catalog, Challenge-definition, or onboarding-taxonomy
  write privilege.
- The import function is private and cannot be executed by browser roles.
- Read RPCs use invoker rights and remain constrained by active-row RLS.
- Inactive products are filtered both by RLS and explicit RPC predicates.
- No service-role key or configuration was added to browser code.
- The shared browser client uses only existing public configuration.
- No arbitrary filter-to-SQL translation or dynamic SQL exists.
- No user-controlled identifier is interpolated into SQL.
- Cursor payloads contain no secret or owner identity.
- Challenge definitions cannot be mutated by browser roles.
- Existing P07 telemetry trust, quarantine, idempotency, grants, and
  `SECURITY DEFINER` configuration are unchanged.

## 25. Known limitations and deferred work

- Workstation-local database runtime is unavailable; authoritative migration,
  strict lint, RLS, and pgTAP evidence came from the successful GitHub CI run.
- The canonical documents do not freeze normalized category/subcategory, color,
  season, fit, material, or image-host vocabularies. P08 records its minimum
  implementation constraints without elevating them to Product decisions.
- External image availability is not tested over the network; tests validate
  deterministic URLs and metadata without depending on a third-party API.
- Repository-owned production imagery and image optimization remain later
  release-hardening work.
- Personalized ranking, feed-instance persistence, impression handling, and
  scroll restoration remain P11.
- Product Detail, Wardrobe, and Challenge feature UI remain P12–P14.
- External suppliers, scraping, synchronization, price refresh, inventory,
  commerce, and checkout are not implemented.
- Analytics views, dashboards, and production ingestion remain deferred.

## 26. Recommended next package/actions

1. P08 is Complete based on the successful GitHub database and application
   validation evidence.
2. Proceed to `P09 — Application shell`: mobile bottom navigation, desktop
   rail, and application boundaries, validated for keyboard, responsive, and
   visual behavior.
3. Keep Discover ranking and feed behavior in P11.
4. Keep external catalog operations, analytics, dashboards, and hosted
   deployment deferred.

## 27. Exact changed-file list and suggested commit message

Created:

- `supabase/migrations/20260724000200_product_catalog_foundation.sql`
- `supabase/tests/008_product_catalog.sql`
- `src/features/catalog/types.ts`
- `src/features/catalog/service.ts`
- `src/features/catalog/supabase.ts`
- `src/features/catalog/test-double.ts`
- `src/features/catalog/test-fixtures.ts`
- `src/features/catalog/types.test.ts`
- `src/features/catalog/service.test.ts`
- `src/features/catalog/supabase.test.ts`
- `docs/engineering/implementation/P08_PRODUCT_CATALOG_HANDOFF.md`

Modified:

- `src/lib/supabase/browser.ts`
- `docs/engineering/IMPLEMENTATION_STATUS.md`

Suggested commit message:

`feat(catalog): add deterministic LR-001 product foundation`

No commit or push was performed.
