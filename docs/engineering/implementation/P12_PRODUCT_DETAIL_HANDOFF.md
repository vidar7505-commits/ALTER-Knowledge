# P12 — Product Detail Handoff

## Status

`Complete`.

P12 local implementation, accessibility checks, production build, one-worker
Playwright E2E, visual certification, and GitHub application validation are
complete. GitHub application validation passed for commit
`bedd5e7068c63e15e3ebc1a732d162cf1c92667a`.

## Package and scope

Package: **P12 — Product Detail** (`feat(product-detail)`).

Implemented scope:

- source-aware `/product/[productId]` route;
- canonical catalog fields and partial-data collapse;
- single- and multi-image gallery;
- horizontal mobile scroll-snap gallery and vertical desktop thumbnails;
- canonical save, remove, and five-second `SYS-07` Undo;
- loading, not-found/unavailable, recoverable error, and contract-error states;
- Discover, Wardrobe, Challenge, and direct-entry source contexts;
- safe direct-entry fallback to Discover;
- Product Detail open, close, failure, save, and remove telemetry;
- request-version and operation-identity stale-response protection;
- immediate duplicate mutation and Undo guards;
- keyboard, reduced-motion, responsive, image-failure, and axe coverage.

Explicitly deferred:

- P13 Wardrobe grid/navigation management;
- Challenge UI and selection behavior;
- recommendations, purchasing, checkout, and commerce;
- durable offline mutation queues;
- new database boundaries or migrations;
- deployment.

## Route, source, and Back behavior

The Product Detail route is keyed by canonical product ID. A route-ID change
renders loading immediately, resets view-local state, and ignores stale load
results through a monotonically increasing request version.

Accepted `from` values are `discover`, `wardrobe`, and `challenge`. Discover
alone accepts a positive feed position. Unknown or absent values remain direct
entry and never claim Discover attribution.

- Discover source returns through browser history and retains P11 restoration
  metadata.
- Wardrobe and Challenge retain route context without implementing either
  destination's future feature UI.
- Direct entry uses `/discover` as the canonical safe fallback.
- Product Detail never creates or ensures a feed instance.

## Product inventory and gallery

Rendered data is limited to accurate catalog fields: imagery, brand/source,
name, category/subcategory, optional price, optional description, color, fit,
materials, and season. Missing optional fields collapse without fabricated
labels.

Single-image products show no redundant index. Multi-image products use native
horizontal scroll snap on mobile and vertical thumbnail controls on desktop.
The active thumbnail uses `aria-selected`; index changes are announced through
a polite status region. Each image preserves geometry and transitions to a
deterministic product-labelled failure state. Zoom and lightbox behavior remain
excluded.

The unsupported blurred/glass top bar was removed. The bar now uses the
canonical solid surface and subtle border tokens.

## Save, remove, Undo, and concurrency

Save uses `save_product(uuid, uuid, text)` with
`p_source_surface = 'product_detail'`.

Remove truthfully uses the canonical two-argument
`remove_product(uuid, uuid)` signature: saved-product ID plus operation ID. It
does not accept a source-surface argument.

Routine removal presents the canonical five-second Undo toast. Focus inside the
toast pauses expiry. Undo is a new logical `save_product` operation and emits
the normal save requested/saved telemetry sequence; no Undo event was invented.

Immediate refs prevent duplicate activation before React commits rendered busy
state. Results apply only when product ID, operation ID, and expected prior
saved state still match. Route leave invalidates pending result application.
Retry preserves the failed operation ID for the same logical action.

## Telemetry

Only canonical LR-001 events are used:

- `product_detail_opened`;
- `product_detail_closed`;
- `product_detail_failed`;
- `product_save_requested`;
- `product_saved`;
- `product_remove_requested`;
- `product_removed`;
- `product_save_failed`.

Open fires once per logical product view and resets for a new product ID.
Custom Back and route/browser leave share a close guard so close cannot
duplicate. Direct entry records a null source rather than inventing Discover.
Telemetry delivery failure remains non-blocking.

## Files

Created:

- `docs/engineering/implementation/P12_PRODUCT_DETAIL_HANDOFF.md`
- `src/features/product-detail/product-detail-experience.module.css`
- `src/features/product-detail/product-detail-experience.test.tsx`
- `src/features/product-detail/product-detail-experience.tsx`
- `src/features/product-detail/supabase.ts`
- `src/features/product-detail/telemetry.ts`
- `src/features/product-detail/types.ts`
- `tests/e2e/product-detail.spec.ts`
- `tests/e2e/product-detail-visual.spec.ts`

Modified:

- `docs/engineering/IMPLEMENTATION_STATUS.md`
- `src/app/(detail)/product/[productId]/page.tsx`
- `src/features/telemetry/contracts.ts`
- `tests/e2e/discover-visual.spec.ts`
- `tests/e2e/discover.spec.ts`
- `tests/e2e/identity-mock.ts`

Deleted:

- `src/features/discover/product-detail-boundary.module.css`
- `src/features/discover/product-detail-boundary.tsx`

## Tests and visual evidence

The Product Detail component suite covers valid, missing, error, save,
save/remove/Undo, and axe behavior. The full Vitest suite passes with 25 files
and 124 tests.

Dedicated P12 Playwright coverage verifies Discover entry/restoration, direct
entry without feed creation, missing product, transient retry, keyboard
save/remove/Undo, duplicate mutation protection, rollback, mobile gallery
interaction, desktop thumbnail activation, telemetry, and horizontal overflow.

Visual evidence covers the five canonical viewports:

- 320 × 700;
- 390 × 844;
- 768 × 1024;
- 1200 × 900;
- 1440 × 1024.

Additional captures cover multi-image, saved, Undo, direct, Wardrobe source,
Challenge source, partial metadata, image failure, recoverable load error,
not-found/unavailable, and mutation-error states.

## Local validation

- `npm.cmd run format:check`: passed.
- `npm.cmd run lint`: passed with 0 warnings and 0 errors.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test`: passed, 25 files / 124 tests.
- `npm.cmd run build`: passed.
- `npm.cmd run test:e2e -- --reporter=line --workers=1`: passed, 26 Chromium
  tests with 1 worker.
- `git diff --check`: passed.
- Playwright/Next teardown: no remaining `node.exe` process.
- Visual certification: passed at 320 × 700, 390 × 844, 768 × 1024,
  1200 × 900, and 1440 × 1024.
- GitHub application validation: passed for P12 commit
  `bedd5e7068c63e15e3ebc1a732d162cf1c92667a`; all workflow jobs and steps were
  reported green by the repository owner.

## Database and cloud record

- Database changes: None.
- Cloud migrations deployed: None.
- Hosted development schema updated: No.
- Remote reset: not run.
- Remote migration push: not run.
- Remote seed push: not run.
- Production deployment: not run.

No remote database command, commit, push, or deployment was performed.

## Known limitations and next package

The catalog detail RPC exposes active products only, so inactive and missing
catalog records converge on the same canonical unavailable/not-found recovery
surface. P13 cross-surface Wardrobe synchronization UI and Challenge post-save
selection remain intentionally deferred.

P13 is **P13 — Wardrobe**. Its objective is the canonical saved grid and
removal; dependencies are P06, P09, and P12; acceptance requires cross-surface
consistency and Undo; its commit boundary is `feat(wardrobe)`. P13 is now Ready
(unblocked).
