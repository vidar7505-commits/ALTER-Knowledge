# A L T E R . — Learning Release 001 UX Specification

**Document ID:** UX-LR-001  
**Work package:** WP-003 Design Foundation  
**Status:** Implementation-ready  
**Owner:** Product Design  
**Release:** Learning Release 001  
**Last updated:** 2026-07-19  
**Depends on:** `docs/product/LR-001_PRD.md`, `docs/design/DESIGN_SYSTEM.md`

---

## 1. Scope and design decision summary

This specification translates LR-001 product requirements into a coherent mobile-first experience.

Approved design decisions for the baseline:

- Persistent primary navigation uses three destinations: **Discover**, **Wardrobe**, and **Challenge**.
- Mobile uses a labelled bottom navigation; desktop uses a left rail.
- Product Detail is a full-screen route on mobile and a split route on desktop.
- Save is available directly from Discover cards and Product Detail.
- Removal from an incomplete Challenge requires confirmation because it invalidates active progress.
- Removal elsewhere uses immediate action plus Undo.
- Onboarding uses one promise screen plus two visual-choice steps.
- The onboarding taxonomy is versioned as `onboarding-style-v1`.
- The single Challenge is versioned as `challenge-evening-v1`.
- Challenge context: **“After Dark” — Build a look for an evening out.**
- Required slots: **Top**, **Bottom**, **Shoes**, **Layer or Accessory**.
- Saved Wardrobe items are the only selectable pool.
- When a slot lacks eligible items, the user is routed to a relevant Discover view and can return without losing progress.
- Return sessions land on Discover with a continuation card unless an interrupted critical action requires direct recovery.
- No drag-and-drop is used.

---

## 2. Information architecture

### 2.1 Route model

```text
/
├── /onboarding
│   ├── /onboarding/welcome
│   ├── /onboarding/style
│   └── /onboarding/mood
├── /discover
│   └── /product/:productId
├── /wardrobe
│   └── /product/:productId
└── /challenge
    ├── /challenge/select/:slotId
    └── /product/:productId
```

Routes may be implemented with overlays while preserving URLs and back behavior.

### 2.2 Primary destinations

#### Discover

Purpose: uninterrupted product exploration, inspection, and saving.

Entry conditions:

- onboarding completed or skipped;
- default return destination;
- Challenge redirect with category intent;
- empty Wardrobe recovery.

#### Wardrobe

Purpose: revisit and manage saved pieces.

Entry conditions:

- primary navigation;
- save success action where useful;
- Challenge selection source.

#### Challenge

Purpose: construct and explicitly complete one context-based look.

Entry conditions:

- primary navigation;
- continuation card;
- post-save prompt is not used in LR-001.

#### Product Detail

Purpose: inspect one product and alter save state without losing source context.

Source context is always one of:

- Discover;
- Wardrobe;
- Challenge slot picker;
- completed Challenge.

### 2.3 Navigation rules

- Bottom navigation is always available on Discover, Wardrobe, and Challenge.
- Selecting the current nav destination scrolls to top only on a second deliberate tap; first tap does not discard position.
- Product Detail hides primary navigation and exposes one back action.
- Back always restores originating surface, loaded data, selected slot, and scroll position.
- Browser/system back follows the same rule.
- Onboarding cannot be reopened from LR-001 UI after completion/skip.
- No profile/settings destination is introduced.

---

## 3. Global shell

### 3.1 Mobile shell

- Background: `surface.canvas`.
- Top region: 56 px app header when used.
- Main content: scrollable, bottom padding equal to nav height plus safe area.
- Bottom navigation: 64 px plus safe-area inset.
- Toast stack: 12 px above bottom navigation.
- Offline banner: below top safe area, pushes content rather than covering it.

### 3.2 Header behavior

Discover:

- wordmark left;
- no search, filter, avatar, notifications, or cart;
- header becomes solid after 24 px scroll.

Wardrobe:

- title and saved-item count;
- no bulk edit mode.

Challenge:

- title or context eyebrow;
- progress text in in-progress state.

Product Detail:

- back control;
- optional product position is not shown;
- save remains within content/sticky action area.

### 3.3 Continuation card

Shown at top of Discover for qualifying return sessions.

Priority variants:

1. **Recover action** — persistence mutation was interrupted.
2. **Continue look** — Challenge has one or more valid selections and is incomplete.
3. **Revisit completed look** — recent completed Challenge.
4. **Back to Wardrobe** — last meaningful destination was Wardrobe and saved items exist.
5. No card.

Anatomy:

- 16:9 editorial crop or product collage;
- 12 px eyebrow: “Continue”;
- one-line title;
- one-line progress/status;
- primary action;
- dismiss control.

Rules:

- Card is not a modal and never blocks Discover.
- Dismissal persists for the current session.
- Selecting card routes to the exact state.
- Card uses no urgency or streak language.

---

## 4. Onboarding UX

### 4.1 Objective

Explain value and collect lightweight visual preferences within approximately one minute without requiring expertise or sensitive data.

### 4.2 Flow

#### ONB-01 — Welcome

Content:

- A L T E R . wordmark.
- Full-bleed editorial fashion image.
- Headline: “Find the pieces that feel like you.”
- Body: “Explore, save, and build a look without the pressure to buy.”
- Primary action: “Start”.
- Quiet action: “Skip for now”.

Behavior:

- “Start” advances to style choice.
- “Skip for now” records skip and enters Discover.
- If skip persistence fails, show recovery sheet with Retry and “Continue with default feed.”
- No carousel, account creation, notification request, or permissions.

#### ONB-02 — Style direction

Question: “What pulls you in?”

Instruction: “Choose up to four.”

Visual options:

1. **Minimal** — clean lines, controlled palette.
2. **Relaxed** — soft layers, easy proportions.
3. **Tailored** — precise structure, polished shape.
4. **Romantic** — fluid form, delicate detail.
5. **Street** — graphic pieces, strong silhouettes.
6. **Experimental** — unexpected shape, contrast, texture.

Presentation:

- two-column image grid;
- each tile uses a non-product editorial composition;
- text label sits on a solid lower scrim;
- selected tile shows check, 2 px accent border, and “Selected” accessible state.

Rules:

- 0–4 choices.
- Fifth selection triggers inline message: “Choose up to four. Remove one to add another.”
- “Continue” enabled with zero selections.
- Back returns to welcome with choices intact.
- Footer displays “1 of 2”.

#### ONB-03 — Mood and use

Question: “What are you dressing for lately?”

Instruction: “Choose any that fit.”

Options:

- Everyday ease
- Work and meetings
- Going out
- Weekends away
- Events and occasions
- Trying something new

Presentation:

- image-backed horizontal tiles in a single vertical list;
- multi-select with no maximum;
- zero selections allowed;
- footer displays “2 of 2”.

Primary action:

- “Show my feed”.

Secondary action:

- “Skip choices”.

Persistence behavior:

- Disable duplicate submission after first activation.
- Show button loading state.
- On success, crossfade into initial Discover skeleton.
- On failure, show inline message:
  - “We couldn’t save your choices.”
  - actions: “Try again” and “Continue with default feed”.
- Continuing with fallback records onboarding completed-without-preferences rather than a false successful preference save.

### 4.3 Onboarding visual-choice asset rules

- Each taxonomy tile uses an editorial image representing styling principles, not protected traits or body ideals.
- Do not use gender labels.
- Do not infer or ask size, age, ethnicity, body type, income, brand affinity, or purchase history.
- Images should vary garment categories and framing.
- Each option has an asset ID tied to `onboarding-style-v1`.
- Alt text describes the look and label, not the model’s physical attributes.
- Avoid visually ambiguous overlap between taxonomy options; internal QA should achieve at least 80% label-image comprehension in a small task test before external release.

---

## 5. Discover feed

### 5.1 Layout

Mobile:

- two-column masonry-informed grid with deterministic reserved heights;
- 8 px page edge gutter;
- 8 px column gap;
- 20 px vertical card gap;
- featured two-column card may appear every 12 items if catalog metadata explicitly marks it.

Desktop:

- regular 4–5 column grid;
- visual variation comes from image ratios, not random DOM order.

### 5.2 Card content

Required:

- product image;
- source/brand when available;
- product name;
- category;
- save control.

Optional:

- valid price, rendered as metadata only.

Prohibited:

- “Buy”, “Add to cart”, “Ships”, delivery estimates, scarcity, discount badges, ratings, likes, comment counts, ownership claims.

### 5.3 Feed interactions

Tap/click image or metadata:

- open Product Detail;
- preserve feed batch list, item positions, viewport offset, and active continuation-card dismissal.

Tap save:

- optimistic save;
- update Wardrobe canonical state;
- icon feedback and live announcement;
- no forced navigation.

Tap remove:

- immediate removal plus Undo unless item is in incomplete Challenge;
- incomplete Challenge dependency opens confirmation sheet.

Pagination:

- request begins before final two viewport heights;
- append stable skeleton cards;
- preserve loaded cards and user interaction;
- no full-screen spinner;
- on failure, show inline retry row after last loaded item.

### 5.4 Initial loading

- Render 6 mobile or 12 desktop skeleton cards.
- Skeleton ratios match expected cards.
- Header and navigation remain interactive.
- If load exceeds a reasonable UX threshold determined by Engineering, replace passive skeleton-only state with text: “Still loading your feed…” and Retry when failure is known.

### 5.5 Empty feed

Title: “Nothing to show yet.”

Body: “The feed is unavailable right now. Your saved pieces are still here.”

Actions:

- primary: “Try again”;
- secondary: “Open Wardrobe” when saved items exist.

Do not imply that user preferences caused the empty state unless verified.

### 5.6 Exhausted feed

Terminal module after final item:

- title: “You’ve reached the end for now.”
- body: “Come back to continue exploring.”
- actions: “Back to top” and “Open Wardrobe”.

No fake infinite repetition. If catalog must recycle, clearly begin a new sequence and prevent duplicate impression ambiguity.

### 5.7 Image failure

- Preserve card ratio.
- Show `image-off` icon and product name.
- Keep save and detail actions available if product data is valid.
- Multiple image failures do not trigger a global page error.

### 5.8 Offline

If already-loaded feed exists:

- display offline banner;
- keep browsing loaded cards;
- allow local interaction only if Engineering supports queued mutation;
- otherwise disable save mutation with explanation: “Reconnect to update your Wardrobe.”
- Retry automatically on reconnection and provide manual Retry.

If no feed is loaded:

- full-page offline state with “Try again” and available route to cached Wardrobe.

---

## 6. Product Detail

### 6.1 Mobile layout

1. top overlay back control;
2. product gallery, 4:5 minimum viewport presence;
3. product identity block;
4. category and optional attributes;
5. concise description when available;
6. sticky bottom save/remove action;
7. bottom safe area.

The route scroll position starts at top for each newly opened product.

### 6.2 Desktop layout

- Left: gallery, approximately 58% width.
- Right: sticky product information column, max 440 px.
- Back action remains at top of right column and in browser history.
- Save action appears near title and remains visible without covering content.

### 6.3 Product gallery

- Single image: no pagination indicators.
- Multiple images: horizontal swipe on mobile and vertical thumbnails on desktop.
- Gallery index is announced as “Image 2 of 4.”
- Zoom interaction is excluded.
- Product color must not be modified by overlays.
- Image failure shows a stable placeholder per image.

### 6.4 Information hierarchy

1. brand/source eyebrow;
2. product name;
3. category;
4. valid price if present;
5. descriptive attributes, maximum six;
6. description, maximum approximately 320 characters visible before optional expansion;
7. no unsupported source link unless accurate and approved.

Missing optional fields collapse without blank labels.

### 6.5 Save action

Unsaved:

- label: “Save to Wardrobe”;
- primary action styling.

Saved:

- label: “Saved” with filled bookmark;
- secondary/selected styling;
- activating initiates remove behavior.

When opened from Challenge picker:

- if unsaved, saving does not automatically select it;
- after save success, show action “Choose for [slot]” when eligible;
- selecting returns to the picker/Challenge and assigns it.

### 6.6 Invalid product

Title: “This piece is unavailable.”

Body: “It may have been removed from the current catalog.”

Actions:

- “Go back”;
- “Open Discover”.

If the product exists in completed Challenge history, the snapshot remains visible there and is not replaced by this error.

---

## 7. Wardrobe

### 7.1 Populated state

Header:

- “Wardrobe”
- count: “[n] saved”

Grid:

- two columns mobile;
- most recently saved first;
- same ProductCard visual language as Discover;
- optional compact category label;
- no sort/filter controls in baseline.

Behavior:

- card opens Product Detail;
- save button acts as remove;
- remove uses Undo unless incomplete Challenge dependency exists;
- removing card collapses after successful canonical response;
- focus lands on next card or empty state.

### 7.2 Empty state

Visual:

- one restrained editorial still-life or abstract garment crop;
- no illustration style foreign to the product.

Copy:

- title: “Your Wardrobe starts here.”
- body: “Save pieces from Discover, then use them to build a look.”
- primary action: “Explore pieces”.

### 7.3 Loading

- Stable grid skeleton.
- Count uses skeleton text.
- Navigation remains available.

### 7.4 Error

If canonical Wardrobe cannot load:

- title: “We couldn’t load your Wardrobe.”
- body: “Your saved pieces have not been changed.”
- actions: “Try again” and “Open Discover”.

Do not render a false empty state for a load failure.

### 7.5 Removal dependency behavior

Incomplete Challenge:

- confirmation sheet before removal;
- explain that the piece will be cleared from the active slot;
- successful removal updates both Wardrobe and Challenge atomically from user perspective;
- failure leaves both unchanged and offers Retry.

Completed Challenge:

- remove immediately;
- completion snapshot remains;
- completed outfit labels item “No longer in Wardrobe” where relevant.

---

## 8. Outfit Challenge

### 8.1 Challenge definition

**Version:** `challenge-evening-v1`  
**Title:** After Dark  
**Context:** “Build a look for an evening out.”  
**Required slots:**

1. Top
2. Bottom
3. Shoes
4. Layer or Accessory

Completion requires:

- one valid saved product in each slot;
- no repeated product;
- explicit “Complete look” action.

### 8.2 Unstarted state

Hero:

- editorial night-context image;
- eyebrow: “Outfit Challenge”;
- display title: “After Dark”;
- context line;
- concise explanation: “Choose four saved pieces to complete the look.”

Preview:

- four empty slot outlines;
- no product picker until challenge starts.

Primary action:

- “Start challenge”.

Secondary route:

- “Explore pieces” when Wardrobe is empty.

### 8.3 In-progress state

Header:

- “After Dark”
- progress: “[n] of 4 pieces”

Slot list:

- vertical on mobile;
- two-column on tablet/desktop;
- each slot shows category and selected product or add state.

Sticky completion bar:

- disabled until all four slots valid;
- supporting text: “Add [n] more pieces”;
- enabled label: “Complete look”.

Navigation:

- bottom nav remains available;
- leaving never discards progress.

### 8.4 Slot selection

Tap empty/selected slot:

- open `SlotPickerSheet`;
- title: “Choose a [slot]”;
- show eligible saved products only;
- current selection marked;
- selected product can be replaced;
- product row has image, product name, category, and selection control.

No eligible product:

- title: “No saved [category] yet.”
- body: “Explore matching pieces, save one, then return here.”
- primary action: “Find [category]”.
- secondary: “Back to look”.

Discover redirect:

- Discover opens with a non-persistent context header: “Finding: [category]”.
- Feed ordering/filter behavior may be simple but must be identified.
- Challenge progress remains stored.
- Product Detail save success may expose “Choose for [slot]”.
- Back or Challenge nav returns to exact progress.

### 8.5 Validation states

Empty:

- neutral dashed outline;
- “Add [slot]”.

Selected:

- image, name, “Selected” state;
- replace and remove controls.

Invalid:

- used when product becomes unavailable, removed, or category eligibility changes;
- error border and icon;
- message: “Choose another piece.”
- invalid selection does not count toward completion.

Loading:

- slot skeleton retains dimensions.

### 8.6 Completion

Tap “Complete look”:

- button loading state;
- canonical validation runs;
- duplicate input ignored.

Success state:

- full-screen or route state within Challenge;
- title: “Look complete.”
- context: “After Dark”
- four-piece editorial composition;
- individual products remain tappable;
- action: “Back to Discover”;
- secondary: “View Wardrobe”.

No score, rating, AI critique, social sharing, comments, posting, or purchase prompt.

### 8.7 Completion composition

Small-team feasible layout:

- 2 × 2 product grid with deliberate varying crop and 8 px gutters;
- optional central context label;
- no automated cutout collage requirement;
- completed record uses stored image/product snapshot references.

### 8.8 Completion failure

If state changed during submit:

- keep user on in-progress screen;
- mark invalid slot;
- title: “One piece needs attention.”
- focus moves to error summary, then invalid slot.
- no completion event is implied.

If network/persistence fails:

- preserve all local selections;
- inline banner: “Your look isn’t complete yet. Try again.”
- Retry available.

### 8.9 Challenge version mismatch

If persisted progress uses an incompatible definition:

- do not remap.
- show recovery screen:
  - title: “This challenge has changed.”
  - body: “Your previous selections can’t be carried into the new version.”
  - primary: “Start current challenge”
  - secondary: “Open Wardrobe”
- only clear old progress after explicit start.
- prior completion records remain viewable if valid snapshots exist.

---

## 9. Return and continuation

### 9.1 Session entry sequence

1. App shell renders.
2. Persisted state begins loading.
3. Onboarding status is resolved.
4. If onboarding is incomplete/not started, route to onboarding.
5. If a critical state mutation was interrupted, show recovery.
6. Otherwise route to Discover.
7. Show one continuation card based on priority.

This avoids forcing returning users directly into Challenge while preserving a clear one-action resume path.

### 9.2 Continuation variants

#### Incomplete Challenge

Eyebrow: “Continue your look”  
Title: “After Dark”  
Status: “[n] of 4 pieces selected”  
Action: “Continue”

#### Completed Challenge

Eyebrow: “Your latest look”  
Title: “After Dark”  
Status: “Completed”  
Action: “View look”

#### Wardrobe return

Eyebrow: “Pick up where you left off”  
Title: “Your Wardrobe”  
Status: “[n] saved pieces”  
Action: “Open Wardrobe”

### 9.3 Feed restoration

When returning within a preserved session or from Product Detail:

- restore exact loaded batches and scroll offset.

On a later session:

- open a coherent new Discover session;
- do not attempt pixel-perfect scroll restoration unless feed version and content remain identical;
- continuation card communicates preserved value;
- prior saved state remains synchronized.

### 9.4 Persisted-state failure

If state cannot be loaded:

- enter usable default Discover;
- show non-blocking banner: “We couldn’t restore your previous activity.”
- action: “Try again”.
- do not show onboarding again until status is known; use a short resolution state rather than risking duplicate onboarding.
- do not display Wardrobe as empty until canonical load resolves.

---

## 10. Cross-cutting states

### 10.1 Initial loading

- Use screen-shaped skeletons, not a global spinner.
- Navigation renders only when destination eligibility is known.
- Do not animate more than one skeleton layer.
- Preserve final component dimensions.

### 10.2 Inline loading

- Buttons preserve width.
- Pagination does not block loaded content.
- Product save uses local state.
- Challenge completion blocks only the completion action.

### 10.3 Empty

An empty state must:

- state what is empty;
- avoid blame;
- explain the value of the next action;
- provide one primary recovery path;
- never be used for an error.

### 10.4 Recoverable error

Pattern:

- concise title;
- plain-language cause class when known;
- assurance about preserved state;
- Retry;
- alternate safe route.

Example: “We couldn’t save that piece. Your Wardrobe is unchanged.”

### 10.5 Non-recoverable local state

Pattern:

- preserve navigation shell;
- explain that the specific content is unavailable;
- return to source destination;
- record the error;
- never strand the user.

### 10.6 Offline

- persistent banner with `wifi-off`;
- loaded content remains;
- mutation availability is explicit;
- reconnection status changes to “Back online” for 2 seconds;
- no repeated toast spam.

### 10.7 Destructive actions

Use confirmation only when:

- removing a Wardrobe item invalidates an incomplete Challenge;
- resetting incompatible Challenge progress;
- an action cannot be reliably undone.

Use Undo for routine Wardrobe removal.

No generic “Are you sure?” copy. State the consequence.

### 10.8 Duplicate action protection

- Buttons become locally busy after activation.
- Optimistic states reconcile to canonical response.
- Retried saves/removes do not create duplicate visible records.
- User feedback should not double-announce.

---

## 11. Responsive specifications by surface

| Surface | Mobile | Tablet | Desktop |
|---|---|---|---|
| Onboarding | Full-screen, 2-column choices | Centered max 720 px | Split editorial image/content |
| Discover | 2-column grid | 3-column grid | 4–5 columns + left rail |
| Product Detail | Full-screen stacked | Split in landscape | 58/42 split |
| Wardrobe | 2-column grid | 3-column grid | 4–5 columns |
| Challenge | Vertical slots, sticky bar | 2-column slots | Centered 2-column canvas |
| Picker | Bottom sheet, 92vh max | Centered sheet | Side panel/dialog |
| Continuation | Full-width card | 2/3 width | Max 720 px within feed |

Mobile-specific:

- interactive overlays respect safe areas;
- no essential horizontal scroll;
- sticky completion bar sits above bottom nav;
- keyboard opening must not hide picker actions.

Desktop-specific:

- hover reveals secondary remove/replace affordances but they remain keyboard accessible;
- left rail is persistent;
- maximum reading width is controlled;
- Product Detail gallery may remain sticky independently of information column.

---

## 12. Copy system

Voice:

- concise;
- visually literate;
- non-judgmental;
- not overly luxurious;
- no pseudo-intelligence claims.

Preferred:

- “Save to Wardrobe”
- “Choose a top”
- “Continue your look”
- “Your Wardrobe is unchanged”
- “Try again”

Avoid:

- “You’ll love this”
- “Perfect for you”
- “AI selected”
- “Trending”
- “Must-have”
- “Complete your purchase”
- “Own this”
- “Your style score”

---

## 13. Analytics-sensitive interaction notes

Design must expose distinguishable states for:

- onboarding viewed, selected, deselected, skipped, completed, and failed;
- qualified product visibility;
- card detail activation versus save activation;
- canonical save/remove success versus optimistic appearance;
- Wardrobe empty versus load failure;
- Challenge viewed, started, slot opened, item selected/removed, redirected, invalidated, attempted, and completed;
- continuation cue shown, dismissed, and selected;
- offline/recovery events.

Do not fire completion or canonical state-change semantics from animation start. Visual optimistic feedback may precede event success, but failure must reconcile visibly.

---

## 14. Figma-ready structure and naming

### 14.1 File pages

```text
00_Cover
01_Foundations
02_Components
03_Onboarding
04_Discover
05_Product_Detail
06_Wardrobe
07_Challenge
08_Return_Recovery
09_Responsive
10_Prototype
99_Archive
```

### 14.2 Frame naming

Pattern:

`[Release]/[Surface]/[State]/[Viewport]/[Variant]`

Examples:

- `LR001/Onboarding/Welcome/M390/Default`
- `LR001/Onboarding/Style/M390/TwoSelected`
- `LR001/Discover/Feed/M390/Loaded`
- `LR001/Discover/Feed/M390/PaginationError`
- `LR001/ProductDetail/Loaded/M390/FromDiscover`
- `LR001/Wardrobe/Empty/M390/Default`
- `LR001/Challenge/InProgress/M390/TwoOfFour`
- `LR001/Challenge/Completed/D1440/Default`
- `LR001/Return/Discover/M390/ContinueChallenge`
- `LR001/System/Offline/M390/LoadedFeed`

Viewport codes:

- `M320`
- `M360`
- `M390`
- `T768`
- `D1440`
- `D1728`

### 14.3 Component naming

Pattern:

`Category/Component/Variant/State`

Examples:

- `Action/Button/Primary/Default`
- `Action/Save/Icon/Saved`
- `Product/Card/Standard/ImageError`
- `Challenge/Slot/Required/Invalid`
- `Feedback/Toast/Undo/Visible`
- `Navigation/BottomNav/ChallengeActive/Default`

### 14.4 Variant properties

Use explicit Figma properties:

- `State`: Default, Hover, Focus, Pressed, Disabled, Loading, Error.
- `Saved`: True, False.
- `Selected`: True, False.
- `Viewport`: Mobile, Tablet, Desktop.
- `Motion`: Standard, Reduced.
- `Data`: Complete, Partial, Missing.
- `Theme`: Light only for LR-001; inverse surfaces are component variants, not a dark theme.

### 14.5 Prototype paths

Prototype 1 — Minimum valid journey:

`Welcome → Style → Mood → Discover → Product Detail → Save → Wardrobe → Challenge → Select slots → Complete → Discover`

Prototype 2 — Return:

`Discover with continuation → Challenge in-progress → leave → return → continue → complete`

Prototype 3 — Recovery:

`Pagination error → Retry → Product Detail unavailable → back → offline → reconnect`

Prototype 4 — Destructive dependency:

`Wardrobe → remove selected Challenge item → confirm → Challenge invalidated → recover`

---

## 15. Engineering implementation notes

### 15.1 State ownership

- Saved state must be canonical and shared across all surfaces.
- UI components receive mutation state rather than maintaining independent saved truth.
- Product Detail source context includes route, item identity, scroll restoration key, and optional Challenge slot.
- Challenge selections reference canonical product IDs plus snapshot data required for completed-history integrity.

### 15.2 Scroll restoration

Store per navigation context:

- route key;
- feed/order version;
- loaded batch cursors;
- item IDs in order;
- viewport scroll offset;
- continuation-card dismissal.

Restore before image transition completes. If context is incompatible, fall back to nearest product anchor or top with a non-disruptive behavior.

### 15.3 Images

- Use responsive image sources and explicit width/height or aspect ratio.
- Prioritize first viewport images.
- Lazy-load below viewport.
- Avoid layout shift.
- Use low-quality placeholders only when source pipeline supports them reliably.
- Preserve alt text separately from visual caption.

### 15.4 Component architecture

Suggested primitives:

- `ScreenShell`
- `AppHeader`
- `PrimaryNavigation`
- `ProductCard`
- `ProductImage`
- `SaveControl`
- `ProductGallery`
- `StateBoundary`
- `EmptyState`
- `InlineError`
- `OfflineBanner`
- `ContinuationCard`
- `ChallengeSlot`
- `SlotPicker`
- `CompletionBar`
- `UndoToast`
- `ConfirmSheet`

Do not fork product card state logic by surface. Compose visual variants over one canonical interaction contract.

### 15.5 Accessibility implementation

- Use native button/link semantics.
- Use `:focus-visible`.
- Dialog focus return must be tested.
- Announce save success/failure once.
- Do not announce every feed insertion.
- Preserve heading hierarchy across route transitions.
- Test keyboard path and screen-reader labels before visual polish sign-off.
- Respect `prefers-reduced-motion`.

### 15.6 Motion implementation

- Shared-element transition is progressive enhancement.
- The fallback must preserve navigation correctness.
- Avoid motion dependencies that require a heavy animation framework if CSS/View Transitions can meet behavior.
- Never delay route state or analytics until animation completion.
- Cancel obsolete animation on rapid navigation.

### 15.7 Error boundaries

Use local boundaries for:

- ProductCard image;
- pagination;
- Product Detail data;
- Wardrobe data;
- Challenge picker;
- Challenge completion.

A local failure must not collapse the app shell or erase valid persisted UI.

### 15.8 Test IDs and state matrix

Engineering should expose stable selectors based on component roles, not visual text where localization/copy may change.

Required automated interaction coverage:

- onboarding skip and completion;
- feed pagination retry;
- save from feed and detail synchronization;
- Product Detail return restoration;
- Wardrobe empty/populated;
- removal with Undo;
- removal affecting incomplete Challenge;
- empty Challenge slot redirect;
- completion disabled/enabled;
- completion persistence;
- return continuation;
- offline and state-load failure;
- reduced motion and keyboard path.

---

## 16. Design acceptance criteria

WP-003 implementation fidelity is acceptable when:

- imagery dominates every primary surface;
- the interface does not resemble generic commerce;
- all PRD states have defined visual and interaction behavior;
- save state is identical across Discover, Detail, Wardrobe, and Challenge;
- Challenge can be completed without drag-and-drop;
- return continuation is visible but not coercive;
- mobile 320–430 px and desktop 1440 px remain usable;
- focus and reduced-motion variants exist;
- destructive dependencies are explicit;
- false commerce and speculative features are absent;
- the minimum valid journey can be prototyped without unresolved screen behavior.
