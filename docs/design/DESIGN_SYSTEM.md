# A L T E R . — Design System

**Document ID:** DS-LR-001  
**Work package:** WP-003 Design Foundation  
**Status:** Implementation-ready baseline  
**Owner:** Product Design  
**Release:** Learning Release 001  
**Last updated:** 2026-07-19  

---

## 1. Purpose

Define the visual, interaction, motion, responsive, and accessibility foundation for Learning Release 001.

This system is deliberately narrow. It supports:

- onboarding;
- Discover;
- Product Detail;
- Wardrobe;
- Outfit Challenge;
- continuation and recovery;
- all required loading, empty, error, offline, and destructive-action states.

It does not define community, commerce, shipping, maintenance, AI advice, scores, public profiles, or enterprise surfaces.

---

## 2. Design direction

### 2.1 Creative position

A L T E R . is an editorial fashion discovery product, not a marketplace template.

The interface should feel like:

- an independent fashion magazine translated into a fluid product;
- image-led, calm, selective, and intentional;
- modern without relying on novelty effects;
- distinctive through proportion, typography, crop, pacing, and motion rather than decorative chrome.

The interface should not feel like:

- a generic card-based e-commerce storefront;
- a dashboard;
- a social network clone;
- a gamified rewards product;
- a luxury brand imitation;
- a dense catalog tool.

### 2.2 Visual signature

The baseline signature is:

1. **Near-black ink and warm paper neutrals.**
2. **Large editorial product imagery.**
3. **High-contrast serif display type paired with a neutral grotesk UI face.**
4. **Asymmetric rhythm within a disciplined grid.**
5. **Restrained controls that appear when needed and recede when not.**
6. **One electric accent role used sparingly for active state, focus, and progress.**
7. **Motion that confirms spatial continuity rather than decorating the interface.**

### 2.3 Imagery principles

- Product imagery is the dominant visual material.
- Default image background should be preserved when editorially credible.
- Use `object-fit: cover` for feed/editorial cards and `contain` only where product silhouette loss would be material.
- Do not apply filters that alter product color.
- Avoid artificial drop shadows on product cutouts unless source imagery requires separation.
- Crop focal areas manually where asset metadata permits; otherwise default to centered crop.
- Every meaningful product image requires product-name-based alternative text.
- Broken imagery must preserve card dimensions and interaction controls.

---

## 3. Experience principles

### EP-01 — Image first, interface second

The product should be understood through products and outfits before explanatory UI. Interface chrome must never compete with the imagery.

### EP-02 — Browse without obligation

Discovery should feel intrinsically useful without purchase pressure, forced creation, notifications, or social performance.

### EP-03 — State must be unmistakable

Saved, unsaved, selected, empty, invalid, loading, completed, and failed states must be perceivable without relying only on color.

### EP-04 — Every action is reversible

Saving, removing, selecting, replacing, and leaving an incomplete challenge should support undo, reversal, or explicit recovery.

### EP-05 — Continue, do not restart

Feed position, Wardrobe state, and Challenge progress should feel continuous across navigation and return sessions.

### EP-06 — Editorial, not ornamental

Distinctiveness comes from typography, art direction, spacing, sequence, and motion. Avoid decorative gradients, excessive glass effects, novelty cursors, and gratuitous 3D.

### EP-07 — Quiet confidence

Copy should be concise and direct. Avoid hype, judgment, artificial scarcity, social proof, and claims of personalization intelligence.

### EP-08 — Friction only where it protects meaning

Confirmation is reserved for destructive or state-invalidating operations. Routine save, selection, and navigation actions receive immediate feedback without modal interruption.

### EP-09 — Accessibility is a state system

Focus, reduced motion, text scaling, contrast, keyboard order, and assistive labels are first-class component variants.

### EP-10 — Learning integrity over vanity polish

The interface may be expressive, but it must not imply unavailable commerce, AI judgment, ownership, delivery, popularity, or social endorsement.

---

## 4. Foundations and tokens

Tokens use platform-neutral names. Engineering may translate them to CSS custom properties, Tailwind theme entries, or design-token JSON without changing semantic intent.

### 4.1 Typography

#### Font families

| Token | Recommended family | Fallback | Use |
|---|---|---|---|
| `font.display` | Instrument Serif | Georgia, Times New Roman, serif | Editorial titles, challenge statements, onboarding promise |
| `font.ui` | Inter | Arial, Helvetica, sans-serif | Navigation, controls, metadata, body copy |
| `font.mono` | IBM Plex Mono | ui-monospace, monospace | Internal/debug only; not a consumer UI style |

Both primary families are open-source and suitable for web delivery. Font loading must use `font-display: swap`.

#### Type scale

| Token | Mobile | Desktop | Line height | Weight | Use |
|---|---:|---:|---:|---:|---|
| `type.display-xl` | 48 px | 72 px | 0.96 | 400 | Onboarding hero only |
| `type.display-lg` | 40 px | 56 px | 1.00 | 400 | Challenge context, major editorial title |
| `type.display-md` | 32 px | 44 px | 1.05 | 400 | Primary screen title |
| `type.heading-lg` | 24 px | 28 px | 1.15 | 600 | Section heading |
| `type.heading-md` | 20 px | 22 px | 1.20 | 600 | Card/empty-state heading |
| `type.body-lg` | 18 px | 18 px | 1.45 | 400 | Intro copy |
| `type.body-md` | 16 px | 16 px | 1.50 | 400 | Default body |
| `type.body-sm` | 14 px | 14 px | 1.45 | 400 | Product metadata |
| `type.label` | 13 px | 13 px | 1.20 | 600 | Controls and navigation |
| `type.caption` | 12 px | 12 px | 1.35 | 500 | Auxiliary metadata |
| `type.micro` | 11 px | 11 px | 1.25 | 600 | Progress count; use sparingly |

Rules:

- Minimum interactive-label size: 13 px.
- Minimum body size: 16 px for substantive text.
- Uppercase is limited to labels of 20 characters or fewer.
- Display serif is never used below 20 px.
- Product name truncation: maximum two lines in cards; no truncation in Product Detail.
- Support browser text zoom to 200% without loss of core functionality.

### 4.2 Spacing

Base unit: `4 px`.

| Token | Value |
|---|---:|
| `space.0` | 0 |
| `space.1` | 4 px |
| `space.2` | 8 px |
| `space.3` | 12 px |
| `space.4` | 16 px |
| `space.5` | 20 px |
| `space.6` | 24 px |
| `space.8` | 32 px |
| `space.10` | 40 px |
| `space.12` | 48 px |
| `space.16` | 64 px |
| `space.20` | 80 px |
| `space.24` | 96 px |

Layout spacing rules:

- Mobile horizontal page gutter: `16 px`.
- Mobile immersive-image gutter: `8 px` where edge proximity is intentional.
- Tablet gutter: `24 px`.
- Desktop content gutter: `32–48 px`.
- Minimum separation between independent touch targets: `8 px`.
- Minimum touch target: `44 × 44 px`.
- Section rhythm uses `32`, `48`, or `64 px`; avoid arbitrary one-off values.

### 4.3 Radius

| Token | Value | Use |
|---|---:|---|
| `radius.none` | 0 | Full-bleed imagery, editorial frames |
| `radius.xs` | 4 px | Focused utility elements |
| `radius.sm` | 8 px | Compact controls, chips |
| `radius.md` | 12 px | Cards, sheets, image containers |
| `radius.lg` | 20 px | Large panels, continuation module |
| `radius.pill` | 999 px | Pills, segmented controls |

Fashion imagery should not be universally rounded. Use `radius.none` or `radius.sm` for editorial cards; reserve larger radii for functional containers.

### 4.4 Elevation

Elevation is rare and functional.

| Token | Definition | Use |
|---|---|---|
| `elevation.0` | none | Default surfaces |
| `elevation.1` | `0 1px 2px rgba(14,14,14,.08)` | Sticky controls on paper |
| `elevation.2` | `0 8px 24px rgba(14,14,14,.12)` | Bottom sheet |
| `elevation.3` | `0 18px 48px rgba(14,14,14,.18)` | Modal confirmation only |

Use borders and tonal separation before shadows.

### 4.5 Color roles

#### Core palette

| Token | Hex | Role |
|---|---|---|
| `color.ink.950` | `#11110F` | Primary text, dark surface |
| `color.ink.800` | `#2B2A27` | Secondary dark |
| `color.ink.600` | `#5F5D57` | Secondary text |
| `color.ink.400` | `#96928A` | Muted text |
| `color.paper.50` | `#FAF8F3` | Primary background |
| `color.paper.100` | `#F3F0E8` | Secondary surface |
| `color.paper.200` | `#E7E2D7` | Borders, skeleton |
| `color.paper.300` | `#D4CEC1` | Strong border |
| `color.signal.500` | `#6D4AFF` | Active, focus, progress |
| `color.signal.600` | `#5936E8` | Pressed active |
| `color.success.600` | `#287A55` | Confirmed success |
| `color.warning.600` | `#9A6418` | Warning |
| `color.danger.600` | `#B43A35` | Destructive/error |
| `color.white` | `#FFFFFF` | Contrast on dark/image |
| `color.black` | `#000000` | Scrim base |

#### Semantic aliases

| Token | Alias |
|---|---|
| `surface.canvas` | `paper.50` |
| `surface.subtle` | `paper.100` |
| `surface.raised` | `white` |
| `surface.inverse` | `ink.950` |
| `text.primary` | `ink.950` |
| `text.secondary` | `ink.600` |
| `text.muted` | `ink.400` |
| `text.inverse` | `paper.50` |
| `border.subtle` | `paper.200` |
| `border.strong` | `paper.300` |
| `action.primary` | `ink.950` |
| `action.primary-text` | `paper.50` |
| `action.accent` | `signal.500` |
| `focus.ring` | `signal.500` |
| `status.success` | `success.600` |
| `status.warning` | `warning.600` |
| `status.error` | `danger.600` |
| `overlay.scrim` | `rgba(0,0,0,.48)` |

#### Contrast rules

- Body text must meet WCAG 2.2 AA: 4.5:1 minimum.
- Large text must meet 3:1 minimum.
- UI boundaries and focus indicators must meet 3:1 against adjacent colors.
- Text over imagery requires a tested scrim or dedicated solid label surface.
- `signal.500` is not used for small text on `paper.50` without contrast verification.
- Saved/selected states combine icon fill, shape, label, and color.

### 4.6 Iconography

- Style: 1.75 px rounded stroke, optical 24 px grid.
- Default sizes: 20 px inline, 24 px control, 28 px primary save.
- Use a single icon family; Lucide is the implementation baseline.
- Required icons: arrow-left, arrow-right, bookmark, bookmark-filled equivalent, plus, minus, x, check, rotate/undo, alert-circle, wifi-off, refresh, image-off, chevron-down, search only if implementation needs in-sheet filtering.
- Do not mix filled and outlined icons except to communicate binary state.
- Icons require visible text or accessible names when meaning is not universally clear.
- Decorative icons use `aria-hidden="true"`.

### 4.7 Grid

#### Mobile, 320–767 px

- 4 columns.
- 16 px outer margin.
- 12 px gutter.
- Product feed: two columns by default.
- A featured product may span both columns at controlled intervals only if ordering and impression measurement remain deterministic.

#### Tablet, 768–1199 px

- 8 columns.
- 24 px outer margin.
- 16 px gutter.
- Product feed: 3 columns.
- Detail: split layout when width permits.

#### Desktop, 1200 px and above

- 12 columns.
- 32–48 px outer margin.
- 20 px gutter.
- Maximum content width: 1440 px.
- Product feed: 4 columns at 1200–1599 px; 5 columns from 1600 px when card minimum width remains 240 px.
- Primary nav becomes a left rail; content remains centered.

---

## 5. Component inventory

### 5.1 Navigation

| Component | Variants | Required states |
|---|---|---|
| `AppHeader` | transparent-over-image, solid | default, scrolled, offline |
| `BottomNav` | 3 destinations | default, active, focus, badge-dot |
| `DesktopRail` | 3 destinations | default, active, focus |
| `BackButton` | icon-only, icon+label | default, hover, focus, pressed |
| `ContinuationCard` | challenge, wardrobe, discover | default, loading, dismissed |

### 5.2 Actions

| Component | Variants | Required states |
|---|---|---|
| `Button` | primary, secondary, quiet, destructive | default, hover, focus, pressed, disabled, loading |
| `IconButton` | solid, ghost, image-overlay | default, hover, focus, pressed, selected, disabled |
| `SaveButton` | icon-only, icon+label | unsaved, saving, saved, removing, error |
| `UndoToast` | save/remove/selection | enter, visible, action focus, exit |
| `Chip` | choice, metadata | default, selected, disabled, focus |
| `ProgressDots` | onboarding | current, completed, upcoming |

### 5.3 Product presentation

| Component | Variants | Required states |
|---|---|---|
| `ProductCard` | standard, featured, compact-picker | loading, loaded, saved, image-error, unavailable |
| `ProductImage` | cover, contain, gallery | loading, loaded, error |
| `ProductMeta` | card, detail | complete, partial-data |
| `ProductGallery` | single, multi-image | loading, active index, image-error |
| `ProductPickerRow` | challenge | eligible, selected, disabled, unavailable |

### 5.4 Wardrobe and Challenge

| Component | Variants | Required states |
|---|---|---|
| `WardrobeGrid` | default | loading, populated, empty, error |
| `ChallengeHero` | unstarted, in-progress, complete | loading, ready |
| `OutfitSlot` | required | empty, eligible, selected, invalid, loading |
| `SlotPickerSheet` | populated, empty-category | open, loading, error |
| `OutfitSummary` | in-progress, complete | valid, invalidated |
| `CompletionBar` | sticky mobile, inline desktop | disabled, enabled, submitting, error |

### 5.5 System feedback

| Component | Variants | Required states |
|---|---|---|
| `Skeleton` | text, product-card, gallery, slot | animated, reduced-motion |
| `InlineError` | local, page | visible, retrying |
| `EmptyState` | wardrobe, feed, category | default |
| `OfflineBanner` | persistent | offline, reconnecting, restored |
| `ConfirmationSheet` | destructive | open, confirm-loading, error |
| `Toast` | success, warning, error | enter, action, exit |
| `FocusRing` | standard, inverse | keyboard-visible |
| `VisuallyHidden` | utility | static |

---

## 6. Component behavior specifications

### 6.1 ProductCard

Anatomy:

1. image;
2. optional source/brand eyebrow;
3. product name;
4. category;
5. save control;
6. full-card detail target.

Rules:

- Card image aspect ratios may alternate between `4:5` and `3:4`; ratio is part of catalog presentation data and must not change after load.
- Save control is directly available on all Discover cards.
- Save control sits in a 44 × 44 px hit area, inset 8 px from image top/right.
- Card body is 52–72 px high depending on wrapped title.
- The full card opens Product Detail; the save control stops propagation.
- Keyboard order: card link, then save control only when DOM semantics preserve a non-nested interactive structure.
- Saved state uses a filled bookmark inside a high-contrast circular surface and an accessible name: “Remove [product] from Wardrobe.”
- Image errors display a neutral patterned placeholder, product name, and retained save/detail actions.
- Unavailable products cannot be newly saved; existing saved state may remain visible with an “Unavailable” label.

### 6.2 SaveButton

Behavior:

- Optimistic visual state begins within 100 ms.
- State changes through `unsaved → saving → saved` or `saved → removing → unsaved`.
- During network mutation, duplicate input is ignored.
- Failure restores the prior canonical state and shows an inline/toast error with Retry.
- A successful remove presents an Undo toast for 5 seconds.
- Removing an item used by an incomplete Challenge requires a confirmation sheet before mutation:
  - title: “Remove this piece?”
  - body: “It will also be cleared from your unfinished look.”
  - actions: “Keep piece” and “Remove”.
- Removing an item from a completed outfit preserves the completion snapshot and uses no blocking confirmation; show “Removed from Wardrobe. Your completed look is unchanged.”

### 6.3 Button

- Mobile primary buttons are 48 px high; compact buttons 44 px.
- Primary button max width is not forced to full width except onboarding, empty state, and mobile completion bar.
- Loading preserves button width and replaces leading icon with a 16 px progress indicator.
- Disabled buttons remain legible and include a nearby explanation when the reason is not obvious.
- Do not use disabled styling as the only explanation for Challenge incompletion.

### 6.4 BottomNav

Destinations:

1. Discover;
2. Wardrobe;
3. Challenge.

Rules:

- Height: 64 px plus safe-area inset.
- Solid `paper.50` surface with 1 px top border.
- Icon plus label always visible.
- Active state uses filled/strong icon, `text.primary`, and a 2 px top marker.
- Challenge may show a non-numeric signal dot only when meaningful persisted progress exists.
- Bottom navigation remains visible on primary destinations.
- It is hidden on onboarding, full-screen Product Detail, and modal/sheet overlays.
- Product Detail back returns to the source context and scroll position.

### 6.5 OutfitSlot

Anatomy:

- slot label;
- category hint;
- image or add affordance;
- state/status text;
- replace/remove controls when selected.

Rules:

- Minimum mobile height: 132 px.
- Empty state uses a dashed boundary plus “Add [slot]”.
- Selected state uses product image, name, and explicit “Selected” text for assistive clarity.
- Invalid state uses error icon, text, and a recovery action.
- The slot itself opens the picker.
- Remove is a separate 44 px target.
- Slots are ordered according to Challenge definition; visual layout never changes semantic order.

---

## 7. Motion system

### 7.1 Motion principles

1. Motion communicates source, destination, state change, and hierarchy.
2. Motion must not delay input or conceal loading.
3. Only one dominant motion event occurs at a time.
4. Product imagery should feel physically continuous between card and detail where feasible.
5. Every nonessential motion has a reduced-motion replacement.

### 7.2 Durations

| Token | Duration | Use |
|---|---:|---|
| `motion.instant` | 80 ms | Press feedback |
| `motion.fast` | 140 ms | Icon state, opacity |
| `motion.base` | 220 ms | Sheet/content transitions |
| `motion.slow` | 360 ms | Shared-element image/detail |
| `motion.deliberate` | 520 ms | Onboarding hero only |

### 7.3 Easing

| Token | Value | Use |
|---|---|---|
| `ease.standard` | `cubic-bezier(.2,.8,.2,1)` | Most transitions |
| `ease.enter` | `cubic-bezier(.16,1,.3,1)` | Elements entering |
| `ease.exit` | `cubic-bezier(.7,0,.84,0)` | Elements leaving |
| `ease.spring-soft` | spring equivalent, damping 28, stiffness 320 | Save and selection feedback |

Avoid high-bounce spring behavior.

### 7.4 Screen transitions

- Primary tab switch: 140 ms crossfade; no lateral slide that implies history.
- Product card → detail: 220–360 ms shared-image expansion where stable; otherwise fade-through with source-position restoration.
- Detail → source: reverse shared transition; restore scroll before completing visual transition.
- Bottom sheet: translate from bottom over 220 ms with scrim fade.
- Confirmation sheet: same pattern, with initial focus on safe action.
- Onboarding step: content crossfade plus 12 px vertical translation over 220 ms.

### 7.5 Save/remove feedback

Save:

1. Bookmark icon compresses to 92% for 80 ms.
2. Fills over 140 ms.
3. Circular surface emits one subtle 6 px scale pulse.
4. No confetti or particle burst.
5. Accessible live-region message: “Saved to Wardrobe.”

Remove:

1. Filled icon transitions to outline over 140 ms.
2. Undo toast enters from lower safe area.
3. No card removal animation on Discover.
4. Wardrobe card collapses only after canonical success; duration 220 ms.
5. Focus moves to the next logical item after removal.

### 7.6 Feed loading

- Initial load: stable skeleton cards matching final aspect ratios.
- Skeleton shimmer duration: 1.4 seconds, low contrast.
- Pagination: 2–4 skeleton cards appended without overlaying loaded content.
- Existing content never dims during pagination.
- Successful insertion uses opacity 0 → 1 over 140 ms; no vertical jump.
- Pagination failure replaces appended skeletons with one inline retry row.

### 7.7 Challenge selection

- Selecting a piece closes the picker and crossfades the slot image over 220 ms.
- Slot boundary moves from dashed to solid.
- Completion progress changes numerically and visually.
- When the final valid slot is filled, the completion button enables with a single 140 ms emphasis transition.
- Replacing a piece uses crossfade, not spin or flip.
- Invalidated selection uses a 2 px error boundary and static message; no shake.

### 7.8 Reduced motion

When `prefers-reduced-motion: reduce`:

- disable shared-element scaling;
- replace translations with crossfades of 80–120 ms;
- stop skeleton shimmer; use static tonal blocks;
- remove pulses and spring overshoot;
- keep state changes immediate;
- do not auto-scroll unless required to reveal focused error content;
- preserve progress and spatial cues through text and focus movement.

---

## 8. Accessibility requirements

### 8.1 Target

LR-001 targets WCAG 2.2 AA for the minimum valid journey.

### 8.2 Semantics

- Use landmarks: header, nav, main, footer where relevant.
- Each screen has one programmatic `h1`.
- Product cards use links for navigation and buttons for save state.
- Sheets and confirmations use dialog semantics, focus trapping, labelled title, and return focus.
- Status messages use polite live regions; blocking errors use assertive announcements sparingly.
- Avoid generic accessible labels such as “button” or “image.”

### 8.3 Keyboard

- All primary actions are keyboard reachable.
- Visible focus uses a 2 px `focus.ring` plus 2 px offset.
- Focus order follows visual/semantic reading order.
- Opening Product Detail moves focus to its heading or back control.
- Closing Detail returns focus to the originating card.
- Opening a picker moves focus to sheet title or first eligible item.
- Escape closes non-destructive sheets and returns focus.
- Destructive confirmations cannot be triggered by Escape.

### 8.4 Screen readers

- Product image alt: “[Brand, if available] [product name], [category].”
- Decorative lifestyle imagery has empty alt.
- Save button labels include product identity and resulting action.
- Bottom navigation exposes active destination with `aria-current="page"`.
- Outfit slot labels announce category, occupancy, and validity.
- Disabled completion control is accompanied by visible and programmatic text: “Add 2 more pieces to finish.”
- Loading states announce once, not on every skeleton.

### 8.5 Touch and pointer

- Minimum target: 44 × 44 px.
- Target spacing: 8 px where adjacent.
- Hover is enhancement only.
- No action depends on long press, swipe, drag-and-drop, or precise gesture.
- Challenge selection uses tap/click; drag-and-drop is out of scope.

### 8.6 Contrast and non-color communication

- Saved: filled icon + label/accessible state.
- Selected: check icon + boundary + text.
- Error: icon + message + color.
- Focus: ring + offset.
- Offline: banner + icon + text.
- Required Challenge slots include “Required” text where ambiguity exists.

### 8.7 Text and zoom

- Layout remains functional at 200% browser zoom.
- At narrow widths or large text, bottom nav labels may wrap to two lines only if 64 px height expands accordingly.
- No fixed-height text container clips content.
- Product metadata can reflow below imagery.
- Horizontal scrolling is not required for the primary journey.

### 8.8 Cognitive clarity

- Onboarding contains one decision concept per screen.
- Error messages describe what happened and the next action.
- Avoid fashion expertise assumptions in preference labels.
- Avoid countdowns, urgency, artificial scarcity, or punishment.
- Challenge completion criteria remain visible during selection.

---

## 9. Responsive behavior

### 9.1 Supported widths

- Minimum supported viewport: 320 px.
- Primary design reference: 390 × 844 px.
- Secondary mobile: 360 × 800 px.
- Tablet: 768 × 1024 px.
- Desktop evaluator: 1440 × 1024 px.
- Wide desktop validation: 1728 × 1117 px.

### 9.2 Mobile

- Bottom navigation.
- Two-column Discover and Wardrobe grids.
- Product Detail is full-screen.
- Challenge picker is a bottom sheet.
- Challenge completion action is sticky above bottom navigation.
- Onboarding uses full-screen paged steps.
- Content respects top and bottom safe-area insets.

### 9.3 Tablet

- Bottom navigation may remain until 1023 px.
- Three-column grids.
- Product Detail uses image/content split when landscape.
- Picker is a centered sheet up to 640 px wide.
- Challenge slots can use two columns while retaining DOM order.

### 9.4 Desktop

- Left navigation rail: 88 px collapsed visual width, labels visible beneath icons or expanded to 200 px when space permits.
- Discover grid uses 4–5 columns.
- Product Detail is a route with a two-column layout: 58% gallery, 42% information.
- Wardrobe uses 4–5 columns.
- Challenge uses a centered canvas up to 1100 px with slots arranged around a clear context header.
- Bottom sheets become dialogs/panels.
- Do not stretch text lines beyond 68 characters.

### 9.5 Orientation and safe areas

- Portrait is primary; landscape remains usable.
- Sticky controls must account for `env(safe-area-inset-bottom)`.
- No critical control sits under browser UI.
- Image aspect ratio is stable across orientation changes.
- Scroll restoration keys include route and source context.

---

## 10. Implementation token example

```css
:root {
  --font-display: "Instrument Serif", Georgia, serif;
  --font-ui: Inter, Arial, sans-serif;

  --surface-canvas: #FAF8F3;
  --surface-subtle: #F3F0E8;
  --surface-raised: #FFFFFF;
  --surface-inverse: #11110F;

  --text-primary: #11110F;
  --text-secondary: #5F5D57;
  --text-muted: #96928A;
  --text-inverse: #FAF8F3;

  --border-subtle: #E7E2D7;
  --border-strong: #D4CEC1;
  --action-accent: #6D4AFF;
  --focus-ring: #6D4AFF;
  --status-success: #287A55;
  --status-warning: #9A6418;
  --status-error: #B43A35;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;

  --motion-fast: 140ms;
  --motion-base: 220ms;
  --motion-slow: 360ms;
  --ease-standard: cubic-bezier(.2,.8,.2,1);
}
```

---

## 11. Design QA checklist

A surface is not design-complete until:

- primary, loading, empty, error, offline, and recovery states are defined where applicable;
- keyboard focus order is documented;
- screen-reader labels are specified for non-text controls;
- saved/selected/error state is not color-only;
- touch targets meet minimum size;
- reduced-motion behavior is defined;
- mobile, tablet, and desktop behavior is described;
- no false-commerce cue exists;
- source-context return behavior is explicit;
- destructive actions use the approved confirmation/undo model;
- analytics-relevant states are visually distinguishable;
- image failure does not break navigation or state actions.
