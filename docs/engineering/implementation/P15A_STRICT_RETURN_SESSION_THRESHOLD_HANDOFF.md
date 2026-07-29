# P15A — Strict Return-Session Threshold Handoff

## 1. Exact contradiction

Canonical Data and P15 acceptance require a new return session only when prior
eligible activity occurred strictly more than 30 minutes earlier. The
historical `public.ensure_session` implementation expired a supplied session
with `<=` and reused the latest session only with `>`, so exactly 30 minutes
was incorrectly outside the current session.

## 2. Canonical threshold definition

- Elapsed time below 30 minutes: same session.
- Elapsed time exactly 30 minutes: same session.
- Elapsed time greater than 30 minutes: new return session.

This follows `EVENT_SPECIFICATION.md` Section 5, the Data Quality staging
journey requirement, and the P15 `>30 min return E2E` acceptance boundary.

## 3. Historical behavior

The validated historical P11A migration used:

- expiration:
  `last_activity_at <= observed_at - interval '30 minutes'`;
- reuse:
  `last_activity_at > observed_at - interval '30 minutes'`.

The historical migration was inspected but not modified.

## 4. Corrected behavior

The replacement uses:

- expiration:
  `last_activity_at < observed_at - interval '30 minutes'`;
- reuse:
  `last_activity_at >= observed_at - interval '30 minutes'`.

All other function behavior is preserved.

## 5. Migration created

`supabase/migrations/20260729000200_strict_return_session_threshold.sql`
contains one forward-only `CREATE OR REPLACE FUNCTION` correction and restores
the canonical owner and grants explicitly.

## 6. Function signature

The sole public signature remains:

`public.ensure_session(uuid,text,text,text,text,text) returns jsonb`

Its parameters remain session candidate ID, app version, platform, entry route,
traffic source, and cohort ID. No ownership input or bypass overload exists.

## 7. Ownership model

Ownership remains derived internally through
`private.current_anonymous_user_id()`, which resolves `auth.uid()`. The
analytical identity row is locked before session resolution and numbering.
Caller-controlled anonymous-user, user, or owner IDs remain prohibited.

## 8. Timestamp authority

`observed_at` remains a PostgreSQL `timestamptz` initialized from
`statement_timestamp()`. Server statement time, not client time, is
authoritative. No human-readable parsing, timezone conversion, precision
truncation, transaction-time substitution, or `clock_timestamp()` was added.
Telemetry ingestion retains ownership of canonical activity advancement using
server receipt time and `greatest(last_activity_at, received_at)`.

## 9. Session numbering preservation

The analytical identity lock, latest-session lookup, deterministic
`session_number DESC` order, and `max(session_number) + 1` allocation are
unchanged. The first session remains number 1 and non-return; each later
canonical session increments exactly once and is classified as return.

## 10. Exact boundary operators

- Existing supplied-session expiration uses `<`.
- Latest-session reuse uses `>=`.
- No `<=` expiration or strict `>` reuse comparison remains in the replacement.

## 11. Less-than-30 behavior

An active session at 29 minutes 59 seconds is reused. Microsecond precision is
also tested: 29 minutes 59.999999 seconds remains the same session.

## 12. Exactly-30 behavior

Exactly 30 minutes reuses both an explicitly supplied existing session and the
latest owned session when a different candidate ID is supplied. Session ID and
number remain unchanged, return classification remains false for session 1, no
second row is created, and the existing session-bound feed instance remains
the canonical feed.

## 13. Greater-than-30 behavior

At 30 minutes plus one microsecond, a new candidate creates session number 2
with `is_return_session = true`. A repeated candidate call at the same
server-observed time converges on that new session rather than creating session 3. The prior session row remains intact.

## 14. Identity isolation

The function still rejects attempts to reuse another identity's session with
`42501 session ownership mismatch`. A second anonymous Auth identity starts its
own session number 1, and another identity's threshold transition does not
alter it.

## 15. Discover regression compatibility

The function signature, JSON result shape, and `ensure_feed_instance`
integration are unchanged. Exactly 30 minutes keeps the original
session-bound feed instance. A genuine greater-than-30-minute return session
can create its own distinct session-bound feed, preserving P11 deterministic
feed and restoration ownership.

## 16. Grants and security

- Owner: `postgres`.
- Volatility: `VOLATILE`.
- Security: `SECURITY DEFINER`.
- Search path: empty.
- `authenticated`: EXECUTE granted.
- `anon` and `PUBLIC`: EXECUTE revoked.
- All referenced objects are schema-qualified.
- No dynamic SQL or direct client session-table mutation exists.

## 17. pgTAP inventory

`supabase/tests/011_strict_return_session_threshold.sql` covers:

- exact signature, single overload, owner, volatility, security, search path,
  grants, parameter inventory, and absence of dynamic SQL;
- exact boundary operators and server timestamp source;
- first-session ownership, numbering, return classification, and timestamp
  initialization;
- 29:59, one microsecond below, exactly 30 minutes through both resolution
  branches, and one microsecond above;
- row-count and numbering convergence across repeated calls;
- prior-session preservation and return classification;
- two-user isolation;
- existing-feed preservation at exactly 30 minutes and new-session feed
  compatibility above the threshold.

Test-only helpers use the same top-level `statement_timestamp()` as the function
call and are rolled back with the pgTAP transaction. No sleep or wall-clock
wait is used.

## 18. Existing-test changes

None. Existing session, Discover, telemetry, RLS, and transactional RPC suites
remain unchanged.

## 19. Validation outcomes

- `npx.cmd supabase --version`: passed (`2.109.1`) after allowing the CLI to
  access its user-profile telemetry file.
- `npm.cmd run format:check`: passed.
- `npm.cmd run lint`: passed with zero warnings/errors.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test`: passed, 30 files / 147 tests.
- `npm.cmd run build`: passed after allowing the existing Google font fetch;
  all 10 routes generated successfully.
- `git diff --check`: passed with working-copy line-ending warnings only.
- `npx.cmd supabase db reset --local`: blocked because the Docker Desktop Linux
  engine pipe `//./pipe/dockerDesktopLinuxEngine` is unavailable.
- `npx.cmd supabase db lint --local --fail-on warning`: blocked with
  `LegacyDbConnectError`; local PostgreSQL is unavailable.
- `npx.cmd supabase test db`: blocked with `LegacyDbConnectError`; local
  PostgreSQL is unavailable.

GitHub Database infrastructure validation remains authoritative for database
closure. No local database test is claimed as passed.

## 20. Local Supabase runtime status

The application gates passed. Local clean reset could not inspect the Supabase
database container because the Docker Desktop Linux-engine pipe does not exist.
Strict database lint and pgTAP could not connect to local PostgreSQL and
returned `LegacyDbConnectError`. The suite remains checked in unchanged for
authoritative GitHub execution.

## 21. GitHub CI status

Configured but awaiting GitHub Database infrastructure validation. P15A is not
Complete locally.

## 22. Cloud status

Cloud migrations deployed: None. Hosted development schema updated: No. Remote
reset: not run. Remote migration push: not run. Production deployment: not
run.

## 23. Security review

No ownership argument, service-role browser path, direct session DML grant,
dynamic SQL, new overload, policy change, or client timestamp authority was
introduced. Existing identity isolation and authenticated-only execution are
preserved.

## 24. Scope review

Only the `public.ensure_session` boundary comparison, dedicated pgTAP coverage,
implementation status, and this handoff are included. No application UI, P15
Continuation implementation, telemetry taxonomy, session schema, RLS policy,
historical migration, remote database state, deployment, commit, or push was
changed.

## 25. Known limitations

Local database execution depends on the workstation Docker/PostgreSQL runtime.
P15 remains blocked until the authoritative GitHub database workflow validates
the new migration and all pgTAP/application gates.

## 26. Exact changed-file inventory

Created:

- `supabase/migrations/20260729000200_strict_return_session_threshold.sql`
- `supabase/tests/011_strict_return_session_threshold.sql`
- `docs/engineering/implementation/P15A_STRICT_RETURN_SESSION_THRESHOLD_HANDOFF.md`

Modified:

- `docs/engineering/IMPLEMENTATION_STATUS.md`

## 27. Recommended next action

Run GitHub Database infrastructure validation. After it passes, close P15A,
mark P15 Ready, and resume P15 — Continuation without changing its canonical
scope or `feat(continuation)` boundary.

## 28. Suggested commit message

`fix(db): enforce strict return-session threshold`
