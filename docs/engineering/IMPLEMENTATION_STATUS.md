# WP-006 Implementation Status

## Current package

`P09 — Application Shell`

## Status

`Configured but awaiting CI validation`.

The LR-001 application shell is implemented locally as one identity-aware
product layout, one typed three-destination navigation model, a safe-area-aware
mobile/tablet bottom navigation, an offset desktop rail, route-level content
boundaries, explicit identity loading/error recovery, shell offline indication,
and removable route placeholders.

All local completion gates pass: formatting, ESLint, TypeScript, 92
unit/component/integration tests, production build, 4 Playwright tests with one
worker, explicit visual review at canonical viewports, and
`git diff --check`. GitHub application CI has not run against this uncommitted
and unpushed P09 working tree.

Database changes: None.
Cloud migrations deployed: None.

## Implemented scope

- Shared `(product)` App Router layout with one shell render across primary
  routes.
- Canonical navigation order: Discover, Wardrobe, Challenge.
- One typed navigation model consumed by mobile and desktop renderers.
- Mobile/tablet bottom navigation through 1199 px, including safe-area
  clearance and non-obscured main content.
- Fixed 88 px desktop rail from 1200 px and expanded 200 px rail from 1600 px.
- Active route indication through `aria-current`, accent edge, surface change,
  and non-color marker.
- Existing P05 anonymous identity bootstrap consumed through one provider.
- Loading, ready, recoverable-error, and unrecoverable-error presentation.
- Explicit Retry only for recoverable identity failures.
- Offline, reconnection, and restored-online shell status without claiming
  durable offline support.
- Skip link, main landmark, route focus transfer, native keyboard order,
  visible focus, reduced motion, and unique navigation landmarks.
- Development-boundary placeholders for `/discover`, `/wardrobe`, and
  `/challenge`.
- Neutral root entry boundary pending P10 onboarding-status resolution; P09
  does not redirect around onboarding.
- Route loading and local error boundaries inside the preserved shell.
- Deterministic local E2E identity interception with no hosted credentials.

## Validation status

- `npm.cmd run format:check`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test`: passed, 17 files and 92 tests.
- `npm.cmd run build`: passed after the unchanged command received network
  access for the repository's existing Google Fonts.
- `npm.cmd run test:e2e -- --reporter=line --workers=1`: passed, 4 Chromium
  tests.
- Axe structural component validation: passed within the unit test command.
- Visual review: passed at M320, M390, T768, D1440, D1728, identity loading,
  and recoverable-error states; landscape, 1024 px, and 1200 px boundaries also
  passed behavioral inspection.
- `git diff --check`: passed with working-copy line-ending warnings only.
- Database validation: not run because P09 changes no database file.
- GitHub application CI with P09: pending.
- Hosted development schema updated: No.

## Explicitly deferred

- Onboarding UI, persistence, and entry routing (`P10`).
- Discover feed, ranking, continuation, telemetry, and scroll restoration
  (`P11`).
- Product Detail route and source-context behavior (`P12`).
- Wardrobe save/remove UI (`P13`).
- Outfit Challenge behavior (`P14`).
- Durable offline queues, cached feature content, and mutation recovery
  (`P16`).
- Certified analytics, dashboards, and reconciliation (`P17`).
- Release-wide accessibility certification and visual polish (`P18`).
- Production deployment and hosted configuration.

## Next action

Run GitHub application CI against P09. If it passes, mark P09 Complete and
proceed to `P10 — Onboarding`: implement the three-step onboarding flow and
persistence with complete, skip, and retry event validation.
