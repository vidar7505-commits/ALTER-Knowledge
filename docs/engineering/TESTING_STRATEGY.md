# A L T E R . — LR-001 Testing Strategy

## 1. Stack

- Unit/component: Vitest, React Testing Library, MSW.
- Browser/E2E/accessibility: Playwright and axe-core.
- Database/RLS/RPC: pgTAP executed against Supabase local.
- Visual regression: Playwright screenshots.
- Contract: generated Zod fixtures and SQL validation tests.

## 2. Test layers

### Unit
Cursor encoding, session boundary, event builders, reducers, visibility timer, eligibility rules, continuation priority, error mapping.

### Component
All design-system states, keyboard operation, announcements, optimistic rollback, image failure, reduced motion.

### Integration
Server Actions against local Supabase, Auth session restoration, route loaders, event endpoint, offline queue replay.

### Database
Migrations, constraints, triggers, immutable completions, operation replay, transaction rollback, indexes for primary queries.

### RLS
For two anonymous identities, prove no cross-user select, insert, update, RPC mutation, or indirect child access. Prove public catalog read and denied private event read.

### End-to-end
Automated release-blocking journey:

`Open → Onboard/Skip → Browse → Open Product Detail → Save → Wardrobe → Start Challenge → Select four valid items → Complete → Exit → advance beyond 30 minutes → Return → Resume/revisit`

Also run variants for skip, offline save retry, failed pagination, challenge version mismatch, removed challenge dependency, identity loss, and telemetry outage.

## 3. Qualified impression tests

- 49% for 2 s: no event.
- 50% for 999 ms: no event.
- 50% for 1,000 ms foreground: one event.
- 60% for 700 ms, drop, 700 ms: no event.
- background during timer: cancel.
- remount same product/feed/session: no duplicate.
- same product in new feed instance: eligible.
- fetched but never rendered: no event.
- depth equals maximum qualified absolute position only.

## 4. Data QA execution matrix

| Check | CI | Staging | Post-deploy | Daily | Pre-release |
|---|---:|---:|---:|---:|---:|
| schema rejection fixtures | yes | yes | sample | yes | yes |
| duplicate success events | yes | yes | yes | yes | yes |
| state/event reconciliation | yes | yes | sample | yes | yes |
| save consistency | yes | yes | sample | yes | yes |
| challenge reconstruction | yes | yes | sample | yes | yes |
| completion immutability | yes | yes | no | weekly | yes |
| missing impressions | component | yes | sample | yes | yes |
| invalid feed depth | yes | yes | yes | yes | yes |
| staging exclusion | yes | yes | yes | yes | yes |
| offline preservation | yes | yes | no | sample | yes |
| timestamp consistency | yes | yes | yes | yes | yes |

Primary-journey reconciliation mismatch is a release blocker.

## 5. CI gates

Formatting, ESLint, TypeScript, unit tests, component tests, build, migration reset, pgTAP/RLS/RPC tests, telemetry contracts, axe checks, critical E2E, and designated visual snapshots. No gate may be bypassed on production promotion without a recorded HQ exception.
