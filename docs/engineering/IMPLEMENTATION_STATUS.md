# WP-006 Implementation Status

## Current package

`P08 — Product Catalog`

## Status

`Configured but awaiting CI validation`.

The LR-001 Product Catalog foundation is implemented locally as one
forward-only migration, a private idempotent repository import, authenticated
RLS-safe read RPCs, a typed application query service, deterministic test
doubles, and behavior-first pgTAP and Vitest coverage.

The repository-controlled dataset contains 16 active products, one inactive
product, the 12-option `onboarding-style-v1` preference definition, and the
active `challenge-evening-v1` After Dark definition. Every Challenge slot has
four eligible active products. Stable UUIDs and external identities, fixed
fixture timestamps, explicit upsert constraints, stable UUID ordering, and
versioned keyset cursors make unchanged imports and reads deterministic.

Application formatting, ESLint, TypeScript, all 81 unit/integration tests,
production build, Playwright, and `git diff --check` pass. The new migration
and pgTAP suite require the authoritative GitHub
`Database infrastructure validation` workflow before P08 can be marked
Complete.

Cloud migrations deployed: None.

## Implemented scope

- Deterministic `lr001-catalog-v1` repository dataset with 16 active and one
  inactive product.
- Stable product UUIDs and unique `alter_repository` external identities.
- Categories, subcategories, seven curated brand labels, descriptive
  attributes, paired EUR prices, and explicit slot eligibility.
- One allow-listed HTTPS image per product with width, height, aspect ratio,
  primary index, and accessible alt metadata.
- Versioned 12-choice onboarding taxonomy matching the approved Design labels.
- Canonical `challenge-evening-v1` After Dark definition with Top, Bottom,
  Shoes, and Layer or Accessory slots.
- Private, browser-inaccessible catalog import with explicit primary-key
  upserts and unchanged-row timestamp preservation.
- Authenticated-only active catalog read RPCs for listing, product detail, and
  Challenge slot eligibility.
- Stable UUID keyset ordering with versioned, secrets-free application cursors.
- Typed list, detail, filter, empty, not-found, invalid-cursor, and malformed
  response behavior.
- Deterministic in-memory catalog data source and narrow Supabase RPC adapter.
- New behavior-first catalog pgTAP suite and 16 application assertions.

## Explicitly deferred

- Personalized Discover ranking, feed instances, impression behavior, and
  scroll restoration (`P11`).
- Product Detail, Wardrobe, and Challenge UI (`P12`–`P14`).
- External supplier synchronization, scraping, price refresh, inventory,
  checkout, and production catalog operations.
- Production asset pipeline and repository-owned image binaries.
- Durable offline/recovery behavior (`P16`).
- Certified analytics views, dashboards, and reconciliation jobs (`P17`).
- Production deployment or hosted-development migration application.

## Validation status

- Supabase CLI: `2.109.1`.
- Focused catalog TypeScript/ESLint checks: passed.
- Focused catalog tests: 3 files and 16 tests passed.
- Full ESLint and TypeScript: passed.
- Full unit/integration tests: 14 files and 81 tests passed.
- Production build: passed after the unchanged command received network access
  for the repository's existing Google Fonts.
- Playwright: 1 Chromium test passed in 18.0 seconds after the sandboxed run
  timed out while its local server remained active.
- Workstation-local reset: blocked because
  `//./pipe/dockerDesktopLinuxEngine` was not found.
- Workstation-local database lint and pgTAP: blocked with
  `LegacyDbConnectError`; local PostgreSQL was unavailable.
- GitHub database validation with P08: not run; awaiting CI.
- Hosted development schema updated: No.

## Next action

Run the unchanged GitHub `Database infrastructure validation` workflow. Mark P08
Complete only after clean reset applies the new catalog migration, strict lint
passes, and all eight pgTAP suites and application gates pass. Then proceed to
P09 — Application Shell. Discover ranking, external catalog ingestion,
analytics, dashboards, and hosted migration deployment remain deferred.
