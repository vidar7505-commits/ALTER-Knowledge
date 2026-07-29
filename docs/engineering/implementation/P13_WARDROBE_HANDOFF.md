# P13 — Wardrobe Handoff

## Status

`Configured but awaiting CI validation`.

P13 local implementation, unit/component validation, production build,
one-worker Playwright E2E, accessibility checks, and visual certification are
complete. GitHub application CI has not yet run for this uncommitted working
tree, so P13 is not marked Complete.

## 1. Preflight

- Repository root:
  `C:\ALTER_REPOSITORY_COMPLETE_WP006_READY\ALTER`.
- `package.json`: present and readable.
- Branch: `main`.
- Initial working tree: clean.
- A fresh `git fetch origin main --prune` completed.
- `HEAD`, `origin/main`, and `FETCH_HEAD` were all
  `b5038d31a62744292873e17c5b598248658d7e7b`.
- P12: Complete.
- P13: Ready (unblocked).
- Package: P13 — Wardrobe.
- Objective: canonical saved grid and removal.
- Dependencies: P06, P09, P12.
- Acceptance: cross-surface consistency and Undo.
- Commit boundary: `feat(wardrobe)`.
- No nested `AGENTS.md` exists.

## 2. Canonical inputs

All canonical inputs named by the assignment were resolved and read completely:

- HQ/release: `CONSTITUTION.md`, `OPERATING_SYSTEM.md`, `ROADMAP.md`,
  `LR-001.md`.
- Product: `LR-001_PRD.md`, `WP-002_HANDOFF.md`.
- Design: `DESIGN_SYSTEM.md`, `LR-001_UX_SPEC.md`,
  `LR-001_SCREEN_INVENTORY.md`, `WP-003_HANDOFF.md`.
- Data: `EVENT_SPECIFICATION.md`, `DATABASE_SCHEMA.md`, `ANALYTICS_SPEC.md`,
  `DASHBOARD_SPEC.md`, `DATA_QUALITY.md`, `WP-004_HANDOFF.md`.
- Engineering: `FRONTEND_ARCHITECTURE.md`, `SUPABASE_IMPLEMENTATION.md`,
  `TESTING_STRATEGY.md`, `WP-006_IMPLEMENTATION_PLAN.md`,
  `IMPLEMENTATION_STATUS.md`.
- Prior implementation handoffs: P06, P07, P08, P09, P10, P11, and P12.

## 3. Confirmed scope

Implemented only the canonical `/wardrobe` route, active saved-product grid,
saved count, recent-first ordering, Product Detail navigation, remove, Undo,
cross-surface canonical refresh, registered telemetry, and required
loading/empty/error/unavailable states.

Excluded: Challenge UI or slot assignment, Discover ranking changes,
collections/folders/tags, filtering/sorting controls, search, bulk/edit mode,
social/community behavior, commerce, ML, external ingestion, durable offline
queues, dashboards, deployment, and remote database work.

## 4. Architecture

```text
P09 product shell
  -> /wardrobe route
    -> WardrobeExperience state machine
      -> identity-scoped, Strict-Mode-deduplicated load
        -> own active saved_products rows through P06 RLS
        -> canonical active metadata through P08 get_catalog_product
      -> WardrobeCard
      -> remove_product(saved_product_id, operation_id)
      -> SYS-07 Undo -> save_product(product_id, operation_id, wardrobe)
      -> P07 telemetry service
```

No global state library or second saved-state authority was introduced.
Route entry/re-entry always resolves PostgreSQL truth. Local state exists only
for the current render, mutation task, focus target, and Undo lifetime.

## 5. Files created

- `src/features/wardrobe/types.ts`
- `src/features/wardrobe/service.ts`
- `src/features/wardrobe/service.test.ts`
- `src/features/wardrobe/supabase.ts`
- `src/features/wardrobe/supabase.test.ts`
- `src/features/wardrobe/telemetry.ts`
- `src/features/wardrobe/wardrobe-card.tsx`
- `src/features/wardrobe/wardrobe-experience.tsx`
- `src/features/wardrobe/wardrobe-experience.test.tsx`
- `src/features/wardrobe/wardrobe.module.css`
- `tests/e2e/wardrobe.spec.ts`
- `tests/e2e/wardrobe-visual.spec.ts`
- `docs/engineering/implementation/P13_WARDROBE_HANDOFF.md`

## 6. Files modified

- `src/app/(product)/wardrobe/page.tsx`
- `tests/e2e/identity-mock.ts`
- `docs/engineering/IMPLEMENTATION_STATUS.md`

## 7. Route behavior

The P09 placeholder at `/wardrobe` is replaced without duplicating the shell.
The route has one `h1`, retains primary navigation, refreshes server truth on
entry/re-entry, and keeps route loading/error content inside the existing
identity/onboarding/shell boundaries.

## 8. Saved-product read boundary

P13 requires no migration. P06 explicitly grants authenticated SELECT on only
the current Auth identity's `saved_products` rows through
`saved_products_select_own`; browser INSERT/UPDATE/DELETE remains revoked.
P13 reads only `id`, `product_id`, and `saved_at`, filters `removed_at IS NULL`,
then resolves each active product through P08's approved
`get_catalog_product(uuid)` RPC.

Inactive/unavailable metadata returns no active catalog row and renders an
honest unavailable saved card. No table mutation, owner parameter,
service-role credential, session token, or product-table write exists.

## 9. Ordering model

The canonical PRD and Design decision is most recently saved first. The query
uses:

`saved_at DESC, saved_product_id DESC`

The UUID tie-breaker makes equal timestamps deterministic. Active duplicate
product rows are rejected as an unrecoverable contract violation rather than
silently rendered. React keys use canonical saved-product IDs.

## 10. Grid and card behavior

- Two columns at mobile, three at tablet, four at 1200 px, five at 1600 px.
- Canonical image, brand, product name, category, saved state, and separate
  remove control.
- No non-canonical price, date, filter, sort, search, category tabs, or bulk
  action.
- Stable image ratio, responsive image sizing, deterministic image failure,
  explicit unavailable label, two-line product-name clamp, and 44 px remove
  target.
- Product link and remove button are siblings, never nested.

## 11. Cross-surface consistency

- Discover save -> Wardrobe entry: canonical refresh.
- Product Detail save -> Wardrobe entry: canonical refresh.
- Wardrobe remove -> Discover/Product Detail unsaved state: canonical refresh.
- Wardrobe Undo -> Discover/Product Detail saved state: canonical refresh.
- Reload and route re-entry discard view-local optimism and read server truth.
- No WebSocket, global cache, or third-party store was required.

## 12. Product Detail integration

Card links use:

`/product/{productId}?from=wardrobe`

No feed instance or feed position is created. P12 parses the approved Wardrobe
source, uses `/wardrobe` as the fallback, and Back returns to the Wardrobe
route. Direct Product Detail behavior is unchanged.

## 13. Remove behavior

Removal is pessimistic at the grid boundary, matching WAR-05: the card remains
with a rendered busy state until canonical success, then collapses. The RPC
receives the canonical `saved_product_id`, not product ID, plus one stable
operation ID. Duplicate input is guarded immediately. Failure retains the card,
hides raw errors, and offers Retry with the same operation ID. Route/identity
generation and mounted-state checks reject stale responses. Focus moves to the
next card, previous card, or empty heading.

P14 Challenge dependency confirmation is not implemented because Challenge
progress/UI does not yet exist; P06 already performs atomic incomplete-Challenge
dependency cleanup when that state becomes available.

## 14. Undo behavior

Successful removal shows SYS-07 for five seconds. Focus within the toast pauses
the remaining duration. Undo is keyboard reachable, guarded against duplicate
activation, and uses a new logical `save_product` operation with source
`wardrobe`. Retry reuses that Undo operation ID. Failure keeps the item honestly
removed and leaves a safe Try again action. Timers and unsafe response
application are cleaned up on route leave.

## 15. Telemetry

Only registered version-1 events are used:

- `session_started` when not already started by another mounted surface;
- `wardrobe_viewed` once per logical page view;
- `wardrobe_empty_viewed` after a successful zero-item query;
- `product_remove_requested` -> `product_removed`;
- `product_save_requested` -> `product_saved` for Undo;
- `product_save_failed` for remove/Undo failure.

Surface/source is `wardrobe`, operation IDs are stable across retry, requested
events are not duplicated, and telemetry failure never erases canonical UI.
No Undo, loaded, refreshed, impression, query, or retry event was invented.

## 16. Loading, empty, error, and recovery

- Identity remains gated by P05/P09.
- Wardrobe loading uses an announced, stable two-column grid skeleton and count
  skeleton; empty never flashes.
- Empty appears only after a successful zero-row query, uses the canonical copy,
  a restrained existing editorial asset, and `Explore pieces` -> `/discover`.
- Recoverable query failure assures that saved pieces are unchanged and offers
  Try again/Open Discover.
- Contract/duplicate failures offer safe navigation without an infinite retry.
- Raw Supabase/database errors never render.
- Remove failure keeps the card; Undo failure keeps the removed truth.

## 17. Accessibility

One Wardrobe `h1`; semantic labelled list; meaningful link/image names;
explicit remove labels; busy states; status/alert semantics; keyboard-reachable
retry, empty action, and Undo; focus-paused timer; visible focus inherited from
the P02/P09 system; 44 px targets; non-color unavailable/error state; no nested
interactive controls; reduced-motion skeleton behavior; predictable
post-removal focus. Axe reports no structural violations.

## 18. Keyboard behavior

Native Tab/Shift+Tab order is Product Detail link then remove controls in DOM
reading order. Enter activates links/buttons; Space remains native for buttons.
Remove, Undo, retry, and empty action are keyboard reachable. No arrow-key
behavior, custom trap, or inaccessible icon-only action was added.

## 19. Responsive behavior

Certified at 320×700, 390×844, 768×1024, 1200×900, and 1440×1024. The grid
retains image geometry, long names clamp safely, the Undo toast clears the
mobile bottom navigation/safe area, desktop content clears the rail, and no
tested viewport has horizontal overflow.

## 20. Design-system usage

The implementation uses only P02/P09 runtime tokens, canonical serif/UI
typography, paper/ink/signal/status roles, approved breakpoints, existing shell,
44 px target size, 4:5 imagery, restrained borders/elevation, and reduced
motion. No new palette, spacing scale, icon family, breakpoint, theme, or
animation framework was added.

## 21. Unit/component/integration tests

Wardrobe tests cover active load, recent-first source order, unavailable
metadata, duplicate rows, malformed saved/product contracts, canonical
saved-product removal argument, save-based Undo, ownership-field exclusion,
loading, populated fields, source link, empty, query error, raw-error hiding,
duplicate mutation guards, remove failure, honest Undo failure, five-second
expiry/focus pause, and axe.

Final full result: 28 test files / 139 tests passed.

## 22. E2E tests

Dedicated P13 Playwright coverage verifies deterministic order, duplicate-free
grid, Product Detail source/Back, keyboard remove/Undo, cross-surface refresh,
query recovery, raw-error hiding, unavailable product, image failure, empty
state, and horizontal overflow at all five required viewport sizes.

Dedicated P13 result: 12 Chromium tests passed with one worker.

Full regression result: 38 Chromium tests passed with one worker.

One intermediate full-suite rerun timed out while polling an existing direct
Product Detail telemetry assertion. The isolated assertion passed on immediate
rerun, and the subsequent complete 38-test run passed; no P13 test failed.

## 23. Visual certification

Captured and manually inspected:

- populated grid at all five required viewports;
- loading skeleton;
- empty;
- recoverable query error;
- image failure;
- unavailable item;
- remove failure;
- Undo toast.

The review corrected undefined token aliases, a falsely rendered zero count in
the query-error state, remove-control contrast, and full-page screenshot
stitching around fixed mobile navigation. The empty-state capture now waits for
decoded editorial-image pixels, and that above-the-fold asset loads eagerly.
Final viewport captures show stable geometry, visible skeletons/controls,
correct nav clearance, and no horizontal overflow.

One-item and long-title cases are exercised by the same deterministic fixtures.
Product Detail return is behaviorally certified in E2E.

## 24. Validation commands and outcomes

- `npm.cmd run format:check`: passed after formatting P13 files.
- `npm.cmd run lint`: passed with zero errors/warnings.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test`: passed, 28 files / 139 tests.
- `npm.cmd run build`: passed after allowing the existing Next font download.
- Dedicated P13 Playwright: passed, 12 tests, one worker.
- Full `npm.cmd run test:e2e -- --reporter=line --workers=1`: passed, 38 tests,
  one worker.
- `git diff --check`: passed.
- No separate accessibility command exists in `package.json`; axe runs in
  `npm.cmd run test`.

## 25. Database status

- Database changes: None.
- Migration files changed: None.
- Cloud migrations deployed: None.
- Hosted development schema updated: No.
- Remote reset/push/seed: not run.

## 26. CI status

Configured but awaiting CI validation. GitHub application CI has not run for
this uncommitted P13 working tree.

## 27. Cloud status

No deployment, hosted schema operation, Supabase project link, or remote
database command was performed.

## 28. Security review

- Ownership derives only through the existing JWT/RLS/RPC boundary.
- No owner/user/Wardrobe IDs are sent as authority.
- No browser direct DML exists.
- `remove_product` receives saved-product ID.
- `save_product` receives product ID, operation ID, and canonical source.
- No service-role credential/session/token reaches visual components.
- No raw errors or secrets render/log through P13.
- No validated migration was edited.

## 29. Scope review

No frozen HQ, Product, Design, Data, Engineering Foundation, release, ADR, or
P04–P12 migration decision changed. No Challenge UI, collections, filters,
commerce, social behavior, ML, offline queue, dashboard, deployment, or P14
scope leaked into P13.

## 30. Known limitations

- P14 must connect incomplete-Challenge dependency confirmation to the existing
  atomic P06 remove boundary; P13 does not fabricate pre-P14 Challenge state.
- Inactive catalog products have no client-readable product snapshot, so P13
  truthfully labels the saved row unavailable without inventing former
  brand/name/image metadata.
- Durable offline mutation/replay remains P16.
- GitHub CI is pending.

## 31. Deferred P14 work

P14 owns Challenge start, slot selection/removal, completion, version mismatch,
and the explicit Wardrobe removal consequence UI for an item selected in an
incomplete Challenge.

## 32. Exact changed-file inventory

Created: the ten files under `src/features/wardrobe/`, two P13 E2E specs, and
this handoff.

Modified: the Wardrobe route page, shared deterministic E2E identity fixture,
and implementation status.

## 33. Recommended next package

P14 — Challenge is the next package in the implementation plan, but it must not
be marked Ready/started until P13 receives GitHub CI closure.

## 34. Suggested commit message

`feat(wardrobe): implement canonical saved grid and undo`
