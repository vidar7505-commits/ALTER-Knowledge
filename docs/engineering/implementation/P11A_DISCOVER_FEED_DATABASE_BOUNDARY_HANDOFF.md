# WP-006 P11A — Discover Feed Database Boundary Handoff

## Status

`Configured but awaiting CI validation`.

P10 remains Complete. P11 — Discover remains **Blocked by database boundary**
until GitHub database validation applies the P11A migration on a clean database
and passes strict lint, all pgTAP suites, and the application gates.

Cloud migrations deployed: None. Hosted development schema updated: No.

## 1. Exact contradiction resolved

P04 created `sessions`, `feed_instances`, and `feed_instance_products`. P06
correctly limited authenticated access to ownership-scoped SELECT and revoked
direct DML. P07 supplied trusted telemetry/session ingestion, but P11 had no
authenticated ownership-safe boundary to create or recover sessions, create or
recover feed instances, append deterministic batches, persist pagination and
loaded depth, or advance qualified depth.

P11A supplies those four narrow RPC boundaries without granting table writes,
using a service-role client, or adding Discover UI.

## 2. Migration files created

- `supabase/migrations/20260724000300_discover_feed_database_boundary.sql`

No validated P04–P10 migration was modified.

## 3. Schema changes

- Added unique constraint
  `feed_instances_session_order_version_key(session_id, feed_order_version)`.
  It is the database convergence key for one logical feed per analytics session
  and ordering version.
- Added private table `private.feed_batch_requests`.
  Its primary key is `(feed_instance_id, request_cursor)` and it also uniquely
  constrains `(feed_instance_id, batch_number)`. It records requested count,
  canonical batch number, returned count, next cursor, and terminal state so a
  repeated cursor returns the original result, including an empty terminal
  batch.
- Added no session owner column, browser-write policy, public catalog field,
  event table, or ranking field.

No new logical-session column was required. The client-generated analytics
`session_id` is already the canonical logical-session identifier. An owner-row
lock plus the existing unique `(anonymous_user_id, session_number)` constraint
serializes new session-number allocation.

## 4. RPC inventory

| RPC                              | Signature                         | Purpose                                                |
| -------------------------------- | --------------------------------- | ------------------------------------------------------ |
| `ensure_session`                 | `(uuid,text,text,text,text,text)` | Create or recover the current owned analytics session  |
| `ensure_feed_instance`           | `(uuid)`                          | Create or recover the current session's canonical feed |
| `append_feed_batch`              | `(uuid,text,integer)`             | Persist or replay one deterministic feed batch         |
| `record_qualified_feed_position` | `(uuid,uuid,uuid,integer)`        | Monotonically persist canonical qualified depth        |

All return compact JSON objects. No RPC accepts `anonymous_user_id`, `user_id`,
`wardrobe_id`, environment, test classification, or client-generated feed
positions/batch numbers.

## 5. Ownership model

Every public RPC calls the existing inaccessible
`private.current_anonymous_user_id()` helper:

`request JWT → auth.uid() → anonymous_users.auth_user_id → anonymous_users.id`

`ensure_session` locks that identity row. The remaining functions verify that
the referenced session/feed resolves to the same canonical owner. A row UUID is
never treated as proof of ownership.

## 6. Session identity and idempotency model

`ensure_session` accepts the canonical analytics session UUID plus validated
application version, platform, entry route, controlled traffic source, and
controlled cohort ID.

- An existing owned, unexpired session UUID is returned unchanged.
- A different UUID presented while the latest session remains active inside the
  30-minute boundary converges on that latest canonical session.
- An explicitly ended or inactive session is not reused.
- A new session is allocated while the identity row is locked.
- Session number is `max(owner session_number) + 1` under that lock.
- `is_return_session` is true only when the new number is greater than one.
- Platform conflicts and foreign session IDs fail deterministically.
- `user_id`, environment, preview namespace, and test classification are
  derived internally.

The database environment is read from the trusted per-project
`app.settings.environment` PostgreSQL setting. A clean local database defaults
to `local`. Existing P07-created sessions retain the context originally derived
by the trusted telemetry endpoint.

## 7. Feed-instance uniqueness model

`ensure_feed_instance` requires an owned session and a terminal onboarding
state. It derives onboarding version and preference IDs from
`onboarding_states`; callers cannot submit preference or owner state.

Preference IDs are de-duplicated and sorted lexically before persistence.
`INSERT ... ON CONFLICT ON CONSTRAINT` against the new session/order unique key
makes Strict Mode and concurrent duplicate requests converge on the same feed
instance.

The returned restoration state includes feed ID, cursor, loaded depth,
qualified depth, exhaustion, order version, onboarding version, and canonical
preferences.

## 8. Deterministic ordering algorithm

Feed order version: `lr001-catalog-order-v1`.

Canonical documents define deterministic preference-aware hashing as an
architecture option but do not define an exact weighting algorithm. P11A
therefore introduces no unapproved weighting or ranking signal. It uses:

`active products → ORDER BY products.id ASC`

The stable canonical product UUID is the complete ordering key and tie-breaker.
Persisted membership freezes the returned order for that feed instance.
`random()`, insertion order, mutable display fields, and timestamps are not
ordering inputs.

## 9. Cursor model

Cursor version: `lr001-feed-cursor-v1`.

The token is a SHA-256 digest over the cursor version, feed UUID, and next
absolute position, prefixed with the public cursor version. It discloses no
feed, session, owner, token, credential, or position value.

No unmanaged signing secret was introduced. Tamper resistance comes from:

- strict version/shape validation;
- comparison with the database-owned `last_cursor`;
- the private `(feed_instance_id, request_cursor)` replay ledger;
- feed row ownership validation;
- rejection of unknown, future, stale, malformed, or foreign-feed tokens.

An earlier valid cursor replays its recorded batch. A new append accepts only
the current database-owned next cursor.

## 10. Batch append behavior

Default batch size is 24 and the LR-001 maximum is 24. Values outside `1..24`
fail with SQLSTATE `22023`.

`append_feed_batch`:

1. derives the owner;
2. locks the owned feed row;
3. replays an existing cursor request or validates the current cursor;
4. computes the next batch number inside the database;
5. selects active, not-yet-persisted products ordered by canonical UUID;
6. assigns contiguous absolute positions after `max_loaded_position`;
7. inserts membership under existing position/product uniqueness constraints;
8. determines whether any active product remains;
9. atomically updates `last_cursor`, `max_loaded_position`, and `is_exhausted`;
10. writes the private replay record;
11. returns ordered approved card fields with position and batch number.

Loaded cards never depend on offset pagination. The empty catalog produces one
replayable terminal batch with zero products.

## 11. Qualified-depth behavior

`record_qualified_feed_position` verifies:

- authenticated canonical owner;
- session/feed relationship;
- feed ownership;
- product membership;
- exact equality between supplied and persisted absolute position.

It locks the feed and applies:

`max_qualified_position = greatest(current, canonical_position)`

Repeated qualification is idempotent. Scroll-back cannot reduce depth.
Cross-user, foreign-session, foreign-product, and position-mismatch calls fail.

The feed membership uniqueness constraints provide the canonical
`(session_id, feed_instance_id, product_id)` key without a second impression
event table.

## 12. Telemetry ordering and atomicity decision

P11A does not create a second event ingestion path and does not alter P07.

P11 must first send `product_impression` through the P07 telemetry service and
call `record_qualified_feed_position` only when P07 returns `accepted` or
`duplicate`. A rejected/quarantined impression must not advance qualified
depth.

Telemetry acceptance and feed-depth persistence are two ordered transactions,
not atomic. A transient failure after telemetry acceptance can leave depth
behind its accepted impression; P11 retries the idempotent depth RPC. Data QA
continues to reconcile event maximum position against feed state. No atomicity
claim is made.

## 13. Concurrency controls

- Identity row `FOR UPDATE` serializes session allocation.
- Existing unique `(anonymous_user_id, session_number)` prevents duplicate
  session numbers.
- Feed session/order unique constraint converges duplicate feed ensure calls.
- Feed row `FOR UPDATE` serializes append and qualified-depth mutation.
- Feed membership primary/unique constraints prevent position and product
  duplication.
- Private request-cursor and batch-number uniqueness provide deterministic
  batch replay.
- Conflicting cursor reuse with another requested count fails.
- No client-side lock or check-then-insert race is trusted.

## 14. RLS and grant boundary

RLS remains enabled and unchanged for sessions, feeds, and feed membership.
Existing ownership-scoped SELECT policies remain unchanged.

- No INSERT, UPDATE, DELETE, or TRUNCATE grant was added to client roles.
- `PUBLIC` and `anon` execute are revoked for all four RPCs.
- Only `authenticated` receives the intended execute signatures.
- Events and quarantine remain directly inaccessible.
- The private schema, helpers, and replay ledger remain inaccessible.

## 15. Function-security review

All four client RPCs:

- are explicitly postgres-owned;
- use `SECURITY DEFINER`;
- set `search_path = ''`;
- schema-qualify every non-catalog object;
- contain no dynamic SQL;
- have one non-overloaded signature;
- return no owner identity;
- derive ownership from `auth.uid()`.

The three P11A private helpers are `SECURITY INVOKER`, postgres-owned, use an
empty search path, have reviewed volatility (`STABLE`, `IMMUTABLE`, `STABLE`),
and are explicitly revoked from client roles. Public mutating RPCs are
`VOLATILE`.

## 16. SQL test inventory

Created `supabase/tests/009_discover_feed_database_boundary.sql`.

It covers:

- function existence, security definer/invoker status, postgres ownership,
  volatility, empty search paths, no dynamic SQL, and unambiguous names;
- exact authenticated/PUBLIC/anon grants and private-schema denial;
- absence of ownership/trusted-context arguments;
- unauthenticated rejection for all four RPCs;
- two-user session ownership and test classification;
- repeated and concurrent-like session convergence;
- 30-minute return-session numbering;
- feed ownership, convergence, and deterministic preference snapshots;
- two-user feed read/mutation isolation;
- active catalog-only ordering and contiguous absolute positions;
- batch number, replay, conflicting limit, second page, duplicate/skip checks;
- malformed, stale, and foreign-feed cursors;
- exact loaded depth, last cursor, and exhaustion;
- membership and position validation for qualified depth;
- monotonic, repeated, and scroll-back qualification;
- cross-user qualification rejection;
- continued direct DML denial.

The suite inserts a deterministic test catalog extension inside its rolled-back
transaction and never depends on one exact active catalog count.

## 17. Existing test changes

Modified `supabase/tests/006_transactional_rpcs.sql` to add only the four
intended signatures to the exact authenticated RPC allow-list and to include
the new public/private functions in security and dynamic-SQL review.

No assertion was replaced with a raw function count and no previous suite was
weakened.

## 18. Validation commands and outcomes

| Command                                              | Outcome                                                                                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx.cmd supabase --version`                         | Passed: `2.109.1`; the sandboxed attempt could not update the user-profile telemetry file, then the unchanged command passed with permission. |
| `npm.cmd run format:check`                           | Passed after Prettier was applied only to this new handoff.                                                                                   |
| `npm.cmd run lint`                                   | Passed.                                                                                                                                       |
| `npm.cmd run typecheck`                              | Passed.                                                                                                                                       |
| `npm.cmd run test`                                   | Passed: 18 files and 97 tests.                                                                                                                |
| `npm.cmd run build`                                  | Passed; the sandboxed run could not fetch existing Google Fonts, then the unchanged command passed with network access.                       |
| `npx.cmd supabase db reset --local`                  | Blocked: Docker pipe `//./pipe/dockerDesktopLinuxEngine` was not found.                                                                       |
| `npx.cmd supabase db lint --local --fail-on warning` | Blocked: `LegacyDbConnectError`; local PostgreSQL was unavailable.                                                                            |
| `npx.cmd supabase test db`                           | Blocked: `LegacyDbConnectError`; local PostgreSQL was unavailable.                                                                            |
| `git diff --check`                                   | Passed in final validation with line-ending warnings only.                                                                                    |

## 19. Local Supabase runtime status

The workstation cannot start the disposable Supabase database because Docker
Desktop's Linux-engine pipe is absent. No unsafe workaround was attempted.
Migration application, PostgreSQL lint, and pgTAP runtime therefore remain
unverified locally.

Application formatting, lint, TypeScript, unit/integration tests, and production
build passed.

## 20. GitHub CI status

Configured but awaiting CI validation.

The existing authoritative database workflow must still prove:

1. clean reset and migration application;
2. strict database lint without warnings;
3. all existing and P11A pgTAP suites;
4. application formatting, ESLint, TypeScript, tests, and build.

P11A is not Complete and P11 is not unblocked until that workflow passes.

## 21. Cloud deployment status

- Cloud migrations deployed: None.
- Hosted development schema updated: No.
- Remote reset: not run.
- Remote push: not run.
- Remote seed push: not run.
- Supabase project linking: unchanged.

## 22. Security review

- No service-role credential or privileged browser client was added.
- No caller-controlled ownership, environment, or test flag is accepted.
- No direct state-table DML grant or permissive mutation policy was added.
- No generic CRUD or arbitrary SQL surface exists.
- Foreign sessions/feeds/products fail before mutation.
- Cursor payloads expose no ownership or secret data.
- Private ledger and helpers have no client access.
- Event and quarantine access remains unchanged.
- Existing migrations remain unchanged.

## 23. Known limitations

- Local SQL runtime is unavailable; CI remains authoritative.
- A hosted Supabase project that creates sessions through `ensure_session`
  requires its trusted `app.settings.environment` database setting. Clean local
  reset defaults to `local`; no hosted setting was changed in P11A.
- Telemetry acceptance and qualified-depth persistence are ordered but not
  atomic. P11 must retry depth persistence with the same canonical impression
  context after accepted/duplicate telemetry.
- The ordering baseline is deterministic catalog UUID order. It is not
  preference-ranked or personalized.
- Catalog changes during an unfinished feed can affect only not-yet-persisted
  membership; already persisted order never changes.

## 24. Exact changed-file list

Created:

- `supabase/migrations/20260724000300_discover_feed_database_boundary.sql`
- `supabase/tests/009_discover_feed_database_boundary.sql`
- `docs/engineering/implementation/P11A_DISCOVER_FEED_DATABASE_BOUNDARY_HANDOFF.md`

Modified:

- `supabase/tests/006_transactional_rpcs.sql`
- `docs/engineering/IMPLEMENTATION_STATUS.md`

## 25. Recommended next action

Run the authoritative GitHub database validation workflow. If and only if clean
reset, strict lint, all pgTAP suites, and application gates pass:

1. mark P11A Complete;
2. mark P11 unblocked;
3. begin P11 Discover UI/service implementation against these RPCs.

## 26. Suggested commit message

`feat(db): add ownership-safe Discover feed boundaries`

No commit or push was performed.
