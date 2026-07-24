# WP-006 P09 — Application Shell Handoff

## Status

`Configured but awaiting CI validation`.

The LR-001 application shell is implemented and validated locally. All required
formatting, lint, TypeScript, unit/component, production-build, Playwright, and
diff checks pass. Explicit visual review is complete at the canonical
viewports. This uncommitted local state has not been pushed, so GitHub
application CI has not validated P09.

Database changes: None.
Cloud migrations deployed: None.

## 1. Preflight result

- Repository root:
  `C:\ALTER_REPOSITORY_COMPLETE_WP006_READY\ALTER`.
- Git top level resolved to that same repository.
- `package.json`: present and readable.
- Initial Git working tree: clean.
- P08: explicitly `Complete`.
- Every required canonical input resolved to a readable file and was read in
  full before modification.
- No nested `AGENTS.md` exists.

## 2. Canonical files read

- `00_HQ/CONSTITUTION.md`
- `00_HQ/OPERATING_SYSTEM.md`
- `00_HQ/ROADMAP.md`
- `06_RELEASES/LR-001.md`
- `docs/product/LR-001_PRD.md`
- `docs/product/WP-002_HANDOFF.md`
- `docs/design/DESIGN_SYSTEM.md`
- `docs/design/LR-001_UX_SPEC.md`
- `docs/design/LR-001_SCREEN_INVENTORY.md`
- `docs/design/WP-003_HANDOFF.md`
- `docs/data/EVENT_SPECIFICATION.md`
- `docs/data/DATABASE_SCHEMA.md`
- `docs/data/ANALYTICS_SPEC.md`
- `docs/data/DASHBOARD_SPEC.md`
- `docs/data/DATA_QUALITY.md`
- `docs/data/WP-004_HANDOFF.md`
- `docs/engineering/FRONTEND_ARCHITECTURE.md`
- `docs/engineering/SUPABASE_IMPLEMENTATION.md`
- `docs/engineering/TESTING_STRATEGY.md`
- `docs/engineering/WP-006_IMPLEMENTATION_PLAN.md`
- `docs/engineering/IMPLEMENTATION_STATUS.md`
- `docs/engineering/implementation/P05_ANONYMOUS_IDENTITY_HANDOFF.md`
- `docs/engineering/implementation/P06_RLS_RPC_FOUNDATION_HANDOFF.md`
- `docs/engineering/implementation/P07_TELEMETRY_FOUNDATION_HANDOFF.md`
- `docs/engineering/implementation/P08_PRODUCT_CATALOG_HANDOFF.md`

## 3. Confirmed package name and scope

`WP-006 / P09 — Application shell`

The frozen implementation-plan objective is `mobile bottom nav, desktop rail,
boundaries`; required acceptance is `keyboard, responsive, visual`.

Implemented scope:

- root product application frame;
- one canonical navigation model;
- mobile/tablet bottom navigation;
- desktop navigation rail;
- route/content boundaries;
- existing anonymous identity bootstrap integration;
- identity loading, recoverable-error, and unrecoverable-error states;
- shell offline/reconnection indication;
- focus, keyboard, semantic, safe-area, viewport, and reduced-motion behavior;
- isolated development-boundary routes for the three primary destinations.

## 4. Shell architecture

```text
server RootLayout
  -> existing IdentityProvider
    -> server (product) route layout
      -> client AppShell identity/connectivity boundary
        -> identity loading/error gate
        -> ready application frame
          -> shared typed navigation model
            -> CSS-responsive BottomNavigation
            -> CSS-responsive DesktopRail
          -> route-focus manager
          -> main route-content boundary
```

The product layout and feature placeholders remain Server Components. Only
identity/connectivity state, route awareness, and navigation interaction are in
client components. No route duplicates the shell.

## 5. Route and layout structure

- `/` — neutral development boundary reserved for P10 entry-state resolution;
  it does not bypass onboarding with a temporary redirect.
- `/(product)/layout` — single shell boundary shared by all primary routes.
- `/discover` — removable P11 development boundary.
- `/wardrobe` — removable P13 development boundary.
- `/challenge` — removable P14 development boundary.
- `/(product)/loading` — route-level loading boundary inside the ready shell.
- `/(product)/error` — recoverable route error inside the preserved shell.

P10 owns onboarding state resolution and canonical first/return routing. P09
does not falsely represent onboarding as complete or choose a destination
before that state exists.

## 6. Navigation model

One typed immutable model is consumed by both navigation patterns:

1. Discover → `/discover`
2. Wardrobe → `/wardrobe`
3. Challenge → `/challenge`

There are no profile, settings, search, cart, notification, community, or other
invented destinations. Active matching supports a destination and its nested
routes without prefix collisions.

The canonical Design documents require Lucide-style icons but do not assign
specific navigation glyph names. P09 uses one consistent 1.75 px rounded-stroke
set: compass for Discover, bookmark for Wardrobe, and plus-in-frame for
Challenge. Icons are decorative to assistive technology because visible text is
always present.

## 7. Mobile bottom navigation

- Visible below the canonical 1200 px desktop breakpoint, including tablet and
  the previously ambiguous 1024–1199 px band.
- Fixed to the viewport bottom with a 64 px minimum content height.
- Adds `env(safe-area-inset-bottom)` without covering route content.
- Uses equal flexible destinations, 44 px-or-larger targets, visible labels,
  pressed feedback, focus rings, and hover only as an enhancement.
- Active state combines `aria-current="page"`, a 2 px accent edge, changed
  surface/text treatment, and a non-color dot marker.
- Validated at 320 × 700, 390 × 844, 768 × 1024, 844 × 390 landscape, and
  1024 × 768.

## 8. Desktop rail

- Appears at 1200 px and replaces the bottom navigation.
- Uses the canonical fixed 88 px rail at normal desktop widths.
- Expands to the existing 200 px token at 1600 px and above.
- Keeps complete labels visible at the 88 px width.
- Main content is offset by the exact rail token and never renders beneath it.
- Active state combines `aria-current`, surface change, accent edge, and dot.
- Validated at 1200 × 900, 1440 × 1024, and 1728 × 1117.

## 9. Identity integration

P09 consumes the existing P05 `IdentityProvider` once through
`useAnonymousIdentity()`. It does not call bootstrap directly, create a second
provider, or expose Supabase sessions or tokens.

State handling:

- `idle` and `loading` → branded resolution state;
- `ready` → application shell;
- `recoverable_error` → preserved-state assurance plus one explicit Retry;
- `unrecoverable_error` → configuration correction state with no retry loop.

The shell does not need the anonymous-user or Wardrobe UUID for rendering and
therefore does not propagate either further.

## 10. Loading and error/recovery behavior

- Identity loading uses stable full-viewport geometry, one polite status
  announcement, editorial heading, and a token-driven loading mark.
- Recoverable identity failure uses a blocking alert and native Retry button.
- Unrecoverable setup failure omits Retry and hides raw internal error details.
- Route loading remains inside the ready frame.
- Route errors preserve the application frame and offer a local Retry.
- Loading animation is static under reduced motion.

## 11. Offline boundary

P09 implements shell indication only, not P16 durable offline behavior.

- Browser APIs are read only in an effect after hydration.
- Going offline shows a persistent, pushing status banner.
- Ready navigation and already-rendered route content remain available.
- Reconnection announces `Back online.` once and clears after two seconds.
- Identity recovery copy remains distinct from the offline banner.
- No save queue, cached Wardrobe claim, background synchronization, or full
  offline capability is represented.

## 12. Accessibility behavior

- Unique `Primary mobile navigation` and `Primary desktop navigation`
  landmarks avoid duplicate-label ambiguity.
- All navigation destinations are named links with visible text.
- Active links use `aria-current="page"`.
- One `main` landmark and one shell-level route `h1` are present.
- `Skip to main content` becomes visible on keyboard focus.
- Global 2 px accent focus ring and 2 px offset apply to all controls.
- Active state is not color-only.
- Targets meet the canonical 44 × 44 px minimum.
- Loading and reconnection use polite status announcements; blocking identity
  failures use alerts.
- No icon-only interactive control exists.
- Axe component review reports no structural violations.

## 13. Keyboard behavior

- Tab and Shift+Tab use native link/button order; no arrow-key override exists.
- Enter activates navigation links; Space retains native button activation.
- The skip link moves focus to `#main-content`.
- Primary route transitions focus the preserved main region without scrolling.
- Focus remains visible on mobile external-keyboard and desktop paths.
- There is no focus trap and no shell Escape behavior because P09 adds no
  dismissible shell UI.

## 14. Responsive behavior

- Mobile first, minimum supported width 320 px.
- Bottom navigation remains through 1199 px; rail begins at 1200 px.
- Tablet has no separate information architecture.
- Layout uses `100dvh`/`100svh` roles and safe-area variables.
- Route content includes navigation clearance at mobile/tablet widths.
- Desktop content is offset by 88 px or 200 px exactly with the rail.
- Global horizontal overflow is clipped defensively; E2E additionally proves
  document scroll width never exceeds client width at tested viewports.
- Orientation changes preserve usable navigation and content.

## 15. Design-token usage

P09 uses the P02 runtime tokens for typography, colors, spacing, borders,
radius, elevation, motion, focus, breakpoints, header/nav sizing, content
width, and z-index. It adds only the missing semantic
`--safe-area-top: env(safe-area-inset-top, 0px)` alongside the existing bottom
safe-area token.

No parallel palette, spacing scale, radius system, breakpoint, dark theme, or
animation framework was added. Development boundary visuals use only canonical
paper, ink, border, signal, serif, and UI-font roles.

## 16. Telemetry behavior

None. No navigation or generic shell event exists in the canonical
`EVENT_SPECIFICATION.md`. P09 does not invent event names, block navigation on
delivery, or wire partial session telemetry.

## 17. Unit/component test inventory

New tests cover:

- exact navigation labels, order, destinations, and icon keys;
- nested active-route matching without prefix collision;
- both responsive patterns consuming the same model;
- accessible link names and unique landmarks;
- `aria-current` on only the active destination;
- skip-link/main association;
- loading state without premature navigation;
- ready shell;
- recoverable Retry behavior;
- unrecoverable state without retry or raw internal details;
- ready shell preserved while offline;
- axe structural accessibility;
- isolated development-boundary copy without fake feature state;
- safe-area, rail, bottom-nav, and reduced-motion CSS contracts;
- neutral root entry behavior that does not bypass onboarding.

The existing P05 Strict Mode test continues to prove one anonymous sign-in and
one provisioning call across duplicate React effects.

Final full Vitest result: 17 files and 92 tests passed.

## 18. E2E test inventory

Four Chromium tests use deterministic network interception for anonymous Auth
and identity provisioning; no hosted Supabase or secret is required.

Coverage includes:

- narrow and standard mobile shell;
- tablet, landscape, and 1024 px boundary;
- desktop and wide desktop rail behavior;
- correct responsive navigation visibility;
- canonical link focus and basic route navigation;
- current-page announcement;
- skip-link keyboard behavior;
- Shift+Tab reversal and Enter activation;
- focus transfer after route transition;
- mobile bottom clearance and desktop rail offset;
- no horizontal overflow;
- reduced-motion computation;
- offline, reconnection, and retained navigation;
- identity loading and recoverable-error rendering.

Final result: 4 tests passed with one worker.

## 19. Visual-validation results

Reviewed generated full-page captures in `test-results/` at:

- 320 × 700 narrow mobile;
- 390 × 844 standard mobile;
- 768 × 1024 tablet;
- 1440 × 1024 desktop;
- 1728 × 1117 wide desktop;
- 390 × 844 identity loading;
- 390 × 844 recoverable identity error.

Also behaviorally inspected 844 × 390 landscape, 1024 × 768, and
1200 × 900.

Review found and corrected duplicate landmark labels, 88 px rail label
wrapping, development-toolbar focus/visual interference, and loading-boundary
capture timing. Final review shows no content/nav overlap, clipping, horizontal
scroll, unsafe bottom placement, rail underlap, broken label, or unstable
loading/error geometry. Typography, icon alignment, active-state clarity,
focus behavior, and spacing match the approved token system.

## 20. Validation commands and exact outcomes

| Command                                               | Outcome                                                                                                                                                                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run format:check`                            | Passed; all matched files use Prettier style.                                                                                                                                                                                                 |
| `npm.cmd run lint`                                    | Passed.                                                                                                                                                                                                                                       |
| `npm.cmd run typecheck`                               | Passed.                                                                                                                                                                                                                                       |
| `npm.cmd run test`                                    | Passed: 17 files and 92 tests.                                                                                                                                                                                                                |
| `npm.cmd run build`                                   | Passed; the sandboxed attempt could not fetch the repository's existing Google Fonts, then the unchanged command passed with approved network access. The route table contains root, fallback, telemetry, and all three primary destinations. |
| `npm.cmd run test:e2e -- --reporter=line --workers=1` | Passed: 4 Chromium tests with deterministic local identity interception and no hosted credentials. The sandboxed attempt timed out while the local dev server/browser was active; the unchanged command passed outside that restriction.      |
| `git diff --check`                                    | Passed; Git emitted working-copy line-ending warnings only.                                                                                                                                                                                   |

`package.json` defines no separate accessibility or component-test command.
Axe component checks run inside `npm.cmd run test`.

## 21. Database-change status

- Database changes: None.
- Migration files changed: None.
- Remote database commands: not run.
- Existing database validation is not a new P09 completion gate.

## 22. Local runtime status

- Static production build: passed.
- Local Next.js/Chromium shell runtime: passed.
- Deterministic anonymous identity bootstrap in E2E: passed.
- Responsive route navigation and focus behavior: passed.
- No local or hosted Supabase runtime was required.

## 23. GitHub CI status

`Configured but awaiting CI validation`.

The repository application workflow exists, but this uncommitted and unpushed
P09 working tree has not run in GitHub Actions. No CI pass is claimed.

## 24. Cloud deployment status

- Cloud deployment: None.
- Cloud migrations deployed: None.
- Hosted development schema updated: No.
- Remote reset, migration push, seed push, and project linking: not run.

## 25. Security review

- Browser shell receives no access token, refresh token, raw Supabase session,
  service-role value, or privileged client.
- Identity remains owned by the existing P05 singleton/provider boundary.
- No owner UUID is accepted from navigation or route state.
- E2E uses obvious local-only fake values supplied by Playwright and intercepted
  before any network service.
- No secret configuration was added to application code.
- Raw identity error messages are not rendered.
- Browser APIs are isolated to client effects and are not read during SSR.
- No migration, RLS, RPC, telemetry, or catalog security boundary changed.

## 26. Scope review

Implemented only the application frame, navigation, route boundaries, identity
state presentation, offline shell indication, accessibility/keyboard behavior,
responsive styling, tests, visual review, and documentation.

Not implemented:

- onboarding flow or persistence;
- Discover products, ranking, pagination, impressions, or continuation;
- Product Detail route behavior;
- Wardrobe save/remove state;
- Challenge start, selection, or completion;
- durable offline mutation or telemetry queues;
- dashboards, analytics views, or new telemetry contracts;
- production deployment or hosted configuration.

No frozen Product, Design, Data, Engineering Foundation, Release, ADR, P04–P08
migration, RLS, RPC, catalog, or telemetry decision was modified.

## 27. Known limitations

- P10 must replace the neutral root development boundary with
  onboarding-status-aware first/return entry resolution.
- Product Detail and Challenge picker shell suppression/return behavior remain
  with their owning feature packages because those routes do not yet exist.
- Offline indication does not imply mutation queuing or cached feature content;
  P16 owns durable recovery.
- CI is pending because no commit or push was authorized.

## 28. Deferred feature work

- P10: onboarding and entry-state routing.
- P11: Discover feed, continuation, ranking, and restoration.
- P12: Product Detail and source-context return.
- P13: Wardrobe state and removal UI.
- P14: Outfit Challenge.
- P16: durable offline/recovery.
- P18: release-wide accessibility and visual polish.

## 29. Recommended next package

First run the application CI workflow against the P09 change and close P09 as
Complete if it passes. Then proceed to:

`P10 — Onboarding`

Frozen P10 scope: three-step flow and persistence, with
complete/skip/retry-event validation.

## 30. Exact changed-file list

Created:

- `src/app/(product)/challenge/page.tsx`
- `src/app/(product)/discover/page.tsx`
- `src/app/(product)/error.tsx`
- `src/app/(product)/layout.tsx`
- `src/app/(product)/loading.tsx`
- `src/app/(product)/wardrobe/page.tsx`
- `src/components/shell/app-shell.test.tsx`
- `src/components/shell/app-shell.tsx`
- `src/components/shell/navigation-icon.tsx`
- `src/components/shell/navigation.test.ts`
- `src/components/shell/navigation.ts`
- `src/components/shell/primary-navigation.tsx`
- `src/components/shell/route-placeholder.module.css`
- `src/components/shell/route-placeholder.test.tsx`
- `src/components/shell/route-placeholder.tsx`
- `src/components/shell/shell.module.css`
- `tests/e2e/identity-mock.ts`
- `tests/e2e/shell.spec.ts`
- `docs/engineering/implementation/P09_APPLICATION_SHELL_HANDOFF.md`

Modified:

- `next.config.ts`
- `playwright.config.ts`
- `src/app/globals.css`
- `src/app/page.test.tsx`
- `src/app/page.tsx`
- `src/styles/tokens.css`
- `src/styles/tokens.test.ts`
- `docs/engineering/IMPLEMENTATION_STATUS.md`

Deleted:

- `tests/e2e/health.spec.ts` — superseded by behavior-level shell E2E coverage.

## 31. Suggested commit message

`feat(shell): add responsive application frame`
