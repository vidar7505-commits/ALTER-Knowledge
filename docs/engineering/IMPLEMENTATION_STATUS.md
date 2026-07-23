# WP-006 Implementation Status

## Current package

`P05 — Anonymous Identity`

## Status

`Configured but awaiting CI validation`.

The LR-001 anonymous identity foundation is implemented. The browser reuses or
recovers a Supabase Auth session, creates an anonymous session when required,
provisions the canonical analytical identity and Wardrobe through one narrowly
scoped `auth.uid()`-derived RPC, and exposes explicit ready and error states.
Application checks pass. The new migration and pgTAP suite still require the
authoritative GitHub Actions `Database infrastructure validation` workflow.

Cloud migrations deployed: None.

## Implemented scope

- Browser-safe Supabase client using only the public URL and anon key.
- Existing-session reuse, anonymous sign-in, invalid-session refresh and
  local-only replacement recovery.
- Shared in-flight bootstrap protection for concurrent calls and React Strict
  Mode.
- Typed identity provider and hook with `idle`, `loading`, `ready`,
  `recoverable_error`, and `unrecoverable_error` states.
- Minimal `ensure_anonymous_identity()` security-definer RPC deriving ownership
  from `auth.uid()` and returning only the canonical anonymous identity and
  Wardrobe IDs.
- Deterministic application tests and pgTAP coverage for session flows,
  concurrency, error states, idempotent provisioning, execution grants, and
  duplicate-row prevention.

## Explicitly deferred

- RLS activation/policies, grants, cross-user isolation, mutation RPCs, and
  application-role immutability enforcement (`P06`).
- Controlled telemetry ingestion, event-contract validation, quarantine routing,
  and reconciliation (`P07`/`P17`).
- Curated onboarding, Challenge, and product seed/import content (`P08`).
- Certified analytics views and hosted-development migration deployment.

## Validation status

- Application lint, typecheck, unit/integration tests, production build, and
  Playwright smoke test passed.
- Unit/integration tests: 7 files and 43 tests passed.
- Workstation-local database reset is blocked because the Docker Desktop Linux
  engine pipe is absent.
- Workstation-local database lint and pgTAP are blocked because local PostgreSQL
  is unavailable.
- GitHub database validation with the P05 migration and SQL test: pending.
- Hosted development schema updated: No.

## Next action

Run the unchanged `Database infrastructure validation` workflow with the P05
migration and SQL test. Mark P05 complete only after clean reset, strict database
lint, and all pgTAP suites pass. P06 RLS/RPC Foundation remains blocked on that
result, and any hosted-development deployment requires a separate reviewed
action.
