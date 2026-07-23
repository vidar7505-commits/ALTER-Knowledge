# WP-006 Implementation Status

## Current package

`P04 — Core Database Migrations`

## Status

`Complete`.

The first authoritative LR-001 PostgreSQL migration foundation and real pgTAP
schema tests are implemented. The authoritative GitHub Actions
`Database infrastructure validation` workflow passed: its clean database reset
applied all four P04 migrations successfully, strict database lint passed, and
all three pgTAP suites passed.

Cloud migrations deployed: None.

## Implemented scope

- `pgcrypto`, the `analytics` schema, and canonical onboarding, Challenge, and
  environment enums.
- Identity/profile, onboarding, session, catalog, Wardrobe/save, Challenge,
  feed-instance, event, and quarantine persistence.
- Explicit primary keys, foreign keys, ownership-consistency keys, unique and
  partial-unique constraints, lifecycle checks, timestamps, and canonical query
  indexes.
- Shared updated-at behavior, immutable anonymous Auth mapping, and guarded
  onboarding/Challenge lifecycle transitions.
- pgTAP coverage for schema objects, columns/types, keys, constraints, valid
  inserts, invalid state rejection, ownership consistency, index presence, and
  seed independence.

## Explicitly deferred

- Anonymous Auth bootstrap and recovery behavior (`P05`).
- RLS activation/policies, grants, cross-user isolation, mutation RPCs, and
  application-role immutability enforcement (`P06`).
- Controlled telemetry ingestion, event-contract validation, quarantine routing,
  and reconciliation (`P07`/`P17`).
- Curated onboarding, Challenge, and product seed/import content (`P08`).
- Certified analytics views and hosted-development migration deployment.

## Validation status

- Repository checks: lint, typecheck, unit tests, and production build passed.
- GitHub database validation with P04: passed.
- Clean database reset in CI: passed; all four P04 migrations applied
  successfully.
- Strict database lint in CI: passed.
- pgTAP in CI: passed; all three suites passed.
- Workstation-local database validation remains unavailable because Docker
  Desktop's Linux engine is unavailable; CI supplied the authoritative runtime
  validation.
- Hosted development schema updated: No.

## Next action

P05 — Anonymous Identity is now unblocked. RLS activation/policies, grants,
cross-user isolation, mutation RPCs, and application-role immutability
enforcement remain deferred to P06. Any hosted-development deployment requires a
separate reviewed action.
