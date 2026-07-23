# WP-006 Implementation Status

## Current package

`P04 — Core Database Migrations`

## Status

`Configured but awaiting CI validation`.

The first authoritative LR-001 PostgreSQL migration foundation and real pgTAP
schema tests are implemented. Local runtime validation is blocked because Docker
Desktop's Linux engine is unavailable on this workstation. The GitHub Actions
`Database infrastructure validation` workflow remains the authoritative runtime
gate and has not yet run with the P04 migrations and SQL tests.

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
- Local clean reset: blocked by the missing Docker Desktop Linux-engine pipe.
- Local database lint and pgTAP: blocked because local PostgreSQL is unavailable.
- GitHub database validation with P04: pending.
- Hosted development schema updated: No.

## Next action

Run the unchanged `Database infrastructure validation` workflow with these P04
migrations and SQL tests. Do not mark P04 complete or begin dependent identity and
security packages until that workflow passes. Any hosted-development deployment
requires a separate reviewed action after CI success.
