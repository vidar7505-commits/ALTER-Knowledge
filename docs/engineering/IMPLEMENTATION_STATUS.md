# WP-006 Implementation Status

## Current package

`P14 — Challenge`

## Status

Configured but awaiting CI validation

P10 remains Complete. P11A remains Complete. P11 remains Complete. P12 remains
Complete. P13 remains Complete after verified GitHub application validation.
P14A is Complete after verified GitHub Database infrastructure validation. P14
is configured locally and awaiting CI validation. P15 remains blocked pending
P14 closure.

P14 database changes: None. P14A previously added one forward-only migration
with optimistic revision preconditions for the three active-state Challenge
mutation RPCs.
Cloud migrations deployed: None.
Hosted development schema updated: No.
Remote reset: not run.
Remote migration push: not run.
Remote seed push: not run.
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

Run GitHub application CI for P14. Do not mark P14 Complete until the required
CI result is verified. P15 — Continuation remains blocked; when unblocked, its
scope is return priority and continuation card behavior with the `>30 min`
return E2E acceptance boundary and `feat(continuation)` commit boundary.
