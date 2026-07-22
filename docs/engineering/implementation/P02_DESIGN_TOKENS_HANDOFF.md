# WP-006 P02 — Design Tokens and Visual Foundation Handoff

## Completed output

Implemented the smallest production-ready LR-001 visual foundation: canonical CSS
tokens and semantic aliases, Tailwind CSS 4 mapping, approved font loading,
accessible global styles, responsive foundations, reduced-motion handling, six
narrow server-renderable primitives, and a removable non-product verification page.

No product feature, complete product screen, runtime styling system, or speculative
visual dependency was introduced.

## Token architecture

`src/styles/tokens.css` is the canonical runtime source and follows:

`primitive tokens → semantic tokens → Tailwind utilities/primitives`

Primitive tokens retain Design terminology for the ink, paper, signal, success,
warning, and danger palettes. Semantic aliases expose surface, foreground, border,
action, focus, status, sizing, layout, and motion roles. Components consume semantic
aliases through Tailwind utilities or CSS variables and do not duplicate approved
values.

LR-001 implements only the approved light appearance. Semantic names remain
theme-extensible without defining an unapproved dark theme.

## Canonical Design values used

- Fonts: Instrument Serif 400 for display; Inter 400/500/600 for interface; IBM
  Plex Mono retained as debug-only fallback token.
- Type: mobile/desktop sizes from 11–72 px, with every approved line height and
  weight.
- Color: all 15 approved palette values and all documented semantic aliases,
  including the 48% black scrim.
- Spacing: the complete 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, and 96 px
  scale.
- Radius: 0, 4, 8, 12, 20, and 999 px.
- Elevation: the approved none, sticky, sheet, and modal shadows.
- Layout: 16/24/32–48 px responsive gutters; 4/8/12 columns; 12/16/20 px grid
  gutters; 1440 px content maximum; 68ch text maximum; 640 px sheet and 1100 px
  challenge constraints.
- Frozen sizing: 44 px touch target, 48 px primary control, 56 px header, 64 px
  bottom navigation, and 88/200 px desktop rail roles.
- Focus: 2 px signal ring plus 2 px offset.
- Motion: 80, 140, 220, 360, and 520 ms durations; 1400 ms skeleton duration; all
  three approved cubic-bezier curves; press scale and step translation values.
- Breakpoints: tablet 768 px, desktop 1200 px, and approved wide-grid threshold
  1600 px.

## Typography implementation

`next/font/google` self-hosts Instrument Serif and Inter, uses `display: swap`, and
requests Latin plus extended-Latin subsets for Turkish characters. CSS role variables
fall back deterministically to Georgia/Times New Roman and Arial/Helvetica/system
sans stacks. Font variables are attached at the root layout to minimize shift and no
render-blocking external stylesheet is used at runtime.

Display, heading, body, label, caption, and micro roles are exposed through narrow
`Heading` and `Text` APIs. Display type is never assigned to sub-20 px roles.

## Tailwind integration

Tailwind 4 remains the only styling system. The token file uses CSS-first
`@theme inline` mapping for semantic colors, fonts, radii, shadows, and Design
breakpoints. Later packages should prefer mapped utilities such as `bg-canvas`,
`text-foreground`, `border-border-subtle`, `font-display`, `rounded-md`, and
`shadow-sheet`. Use direct `var(--semantic-token)` references only when a Tailwind
utility cannot express the approved role; arbitrary raw values should remain
exceptional.

## Global visual foundation

The global stylesheet establishes warm-paper canvas, near-black text, light-only
color scheme, box sizing, minimum 320 px viewport support, dynamic viewport height,
selection, inherited links and form fonts, responsive media defaults, font smoothing,
and a non-color-only focus outline. The reduced-motion query removes long/repeated
animation and collapses transitions to the approved 80 ms instant duration while
preserving feedback.

## Primitives added

- `Container`: canonical maximum width and responsive gutters.
- `Stack`: vertical flow with token-driven configurable gap.
- `Text`: six approved functional type roles.
- `Heading`: five approved display/heading roles with semantic heading selection.
- `Button`: minimal semantic button used only to verify focus, touch, and motion.
- `VisuallyHidden`: shared assistive-text utility.

The only class composition mechanism is a local truthy-string joiner; no dependency
or speculative variant system was added.

## Tests added or updated

- Verification-page rendering and approved typography-role content.
- Button semantics, heading level, text element selection, and visually hidden
  behavior.
- Critical token-name contract and Tailwind CSS-first mapping.
- Deterministic reduced-motion CSS contract.
- Non-product scope assertion.
- axe-core accessibility smoke scan.
- Existing Playwright smoke expectation updated for the verification page.

## Dependencies added

None.

## Minor implementation decisions

- Design does not freeze letter-spacing numbers, so role tokens use `normal` rather
  than inventing tracking.
- Design freezes spring damping 28 and stiffness 320 but gives no CSS easing
  equivalent. Both values are preserved as metadata tokens; P02 does not pretend a
  cubic-bezier is equivalent.
- Design requires overlay ordering but does not name z-index values. A minimal
  reversible 0/10/20/30/40 role ladder was added for base, sticky, overlay, modal,
  and toast consumption.
- Selection colors reuse approved inverse surface roles.
- `text.muted` is implemented canonically but not used for essential small text on
  the verification canvas because the approved ink-400/paper-50 pairing is not
  suitable for small required copy under the 4.5:1 rule.

## Unresolved Design gaps

- Letter spacing has role intent but no explicit numeric values.
- `ease.spring-soft` has physics parameters but no CSS-native approximation.
- Z-index role names and values are not frozen by Design.
- The canonical muted text color requires context-specific contrast validation and
  must not be assumed safe for small text on the primary paper surface.
- Exact licensed font binaries are not stored in the repository; offline builds
  without a populated Next font cache require approved network access.

## Future integration boundaries

- Motion stays component-local, interruptible, and reduced-motion aware; a later
  owning package may justify a library only for a confirmed interaction.
- Copy remains separate from token and primitive definitions so locale routing and
  dictionaries can be introduced without changing the visual foundation.
- Any approved 3D experience must be an isolated client-only dynamic island with
  lazy-loaded assets, no critical-bundle runtime, and an accessible fallback.

## Visual verification limitations

The root surface verifies token consumption responsively but is not a screenshot
baseline. Playwright did not launch because the host `ComSpec` points to a directory
instead of a command processor. No E2E or visual-regression success is claimed.

## Validation results

- `npm install`: passed with approved registry access; 508 packages audited and
  package files unchanged. npm reports 1 moderate and 2 high existing dependency
  findings; no breaking automatic upgrade was applied.
- `npm run format:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test`: passed, 3 files and 18 tests.
- `npm run build`: passed; root and not-found routes are statically generated.
- `npm run test:e2e`: attempted and returned a pre-launch host `ComSpec` error.
- `git diff --check`: passed.

The production client-reference manifest contains framework-only modules. P02 has no
`use client` boundary and introduces no application client-side JavaScript.

## Recommended next package

Proceed with `P03 — Supabase Local Setup`. The next visual consumer is P09, which
should use these semantic utilities and primitives rather than creating parallel
tokens.
