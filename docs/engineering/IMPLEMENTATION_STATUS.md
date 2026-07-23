# WP-006 Implementation Status

## Current package

`P06 — RLS and RPC Foundation`

## Status

`Configured but awaiting CI validation`.

The LR-001 authorization and transactional mutation foundation is implemented
in two forward-only migrations. All 15 public domain tables have RLS enabled;
authenticated reads are limited to caller-owned state plus active catalog and
Challenge definitions; client-role direct DML is revoked; events, quarantine,
and private operation infrastructure are inaccessible. Eight transactional
mutation RPCs derive ownership from `auth.uid()` and use a private operation
ledger for deterministic idempotency and conflict rejection.

Application formatting, ESLint, TypeScript, all 43 unit/integration tests,
production build, Playwright, and `git diff --check` passed. The workstation
cannot run the disposable Supabase stack because Docker Desktop's Linux-engine
pipe is absent. Local reset, database lint, and pgTAP therefore remain blocked.
P06 must not be marked Complete until the GitHub `Database infrastructure
validation` workflow applies both migrations and passes all six pgTAP suites.

Cloud migrations deployed: None.

## Implemented scope

- RLS enabled on all 15 public LR-001 domain tables.
- Caller-owned SELECT policies for identity, onboarding, sessions, Wardrobe,
  save history, Challenge state/history, and feed state.
- Authenticated read-only access to active products and the active Challenge
  definition.
- No client access to raw events, event quarantine, or private mutation
  infrastructure.
- No direct client DML on any public domain table.
- Transactional RPCs for onboarding completion/skip, Wardrobe save/remove,
  Challenge start/select/remove/complete.
- Global operation-ID ledger with request fingerprints, canonical replay, and
  deterministic conflict rejection.
- Atomic Wardrobe removal cleanup for incomplete Challenge dependencies.
- Immutable completion snapshots and client-role UPDATE/DELETE denial.
- Two-user pgTAP fixtures covering behavioral RLS and cross-user mutation
  denial.
- Security catalog tests for function owner, `security definer`, fixed
  `search_path`, grants, private helpers, and ownership-free signatures.

## Explicitly deferred

- Trusted telemetry/session ingestion and event validation (`P07`).
- Feed-instance creation, recovery, and pagination mutations (`P07`/`P11`).
- Curated onboarding, Challenge, and product seed/import content (`P08`).
- Feature UI and application RPC consumers (`P10`–`P14`).
- Certified analytics views and hosted-development migration deployment.

## Validation status

- Supabase CLI: `2.109.1`.
- Formatting, ESLint, TypeScript, and `git diff --check`: passed.
- Unit/integration tests: 7 files and 43 tests passed.
- Production build: passed after the unchanged command received network access
  for the repository's existing Google Fonts.
- Playwright: 1 Chromium test passed in 13.6 seconds after the sandboxed run
  timed out while its local server was active.
- Workstation-local database reset: blocked because
  `//./pipe/dockerDesktopLinuxEngine` was not found.
- Workstation-local database lint and pgTAP: blocked because local PostgreSQL
  was unavailable.
- GitHub database validation with P06: pending; no commit or push was made.
- Hosted development schema updated: No.

## Next action

Review and commit P06, then let the existing `Database infrastructure
validation` workflow run on a pull request or by an authorized manual dispatch.
Mark P06 Complete only after clean reset, strict database lint, and all six
pgTAP suites pass. P07 telemetry remains blocked until that result.
