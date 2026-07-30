# WP-006 Implementation Status

## Current package

`P16 — Offline / Recovery`

## Status

Ready

P10 remains Complete. P11A remains Complete. P11 remains Complete. P12 remains
Complete. P13 remains Complete after verified GitHub application validation.
P14A is Complete after verified GitHub Database infrastructure validation. P14
is Complete after verified GitHub application validation of commit
`2449c7f4e1aaf2ee31df344697bf8e9af48b4856`. P15A is Complete after verified
GitHub Database infrastructure validation. P15B is Complete at commit
`11bed0f78638f4ed246fdf07d6792dcb744566ed`. P15C is Complete after verified
GitHub Database infrastructure validation of implementation commit
`4bee1b5618d798930b6b8665cbb2c45839befe5c` and test-fixture correction commit
`38494158aba0584d1a5816b3d8c17028d09319d8`. P15 is Complete after verified
GitHub Application CI validation of implementation commit
`d5edf3bf6a66dfd469386b93c0d7586ff7320b3b`. P16 is Ready but not implemented.

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

## P15 implementation

- GitHub Application CI passed for implementation commit
  `d5edf3bf6a66dfd469386b93c0d7586ff7320b3b`
  (`feat(continuation)`).
- Format passed.
- Lint passed with zero warnings/errors.
- Typecheck passed.
- Vitest passed: 35 files; 161 tests.
- Production build passed: 10 routes generated.
- Full Playwright passed: 65/65; Chromium; one worker.
- Dedicated P15 Playwright passed: 14/14.
- Accessibility/axe coverage passed.
- Process teardown passed with no ALTER-related orphan Node, Next.js, or
  Playwright process.
- Resolves at most one continuation cue on Discover entry and only for a
  server-confirmed return session.
- Applies the frozen priority exactly: active incomplete Challenge with a valid
  selection; latest completion in its first later return session; meaningful,
  non-empty Wardrobe; otherwise normal Discover with no card.
- Treats Discover only as the no-card fallback. A strict return rotates an
  expired session candidate, clears prior Discover restoration, and obtains the
  new session-bound feed without reusing a prior-session feed.
- Renders the canonical non-modal, dismissible card above the Discover grid,
  with one destination action and a compact retryable resolver-error surface.
- Stores shown and distinct dismissed/activated state under the versioned,
  identity-and-session-scoped key
  `alter:continuation:v1:<anonymous-user-id>:<session-id>`.
- Records qualified primary Discover, Wardrobe, and Challenge views through
  `public.record_meaningful_destination(uuid,text,uuid)`. Product Detail,
  Challenge picker, dismissal, and activation do not write a destination.
- Uses only registered continuation telemetry events. Resolver, destination,
  and telemetry failures never replace or block the underlying primary surface.
- Adds deterministic unit/component coverage and a dedicated one-worker
  Playwright suite, including strict session modes, priority, consumption,
  destination recording, resolver recovery, accessibility, and the five
  canonical viewports.
- Completed visual certification for all 15 required state rows at 320×700,
  390×844, 768×1024, 1200×900, and 1440×1024. The 14 distinct rendered states
  produced 70 viewport artifacts because the Wardrobe artifact also represents
  the canonical long-copy state. Automated geometry, overflow, shell,
  touch-target, focus, and reduced-motion assertions passed; manual
  contact-sheet inspection passed at every viewport.
- Corrected the continuation reduced-motion rule so the card, error surface,
  and their controls disable animation and transition when reduced motion is
  requested.
- Database changes: None.
- New migrations: None.
- Cloud migrations deployed: None.
- Hosted development schema updated: No.
- Remote reset: not run.
- Remote migration push: not run.
- Production deployment: not run.

## P16 definition

- Package: **P16 — Offline / Recovery**
- Dependencies: P07 and P11–P15
- Scope: queue, retry, and corrupt-state handling
- Acceptance: offline and interrupted mutation behavior
- Commit boundary: `feat(recovery)`
- Status: Ready but not implemented.

## P15C implementation

- Added the forward-only migration
  `20260729000300_meaningful_destination_boundary.sql`.
- Added the sole approved
  `public.record_meaningful_destination(uuid,text,uuid) returns jsonb`
  application write boundary for
  `anonymous_users.last_meaningful_destination`.
- Derives ownership exclusively through
  `private.current_anonymous_user_id()` and accepts no owner, anonymous-user, or
  auth-user identifier.
- Accepts only exact lowercase `discover`, `wardrobe`, or `challenge`; invalid,
  blank, null, and mixed-case destinations are rejected without a successful
  ledger result.
- Validates that the supplied session belongs to the current identity, is not
  ended, and remains active under the P15A boundary:
  `last_activity_at >= statement_timestamp() - interval '30 minutes'`.
- Rejects missing, foreign, ended, and strictly-greater-than-30-minute stale
  sessions without mutating identity, session, or feed state.
- Uses the existing `private.mutation_operations` ledger. Identical replay
  returns the original result without a second revision increment; reuse with
  another owner, session, or destination remains a deterministic
  `operation_id conflict`.
- Updates only the current identity's destination and increments
  `anonymous_users.state_revision` exactly once for each fresh successful
  operation. The existing `updated_at` trigger supplies the canonical server
  audit timestamp returned as `recorded_at`.
- Preserves direct browser UPDATE denial, RLS, session numbering, P11 feed
  ownership, telemetry taxonomy, and all historical migrations.
- Added
  `supabase/tests/012_meaningful_destination_boundary.sql` with 53 deterministic
  pgTAP assertions covering structure, grants, allowlist, active-session
  precision, state mutation, replay/conflict, identity isolation, return-session
  integration, and feed regression.
- Updated only the existing exact RPC allow-list assertions in
  `supabase/tests/006_transactional_rpcs.sql` for the new approved signature.
- No column CHECK constraint was added because a forward-only migration cannot
  prove that every previously deployed historical value complies; the RPC is
  the exclusive application write boundary and enforces the frozen allowlist.
- The finalized fixture expires only the latest identity-scoped session,
  derives the next number from that identity's current maximum, and uses
  distinct user A/user B session UUID namespaces.
- Both identity lineages begin at 1 and remain contiguous; neither identity's
  return advances the other, and no session ID belongs to multiple identities.
- Destination recording creates no additional session, does not renumber
  sessions, preserves feed state, and keeps operation-ledger ownership
  identity-isolated.
- Implementation commit:
  `4bee1b5618d798930b6b8665cbb2c45839befe5c`.
- Test-fixture correction commit:
  `38494158aba0584d1a5816b3d8c17028d09319d8`.
- GitHub Database infrastructure validation: passed.
- Clean database reset: passed.
- Strict database lint: passed.
- All pgTAP suites: passed.
- `supabase/tests/006_transactional_rpcs.sql`: passed.
- `supabase/tests/012_meaningful_destination_boundary.sql`: passed with 53
  assertions.
- Application format, lint, typecheck, Vitest, and production build: passed.

Database changes: one forward-only function migration.
New migrations: one.
Cloud migrations deployed: None.
Hosted development schema updated: No.
Remote reset: not run.
Remote migration push: not run.
Production deployment: not run.

## P15B canonicalization

- Discover is the no-card fallback and is not a continuation-card candidate.
- A strictly-greater-than-30-minute return uses a new session-bound feed;
  prior-session feed reuse is prohibited, while same-session Product
  Detail/Discover restoration is unchanged.
- Candidate priority is active incomplete Challenge, latest completion on the
  first return after completion, Wardrobe when last meaningful with at least
  one non-removed saved row, then no card.
- An unavailable-only Wardrobe may qualify.
- Higher-priority query or contract failure is typed and cannot silently fall
  through; Discover remains usable with a compact retryable continuation error.
- Meaningful destinations are exactly `discover`, `wardrobe`, and `challenge`
  and are recorded only after the primary surface qualifies as viewed.
- Product Detail and Challenge picker inherit their parent destination;
  onboarding, dismissal, and activation do not directly overwrite it.
- Dismissal and successful activation consume at most one card for the current
  return session. Versioned identity/session browser state survives reload; a
  new return session reevaluates candidates. Telemetry is not state authority.
- P15C owns the approved authenticated
  `record_meaningful_destination(uuid, text, uuid)` database boundary.
- No telemetry event was added, and P15B contains no database implementation.

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
- Migration:
  `20260729000200_strict_return_session_threshold.sql`.
- GitHub Database infrastructure validation: passed.
- Clean database reset: passed.
- Strict database lint: passed.
- All pgTAP suites: passed.
- `supabase/tests/011_strict_return_session_threshold.sql`: passed with 27
  assertions.
- 29:59 remained the same session.
- Exactly 30:00 remained the same session.
- 30:00 plus one microsecond created a new return session.
- User B could not reuse user A's session and created an independent
  session-number lineage.
- User A's session lineage remained unchanged.
- Discover session/feed integration remained valid.
- Application validation gates: passed.
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

Begin P16 — Offline / Recovery only under a separately authorized
implementation task. P15 is Complete. P16 is Ready but not implemented.
