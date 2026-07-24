# WP-006 Implementation Status

## Current package

`P11A — Discover Feed Database Boundary`

## Status

Complete

P10 remains Complete. P11A provides validated forward-only, ownership-safe database
boundaries for session recovery, feed-instance recovery, deterministic batch
persistence, cursor/loaded-depth state, and qualified-depth persistence.
The authoritative GitHub `Database infrastructure validation` workflow passed,
so **P11 — Discover is Ready (unblocked)**. P11 remains unimplemented.

Database changes: validated by CI.
Cloud migrations deployed: None.
Hosted development schema updated: No.
Remote reset: not run.
Remote migration push: not run.
Remote seed push: not run.

## Validation status

- `npm.cmd run format:check`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test`: passed, 18 files and 97 tests.
- `npm.cmd run build`: passed with network access for the existing Google Fonts.
- `npx.cmd supabase --version`: passed, `2.109.1`.
- `npx.cmd supabase db reset --local`: blocked because the Docker Desktop Linux
  engine pipe is absent.
- `npx.cmd supabase db lint --local --fail-on warning`: blocked because local
  PostgreSQL is unavailable.
- `npx.cmd supabase test db`: blocked because local PostgreSQL is unavailable.
- `git diff --check`: passed (line-ending normalization warnings only).
- GitHub database CI: passed.
- Clean database reset: passed.
- Migration application: passed; all migrations, including P11A, applied
  successfully.
- Strict database lint: passed with no warnings.
- pgTAP: passed; all suites, including P11A, passed.
- Cloud deployment: None; no remote commands were run.

## Validated P11A scope

- `ensure_session` with Auth-derived ownership, 30-minute recovery, serialized
  session numbering, return classification, and server-owned environment/test
  context.
- `ensure_feed_instance` with terminal-onboarding snapshots, deterministic
  preference ordering, and one feed per session/order version.
- `append_feed_batch` with a 24-item maximum, active catalog `product.id`
  ordering, contiguous database-owned positions, database-owned batch numbers,
  opaque versioned cursors, exact replay, and atomic loaded-depth/exhaustion
  updates.
- `record_qualified_feed_position` with owned session/feed/product membership
  validation and monotonic qualified depth.
- Private cursor/replay helpers and a private batch request ledger.
- New pgTAP coverage plus the updated exact authenticated RPC allow-list.

## Explicitly deferred

- Discover UI, browser service wiring, visibility observation, and telemetry
  orchestration (`P11`).
- Product Detail (`P12`), Wardrobe (`P13`), Challenge (`P14`), continuation
  (`P15`), durable offline recovery (`P16`), analytics QA (`P17`), release
  polish (`P18`), and production deployment.

## Security and scope review

No direct session/feed table DML grant, caller-controlled owner field,
service-role credential, existing migration edit, UI change, remote reset,
project link, or deployment was introduced. All four RPCs derive ownership from
`auth.uid()`, fix an empty `search_path`, and grant execution only to
`authenticated` on the approved signatures. `PUBLIC` and `anon` execution
remain revoked. Browser feed-table DML remains denied: there is no service-role
use and no direct client mutation. Catalog ordering remains deterministic, the
private cursor replay ledger remains authoritative, and qualified depth remains
monotonic. No ranking model was introduced.

## Next action

Proceed to **P11 — Discover**, now Ready (unblocked), with the plan-frozen scope:
deterministic feed and cursor behavior, pagination, restoration, visibility,
and qualified impressions. Do not treat P11 as Complete. P12 and later feature
packages remain deferred.
