# WP-006 Implementation Status

## Current package

`P07 — Telemetry Foundation`

## Status

`Configured but awaiting CI validation`.

The LR-001 telemetry foundation is implemented locally as a typed, bounded
browser service, an authenticated Next.js ingestion route, a server-only
Supabase privileged adapter, and one forward-only database migration. The
database boundary resolves the analytical identity from a server-verified Auth
user, creates or validates the canonical session, derives environment, app
version, preview/test classification, validates all 40 version-1 events,
inserts valid events, quarantines invalid payloads with redaction, and provides
ordered per-item batch results.

Application formatting, ESLint, TypeScript, all 65 unit/integration tests,
production build, Playwright, and `git diff --check` pass. The new migration and
pgTAP suite still require the authoritative GitHub
`Database infrastructure validation` workflow before P07 can be marked
Complete.

Cloud migrations deployed: None.

## Implemented scope

- Canonical 40-name, version-1 event registry and typed property mapping.
- Strict runtime event, envelope, context, enum, UUID, numeric, timestamp, and
  size validation.
- A narrow `capture`, `captureBatch`, `flush`, and `dispose` telemetry API.
- Bounded 100-event in-memory buffering with ordered retry and immutable event
  IDs.
- Authenticated `POST /api/telemetry` application boundary.
- Service-role configuration isolated to a `server-only` module.
- Server-derived release, app version, environment, preview namespace, receipt
  time, analytical identity, upgraded user identity when present, and test
  classification.
- Server-only session ensure with canonical numbering and ownership checks.
- Equivalent event replay deduplication and deterministic conflicting-ID
  rejection.
- Ordered partial-failure batch semantics.
- Safe invalid-event quarantine with stable codes and recursive secret-key
  redaction.
- Deterministic in-memory database and transport test doubles.
- New behavior-first pgTAP telemetry suite.

## Explicitly deferred

- Product UI and feature event wiring (`P10`–`P15`).
- Durable browser/offline persistence beyond the bounded in-memory queue
  (`P16`).
- Certified analytics views, dashboards, and reconciliation jobs (`P17`).
- Catalog ingestion, feed ranking, external warehouses, streaming
  infrastructure, and machine learning.
- Production deployment or hosted-development migration application.

## Validation status

- Focused telemetry TypeScript/ESLint checks: passed.
- Focused telemetry tests: 4 files and 22 tests passed.
- Supabase CLI: `2.109.1`.
- Full formatting, ESLint, TypeScript, and `git diff --check`: passed.
- Full unit/integration tests: 11 files and 65 tests passed.
- Production build: passed after the unchanged command received network access
  for the repository's existing Google Fonts.
- Playwright: 1 Chromium test passed in 11.1 seconds after the sandboxed run
  timed out while its local server remained active.
- Workstation-local reset: blocked because
  `//./pipe/dockerDesktopLinuxEngine` was not found.
- Workstation-local database lint and pgTAP: blocked with
  `LegacyDbConnectError`; local PostgreSQL was unavailable.
- GitHub database validation with P07: not run; awaiting CI.
- Hosted development schema updated: No.

## Next action

Run the complete local validation matrix, record the exact workstation
Supabase outcomes, then submit the uncommitted change set for the unchanged
GitHub database validation workflow. Mark P07 Complete only after that workflow
passes clean reset, strict lint, all pgTAP suites, and application gates.
