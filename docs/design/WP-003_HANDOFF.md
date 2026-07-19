# WP-003 Design Foundation — Handoff Report

**Status:** Complete  
**Date:** 2026-07-19  
**Primary outputs:** `docs/design/DESIGN_SYSTEM.md`, `docs/design/LR-001_UX_SPEC.md`, `docs/design/LR-001_SCREEN_INVENTORY.md`

## Completed output:

Produced an implementation-ready design foundation for Learning Release 001 covering:

- LR-001 experience principles;
- editorial visual direction;
- mobile-first information architecture;
- persistent navigation behavior;
- onboarding flow and versioned visual-choice taxonomy;
- infinite discovery feed;
- Product Detail;
- Wardrobe;
- one context-based Outfit Challenge;
- return and continuation behavior;
- loading, empty, error, offline, recovery, and destructive-action states;
- typography, spacing, radius, elevation, color, and icon tokens;
- transition, save/remove, feed-loading, selection, completion, and reduced-motion behavior;
- mobile, tablet, desktop, orientation, safe-area, and text-zoom behavior;
- WCAG 2.2 AA-oriented interaction requirements;
- component inventory and component state contracts;
- Figma page, frame, component, variant, and prototype naming;
- engineering implementation notes;
- a 67-state baseline screen inventory before responsive variants.

The baseline visual direction is image-led and editorial rather than commerce-led. The interface uses restrained chrome, warm neutral surfaces, high-contrast editorial typography, deterministic image layouts, and one sparingly used signal accent.

The approved minimum navigation model is:

`Discover ↔ Wardrobe ↔ Challenge`

Product Detail is contextual and restores the originating surface, loaded state, and scroll position.

The approved onboarding definition is `onboarding-style-v1`.

The approved LR-001 Challenge definition is:

- version: `challenge-evening-v1`;
- title: `After Dark`;
- context: build a look for an evening out;
- slots: Top, Bottom, Shoes, Layer or Accessory;
- selection pool: saved Wardrobe products;
- completion: four valid unique products plus explicit confirmation.

No frozen strategy, technology, product scope, or research decision was reopened.

## Assumptions:

- Mobile reference width is 390 px, with 320 px as the supported minimum.
- Desktop evaluation reference is 1440 px.
- Instrument Serif and Inter are acceptable open-source baseline fonts; Engineering may replace them only with metrically and tonally comparable families.
- Lucide is an acceptable baseline icon set.
- Product data supplies stable product IDs, image dimensions or aspect ratios, category eligibility, and verified optional metadata.
- Product images can reach sufficient quality to support an editorial visual standard.
- Saved state is canonical across Discover, Product Detail, Wardrobe, and Challenge.
- Engineering can preserve route source context and scroll restoration keys.
- Completed Challenge records can retain product snapshot/reference data after Wardrobe removal.
- Challenge product selection is tap/click based; drag-and-drop is unnecessary.
- A return session may open Discover with a continuation card rather than forcing direct navigation into Challenge.
- Category-targeted Discover routing can use a simple baseline query/filter/order without introducing a complex recommendation system.

## Unresolved risks:

- Source imagery may be visually inconsistent in crop, lighting, background, and resolution; this can materially reduce perceived quality even with correct UI implementation.
- The onboarding image taxonomy requires asset curation and a small comprehension check. Labels alone do not guarantee that visual choices are distinguishable.
- Product category data may not map cleanly to the four Challenge slots. Product and Engineering must validate eligibility coverage before implementation sign-off.
- A Wardrobe-first Challenge may have low completion when users have too few eligible saved products. The designed Discover redirect mitigates friction but does not remove catalog risk.
- Exact behavior for locally queued offline save/remove mutations depends on Engineering architecture. The UX specifies that mutation availability must never be ambiguous.
- Shared-element Product Detail transitions depend on stable images and routing support. They are progressive enhancement, not a release requirement.
- Font delivery, image optimization, and skeleton behavior require performance validation on mid-range mobile devices.
- WCAG 2.2 AA intent still requires implementation testing with keyboard, screen reader, zoom, and reduced motion.
- Data finalized qualified impression, feed-depth, session-boundary, and return-window definitions in WP-004; implementation must use those canonical thresholds.
- The four-slot completed outfit uses a feasible grid composition rather than automated garment cutouts. Visual quality depends on art direction and source assets.

## Files created or changed:

- `docs/design/DESIGN_SYSTEM.md`
- `docs/design/LR-001_UX_SPEC.md`
- `docs/design/LR-001_SCREEN_INVENTORY.md`
- `docs/design/WP-003_HANDOFF.md`

## Recommended next action:

Open WP-005 Engineering Foundation using the PRD, these design documents, and WP-004 Data documents as canonical inputs. Engineering should first resolve stable user state, canonical save synchronization, feed pagination and scroll restoration, Challenge persistence/version handling, completed-outfit snapshots, and local error boundaries. In parallel, create the Figma component library and prototype the minimum valid journey using the exact state and naming inventory in this package. Before WP-006 implementation begins, run one joint Product–Design–Engineering review focused on category eligibility coverage, persistence recovery, image pipeline quality, accessibility blockers, and instrumentation-sensitive UI states.
