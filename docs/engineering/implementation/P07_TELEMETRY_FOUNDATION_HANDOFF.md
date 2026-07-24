# WP-006 P07 — Telemetry Foundation Handoff

## Status

`Complete`.

GitHub Actions `Database infrastructure validation` passed. Clean database
reset, P07 migration application, strict database lint, all pgTAP suites, and
all application gates passed.

Cloud migrations deployed: None.

## 1. Preflight result

- Repository root:
  `C:\ALTER_REPOSITORY_COMPLETE_WP006_READY\ALTER`.
- `package.json`: present and readable.
- Initial Git working tree: clean.
- P06: explicitly `Complete`.
- Every required canonical input existed and was readable.
- No P04, P05, or P06 migration was edited.
- No nested `AGENTS.md` instruction file exists in the repository.

## 2. Canonical files read

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
- `docs/data/ANALYTICS_SPEC.md`
- `docs/data/DATABASE_SCHEMA.md`
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

## 3. Telemetry architecture

```text
typed capture API
  -> bounded ordered memory queue
  -> authenticated POST /api/telemetry
  -> Supabase token verification
  -> server-only privileged adapter
  -> service-role-only ingest_telemetry_batch RPC
  -> session ensure/ownership check
  -> contract validation
  -> public.events or public.event_quarantine
```

The route is the trust boundary. It verifies the caller through Supabase Auth,
derives deployment context from server environment, and invokes a database
function that client roles cannot execute.

## 4. Files created

- `src/app/api/telemetry/route.ts`
- `src/features/telemetry/contracts.ts`
- `src/features/telemetry/contracts.test.ts`
- `src/features/telemetry/server.ts`
- `src/features/telemetry/server.test.ts`
- `src/features/telemetry/service.ts`
- `src/features/telemetry/service.test.ts`
- `src/features/telemetry/supabase-server.ts`
- `src/features/telemetry/test-double.ts`
- `src/features/telemetry/test-fixtures.ts`
- `src/features/telemetry/transport.ts`
- `src/features/telemetry/transport.test.ts`
- `src/features/telemetry/types.ts`
- `supabase/migrations/20260724000100_telemetry_ingestion_foundation.sql`
- `supabase/tests/007_telemetry_ingestion.sql`
- `docs/engineering/implementation/P07_TELEMETRY_FOUNDATION_HANDOFF.md`

## 5. Files modified

- `docs/engineering/IMPLEMENTATION_STATUS.md`

No package, lockfile, UI, frozen Product/Design/Data/Foundation/Release
document, ADR, existing migration, seed, workflow, or Supabase configuration was
modified.

## 6. Event registry

All canonical names are version `1`.

- Session/state/continuation: `session_started`, `app_state_restored`,
  `app_state_restore_failed`, `continuation_cue_viewed`,
  `continuation_action_selected`, `continuation_cue_dismissed`.
- Onboarding: `onboarding_viewed`, `onboarding_step_viewed`,
  `onboarding_preference_selected`, `onboarding_preference_removed`,
  `onboarding_completed`, `onboarding_skipped`,
  `onboarding_persistence_failed`.
- Discover/feed: `discover_viewed`, `feed_batch_requested`,
  `feed_batch_loaded`, `feed_batch_failed`, `product_impression`,
  `feed_depth_reached`, `feed_exhausted`.
- Product detail: `product_detail_opened`, `product_detail_closed`,
  `product_detail_failed`.
- Save/Wardrobe: `product_save_requested`, `product_saved`,
  `product_remove_requested`, `product_removed`, `product_save_failed`,
  `wardrobe_viewed`, `wardrobe_empty_viewed`.
- Challenge: `challenge_viewed`, `challenge_started`,
  `challenge_slot_opened`, `challenge_item_selected`,
  `challenge_item_removed`, `challenge_discovery_redirected`,
  `challenge_completion_attempted`, `challenge_completed`,
  `challenge_state_invalidated`, `challenge_operation_failed`.

Unknown names and any version other than `1` cannot enter `public.events`.

## 7. Event contract inventory

The TypeScript and SQL registries validate exact required property sets for all
40 events. Validation covers:

- UUID identifiers and nullable identifier fields;
- strict property allow-lists;
- string identifiers and route bounds;
- canonical enums for surfaces, source surfaces, platforms, error classes,
  network state, and Challenge state;
- nonnegative/positive integer and numeric bounds;
- batch/requested/returned counts no greater than 100;
- impression ratio `0.5–1` and duration at least `1,000 ms`;
- feed-depth thresholds `5, 10, 20, 30, 50, 75, 100`;
- preference-count/array agreement;
- Challenge filled/required-count agreement;
- explicit-completion validity agreement;
- existing product and Challenge references in SQL where supplied;
- web viewport requirements and bounded client context.

The application fixture suite supplies one conforming example for every
registry entry.

## 8. Trusted and untrusted field boundary

Client-allowed fields:

- `event_id`
- `event_name`
- `event_version`
- `occurred_at`
- `session_id`
- `platform`
- `surface`
- `source_surface`
- `client_sequence`
- `properties`
- allow-listed `context`

Server-owned and rejected when caller-supplied:

- `anonymous_user_id`
- `user_id`
- `received_at`
- `release_id`
- `app_version`
- `environment`
- `is_test`
- `preview_namespace`
- `validation_status`
- `validation_errors`
- `inserted_at`

The chosen policy is rejection plus safe quarantine, not silent overwrite.

## 9. Server ingestion implementation

`POST /api/telemetry`:

- accepts JSON only through a bounded request body;
- requires one Supabase bearer access token;
- verifies the token with `auth.getUser(accessToken)`;
- validates the session/batch request shape;
- derives deployment context from server-owned variables;
- invokes the database only through a `server-only` privileged adapter;
- returns HTTP `200` for deterministic mixed per-item outcomes;
- returns typed `400`, `401`, `413`, or `503` errors for request/boundary
  failures;
- never logs or forwards request headers into quarantine.

## 10. Database implementation

Migration:

- `20260724000100_telemetry_ingestion_foundation.sql`

Private helpers:

- `private.telemetry_is_uuid(text)`
- `private.telemetry_is_timestamptz(text)`
- `private.telemetry_contract(text)`
- `private.telemetry_value_matches(jsonb,text)`
- `private.telemetry_redact(jsonb)`
- `private.telemetry_safe_payload(jsonb)`
- `private.telemetry_validation_errors(jsonb,timestamptz)`

Trusted RPC:

- `public.ingest_telemetry_batch(uuid,jsonb,jsonb,app_environment,text,text)`

Every helper and RPC is postgres-owned, fixes an empty `search_path`,
schema-qualifies objects, and contains no dynamic SQL. The public RPC is
`SECURITY DEFINER`; private helpers are `SECURITY INVOKER`.

Grant/revoke inventory:

- `service_role`: EXECUTE on `ingest_telemetry_batch`.
- `PUBLIC`, `anon`, `authenticated`: no EXECUTE.
- Client roles retain no direct event/quarantine DML.
- Client roles retain no access to private telemetry helpers.

## 11. Identity and session validation

The server verifies the bearer token and supplies only the verified
`auth.users.id` over the privileged database channel. The RPC:

1. verifies that Auth row exists;
2. resolves exactly one `anonymous_users.auth_user_id` mapping;
3. resolves `users.id` where an upgraded profile exists;
4. locks the analytical identity while allocating a session number;
5. creates a missing session with server receipt time and canonical
   `session_number`;
6. derives `is_return_session` from prior canonical sessions;
7. rejects a session owned by another analytical identity;
8. rejects platform reuse conflicts;
9. derives session environment, app version, preview namespace, and test flag;
10. inserts events only with the resolved session/identity pair.

This package uses the assignment's explicitly permitted server-held
privileged-client architecture. Browser roles cannot call the trusted RPC.

## 12. Idempotency behavior

- The first valid `event_id` inserts one event.
- Equivalent replay returns `duplicate` and the original `received_at`.
- Conflicting canonical reuse returns `rejected` with `event_id_conflict`.
- Conflicts are quarantined and never overwrite the accepted event.
- `INSERT ... ON CONFLICT DO NOTHING` plus primary-key convergence handles
  parallel duplicate claims.
- The existing event is compared across identity, session, name/version,
  occurrence time, platform/environment, surfaces, sequence, properties, and
  context.

## 13. Batch semantics

- Maximum: 100 events, from the canonical Event Specification.
- Maximum event payload: 16 KB.
- Input order is preserved through `index`.
- Every item returns `accepted`, `duplicate`, `quarantined`, or `rejected`.
- One invalid item does not roll back independent accepted items.
- Authentication, invalid outer request shape, and oversized batch are
  request-level failures.
- Event retry retains `event_id`, `occurred_at`, and `client_sequence`.

## 14. Quarantine behavior

Invalid and security-rejected items route through the trusted function to
`public.event_quarantine`. Stored data includes only safe payload,
machine-readable codes, server receipt time, environment, and preview namespace.

Sensitive key names—including authorization, cookie, token, secret, password,
service-role, database-URL, and connection-string variants—are recursively
redacted. Oversized payloads store only safe event identity hints, byte count,
and a truncation marker. HTTP headers are never included.

## 15. Error-code inventory

Request/client:

- `unauthenticated`
- `invalid_request`
- `batch_too_large`
- `queue_full`
- `transport_unavailable`
- `response_contract_invalid`
- `database_unavailable`

Item validation:

- `event_not_object`
- `forbidden_trusted_field`
- `unexpected_envelope_field`
- `invalid_envelope`
- `unknown_event_name`
- `unsupported_event_version`
- `invalid_properties`
- `payload_too_large`
- `timestamp_future`
- `timestamp_future_skew`
- `timestamp_stale`

Session/idempotency:

- `session_not_found`
- `session_owner_mismatch`
- `session_context_conflict`
- `event_id_conflict`

## 16. Client telemetry API

`BufferedTelemetryService` exposes only:

- `capture(event)`
- `captureBatch(events)`
- `flush()`
- `dispose()`

It creates `event_id` before enqueue, adds immutable occurrence/session/platform
context, assigns monotonically increasing client sequence values, validates
before transport, caps memory at 100 events, shares an in-flight flush, keeps
transient failures buffered, and performs no unbounded automatic retry.

## 17. Application test inventory

Four telemetry suites cover:

- all 40 registry entries and conforming fixtures;
- valid, unknown, unsupported, missing, wrong-type, and extra-property events;
- forbidden trusted fields;
- surfaces, sequence, impression, timestamp, context, and payload bounds;
- server Auth verification and server-derived identity/environment/app version;
- equivalent replay and conflict rejection;
- mixed ordered batches and maximum size;
- cross-user session spoofing;
- bounded buffering and retry ID preservation;
- compile-time property mapping;
- browser transport credentials and absence of service-role data;
- typed transient error mapping.

Focused result before final validation: 4 files, 22 tests passed.

## 18. SQL test inventory

`supabase/tests/007_telemetry_ingestion.sql` behaviorally covers:

- direct authenticated event/quarantine insert denial;
- security-definer owner/search-path settings;
- service-role-only execution and authenticated bypass denial;
- unauthenticated rejection;
- valid insertion and server-derived identity/context;
- session creation/numbering;
- equivalent duplicate and conflicting replay;
- foreign-session rejection and two-user isolation;
- forbidden ownership fields;
- unknown name, unsupported version, missing property, and wrong type;
- invalid surface/source surface and sequence bounds;
- future-warning, future-rejection, and stale-event rules;
- ordered mixed batch results;
- test classification;
- secret-key redaction;
- database-enforced 100-event batch maximum;
- absence of dynamic SQL.

Existing P04–P06 SQL suites are unchanged.

## 19. Validation commands and outcomes

| Command                                               | Outcome                                                                                                                                                                          |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx.cmd supabase --version`                          | Passed: `2.109.1`. The sandboxed call could not update the user-profile telemetry file; the unchanged command passed with permission.                                            |
| `npm.cmd run format:check`                            | Passed; all matched files use Prettier style.                                                                                                                                    |
| `npm.cmd run lint`                                    | Passed.                                                                                                                                                                          |
| `npm.cmd run typecheck`                               | Passed.                                                                                                                                                                          |
| `npm.cmd run test`                                    | Passed: 11 files and 65 tests.                                                                                                                                                   |
| `npm.cmd run build`                                   | Passed. The sandboxed call could not fetch the repository's existing Instrument Serif and Inter Google Fonts; the unchanged command passed with network access.                  |
| `npm.cmd run test:e2e -- --reporter=line --workers=1` | Passed: 1 Chromium test in 11.1 seconds. The sandboxed attempt timed out after 180 seconds while its local server remained active; the unchanged command passed with permission. |
| `git diff --check`                                    | Passed; Git emitted only the existing LF-to-CRLF working-copy warning for the status file.                                                                                       |
| `npx.cmd supabase db reset --local`                   | Blocked: Docker Desktop Linux-engine pipe `//./pipe/dockerDesktopLinuxEngine` was not found.                                                                                     |
| `npx.cmd supabase db lint --local --fail-on warning`  | Blocked: `LegacyDbConnectError`; local PostgreSQL was unavailable.                                                                                                               |
| `npx.cmd supabase test db`                            | Blocked: `LegacyDbConnectError`; local PostgreSQL was unavailable.                                                                                                               |

No unsafe Docker workaround was attempted. No test, SQL assertion, or CI gate
was weakened.

Authoritative GitHub database validation also passed:

- clean database reset: passed;
- all P07 migrations applied successfully;
- strict database lint: passed after correcting incorrect `IMMUTABLE`
  declarations, explicit `text[]` initializer typing, and the ingestion
  `event_id` variable/column ambiguity;
- all telemetry and existing pgTAP suites: passed;
- application formatting, ESLint, TypeScript, unit/integration tests,
  production build, and Playwright: passed.

## 20. Local runtime status

- Application unit/integration runtime: passed, 65 tests.
- Production application build: passed.
- Browser smoke runtime: passed, 1 Chromium test.
- Supabase clean reset: not runnable because the Docker Linux-engine pipe is
  absent.
- PostgreSQL lint: not runnable because local PostgreSQL is unavailable.
- pgTAP/RLS/RPC runtime: not runnable because local PostgreSQL is unavailable.

## 21. GitHub CI status

Passed. GitHub Actions `Database infrastructure validation` verified:

1. clean database reset;
2. successful P07 migration application;
3. strict database lint;
4. all telemetry and existing pgTAP suites;
5. application formatting, ESLint, TypeScript, unit/integration tests,
   production build, and Playwright.

P07 is Complete.

## 22. Cloud deployment status

- Hosted development schema updated: No.
- Cloud migrations deployed: None.
- Remote reset: not run.
- Remote push: not run.
- Remote seed push: not run.
- Supabase project linking: not changed.

## 23. Security review

- No service-role value appears in browser code or event transport bodies.
- Service-role environment access exists only in a `server-only` module.
- No direct event/quarantine DML grant was added.
- No client-supplied ownership field is accepted.
- Trusted RPC owner and empty search path are explicit.
- No dynamic SQL exists.
- Quarantine never receives HTTP authorization headers.
- Sensitive payload keys are recursively redacted.
- No arbitrary SQL or generic JSON-to-table mutation surface exists.
- Foreign-session and two-user spoofing are rejected.
- Replay cannot update an accepted event.
- Client request limits and database limits are both enforced.

## 24. Scope review

Implemented only telemetry contracts, client/service transport, trusted route,
session ensure, database validation/ingestion/quarantine, tests, and
documentation.

Not implemented:

- dashboards or certified views;
- production deployment;
- machine learning or feed ranking;
- catalog ingestion;
- onboarding, Wardrobe, Challenge, or other feature UI;
- queues, Kafka, warehouses, or streaming infrastructure;
- remote migration/reset/linking;
- commit or push.

## 25. Known limitations

- Workstation-local database runtime remains unavailable because the Docker
  Desktop Linux-engine pipe is absent; authoritative GitHub database validation
  passed.
- The bounded queue is in memory only; durable offline persistence remains P16.
- Product feature packages must wire canonical success/failure events after
  their state transactions resolve.
- Events older than 30 days are quarantined because the canonical documents
  require explicit replay classification but define no LR-001 replay field.
- Arrival order is not used to reject sequence regression because canonical
  offline events may arrive out of order; sequence is validated as a
  nonnegative integer and preserved for analytical ordering.

## 26. Recommended next package/actions

1. Proceed to P08 Product Catalog in dependency order; it is now unblocked.
2. Keep P10–P15 feature event wiring behind this typed service.
3. Implement durable offline replay only in P16.
4. Implement certified analytics/reconciliation only in P17.
5. Keep analytics views, dashboards, and production ingestion deferred until
   their approved packages.

## 27. Suggested commit message

`feat(telemetry): add trusted LR-001 ingestion foundation`
