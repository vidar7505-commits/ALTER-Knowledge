# A L T E R . — Deployment and Operations

## 1. Deployment model

Vercel hosts Next.js. Supabase hosts Auth, PostgreSQL, and Storage. Local/test use Supabase CLI. Preview, staging, and production use isolated persistent projects; preview shares a synthetic-only project to control cost.

## 2. Promotion

1. Pull request checks pass.
2. Preview deployment receives smoke tests.
3. Merge to main deploys staging.
4. Migrations apply to staging before app promotion.
5. Full critical journey, RLS, telemetry, accessibility, and visual QA pass.
6. Tagged release applies production migration.
7. Production app deploy follows.
8. Automated smoke and reconciliation checks run.
9. Rollback uses previous app deployment; database rollback uses a forward corrective migration, never down-migration on production data.

## 3. Feature flags

Flags are server-evaluated environment configuration for operational disablement only: challenge entry, telemetry submission, continuation cue. Flags may not create unapproved product variants. Every flag has owner, default, removal date, and telemetry tag.

## 4. Observability

- Frontend/server exceptions: error reporting with release and route tags.
- Structured server logs: request ID, operation ID, result class, latency; no event properties or tokens.
- Supabase: connection use, slow queries, lock waits, storage failures, Auth failures.
- Mutation monitors: failure rate, conflict rate, p95 latency, replay rate.
- Telemetry: accepted, duplicate, rejected, quarantined, queue age.
- Release health: core journey success, save consistency, challenge completion RPC success, return restoration success.

Alert thresholds:
- mutation error rate > 2% for 10 min;
- event rejection > 1% for 15 min;
- database p95 > 500 ms for primary queries;
- Auth anonymous sign-in failures > 1%;
- core E2E synthetic failure twice consecutively.

## 5. Internal traffic

All non-production environments are non-eligible. Production internal testers use an allow-listed hashed identifier or JWT metadata set server-side to `is_test=true`. Clients cannot unset this value.

## 6. Operational runbooks

Maintain runbooks for Auth outage, Supabase database degradation, failed migration, event-ingestion backlog, catalog asset failure, identity mapping fault, and accidental service-role exposure.

## 7. Security operations

Rotate exposed secrets immediately, invalidate deployments containing them, review access logs, and execute incident documentation. Dependency scanning and secret scanning run on every PR and weekly on main.
