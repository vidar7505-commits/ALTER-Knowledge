# WP-006 P06 — RLS and RPC Foundation Handoff

## Status

`Configured but awaiting CI validation`.

The static implementation is complete. P06 is not marked Complete because the
new migrations and pgTAP suites have not yet passed the authoritative GitHub
`Database infrastructure validation` workflow.

Cloud migrations deployed: None.

## 1. Preflight

- Repository root:
  `C:\ALTER_REPOSITORY_COMPLETE_WP006_READY\ALTER`.
- `package.json`: present and readable.
- Initial Git working tree: clean.
- P05: `Complete`.
- All 21 required canonical inputs existed, were readable, and were read before
  modification.
- No existing P04 or P05 migration was edited.

## 2. Canonical inputs read

- `00_HQ/CONSTITUTION.md`
- `00_HQ/OPERATING_SYSTEM.md`
- `00_HQ/ROADMAP.md`
- `06_RELEASES/LR-001.md`
- `docs/product/LR-001_PRD.md`
- `docs/product/WP-002_HANDOFF.md`
- `docs/design/LR-001_UX_SPEC.md`
- `docs/design/LR-001_SCREEN_INVENTORY.md`
- `docs/design/WP-003_HANDOFF.md`
- `docs/data/EVENT_SPECIFICATION.md`
- `docs/data/DATABASE_SCHEMA.md`
- `docs/data/ANALYTICS_SPEC.md`
- `docs/data/DATA_QUALITY.md`
- `docs/data/WP-004_HANDOFF.md`
- `docs/engineering/SUPABASE_IMPLEMENTATION.md`
- `docs/engineering/TESTING_STRATEGY.md`
- `docs/engineering/WP-006_IMPLEMENTATION_PLAN.md`
- `docs/engineering/IMPLEMENTATION_STATUS.md`
- `docs/engineering/implementation/P04_CORE_MIGRATIONS_HANDOFF.md`
- `docs/engineering/implementation/P05_ANONYMOUS_IDENTITY_HANDOFF.md`

## 3. Authorization architecture

Supabase Auth is the authentication authority. Each RPC calls a private identity
resolver that:

1. reads `auth.uid()`;
2. verifies the Auth row is anonymous;
3. resolves exactly one `public.anonymous_users.id`;
4. rejects missing or unprovisioned identity state.

Client-readable private state is protected twice:

- the authenticated role receives SELECT only, never direct DML;
- each SELECT policy resolves ownership through the immutable
  `anonymous_users.auth_user_id = auth.uid()` mapping.

Security-definer RPCs intentionally bypass table RLS only after resolving and
checking that ownership. No RPC accepts `anonymous_user_id`, `user_id`, or
`wardrobe_id`.

## 4. Migration files created

1. `supabase/migrations/20260723000600_rls_and_client_grants.sql`
   - enables RLS on all 15 public domain tables;
   - creates 13 authenticated SELECT policies;
   - revokes all table access from client roles;
   - restores only the required authenticated SELECT grants;
   - revokes direct execution of P04 trigger helpers.
2. `supabase/migrations/20260723000700_transactional_mutation_rpcs.sql`
   - creates the inaccessible `private` schema and operation ledger;
   - creates two private security helpers;
   - creates eight transactional mutation RPCs;
   - sets explicit owners, search paths, and execute grants.

## 5. RLS-enabled table inventory

| Table                      | Client visibility              | Mutation boundary                   |
| -------------------------- | ------------------------------ | ----------------------------------- |
| `anonymous_users`          | Own Auth-linked row            | `ensure_anonymous_identity()` only  |
| `users`                    | Own Auth profile row           | No P06 client mutation              |
| `onboarding_states`        | Own row                        | Onboarding RPCs only                |
| `sessions`                 | Own rows                       | Deferred controlled session RPC     |
| `products`                 | Active rows                    | Server/catalog pipeline only        |
| `wardrobes`                | Own row                        | Provisioning and approved RPCs only |
| `saved_products`           | Own active and historical rows | Save/remove RPCs only               |
| `challenges`               | Current active definition      | Server/catalog pipeline only        |
| `challenge_progress`       | Own rows                       | Challenge RPCs only                 |
| `challenge_progress_items` | Items under own progress       | Challenge RPCs only                 |
| `challenge_completions`    | Own snapshots                  | Completion RPC insert only          |
| `feed_instances`           | Own rows                       | Deferred feed/session RPC           |
| `feed_instance_products`   | Rows under own feed            | Deferred feed RPC                   |
| `events`                   | None                           | P07 trusted ingestion only          |
| `event_quarantine`         | None                           | Internal P07 processing only        |

## 6. Policy inventory

| Table                      | SELECT policy                         | INSERT | UPDATE | DELETE |
| -------------------------- | ------------------------------------- | ------ | ------ | ------ |
| `anonymous_users`          | `anonymous_users_select_own`          | None   | None   | None   |
| `users`                    | `users_select_own`                    | None   | None   | None   |
| `onboarding_states`        | `onboarding_states_select_own`        | None   | None   | None   |
| `sessions`                 | `sessions_select_own`                 | None   | None   | None   |
| `products`                 | `products_select_active`              | None   | None   | None   |
| `wardrobes`                | `wardrobes_select_own`                | None   | None   | None   |
| `saved_products`           | `saved_products_select_own`           | None   | None   | None   |
| `challenges`               | `challenges_select_active`            | None   | None   | None   |
| `challenge_progress`       | `challenge_progress_select_own`       | None   | None   | None   |
| `challenge_progress_items` | `challenge_progress_items_select_own` | None   | None   | None   |
| `challenge_completions`    | `challenge_completions_select_own`    | None   | None   | None   |
| `feed_instances`           | `feed_instances_select_own`           | None   | None   | None   |
| `feed_instance_products`   | `feed_instance_products_select_own`   | None   | None   | None   |
| `events`                   | None                                  | None   | None   | None   |
| `event_quarantine`         | None                                  | None   | None   | None   |

No policy uses caller-supplied ownership. Active catalog/Challenge policies also
enforce activation windows.

## 7. Grant and revoke inventory

- `anon`: no table privileges and no P06 RPC execution.
- `authenticated`: SELECT on the 13 client-readable tables listed above.
- `authenticated`: no INSERT, UPDATE, DELETE, or TRUNCATE on any public LR-001
  domain table.
- `authenticated`: EXECUTE on `ensure_anonymous_identity()` and the eight P06
  mutation RPCs only.
- `public` and `anon`: all P06 RPC execution revoked.
- `public`, `anon`, and `authenticated`: P04 trigger-helper execution revoked.
- `public`, `anon`, and `authenticated`: no access to the `private` schema or
  either private helper.
- `events` and `event_quarantine`: no client grant.

## 8. RPC inventory

| RPC                                          | Caller input                    | Canonical behavior                                                                                  |
| -------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `complete_onboarding(uuid,text,text,text[])` | Operation/version/preferences   | Normalizes preferences, validates terminal transition, persists canonical completion                |
| `skip_onboarding(uuid,text)`                 | Operation/version               | Persists canonical skip through the allowed state path                                              |
| `save_product(uuid,uuid,text)`               | Product/operation/source        | Resolves own Wardrobe, validates active product, converges on one active save                       |
| `remove_product(uuid,uuid)`                  | Saved-row/operation             | Verifies ownership, soft removes save and incomplete Challenge dependencies atomically              |
| `start_challenge(uuid,uuid)`                 | Challenge/operation             | Validates active definition and creates or recovers one progress row                                |
| `select_challenge_item(uuid,text,uuid,uuid)` | Progress/slot/product/operation | Locks owned progress; validates status, slot, active product, eligibility, and active Wardrobe save |
| `remove_challenge_item(uuid,uuid)`           | Selection/operation             | Locks and soft removes only an active owned selection                                               |
| `complete_challenge(uuid,uuid)`              | Progress/operation              | Validates exact active slots and saves, snapshots products/definition, creates one completion       |

All RPCs return only `{ok, operation_id, state_revision?, data}`. No generic CRUD
function was introduced.

## 9. Function security review

Every client RPC:

- is owned explicitly by `postgres`;
- uses `security definer`;
- uses `set search_path = ''`;
- schema-qualifies every table, type, and helper reference;
- contains no dynamic SQL;
- has one non-overloaded signature.

- rejects unauthenticated/permanent Auth context through the private resolver;
- derives analytical ownership internally;
- has PUBLIC and `anon` execution revoked;
- is granted only to `authenticated`.

Both private helpers are explicitly `security invoker`, owned by `postgres`,
and use `set search_path = ''`. They inherit the already-established
security-definer execution context of an approved RPC without creating
additional independent privilege-escalation boundaries.

Private helpers and the operation ledger are under a schema for which client
roles have no USAGE. The browser does not require service-role credentials.

## 10. Ownership derivation model

The only accepted ownership chain is:

`request JWT → auth.uid() → anonymous_users.auth_user_id → anonymous_users.id`

Wardrobe, saved-product, onboarding, Challenge, session, and feed ownership is
resolved from that canonical analytical ID. Target row IDs remain domain
identifiers, not proof of ownership; each RPC verifies that the resolved owner
owns the target before mutation.

## 11. Idempotency and concurrency model

`private.mutation_operations` owns operation IDs globally. Each record stores:

- operation ID;
- canonical anonymous owner;
- operation type;
- normalized JSON request fingerprint;
- exact canonical JSON result;
- creation and completion timestamps.

The primary-key insert is the concurrency claim. A repeated identical request
waits for/reuses the existing operation and returns its stored result. Reuse by
another owner, operation type, or request fingerprint fails with SQLSTATE
`22023` and `operation_id conflict`. Failed domain operations roll back their
ledger claim with the surrounding PostgreSQL transaction.

Domain uniqueness and progress-row locks add convergence:

- one active save per identity/product;
- one progress row per identity/Challenge;
- one active product per slot and one active slot per product;
- one completion per progress;
- progress mutation locks serialize slot/status changes.

pgTAP covers replay plus different-operation convergence paths. True
simultaneous client connections are not orchestrated inside pgTAP; PostgreSQL
unique constraints, `ON CONFLICT`, and `FOR UPDATE` are the runtime concurrency
mechanisms that CI must validate.

## 12. Immutable-record protections

- `challenge_completions` has no direct client INSERT, UPDATE, or DELETE grant.
- RLS exposes only the caller's completion rows.
- completion is inserted only after exact slot, active-product, eligibility,
  active-save, status, and Challenge-version validation.
- product and Challenge details are copied into non-empty JSON snapshots.
- one completion per progress and one global completion operation ID remain
  enforced by P04 constraints.
- later Wardrobe removal never rewrites a completion snapshot.
- saved-product and Challenge selection removal remains soft-delete history.

Account deletion/retention by trusted infrastructure remains possible; P06 does
not add an unconditional trigger that would block reviewed retention cascades.

## 13. Two-user isolation model

The SQL tests create two anonymous `auth.users`, analytical identities,
Wardrobes, sessions, saves, Challenge state, completions, and feed state. They
switch JWT claims between user A, user B, and unauthenticated context.

Behavioral assertions prove:

- each user sees only their identity and owned state;
- child policies do not leak through progress/feed relationships;
- user B cannot remove user A save or mutate user A Challenge;
- inactive catalog and Challenge definitions remain hidden;
- event and quarantine access fails;
- role and JWT context is reset between fixture phases.

## 14. SQL test inventory

### `supabase/tests/005_rls_authorization.sql`

34 assertions cover:

- RLS activation on all 15 tables;
- complete grant/DML boundaries;
- anonymous denial;
- active catalog and Challenge reads;
- two-user SELECT isolation across every client-visible state family;
- direct mutation denial;
- completion UPDATE/DELETE denial;
- event and quarantine denial.

### `supabase/tests/006_transactional_rpcs.sql`

54 assertions cover:

- function owner/search-path/security-definer review;
- execute grants and private-schema denial;
- absence of owner parameters and dynamic SQL;
- unauthenticated mutation denial;
- onboarding complete/skip, replay, conflict, and invalid transition;
- save/remove success, replay, inactive-product denial, and active-save
  convergence;
- Challenge start convergence;
- slot, product, active-save, and ownership validation;
- selection/removal replay and one-active-item convergence;
- Wardrobe dependency cleanup;
- incomplete-completion rejection;
- valid four-slot completion, replay, convergence, and immutable snapshots;
- cross-user save and Challenge mutation denial;
- atomic operation-ledger finalization.

Existing P04/P05 suites remain unchanged, producing six total pgTAP files.

## 15. Application changes

None. The current application has no onboarding, Wardrobe, Challenge, session,
feed, or telemetry service that performs direct writes. Typed consumers belong
to P10–P14 when those services are introduced. The existing browser identity
client continues to call only `ensure_anonymous_identity()` and requires no
service-role configuration.

## 16. Validation commands and exact outcomes

| Command                                               | Outcome                                                                                                                                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npx.cmd supabase --version`                          | Passed: `2.109.1`; the sandboxed run could not write the user-profile telemetry file, then the unchanged command passed with permission. |
| `npm.cmd run format:check`                            | Passed in final validation; all matched files use Prettier style.                                                                        |
| `npm.cmd run lint`                                    | Passed.                                                                                                                                  |
| `npm.cmd run typecheck`                               | Passed.                                                                                                                                  |
| `npm.cmd run test`                                    | Passed: 7 files, 43 tests.                                                                                                               |
| `npm.cmd run build`                                   | Passed; sandboxed build could not fetch existing Google Fonts, then the unchanged command passed with network permission.                |
| `npm.cmd run test:e2e -- --reporter=line --workers=1` | Passed: 1 Chromium test in 13.6 seconds; sandboxed run timed out while the test server remained active.                                  |
| `git diff --check`                                    | Passed in final validation; Git emitted an LF-to-CRLF working-copy warning for the status file only.                                     |
| `npx.cmd supabase db reset --local`                   | Blocked: Docker pipe `//./pipe/dockerDesktopLinuxEngine` was not found.                                                                  |
| `npx.cmd supabase db lint --local --fail-on warning`  | Blocked: `LegacyDbConnectError`; local PostgreSQL was unavailable.                                                                       |
| `npx.cmd supabase test db`                            | Blocked: `LegacyDbConnectError`; local PostgreSQL was unavailable.                                                                       |

No unsafe Docker workaround was attempted. No SQL test or CI gate was weakened.

## 17. Local runtime status

- Application unit/integration runtime: passed.
- Production application build: passed.
- Browser smoke runtime: passed.
- Supabase clean reset: not runnable on this workstation.
- PostgreSQL lint: not runnable on this workstation.
- pgTAP/RLS/RPC runtime: not runnable on this workstation.

## 18. GitHub CI status

Pending. No commit or push was made, so the changed migration/test set is not
present in a GitHub ref and no P06 database-validation run exists. The workflow
remains authoritative for:

1. clean application of all seven migrations;
2. strict database lint;
3. all six pgTAP suites;
4. the existing application gates.

P06 must remain `Configured but awaiting CI validation` until that workflow
passes.

## 19. Cloud deployment status

- Hosted development schema updated: No.
- Cloud migrations deployed: None.
- Remote reset: not run.
- Remote push: not run.
- Supabase project linking: not changed.

## 20. Security limitations

- Browser storage loss still loses the anonymous Auth credential, as documented
  in P05.
- P06 does not implement abuse controls for anonymous sign-up.
- Private helpers rely on intentional `postgres` ownership and the reviewed
  security-definer boundary; CI database lint/runtime review is still pending.
- pgTAP convergence tests do not open simultaneous connections.
- Catalog and Challenge content correctness remains dependent on P08 curation.
- Account deletion, retention, and service-role operations require separate
  trusted procedures and are not exposed here.

## 21. Deferred P07 telemetry work

P06 intentionally does not implement:

- `ensure_session`;
- trusted event ingestion;
- server-derived environment, test, namespace, session, or user context;
- contract validation and quarantine routing;
- offline telemetry replay;
- event reconciliation.

`events` and `event_quarantine` remain completely inaccessible to browser roles.

## 22. Known limitations

- Database syntax, lint, and behavior await CI because the local database cannot
  start.
- Feed-instance mutation is deferred until the canonical feed/session consumer
  is implemented.
- No generated Supabase TypeScript database types exist yet for these RPCs; no
  current application consumer requires them.
- P06 records state changes but does not emit success telemetry; trusted
  ingestion/event coupling belongs to P07.

## 23. Scope review

Implemented only RLS, grants, private operation handling, onboarding/Wardrobe/
Challenge mutation RPCs, SQL authorization tests, and required documentation.

Not implemented:

- onboarding, feed, Wardrobe, catalog, or Challenge UI;
- catalog import or seed content;
- telemetry ingestion or dashboards;
- production/hosted deployment;
- service-role browser code;
- certified analytics views.

No frozen Product, Design, Data, Engineering Foundation, Release, ADR, P04, or
P05 file was modified.

## 24. Exact changed-file list

Created:

- `supabase/migrations/20260723000600_rls_and_client_grants.sql`
- `supabase/migrations/20260723000700_transactional_mutation_rpcs.sql`
- `supabase/tests/005_rls_authorization.sql`
- `supabase/tests/006_transactional_rpcs.sql`
- `docs/engineering/implementation/P06_RLS_RPC_FOUNDATION_HANDOFF.md`

Modified:

- `docs/engineering/IMPLEMENTATION_STATUS.md`

## 25. Recommended next package

First obtain a passing GitHub `Database infrastructure validation` result for
P06 and change its status to Complete only after that evidence exists. Then
proceed to P07 — Telemetry. P07 must retain the current event/quarantine denial
and add trusted session/event ingestion without granting browser direct DML.

## 26. Suggested commit message

`feat(security): add RLS and transactional mutation RPCs`
