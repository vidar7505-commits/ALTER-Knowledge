# A L T E R . — LR-001 Frontend Architecture

## 1. Repository structure

```text
src/
  app/
    (public)/onboarding/{welcome,style,mood}/
    (product)/discover/
    (product)/product/[productId]/
    (product)/wardrobe/
    (product)/challenge/
    (product)/challenge/select/[slotId]/
    api/events/route.ts
    layout.tsx
    error.tsx
  features/
    identity/
    onboarding/
    discover/
    product-detail/
    wardrobe/
    challenge/
    continuation/
    telemetry/
  components/
    design-system/
    shell/
    feedback/
    accessibility/
  lib/
    supabase/{browser,server,admin}.ts
    validation/
    config/
  styles/
    tokens.css
    globals.css
tests/
  unit/
  component/
  integration/
  e2e/
  visual/
supabase/
  migrations/
  seed.sql
  tests/
scripts/
```

Feature modules own components, schemas, queries, actions, tests, and types specific to that feature. `lib/` contains only cross-cutting infrastructure.

## 2. Route and rendering strategy

| Route | Rendering | Initial data | Cache | State owner | Restoration |
|---|---|---|---|---|---|
| `/onboarding/welcome` | Server shell + client actions | onboarding status/version | no-store | PostgreSQL | redirect if resolved |
| `/onboarding/style` | Server data + client selection | visual choices | catalog-version cache | local pending + server final | step state in sessionStorage |
| `/onboarding/mood` | same | mood choices | catalog-version cache | local pending + server final | same |
| `/discover` | Server first page + client pagination | continuation, feed instance, products, saved IDs | private/no-store | server feed instance + client view | history state + persisted feed instance |
| `/product/[id]` | Server Component + client save | product, saved state, source context | product revalidate 5 min; state no-store | server | URL search params and history key |
| `/wardrobe` | Server Component | active saved products | no-store | PostgreSQL | browser scroll key |
| `/challenge` | Server Component + client interactions | definition, progress, eligible counts | no-store | PostgreSQL | canonical progress |
| `/challenge/select/[slotId]` | Server list + client selection | eligible Wardrobe products | no-store | PostgreSQL | slot and challenge route state |

## 3. State management decision

No global state library. Use:
- Server Components for authoritative reads.
- Server Actions for mutations.
- React local state for interaction state.
- `useOptimistic` for save/remove and slot changes.
- URL/search params for navigable state.
- history state/sessionStorage for scroll and source-route restoration.
- IndexedDB for telemetry queue and offline mutation intents only.

Server responses always replace optimistic state. Cross-surface saved state is refreshed with `revalidatePath` and canonical mutation payloads.

## 4. Feed implementation

- Batch size: 24 products.
- Cursor: opaque, signed representation of `{feed_instance_id, next_position}`.
- Ordering: deterministic hash over `feed_order_version`, preference IDs, and product ID; active products only.
- First page creates `feed_instances` and persists exact product sequence.
- Later pages append to `feed_instance_products`; duplicates are rejected by unique constraint.
- Absolute position is database-owned.
- Unavailable products remain in historical feed sequence but render unavailable and are excluded from new feed creation.
- Scroll restoration stores `{feedInstanceId, scrollY, loadedThrough}` and validates the feed instance before reuse.

## 5. Qualified impression implementation

Each product card registers one observer with thresholds `[0, 0.5, 1]`.

```ts
type ExposureKey = `${string}:${string}:${string}`; // session:feed:product

function onVisibility(entry: IntersectionObserverEntry) {
  if (document.visibilityState !== "visible" || entry.intersectionRatio < 0.5) {
    cancelTimer(entry.target);
    return;
  }
  startTimer(entry.target, 1000, () => {
    if (stillVisibleAtLeast(entry.target, 0.5) && !alreadyEmitted(key(entry.target))) {
      emitProductImpression();
      markEmitted(key(entry.target));
    }
  });
}
```

Timers cancel on ratio drop, unmount, page hide, route change, or tab background. Remount does not duplicate because the emitted key is retained for the feed instance. Rapid scroll produces no event unless the continuous 1,000 ms threshold is met.

## 6. Design-system implementation

- `tokens.css` is canonical runtime token output.
- Tailwind maps semantic names to CSS variables; components do not hard-code brand colors.
- Fonts use `next/font`: Instrument Serif and Inter, `display: swap`.
- Lucide is the sole icon family.
- No dark mode in LR-001; color-scheme is light.
- Reduced-motion media query removes route transforms, shared-element motion, and long easing while retaining state feedback.
- Breakpoints follow Design: 320–767, 768–1199, ≥1200.
- Minimum touch target: 44 × 44 CSS px.

## 7. Component boundaries

### Design-system primitives
`Button`, `IconButton`, `Chip`, `Text`, `Heading`, `Sheet`, `Dialog`, `Toast`, `Skeleton`, `VisuallyHidden`, `FocusRing`.

### Shared shell
`AppHeader`, `BottomNav`, `DesktopRail`, `BackButton`, `OfflineBanner`, `RouteError`.

### Feature components
`ProductCard`, `ProductImage`, `SaveButton`, `ProductGallery`, `WardrobeGrid`, `ChallengeSlot`, `ProductPicker`, `ContinuationCard`.

Client components are limited to interactive controls, observers, galleries, optimistic regions, sheets, and toasts. Data-only layouts remain Server Components.

Visual regression coverage is mandatory for ProductCard, Product Detail, navigation, Wardrobe states, Challenge states, continuation card, error/empty/offline states, and 200% zoom snapshots.

## 8. Motion

Use CSS transitions and View Transitions API as progressive enhancement. No animation framework is included. Route transitions max 220 ms; save feedback max 160 ms; completion sequence max 400 ms. All motion is interruptible and disabled/reduced under `prefers-reduced-motion`.

## 9. Accessibility

- Semantic landmarks and heading order.
- Visible keyboard focus on every action.
- Focus returns to invoking control after sheet/dialog closure.
- Product save state announced through polite live region.
- Errors link summary to fields and controls.
- Dialog and sheet use focus trap, Escape close where non-destructive, and inert background.
- Product imagery uses descriptive alt when information-bearing; decorative editorial imagery uses empty alt.
- 200% zoom must not hide navigation or completion controls.
