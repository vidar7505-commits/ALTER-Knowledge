# WP-006 P04 — Core Database Migrations Handoff

## Status

`Complete`.

The GitHub Actions `Database infrastructure validation` workflow passed. Its
clean database reset applied all four P04 migrations successfully, strict
database lint passed, and all three pgTAP suites passed. The local workstation
still cannot run the disposable Supabase stack because Docker Desktop's
Linux-engine pipe is absent; the successful CI workflow supplied the
authoritative runtime validation.

Cloud migrations deployed: None.

## Preflight

- Repository root: `C:\ALTER_REPOSITORY_COMPLETE_WP006_READY\ALTER`.
- `package.json`: present and readable.
- Initial Git working tree: clean.
- P03A: `Complete`.
- Corrected P03 input:
  `docs/engineering/implementation/P03_SUPABASE_LOCAL_SETUP_HANDOFF.md` exists and
  is readable.
- Every required canonical input existed, was readable, and was read before any
  modification.

## Canonical inputs read

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
- `docs/engineering/IMPLEMENTATION_STATUS.md`
- `docs/engineering/implementation/P03_SUPABASE_LOCAL_SETUP_HANDOFF.md`
- `docs/engineering/implementation/P03A_SUPABASE_CLOUD_CI_HANDOFF.md`

Relevant frozen engineering decisions in `SUPABASE_IMPLEMENTATION.md`,
`TESTING_STRATEGY.md`, and `WP-006_IMPLEMENTATION_PLAN.md` were also reviewed to
preserve package boundaries and migration ordering.

## Migration inventory

1. `supabase/migrations/20260723000100_extensions_types_and_helpers.sql`
   - `pgcrypto`, `analytics`, enums, and internal integrity helpers.
2. `supabase/migrations/20260723000200_identity_sessions_and_catalog.sql`
   - identity/profile, onboarding, sessions, catalog, and associated triggers.
3. `supabase/migrations/20260723000300_wardrobe_and_challenge.sql`
   - Wardrobe/save history, Challenge definitions/progress/items/completions, and
     active-state uniqueness.
4. `supabase/migrations/20260723000400_feed_telemetry_and_indexes.sql`
   - persisted feed ordering, raw events, quarantine, and required query/FK
     indexes.

Each file is timestamp-ordered, environment-independent, credential-free, and
transactional. The canonical Engineering Foundation requires forward-only
migrations; clean reset supplies deterministic reconstruction, while transaction
rollback prevents partial application. No destructive down migration was added.

## Schema object inventory

### Extension and schema

- Extension: `pgcrypto`
- Schema: `analytics`

### Enum types

- `public.onboarding_status`
- `public.challenge_status`
- `public.app_environment`

### Tables

- Identity/profile: `anonymous_users`, `users`, `onboarding_states`
- Sessions: `sessions`
- Catalog: `products`
- Wardrobe: `wardrobes`, `saved_products`
- Challenge: `challenges`, `challenge_progress`,
  `challenge_progress_items`, `challenge_completions`
- Feed: `feed_instances`, `feed_instance_products`
- Telemetry: `events`, `event_quarantine`

### Internal integrity functions

- `set_updated_at()`
- `prevent_anonymous_auth_user_id_change()`
- `enforce_onboarding_status_transition()`
- `enforce_challenge_status_transition()`

These helpers enforce schema correctness only. No application mutation RPC,
security-definer business function, or telemetry ingestion function was added.

## Canonical requirement mapping

| Objects                                         | Canonical requirements                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `anonymous_users`, `users`, `onboarding_states` | Data schema §4; PRD ONB-001–008 and RET-001–008; immutable Auth mapping correction                                |
| `sessions`                                      | Data schema §5; Event Specification §5; 30-minute/return analysis foundation                                      |
| `products`                                      | Data schema §7; PRD FEE-001–012 and PDP-001–009; verified optional price/catalog fields                           |
| `wardrobes`, `saved_products`                   | Data schema §8; PRD WAR-001–010; idempotent active save and removal history                                       |
| Challenge tables                                | Data schema §9; PRD CHL-001–015; versioned definition, unique active slot/product, immutable completion snapshots |
| Feed tables                                     | Data schema §10; PRD FEE-001–012; deterministic session/feed/product positions                                    |
| Event tables                                    | Data schema §6; Event Specification §§3–13; append-only storage and invalid-payload quarantine foundation         |
| Indexes                                         | Data schema §12; canonical feed, state, product, Challenge, session, and analytics query paths plus FK access     |

The optional continuation table was not created because the approved Design
baseline keeps dismissal session-local. No product entity outside the canonical
schema was introduced.

## Constraint and invariant inventory

- Every table has an explicitly named UUID or composite primary key.
- Every owner/domain reference has an explicitly named foreign key.
- Composite foreign keys enforce:
  - event identity equals session identity;
  - feed identity equals session identity;
  - saved-product identity equals Wardrobe identity;
  - completion identity and Challenge equal its progress record.
- Canonical idempotency keys are unique for onboarding completion/skip, saves,
  removals, Challenge start/selection/removal/completion, and event IDs.
- Active saves are unique by identity/product.
- Exactly one Challenge definition may be active.
- Active Challenge slots and products are unique within progress.
- Feed positions and products are unique within one feed instance.
- Onboarding terminal states require the correct version, operation, timestamp,
  and preference shape.
- Onboarding and Challenge terminal states cannot transition backward.
- Session numbers/timestamps, return classification, revisions, price pairs,
  ISO-style uppercase currency, removal timestamps, active windows, JSON shapes,
  feed depths, event envelopes, and quarantine rows have named checks.
- Mutable canonical rows receive server-generated `updated_at` values.
- `anonymous_users.auth_user_id` is immutable.

Exact constraint names are asserted through
`001_core_schema_structure.sql`; invalid behavior is exercised through
`002_core_schema_behavior.sql`.

## Index inventory and rationale

Canonical active-state integrity:

- `saved_products_active_unique`
- `one_active_challenge`
- `challenge_active_slot_unique`
- `challenge_active_product_unique`

Identity/session/return paths:

- `users_primary_anonymous_user_idx`
- `anonymous_users_merged_user_idx`
- `onboarding_states_user_idx`
- `sessions_identity_started_idx`
- `sessions_user_idx`
- `sessions_return_idx`

Catalog/Wardrobe paths:

- `products_active_category_idx`
- `saved_products_wardrobe_saved_idx`
- `saved_products_anonymous_user_idx`
- `saved_products_user_idx`
- `saved_products_product_idx`

Challenge paths:

- `challenge_progress_identity_idx`
- `challenge_progress_user_idx`
- `challenge_progress_challenge_idx`
- `challenge_progress_items_progress_idx`
- `challenge_progress_items_product_idx`
- `challenge_completions_anonymous_user_idx`
- `challenge_completions_user_idx`
- `challenge_completions_challenge_idx`

Feed paths:

- `feed_instances_session_idx`
- `feed_instances_anonymous_user_idx`
- `feed_instance_products_product_idx`

Event and analytics paths:

- `events_identity_time_idx`
- `events_user_idx`
- `events_session_time_idx`
- `events_name_time_idx`
- `events_product_idx`
- `events_challenge_idx`
- `events_properties_gin_idx`

No speculative search, recommendation, commerce, or dashboard indexes were added.
FK-side indexes are explicit so referential actions and canonical joins do not
depend on accidental plans.

## SQL test inventory

### `supabase/tests/001_core_schema_structure.sql`

- verifies the extension, schema, enums, and all 15 tables;
- verifies every canonical column and PostgreSQL data type;
- verifies primary keys and named foreign, unique, and check constraints;
- verifies core domain tables begin empty, proving no silent seed dependency.

### `supabase/tests/002_core_schema_behavior.sql`

- inserts valid Auth-linked identities, onboarding state, sessions, products,
  Wardrobe history, Challenge state/snapshots, feed rows, and events;
- rejects Auth identity reassignment;
- rejects invalid onboarding and Challenge transitions;
- rejects malformed preference completion, return-session, price/currency,
  removal, Challenge-slot, feed-depth, event ownership/release, and quarantine
  states;
- proves active-save idempotency, re-save history, unique active Challenge
  slot/product selection, and valid completion snapshots.

### `supabase/tests/003_core_schema_indexes.sql`

- verifies all 33 explicit indexes;
- verifies the four canonical partial indexes are unique and have the intended
  predicates;
- verifies event properties use GIN.

All SQL tests run inside transactions and roll back their fixtures. No seed data,
credential, hosted reference, or static production identity was added.

## Validation commands and outcomes

| Command                                              | Outcome                                                                                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx.cmd supabase --version`                         | Passed: `2.109.1`. The sandboxed attempt could not update the user-profile telemetry file; the unchanged command passed with permission.                  |
| `npm.cmd run lint`                                   | Passed.                                                                                                                                                   |
| `npm.cmd run typecheck`                              | Passed.                                                                                                                                                   |
| `npm.cmd run test`                                   | Passed: 4 files, 25 tests.                                                                                                                                |
| `npm.cmd run build`                                  | Passed. The sandboxed attempt could not fetch the existing Instrument Serif and Inter Google Fonts; the unchanged command passed with network permission. |
| `npx.cmd supabase db reset --local`                  | Blocked: Docker Desktop Linux-engine pipe `//./pipe/dockerDesktopLinuxEngine` was not found.                                                              |
| `npx.cmd supabase db lint --local --fail-on warning` | Blocked: `LegacyDbConnectError`; local PostgreSQL was unavailable.                                                                                        |
| `npx.cmd supabase test db`                           | Blocked: `LegacyDbConnectError`; local PostgreSQL was unavailable.                                                                                        |
| GitHub Actions `Database infrastructure validation`  | Passed: clean reset applied all four P04 migrations; strict database lint and all three pgTAP suites passed.                                              |
| `npm.cmd run format:check`                           | Passed after Prettier was applied only to this new handoff; the first check identified this file's Markdown formatting.                                   |
| `git diff --check`                                   | Passed; Git emitted LF-to-CRLF working-copy warnings for the two updated engineering documents.                                                           |

No unsafe workaround was attempted. Tests were not weakened, and the database CI
gate was not changed.

## Runtime and deployment status

- GitHub Actions validation with P04: passed.
- Clean database reset in CI: passed.
- P04 migration application in CI: passed; all four migrations applied
  successfully.
- Strict database lint in CI: passed.
- pgTAP in CI: passed; all three suites passed.
- Workstation-local reset, lint, and pgTAP remain unavailable because Docker is
  absent; CI supplied the authoritative runtime validation.
- Hosted development schema updated: No.
- Cloud migrations deployed: None.
- Remote reset: not run.
- Remote seed push: not run.

## Security boundaries

- No credential, project reference, access token, password, connection string, or
  service-role value appears in migrations, tests, or documentation.
- No remote Supabase command was run.
- No client grant, permissive policy, or incomplete RLS policy was added.
- Public domain tables require the reviewed P06 RLS/grant layer before any client
  access. P04 does not claim cross-user isolation or authorization completeness.
- Event/quarantine storage is only the relational foundation; P07 must implement
  trusted server context and controlled ingestion.
- Application-role UPDATE/DELETE denial for events/completions remains part of
  P06 grants/policies so account-retention cascades are not accidentally blocked
  by an unconditional P04 trigger.

## Known limitations and deferred work

- Auth-user bootstrap/profile/Wardrobe creation and recovery belong to P05.
- RLS, two-user isolation, grants, application-role immutability, and mutation
  RPCs belong to P06.
- Event contract validation, trusted field derivation, future-skew routing,
  ingestion idempotency, and reconciliation belong to P07/P17.
- Slot eligibility and exact completion-rule validation belong in the P06
  transactional mutation boundary; P04 enforces structural uniqueness.
- Catalog host validation and deterministic onboarding/Challenge/product fixtures
  belong to P08. The existing empty seed file remains unchanged.
- Certified analytics views remain deferred.

## Recommended next package

P05 — Anonymous Identity is now unblocked. Proceed to P05 in dependency order.
P06 RLS/RPC Foundation remains deferred, including RLS, grants, cross-user
isolation, application-role immutability, and mutation RPCs. Do not deploy these
migrations to hosted development without a separately reviewed action.

## Exact changed-file list

- `supabase/migrations/20260723000100_extensions_types_and_helpers.sql`
- `supabase/migrations/20260723000200_identity_sessions_and_catalog.sql`
- `supabase/migrations/20260723000300_wardrobe_and_challenge.sql`
- `supabase/migrations/20260723000400_feed_telemetry_and_indexes.sql`
- `supabase/tests/001_core_schema_structure.sql`
- `supabase/tests/002_core_schema_behavior.sql`
- `supabase/tests/003_core_schema_indexes.sql`
- `docs/engineering/IMPLEMENTATION_STATUS.md`
- `docs/engineering/implementation/P04_CORE_MIGRATIONS_HANDOFF.md`

No application code, Supabase configuration, seed, workflow, script, package,
canonical Product/Design/Data/Foundation/Release document, or ADR was modified.
