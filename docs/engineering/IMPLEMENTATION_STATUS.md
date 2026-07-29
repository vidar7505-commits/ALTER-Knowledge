# WP-006 Implementation Status

## Current package

`P15A — Strict Return-Session Threshold`

## Status

Configured but awaiting CI validation

P10 remains Complete. P11A remains Complete. P11 remains Complete. P12 remains
Complete. P13 remains Complete after verified GitHub application validation.
P14A is Complete after verified GitHub Database infrastructure validation. P14
is Complete after verified GitHub application validation of commit
`2449c7f4e1aaf2ee31df344697bf8e9af48b4856`. P15A is configured locally and
awaiting GitHub Database infrastructure validation. P15 is blocked pending
P15A database CI closure. P16 remains blocked.

P15A adds one forward-only migration correcting only the strict 30-minute
boundary in `public.ensure_session`. P14A previously added one forward-only
migration with optimistic revision preconditions for the three active-state
Challenge mutation RPCs.
Cloud migrations deployed: None.
Hosted development schema updated: No.
Remote reset: not run.
Remote migration push: not run.
Remote seed push: not run.
Production deployment: not run.

## P15A implementation

- Replaced the existing exact
  `public.ensure_session(uuid,text,text,text,text,text)` implementation through
  one forward-only migration.
- Changed expiration from `last_activity_at <= observed_at - interval '30
minutes'` to `<`.
- Changed latest-session reuse from `last_activity_at > observed_at - interval
'30 minutes'` to `>=`.
- Preserved server `statement_timestamp()` authority, `timestamptz` precision,
  session numbering, result shape, identity locking and isolation, feed
  integration, postgres ownership, `SECURITY DEFINER`, empty search path, and
  authenticated-only execution.
- Added deterministic pgTAP coverage for first-session creation, 29:59,
  exactly 30 minutes, ±1 microsecond, return-session creation, repeated-call
  convergence, identity isolation, and feed-instance compatibility.
- Did not edit the historical P11A migration, application code, telemetry
  taxonomy, session schema, or RLS policies.
- `npx.cmd supabase --version`: passed (`2.109.1`) after allowing the CLI to
  access its user-profile telemetry file.
- `npm.cmd run format:check`: passed.
- `npm.cmd run lint`: passed with zero warnings/errors.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test`: passed (30 test files / 147 tests).
- `npm.cmd run build`: passed after allowing the existing Google font fetch.
- `git diff --check`: passed with working-copy line-ending warnings only.
- `npx.cmd supabase db reset --local`: blocked because the Docker Desktop Linux
  engine pipe `//./pipe/dockerDesktopLinuxEngine` is unavailable.
- `npx.cmd supabase db lint --local --fail-on warning`: blocked with
  `LegacyDbConnectError`; local PostgreSQL is unavailable.
- `npx.cmd supabase test db`: blocked with `LegacyDbConnectError`; local
  PostgreSQL is unavailable.

Database changes: one forward-only `ensure_session` function replacement.
New migrations: one.
Cloud migrations deployed: None.
Hosted development schema updated: No.
Remote reset: not run.
Remote migration push: not run.
Production deployment: not run.

## P14 implementation

- Replaced only the `/challenge` placeholder inside the existing P09 shell.
- Added canonical Challenge definition, progress, selection, completion, and
  mutation-envelope validation.
- Added owner-scoped recovery reads and the approved start, select, remove,
  complete, and slot-product RPC calls.
- Sends the current `state_revision` for every active-state mutation and maps
  SQLSTATE `40001` / `challenge_revision_mismatch` to canonical refetch rather
  than stale replay.
- Preserves stable operation IDs for logical retry, distinguishes operation
  conflict, rejects stale responses, and guards duplicate input immediately.
- Renders the four required slots in canonical order and locks every mutation
  control after completion.
- Uses immutable completion snapshots when current catalog availability changes.
- Integrates Product Detail only through `from=challenge`.
- Uses only P07 registered Challenge events and keeps telemetry failure outside
  canonical Challenge state.
- Added deterministic unit/component, axe, dedicated one-worker E2E, mock, and
  five-viewport visual coverage.

Database changes: None.
New migrations: None.
Cloud migrations deployed: None.
Hosted development schema updated: No.
Remote reset: not run.
Remote migration push: not run.
Production deployment: not run.

## P14A implementation

- Replaced `select_challenge_item` with
  `select_challenge_item(uuid,text,uuid,bigint,uuid)`.
- Replaced `remove_challenge_item` with
  `remove_challenge_item(uuid,bigint,uuid)`.
- Replaced `complete_challenge` with
  `complete_challenge(uuid,bigint,uuid)`.
- Dropped the obsolete client-callable signatures so no revision-bypass
  overload remains.
- Added non-null, nonnegative expected-revision validation.
- Added `expected_state_revision` to every Challenge mutation fingerprint.
- Preserved ownership derivation, row locking, operation replay, operation
  conflict, slot/product/Wardrobe validation, revision increments, and
  completed-state immutability.
- Added typed `challenge_revision_mismatch` rejection before canonical mutation.
- Added dedicated deterministic two-user pgTAP coverage in
  `010_challenge_revision_preconditions.sql`.
- Updated the existing P06 exact RPC allow-list and Challenge calls for the new
  signatures.

## Validation status

- `npx.cmd supabase --version`: passed (`2.109.1`) after allowing the CLI to
  access its user-profile telemetry file.
- `npx.cmd supabase db reset --local`: blocked because the Docker Desktop Linux
  engine pipe `//./pipe/dockerDesktopLinuxEngine` is unavailable.
- `npx.cmd supabase db lint --local --fail-on warning`: blocked with
  `LegacyDbConnectError`; local PostgreSQL is unavailable.
- `npx.cmd supabase test db`: blocked with `LegacyDbConnectError`; local
  PostgreSQL is unavailable.
- `npm.cmd run format:check`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test`: passed (28 test files / 139 tests).
- `npm.cmd run build`: passed after allowing the existing Google font fetch.
- `git diff --check`: passed with working-copy line-ending warnings only.
- GitHub Database infrastructure validation: passed.
- Clean database reset: passed.
- Strict database lint: passed.
- All pgTAP suites: passed.
- `supabase/tests/006_transactional_rpcs.sql`: passed.
- `supabase/tests/010_challenge_revision_preconditions.sql`: passed.
- Application validation gates: passed.
- GitHub application validation for P14 commit
  `2449c7f4e1aaf2ee31df344697bf8e9af48b4856`: passed.
- Format: passed.
- Lint: passed with zero warnings/errors.
- Typecheck: passed.
- Vitest: passed (30 files / 147 tests).
- Production build: passed.
- Full Playwright in Chromium with one worker: passed (51 tests).
- Axe accessibility coverage: passed.
- Visual certification: passed at 320×700, 390×844, 768×1024, 1200×900, and
  1440×1024.
- Process teardown: passed; no orphan ALTER-related Node, Next.js, or
  Playwright processes remained.
- Challenge revision mismatch behavior for select, remove, and complete: passed.
- Replay and operation-conflict semantics: passed.
- Two-user isolation: passed.
- Old revision-bypass signatures: absent or non-executable.
- New revision-aware signatures: authenticated-only.

## Security and scope review

The revised functions remain postgres-owned `SECURITY DEFINER` functions with
an empty search path, schema-qualified state access, no dynamic SQL, no owner
parameters, no service-role browser path, and authenticated-only execution.
Existing RLS and completed-snapshot protections are unchanged.

No Challenge UI, P14 application code, P13 behavior, slot taxonomy, product
eligibility, telemetry contract, unrelated migration, remote database state,
deployment, commit, or push was changed.

## Next action

Run GitHub Database infrastructure validation for P15A. Do not mark P15A
Complete or unblock P15 until clean reset, strict database lint, all pgTAP
suites including `011_strict_return_session_threshold.sql`, and application
gates pass. P15 remains Continuation, depending on P11, P13, and P14, with
return priority and card scope, `>30 min` return E2E acceptance, and
`feat(continuation)` commit boundary.
