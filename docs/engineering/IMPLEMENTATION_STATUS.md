# WP-006 Implementation Status

## Current package

`P11A — Discover Feed Database Boundary`

## Status

Configured but awaiting CI validation

P10 remains Complete. P11A now configures forward-only, ownership-safe database
boundaries for session recovery, feed-instance recovery, deterministic batch
persistence, cursor/loaded-depth state, and qualified-depth persistence.
P11 — Discover remains **Blocked by database boundary** until the authoritative
GitHub database workflow applies the migration and passes strict lint plus all
pgTAP suites.

Database changes: One new forward-only P11A migration.
Cloud migrations deployed: None.
Hosted development schema updated: No.
Remote reset: not run.
Remote push: not run.
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
- GitHub database CI: configured but awaiting CI validation.
- Cloud deployment: None; no remote commands were run.

## Configured P11A scope

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
`authenticated`. Catalog ordering is deterministic and introduces no ranking
model.

## Next action

Run the authoritative GitHub database validation workflow. Mark P11A Complete
and unblock **P11 — Discover** only after clean reset, strict lint, all pgTAP
suites, and application gates pass.
