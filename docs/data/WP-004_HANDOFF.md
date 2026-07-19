# WP-004 — Data Foundation for Learning Release 001 Handoff

**Status:** Complete  
**Date:** 2026-07-19  
**Owner:** Data & Analytics

## Completed output:

Created an implementation-ready LR-001 behavioral data foundation covering:

- canonical event taxonomy and naming;
- typed event envelope and event-specific properties;
- Supabase anonymous-auth identity mapping;
- canonical onboarding and product state;
- 30-minute session boundary;
- return-session classification and D1/D3/D7 windows;
- qualified feed impressions at 50% visibility for 1,000 continuous milliseconds;
- feed-depth derivation and thresholds;
- Product, Wardrobe, and Outfit Challenge interaction/state models;
- event and state-transition versioning;
- Supabase/PostgreSQL persistence model;
- constraints, indexes, RLS boundaries, and idempotent RPC contracts;
- certified metric definitions;
- Product, Research, and Growth/source-quality dashboards;
- retention, validation, QA, reconciliation, and monitoring;
- future experiment-assignment readiness without active experiments;
- privacy restrictions excluding unnecessary personal and sensitive data.

## Assumptions:

- LR-001 uses Supabase Anonymous Auth and a stable mapping from `auth.users.id` to analytical anonymous identity.
- Supabase PostgreSQL is sufficient for release-scale event/state volume.
- Exactly one active Challenge definition exists at a time.
- Product records have stable canonical IDs and versioned metadata.
- Frontend and ingestion share generated typed event contracts.
- Production, staging, preview, automated QA, internal traffic, and test identities are separable.
- Primary return metric is D7; D1 and D3 are secondary.
- Session inactivity boundary is 30 minutes.
- Product impression qualification is 50% visibility for 1,000 continuous milliseconds.
- Raw production behavioral events have a provisional maximum 24-month retention pending privacy/legal review.

## Unresolved risks:

- Browser storage clearing can cause anonymous identity loss.
- Feed virtualization must preserve reliable visibility and absolute positions.
- Offline delivery can create late events; queue implementation must preserve IDs, sequences, and timestamps.
- Challenge slot/category taxonomy and catalog eligibility must be validated before seed sign-off.
- Small LR-001 cohorts may limit subgroup interpretation.
- Shared preview infrastructure requires deployment namespaces and cleanup.
- Retention duration requires legal/privacy confirmation before public scale.
- Source image/catalog quality can bias engagement independently of instrumentation quality.

## Files created or changed:

- `docs/data/EVENT_SPECIFICATION.md`
- `docs/data/DATABASE_SCHEMA.md`
- `docs/data/ANALYTICS_SPEC.md`
- `docs/data/DASHBOARD_SPEC.md`
- `docs/data/DATA_QUALITY.md`
- `docs/data/WP-004_HANDOFF.md`

## Recommended next action:

Engineering implementation must create migrations, typed telemetry contracts, secure anonymous identity mapping, transactional idempotent state RPCs, controlled event ingestion, certified SQL views, and executable Data QA checks. Before external release, Data and Engineering must run the complete staging journey checklist and treat any cross-user access, primary-state reconciliation mismatch, or Challenge completion mismatch as a release blocker.
