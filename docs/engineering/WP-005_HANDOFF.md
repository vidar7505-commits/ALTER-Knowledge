# WP-005 — Engineering Foundation Handoff

## Completed output:

Created an implementation-ready engineering foundation for LR-001 covering system and frontend architecture, Supabase implementation, anonymous identity, RLS, mutations, idempotency, telemetry, sessions, deterministic feed, qualified impressions, design-system implementation, accessibility, recovery, testing, Data QA, security, performance, observability, deployment, CI/CD, AI-assisted development, WP-006 sequencing, and seven ADRs.

## Canonical engineering decisions:

- Single Next.js App Router application on Vercel.
- Supabase anonymous Auth is the authorization root.
- PostgreSQL and RPCs are canonical for product-state mutations.
- State success events are inserted transactionally by mutation RPCs.
- Client observations use a Next.js ingestion endpoint plus PostgreSQL RPC.
- No global client state library.
- Deterministic persisted feed instances with opaque cursor pagination.
- Dedicated `start_operation_id` for challenge-start idempotency.
- CSS/Tailwind implementation preserves approved Design tokens.
- Separate staging and production Supabase projects.

## Assumptions:

- Supabase anonymous sign-in is enabled in all LR-001 environments.
- Catalog assets are curated and cover all challenge slots.
- Vercel and Supabase are acceptable deployment vendors.
- Instrument Serif, Inter, and Lucide remain approved.
- Exactly one active challenge definition exists.

## Required schema corrections:

- Map each analytic anonymous user to immutable `auth.users.id`.
- Add canonical onboarding-state persistence.
- Add unique challenge `start_operation_id` and completion operation ID.
- Derive identity/environment/test flags server-side for telemetry.
- Enforce append-only completed challenge snapshots.
- Add continuation dismissal persistence only if Product confirms cross-session dismissal.

## Unresolved risks:

- Source image quality may undermine approved visual quality.
- Shared preview Supabase can create test collisions unless namespaces are enforced.
- Browser storage clearing causes anonymous identity loss.
- Offline mutation conflict behavior requires staging device testing.
- Catalog slot eligibility remains a release dependency.
- Provisional 24-month retention requires privacy review.

## Files created or changed:

- `docs/engineering/SYSTEM_ARCHITECTURE.md`
- `docs/engineering/FRONTEND_ARCHITECTURE.md`
- `docs/engineering/SUPABASE_IMPLEMENTATION.md`
- `docs/engineering/SECURITY_AND_RLS.md`
- `docs/engineering/TELEMETRY_IMPLEMENTATION.md`
- `docs/engineering/TESTING_STRATEGY.md`
- `docs/engineering/DEPLOYMENT_AND_OPERATIONS.md`
- `docs/engineering/AI_DEVELOPMENT_PROTOCOL.md`
- `docs/engineering/WP-006_IMPLEMENTATION_PLAN.md`
- `docs/engineering/WP-005_HANDOFF.md`
- seven ADRs under `docs/decisions/engineering/`

## WP-006 implementation order:

P01 repository → P02 tokens → P03 Supabase local → P04 migrations → P05 identity → P06 RLS/RPC → P07 telemetry → P08 catalog → P09 shell → P10 onboarding → P11 Discover → P12 Detail → P13 Wardrobe → P14 Challenge → P15 continuation → P16 recovery → P17 Data QA → P18 accessibility/visual → P19 hardening.

## Recommended next action:

Open WP-006 with P01–P07 as the protected technical critical path. Do not begin feature persistence before anonymous identity, RLS, and transactional RPC foundations pass automated two-user isolation tests.
