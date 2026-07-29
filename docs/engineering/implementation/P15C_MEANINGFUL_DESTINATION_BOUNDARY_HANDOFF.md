# P15C — Meaningful Destination Boundary Handoff

## 1. Status

WP-006 / P15C — Meaningful Destination Boundary.

Status: **Complete**.

GitHub Database infrastructure validation passed for implementation commit
`4bee1b5618d798930b6b8665cbb2c45839befe5c` and test-fixture correction commit
`38494158aba0584d1a5816b3d8c17028d09319d8`. P15 is Ready. P16 remains blocked
pending P15 closure.

## 2. Preflight

- Repository root:
  `C:\ALTER_REPOSITORY_COMPLETE_WP006_READY\ALTER`.
- `package.json`: present and readable.
- Branch: `main`.
- Initial working tree: clean.
- `origin/main` fetched successfully.
- Closure working tree before documentation changes: clean.
- Closure local `main` and `origin/main`:
  `38494158aba0584d1a5816b3d8c17028d09319d8`.
- P15A: Complete.
- P15B: Complete.
- P15C: Ready before implementation.
- P15: blocked pending P15C Database CI closure.
- Every corrected canonical input existed and was read before modification.
- No historical migration was modified.

## 3. Canonical inputs

Read completely:

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
- `docs/data/DATA_QUALITY.md`
- `docs/data/WP-004_HANDOFF.md`
- `docs/engineering/SUPABASE_IMPLEMENTATION.md`
- `docs/engineering/TESTING_STRATEGY.md`
- `docs/engineering/WP-006_IMPLEMENTATION_PLAN.md`
- `docs/engineering/IMPLEMENTATION_STATUS.md`
- `docs/engineering/implementation/P05_ANONYMOUS_IDENTITY_HANDOFF.md`
- `docs/engineering/implementation/P06_RLS_RPC_FOUNDATION_HANDOFF.md`
- `docs/engineering/implementation/P09_APPLICATION_SHELL_HANDOFF.md`
- `docs/engineering/implementation/P15A_STRICT_RETURN_SESSION_THRESHOLD_HANDOFF.md`
- `docs/engineering/implementation/P15B_CONTINUATION_CANONICALIZATION_HANDOFF.md`
- `docs/decisions/engineering/ADR-ENG-001-ANONYMOUS-IDENTITY.md`

The P05 implementation evidence was also inspected directly:

- `supabase/migrations/20260723000200_identity_sessions_and_catalog.sql`
- `supabase/migrations/20260723000500_anonymous_identity_bootstrap.sql`
- `supabase/migrations/20260723000600_rls_and_client_grants.sql`
- `supabase/migrations/20260723000700_transactional_mutation_rpcs.sql`
- `supabase/tests/004_anonymous_identity_bootstrap.sql`

Current identity, session, operation-ledger, RLS, feed, exact RPC allow-list, and
function-security migrations/tests were inspected before implementation.

## 4. Confirmed P15C scope

- Package: **P15C — Meaningful Destination Boundary**
- Dependencies: P05, P06, P09, P15A, P15B
- Objective: record identity-scoped qualified primary destination
- Acceptance: allowlist, active-session validation, idempotency, identity
  isolation
- Commit boundary: `feat(db): add meaningful destination boundary`

No P15 UI, continuation resolver, card, telemetry event, application consumer,
new table, or remote deployment is included.

## 5. Files created

- `supabase/migrations/20260729000300_meaningful_destination_boundary.sql`
- `supabase/tests/012_meaningful_destination_boundary.sql`
- `docs/engineering/implementation/P15C_MEANINGFUL_DESTINATION_BOUNDARY_HANDOFF.md`

## 6. Files modified

- `supabase/tests/006_transactional_rpcs.sql`
- `docs/engineering/IMPLEMENTATION_STATUS.md`

## 7. Migration inventory

One forward-only migration follows P15A:

`supabase/migrations/20260729000300_meaningful_destination_boundary.sql`

It contains only the approved function definition plus explicit owner,
revocations, and authenticated grant. No historical migration, column, table,
policy, feed behavior, session numbering, or threshold function was changed.

## 8. RPC signature

```sql
public.record_meaningful_destination(
  p_session_id uuid,
  p_destination text,
  p_operation_id uuid
) returns jsonb
```

There is one unambiguous overload. No ownership argument is accepted.

## 9. Ownership model

Ownership is derived exclusively through:

`auth.uid() → private.current_anonymous_user_id() → anonymous_users.id`

The function accepts a session domain identifier but treats it only as a target
to validate. It never treats a caller-supplied ID as ownership proof. The
identity row is locked before state mutation, and the session row must belong to
that derived identity.

## 10. Active-session validation

The function rejects:

- null or nil session IDs;
- missing sessions;
- sessions owned by another identity;
- sessions with `ended_at` set;
- stale sessions outside the P15A boundary.

The session row is locked during validation. The RPC does not update
`sessions.last_activity_at`, `ended_at`, numbering, or any other session field.

## 11. Strict 30-minute threshold

PostgreSQL `statement_timestamp()` is the sole time authority.

- 29:59: accepted.
- Exactly 30:00: accepted.
- 30:00 plus one microsecond: rejected.

The exact expiration condition is:

```sql
last_activity_at < statement_timestamp() - interval '30 minutes'
```

No client time, timezone parsing, precision truncation, `<=`, or altered
`ensure_session` behavior is introduced.

## 12. Destination allowlist

The exact lowercase allowlist is:

- `discover`
- `wardrobe`
- `challenge`

Null, empty, unknown, mixed-case, Product Detail, Challenge picker, onboarding,
continuation, and arbitrary route strings are rejected with SQLSTATE `22023`
and stable message `meaningful_destination_invalid`. No normalization or silent
coercion occurs.

## 13. Idempotency fingerprint

The existing `private.mutation_operations` ledger is used unchanged.

The normalized JSONB request fingerprint includes:

- current anonymous identity;
- RPC name;
- session ID;
- destination.

The operation ID remains the ledger primary key and is passed separately to the
existing claim helper. Every fingerprint field is non-null before claim.

## 14. Replay semantics

An identical operation replay returns the original stored JSONB result.
Replay does not reapply the update, increment the revision, change the audit
timestamp, mutate the session, or alter feed state.

Replay remains valid after the original successful call because it represents
the canonical result of that logical operation.

## 15. Conflict semantics

Global operation-ID reuse with a different:

- identity;
- session;
- destination; or
- operation type

raises SQLSTATE `22023` with the established `operation_id conflict` message.
Conflict resolution occurs before target-session validation for an already
claimed operation, preserving deterministic replay/conflict semantics.

## 16. Validation rollback

Basic session-ID and destination-shape validation occurs before ledger claim.
Owned-session validation occurs after claim so operation conflict stays
distinct. Any missing, foreign, ended, or stale-session rejection raises inside
the same PostgreSQL transaction and rolls back the new ledger claim. Failed
calls therefore leave no misleading completed or pending operation row.

## 17. State mutation

The fresh successful operation updates only:

- `anonymous_users.last_meaningful_destination`;
- `anonymous_users.state_revision`;
- `anonymous_users.updated_at` through the existing canonical trigger.

The state revision increments exactly once for every new valid logical
operation, including recording the same destination with a new operation ID.
No unrelated identity field changes.

## 18. Revision and audit behavior

`anonymous_users.state_revision` is the existing canonical identity revision
and increments by one on every fresh successful write. The existing
`anonymous_users_set_updated_at` trigger supplies the server-owned audit time.
The returned `recorded_at` is that canonical `updated_at` value. Replay returns
the originally stored revision and timestamp.

## 19. Return payload

The canonical response is:

```json
{
  "ok": true,
  "operation_id": "<uuid>",
  "state_revision": 4,
  "data": {
    "destination": "wardrobe",
    "session_id": "<uuid>",
    "recorded_at": "<server timestamptz>"
  }
}
```

It contains no anonymous-user, Auth-user, ledger, token, or ownership field.

## 20. Function security

The RPC is:

- owned by `postgres`;
- `VOLATILE`;
- `SECURITY DEFINER`;
- configured with `SET search_path = ''`;
- fully schema-qualified;
- free of dynamic SQL;
- non-overloaded.

## 21. Grants and RLS

- EXECUTE revoked from `PUBLIC`.
- EXECUTE revoked from `anon`.
- EXECUTE granted only to `authenticated`.
- Direct `anonymous_users` UPDATE remains unavailable to `anon` and
  `authenticated`.
- Existing SELECT RLS and every other policy/grant remain unchanged.
- Browser service-role use is neither required nor added.

## 22. Check-constraint decision

No column CHECK constraint was added.

P15B freezes the application allowlist, but this forward-only package cannot
prove that every value in every previously deployed schema already complies.
Adding and validating a column constraint could therefore make an upgrade fail
on unknown historical data. The RPC is the only approved application write
boundary and enforces the exact persistent allowlist without rewriting existing
rows.

## 23. pgTAP inventory

`supabase/tests/012_meaningful_destination_boundary.sql` contains 53
deterministic assertions covering:

- exact signature, return type, owner, volatility, security, search path,
  grants, overload count, parameter inventory, and absence of dynamic SQL;
- direct browser UPDATE denial;
- unauthenticated rejection;
- exact destination allowlist, null/blank/unknown/mixed-case rejection, and no
  invalid mutation result;
- missing, foreign, ended, stale, exactly-30-minute, 29:59, and
  30-minutes-plus-one-microsecond session behavior;
- canonical payload and ownership-field exclusion;
- revision, audit, unrelated-field, and session-row behavior;
- identical replay, destination/session conflict, new-operation behavior, and
  failed-validation rollback;
- two-user identity and operation isolation;
- session-number lineage preservation;
- greater-than-30-minute `ensure_session` integration before destination
  recording;
- P11 feed ownership/state preservation and absence of feed-product mutation.

Fixtures use two deterministic anonymous Auth identities, explicit UUIDs,
statement-time-relative intervals, and helper functions whose updates and calls
share one statement timestamp. No sleep or real-time wait is used.

The finalized fixture additionally proves:

- only the latest identity-scoped session is expired for return creation;
- the next session number is derived from the current identity-scoped maximum;
- user A and user B use distinct session UUID namespaces;
- both lineages begin at 1 and remain contiguous;
- neither identity's return advances the other identity's lineage;
- no session ID belongs to multiple identities;
- destination recording creates no additional session and does not renumber
  the accepted session;
- feed state remains unchanged;
- operation-ledger ownership remains identity-isolated.

## 24. Existing-test changes

Only the exact public RPC allow-list assertions in
`supabase/tests/006_transactional_rpcs.sql` changed:

- security-definer function count: 13 → 14;
- authenticated public RPC count: 16 → 17;
- the new exact signature was added to the security, execution, ownership-input,
  and dynamic-SQL inventories.

No historical behavioral assertion was weakened or removed.

After the first Database CI run, only
`supabase/tests/012_meaningful_destination_boundary.sql` changed. The correction
expired the actual latest owned session and replaced contaminated hardcoded
lineage expectations with deterministic identity-scoped derivation. The P15C
migration remained unchanged.

## 25. Validation results

| Command                                                  | Outcome                                                                                                                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx.cmd supabase --version`                             | Passed: `2.109.1` after allowing access to the CLI's user-profile telemetry file.                                                                                |
| `npm.cmd run format:check`                               | Passed.                                                                                                                                                          |
| `npm.cmd run lint`                                       | Passed with no warning/error output.                                                                                                                             |
| `npm.cmd run typecheck`                                  | Passed.                                                                                                                                                          |
| `npm.cmd run test`                                       | Passed: 30 files / 147 tests. Vitest emitted the existing jsdom canvas implementation notice.                                                                    |
| `npm.cmd run build`                                      | Passed; the sandboxed attempt could not fetch the existing Google fonts, then the unchanged command passed with font-network access and generated all 10 routes. |
| `git diff --check`                                       | Passed with working-copy LF-to-CRLF warnings only.                                                                                                               |
| `npx.cmd supabase db reset --local`                      | Blocked: Docker Desktop Linux-engine pipe `//./pipe/dockerDesktopLinuxEngine` was not found.                                                                     |
| `npx.cmd supabase db lint --local --fail-on warning`     | Blocked with `LegacyDbConnectError`; local PostgreSQL was unavailable.                                                                                           |
| `npx.cmd supabase test db`                               | Blocked with `LegacyDbConnectError`; local PostgreSQL was unavailable.                                                                                           |
| GitHub Database infrastructure validation                | Passed: clean reset, strict lint, all pgTAP suites, and application gates.                                                                                       |
| `supabase/tests/006_transactional_rpcs.sql`              | Passed in authoritative GitHub Database CI.                                                                                                                      |
| `supabase/tests/012_meaningful_destination_boundary.sql` | Passed with 53 assertions in authoritative GitHub Database CI.                                                                                                   |

No database pass is claimed from the blocked local commands. Authoritative
GitHub Database infrastructure validation closed that local runtime gap.

## 26. Local Supabase runtime status

The Supabase CLI itself ran successfully. Clean reset could not inspect the
database container because the Docker Desktop Linux-engine pipe does not exist.
Strict lint and pgTAP could not connect to local PostgreSQL and returned
`LegacyDbConnectError`. No unsafe Docker workaround was attempted and no test
was weakened.

## 27. GitHub CI status

Passed. Clean database reset, strict database lint, all pgTAP suites,
`006_transactional_rpcs.sql`, the 53-assertion
`012_meaningful_destination_boundary.sql` suite, and application format, lint,
typecheck, Vitest, and production build passed.

P15C is Complete.

## 28. Cloud status

- Cloud migrations deployed: None.
- Hosted development schema updated: No.
- Remote reset: not run.
- Remote migration push: not run.
- Production deployment: not run.
- Project linking: not run.

## 29. Security review

- No caller-controlled owner, anonymous-user, Auth-user, or Wardrobe ID.
- No direct browser identity UPDATE.
- No service-role browser path.
- No dynamic SQL.
- No non-empty or caller-controlled search path.
- No grant to `anon` or `PUBLIC`.
- No cross-user session acceptance or operation replay.
- No raw internal ledger data in results.
- No session or feed mutation.
- Failed validation rolls back its ledger claim.

## 30. Scope review

Implemented only the approved meaningful-destination database boundary, its
dedicated pgTAP coverage, the exact RPC allow-list update, implementation
status, and this handoff.

Not implemented:

- P15 continuation UI, resolver, card, routing, or browser consumption state;
- application code or generated client types;
- telemetry events or properties;
- recommendation, ranking, notifications, or later-package behavior;
- session threshold or numbering changes;
- feed creation, ordering, restoration, or mutation;
- new table, column, RLS policy, or historical migration;
- deployment or remote Supabase action.

## 31. Known limitations

- The workstation-local database runtime remains unavailable; authoritative
  GitHub validation passed and closes this local execution gap.
- No persistent column CHECK is added for upgrade safety; all approved
  application writes must use the RPC.
- P15 must implement the qualified-view call timing and typed application error
  mapping; P15C provides only the database boundary.

## 32. Exact changed-file inventory

Created:

- `supabase/migrations/20260729000300_meaningful_destination_boundary.sql`
- `supabase/tests/012_meaningful_destination_boundary.sql`
- `docs/engineering/implementation/P15C_MEANINGFUL_DESTINATION_BOUNDARY_HANDOFF.md`

Modified:

- `supabase/tests/006_transactional_rpcs.sql`
- `docs/engineering/IMPLEMENTATION_STATUS.md`

## 33. Recommended next action

Begin P15 — Continuation. Its effective dependencies are P11, P13, P14, P15A,
P15B, and P15C; scope is return priority and the continuation card; acceptance
is a strictly greater-than-30-minute return E2E; and its commit boundary is
`feat(continuation)`. P16 remains blocked pending P15 closure.

## 34. Suggested commit message

`docs(implementation): close P15C and ready P15`
