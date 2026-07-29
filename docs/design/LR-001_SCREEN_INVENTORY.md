# A L T E R . — LR-001 Screen and State Inventory

**Document ID:** SI-LR-001  
**Work package:** WP-003 Design Foundation  
**Status:** Implementation-ready  
**Owner:** Product Design  
**Release:** Learning Release 001  
**Last updated:** 2026-07-19  

---

## 1. Inventory conventions

### 1.1 IDs

- `ONB` — Onboarding
- `DIS` — Discover
- `PDP` — Product Detail
- `WAR` — Wardrobe
- `CHL` — Challenge
- `RET` — Return/continuation
- `SYS` — System and recovery

### 1.2 Required viewport coverage

Every state marked **Core** requires:

- `M320`
- `M390`
- `D1440`

Every state marked **Responsive** additionally requires:

- `T768`
- `D1728`

### 1.3 State completeness

Each screen record identifies:

- trigger;
- required content;
- primary action;
- secondary/recovery action;
- navigation;
- accessibility state;
- motion state;
- analytics-sensitive distinction.

---

## 2. Master inventory

| ID | Surface | State | Priority | Primary purpose |
|---|---|---|---|---|
| ONB-01 | Onboarding | Welcome | Core | Explain value and start/skip |
| ONB-02 | Onboarding | Style, none selected | Core | Visual preference input |
| ONB-03 | Onboarding | Style, selected | Core | Confirm multi-selection state |
| ONB-04 | Onboarding | Style, max reached | Core | Explain selection limit |
| ONB-05 | Onboarding | Mood, none selected | Core | Context preference input |
| ONB-06 | Onboarding | Mood, selected | Core | Confirm selections |
| ONB-07 | Onboarding | Submitting | Core | Prevent duplicate completion |
| ONB-08 | Onboarding | Persistence error | Core | Retry or fallback |
| DIS-01 | Discover | Initial loading | Core | Stable first paint |
| DIS-02 | Discover | Loaded, first session | Core | Primary browsing |
| DIS-03 | Discover | Loaded, return continuation | Core | Resume prior value |
| DIS-04 | Discover | Pagination loading | Core | Continue browsing |
| DIS-05 | Discover | Pagination error | Core | Retry without losing content |
| DIS-06 | Discover | Empty | Core | Recover from no catalog result |
| DIS-07 | Discover | Exhausted | Core | Honest terminal state |
| DIS-08 | Discover | Image error card | Core | Preserve product action |
| DIS-09 | Discover | Save optimistic | Core | Immediate feedback |
| DIS-10 | Discover | Save failed | Core | Reconcile canonical state |
| DIS-11 | Discover | Challenge category context | Core | Find eligible slot product |
| PDP-01 | Product Detail | Loading | Core | Stable transition |
| PDP-02 | Product Detail | Loaded unsaved | Core | Inspect and save |
| PDP-03 | Product Detail | Loaded saved | Core | Inspect and remove |
| PDP-04 | Product Detail | Partial data | Core | Avoid broken labels |
| PDP-05 | Product Detail | Image error | Core | Preserve information/actions |
| PDP-06 | Product Detail | Unavailable product | Core | Recover to source |
| PDP-07 | Product Detail | Save/remove pending | Core | Prevent duplicate mutation |
| PDP-08 | Product Detail | Save/remove error | Core | Retry and restore state |
| PDP-09 | Product Detail | From Challenge slot | Core | Save then choose for slot |
| WAR-01 | Wardrobe | Loading | Core | Distinguish from empty |
| WAR-02 | Wardrobe | Populated | Core | Revisit saved products |
| WAR-03 | Wardrobe | Empty | Core | Route to Discover |
| WAR-04 | Wardrobe | Load error | Core | Retry without false empty |
| WAR-05 | Wardrobe | Removing with Undo | Core | Reversible removal |
| WAR-06 | Wardrobe | Remove dependency confirm | Core | Protect in-progress Challenge |
| WAR-07 | Wardrobe | Remove dependency error | Core | Preserve both states |
| CHL-01 | Challenge | Loading | Core | Resolve active definition/state |
| CHL-02 | Challenge | Unstarted, Wardrobe populated | Core | Explain/start |
| CHL-03 | Challenge | Unstarted, Wardrobe empty | Core | Route to Discover |
| CHL-04 | Challenge | In progress, zero selected | Core | Show required slots |
| CHL-05 | Challenge | In progress, partial | Core | Continue selection |
| CHL-06 | Challenge | In progress, valid complete set | Core | Enable explicit completion |
| CHL-07 | Challenge | Slot picker loading | Core | Load eligible Wardrobe |
| CHL-08 | Challenge | Slot picker populated | Core | Select/replace |
| CHL-09 | Challenge | Slot picker empty category | Core | Discover redirect |
| CHL-10 | Challenge | Slot selected | Core | Confirm assignment |
| CHL-11 | Challenge | Slot invalid | Core | Recover invalidated state |
| CHL-12 | Challenge | Completion submitting | Core | Prevent duplicate completion |
| CHL-13 | Challenge | Completion error | Core | Preserve selections and retry |
| CHL-14 | Challenge | Completed | Core | Persistent outfit record |
| CHL-15 | Challenge | Completed item removed | Core | Preserve history integrity |
| CHL-16 | Challenge | Version mismatch | Core | Explicit progress reset |
| RET-01 | Return | State resolution | Core | Avoid duplicate onboarding |
| RET-02 | Return | Continue incomplete Challenge | Core | Resume progress |
| RET-03 | Return | Revisit completed Challenge | Core | Revisit completion |
| RET-04 | Return | Return to Wardrobe | Core | Resume saved collection |
| RET-05 | Return | Persisted state failure | Core | Usable fallback |
| RET-06 | Return | Interrupted mutation recovery | Core | Reconcile uncertain state |
| SYS-01 | System | Offline with loaded content | Core | Preserve browsing |
| SYS-02 | System | Offline without content | Core | Retry and cached route |
| SYS-03 | System | Reconnecting | Core | Explain recovery |
| SYS-04 | System | Back online | Core | Confirm restoration |
| SYS-05 | System | Generic local error | Core | Retry/alternate route |
| SYS-06 | System | Destructive confirmation | Core | Explain consequence |
| SYS-07 | System | Undo toast | Core | Reverse routine remove |
| SYS-08 | System | Reduced motion | Responsive | Replace nonessential motion |
| SYS-09 | System | Keyboard focus states | Responsive | Full primary journey |
| SYS-10 | System | 200% text zoom | Responsive | Reflow without clipping |

---

## 3. Detailed screen specifications

## 3.1 Onboarding

### ONB-01 — Welcome

**Trigger:** First eligible launch with unresolved/not-started onboarding.  
**Content:** Wordmark, editorial image, value headline, one-sentence explanation.  
**Primary:** Start.  
**Secondary:** Skip for now.  
**Navigation:** No primary nav; browser back exits or remains on welcome depending platform shell.  
**Accessibility:** One `h1`; image alt or decorative treatment; visible focus; actions announced clearly.  
**Motion:** Deliberate image/text entrance; reduced motion uses static composition.  
**Analytics distinction:** `onboarding_viewed`.

### ONB-02 — Style / none selected

**Trigger:** Start from welcome or back from Mood.  
**Content:** Question, instruction, six image tiles, “1 of 2”.  
**Primary:** Continue.  
**Secondary:** Back.  
**State:** Continue is enabled at zero selections.  
**Accessibility:** Tile is checkbox semantic; selected state not color-only.  
**Analytics distinction:** No selection event until deliberate input.

### ONB-03 — Style / selected

**Trigger:** One to four selections.  
**State:** Check icon, accent border, selected label.  
**Primary:** Continue.  
**Recovery:** Selection can be toggled off.  
**Analytics distinction:** selection and removal are separate observable actions.

### ONB-04 — Style / max reached

**Trigger:** Attempt fifth selection.  
**State:** Existing four remain; attempted tile does not select.  
**Message:** “Choose up to four. Remove one to add another.”  
**Accessibility:** Message associated with choice group and announced politely.  
**Motion:** No shake.

### ONB-05 — Mood / none selected

**Trigger:** Continue from Style.  
**Content:** Six context choices, “2 of 2”.  
**Primary:** Show my feed.  
**Secondary:** Skip choices; Back.  
**State:** Completion allowed with zero.

### ONB-06 — Mood / selected

**Trigger:** One or more context choices selected.  
**State:** Persistent multi-selection.  
**Primary:** Show my feed.

### ONB-07 — Submitting

**Trigger:** Completion/skip activation.  
**State:** Activated control becomes loading; all submission controls disabled; visual choices remain visible.  
**Accessibility:** Announce “Saving choices.”  
**Analytics distinction:** Do not emit completed until canonical success.

### ONB-08 — Persistence error

**Trigger:** Onboarding preference or completion state fails to persist.  
**Content:** Error message assuring choices remain locally.  
**Primary:** Try again.  
**Secondary:** Continue with default feed.  
**Accessibility:** Focus error heading; actions labelled by outcome.  
**Analytics distinction:** `onboarding_error`, fallback completion is not preference completion.

---

## 3.2 Discover

### DIS-01 — Initial loading

**Trigger:** Enter Discover without loaded feed.  
**Content:** Header, six mobile/twelve desktop product skeletons, primary nav.  
**Primary:** None.  
**Recovery:** Error replaces skeleton when known.  
**Accessibility:** Single loading announcement; skeleton hidden from accessibility tree.  
**Motion:** Shimmer or static in reduced motion.

### DIS-02 — Loaded / first session

**Trigger:** Initial feed success.  
**Content:** Header, deterministic product grid.  
**Primary:** Open product.  
**Secondary:** Save/remove.  
**Navigation:** Bottom nav/desktop rail.  
**Accessibility:** Product link and save button have distinct semantics.  
**Analytics distinction:** Impression only after qualified visibility.

### DIS-03 — Loaded / return continuation

**Trigger:** Return state qualifies for continuation.  
**Content:** Continuation card above grid.  
**Primary:** Continue exact state.  
**Secondary:** Dismiss.  
**Analytics distinction:** Shown, selected, dismissed are distinct.

### DIS-04 — Pagination loading

**Trigger:** Near end of loaded products.  
**Content:** Loaded feed retained; appended skeleton cards.  
**Primary:** Existing interactions remain active.  
**Motion:** New content fades in without jump.

### DIS-05 — Pagination error

**Trigger:** Additional batch failure.  
**Content:** Loaded products plus inline retry row.  
**Primary:** Try again.  
**Secondary:** Continue browsing loaded content.  
**Accessibility:** Retry row is next in reading order.

### DIS-06 — Empty

**Trigger:** Successful feed response with zero valid products.  
**Content:** Empty-state title/body.  
**Primary:** Try again.  
**Secondary:** Open Wardrobe if applicable.  
**Analytics distinction:** Must not share visual semantics with load error.

### DIS-07 — Exhausted

**Trigger:** Catalog/order session exhausted.  
**Content:** Honest terminal module.  
**Primary:** Back to top.  
**Secondary:** Open Wardrobe.  
**Accessibility:** Module is a section heading, not an error alert.

### DIS-08 — Image error card

**Trigger:** Product image fails.  
**Content:** Stable placeholder, product identity, save control.  
**Primary:** Open detail.  
**Secondary:** Save/remove.  
**State:** Card geometry unchanged.

### DIS-09 — Save optimistic

**Trigger:** Save/remove input.  
**State:** Icon transitions immediately; local busy state.  
**Accessibility:** Success announced only after canonical success.

### DIS-10 — Save failed

**Trigger:** Mutation failure.  
**State:** Revert icon to canonical prior state.  
**Content:** Toast/inline message with Retry.  
**Analytics distinction:** No successful save/remove event.

### DIS-11 — Challenge category context

**Trigger:** Redirect from empty Challenge slot.  
**Content:** Context header “Finding: Shoes” or relevant category, feed.  
**Primary:** Open/save eligible product.  
**Secondary:** Back to look.  
**State:** Challenge progress intact.  
**Accessibility:** Context header is programmatically associated with page title.

---

## 3.3 Product Detail

### PDP-01 — Loading

**Trigger:** Open valid route before data resolves.  
**Content:** Gallery and text skeleton, back button.  
**Primary:** Back remains active.  
**Motion:** Shared-image transition only where data and image are stable.

### PDP-02 — Loaded unsaved

**Content:** Gallery, product identity, available attributes, save action.  
**Primary:** Save to Wardrobe.  
**Secondary:** Back.  
**Analytics distinction:** Source surface retained.

### PDP-03 — Loaded saved

**Content:** Same hierarchy with “Saved” state.  
**Primary:** Remove behavior.  
**State:** Filled bookmark and explicit text.

### PDP-04 — Partial data

**Trigger:** Optional fields missing.  
**Content:** Render only verified fields.  
**State:** No “N/A”, empty rows, or invented copy.

### PDP-05 — Image error

**Trigger:** One/all images fail.  
**Content:** Stable placeholder and all valid text/actions.  
**Recovery:** Retry image may be automatic/manual based on implementation.

### PDP-06 — Unavailable

**Trigger:** Invalid or removed product.  
**Content:** Availability message.  
**Primary:** Go back.  
**Secondary:** Open Discover.  
**Accessibility:** Focus heading; no broken gallery semantics.

### PDP-07 — Mutation pending

**Trigger:** Save/remove.  
**State:** Sticky action loading; route/back remain usable only if mutation can safely continue/cancel.  
**Duplicate protection:** Ignore repeated activation.

### PDP-08 — Mutation error

**Trigger:** Save/remove failure.  
**State:** Restore prior canonical state.  
**Primary:** Try again.  
**Secondary:** Dismiss message.

### PDP-09 — From Challenge

**Trigger:** Product opened with `slotId` source context.  
**Content:** Standard Detail plus eligible post-save action.  
**Primary:** Save or “Choose for [slot]”.  
**Return:** Exact picker/Challenge context.

---

## 3.4 Wardrobe

### WAR-01 — Loading

**Trigger:** Wardrobe route before canonical saved items resolve.  
**Content:** Header/count skeleton, grid skeleton.  
**Rule:** Never show empty state during load.

### WAR-02 — Populated

**Content:** Title, saved count, recent-first grid.  
**Primary:** Open product.  
**Secondary:** Remove.  
**Navigation:** Persistent primary nav.

### WAR-03 — Empty

**Trigger:** Canonical successful state has zero saved items.  
**Content:** Editorial empty visual, value copy.  
**Primary:** Explore pieces.

### WAR-04 — Load error

**Trigger:** Canonical Wardrobe request fails.  
**Content:** Assurance that items are unchanged.  
**Primary:** Try again.  
**Secondary:** Open Discover.

### WAR-05 — Removing with Undo

**Trigger:** Routine remove not affecting incomplete Challenge.  
**State:** Card collapses after success; Undo toast for five seconds.  
**Focus:** Next card or empty-state heading.  
**Undo:** Restores card in original deterministic position where feasible.

### WAR-06 — Dependency confirmation

**Trigger:** Remove item currently selected in incomplete Challenge.  
**Content:** Explicit consequence.  
**Primary safe action:** Keep piece.  
**Destructive action:** Remove.  
**Accessibility:** Initial focus on safe action; destructive label includes consequence.

### WAR-07 — Dependency removal error

**Trigger:** Atomic removal/Challenge clear fails.  
**State:** Card and slot remain unchanged.  
**Primary:** Try again.  
**Message:** “Nothing was removed.”

---

## 3.5 Challenge

### CHL-01 — Loading

**Trigger:** Challenge route before definition/progress resolves.  
**Content:** Hero and slot skeletons.  
**Rule:** Do not display unstarted state until progress resolution completes.

### CHL-02 — Unstarted / Wardrobe populated

**Content:** Context hero, four-slot preview, explanation.  
**Primary:** Start challenge.  
**Secondary:** Explore pieces.

### CHL-03 — Unstarted / Wardrobe empty

**Content:** Same context plus eligibility explanation.  
**Primary:** Explore pieces.  
**Secondary:** Start may remain available, leading to empty slot recovery; preferred baseline is Explore first.

### CHL-04 — In progress / zero selected

**Content:** Four empty required slots, 0 of 4 progress.  
**Primary:** First slot selection.  
**Completion:** Disabled with visible explanation.

### CHL-05 — In progress / partial

**Content:** Mixed selected/empty slots, progress count.  
**Primary:** Add/replace pieces.  
**Secondary:** Remove selection.  
**Persistence:** Leaving route retains state.

### CHL-06 — In progress / all valid

**Content:** Four selected valid slots.  
**Primary:** Complete look enabled.  
**Secondary:** Replace/remove before completion.

### CHL-07 — Slot picker loading

**Trigger:** Open slot.  
**Content:** Sheet title and picker skeleton rows.  
**Navigation:** Close returns focus to slot.

### CHL-08 — Slot picker populated

**Content:** Eligible saved products, current selection.  
**Primary:** Choose product.  
**Secondary:** Open Product Detail; close.  
**Accessibility:** Single-select radiogroup semantics are acceptable.

### CHL-09 — Slot picker empty

**Content:** No saved category state.  
**Primary:** Find [category].  
**Secondary:** Back to look.

### CHL-10 — Slot selected

**Trigger:** Product choice.  
**State:** Picker closes; slot updates; progress increments.  
**Accessibility:** Announce “[product] selected for [slot].”

### CHL-11 — Slot invalid

**Trigger:** Product removed/unavailable/ineligible.  
**Content:** Error summary and invalid slot.  
**Primary:** Choose another piece.  
**Completion:** Disabled.

### CHL-12 — Completion submitting

**Trigger:** Complete look.  
**State:** Button loading; all slots remain visible.  
**Duplicate protection:** Ignore repeated activation.

### CHL-13 — Completion error

**Trigger:** Persistence or validation failure.  
**Content:** Preserved selections and specific recovery.  
**Primary:** Try again or resolve invalid slot.  
**Accessibility:** Focus error summary.

### CHL-14 — Completed

**Content:** Context, four-piece composition, completed status.  
**Primary:** Back to Discover.  
**Secondary:** View Wardrobe.  
**Navigation:** Primary nav remains available.  
**Prohibited:** score, rating, share, comments, purchase.

### CHL-15 — Completed item removed

**Trigger:** Wardrobe removal after completion.  
**Content:** Completion snapshot unchanged; affected item labelled “No longer in Wardrobe.”  
**Primary:** Product detail may be unavailable; route recovers safely.

### CHL-16 — Version mismatch

**Trigger:** Persisted progress incompatible with active challenge.  
**Content:** Explicit change explanation.  
**Primary:** Start current challenge.  
**Secondary:** Open Wardrobe.  
**Destructive behavior:** Old progress cleared only after explicit action.

---

## 3.6 Return and system

### RET-01 — State resolution

**Trigger:** App return before persisted state known.  
**Content:** Branded shell/resolution state.  
**Rule:** Do not flash onboarding, empty Wardrobe, or unstarted Challenge.

### RET-02 — Continue Challenge

**Trigger:** Incomplete Challenge with valid progress.  
**Content:** Discover continuation card.  
**Primary:** Continue.  
**Secondary:** Dismiss.

### RET-03 — Revisit completed Challenge

**Trigger:** Latest completion in the first return session after completion.
**Content:** Completed-look continuation card.
**Primary:** View look.
**Rule:** Later return sessions do not repeat this completion cue.

### RET-04 — Return to Wardrobe

**Trigger:** Wardrobe was last meaningful destination, at least one non-removed saved row exists, and no higher priority cue.
**Content:** Wardrobe continuation card.
**Primary:** Open Wardrobe.
**Rule:** An unavailable-only Wardrobe may still qualify.

### RET-04A — No continuation candidate

**Trigger:** No canonical candidate qualifies.
**Content:** Normal Discover without a continuation card.
**Rule:** Discover is not itself a continuation-card candidate.

### RET-05 — Persisted-state failure

**Trigger:** State request fails/corrupt.  
**Content:** Usable default Discover plus banner.  
**Primary:** Try again.  
**Rule:** Do not silently overwrite remote/canonical state.

### RET-05A — Continuation resolver failure

**Trigger:** A higher-priority candidate query or contract fails.
**Content:** Compact retryable error in the continuation region plus usable Discover.
**Primary:** Try again.
**Rule:** Do not silently fall through, fabricate a candidate, or expose raw errors.

### RET-05B — Continuation consumed

**Trigger:** The card was dismissed or successfully activated in the current return session.
**Content:** Normal Discover without the consumed card.
**Persistence:** Identity-scoped, session-scoped, versioned browser state survives same-session reload.
**Reset:** A new strictly-greater-than-30-minute return session reevaluates candidates.

### RET-06 — Interrupted mutation recovery

**Trigger:** Prior save/remove/completion has unknown result.  
**Content:** Resolution banner or blocking state only if required.  
**Primary:** Check status/Try again.  
**Rule:** Reconcile canonical result before presenting action as failed or successful.

### SYS-01 — Offline with loaded content

**Content:** Offline banner; loaded feed/Wardrobe remains.  
**Mutation:** Explicitly queued or disabled; never ambiguous.

### SYS-02 — Offline without content

**Content:** Full state.  
**Primary:** Try again.  
**Secondary:** Open cached Wardrobe if available.

### SYS-03 — Reconnecting

**Content:** Banner “Reconnecting…”  
**Motion:** Static progress or subtle spinner; reduced motion static text.

### SYS-04 — Back online

**Content:** Temporary banner “Back online.”  
**Duration:** Two seconds; screen-reader announcement once.

### SYS-05 — Generic local error

**Content:** Local error boundary, preserved shell.  
**Primary:** Retry.  
**Secondary:** Safe route.

### SYS-06 — Destructive confirmation

**Content:** Consequence-specific title/body.  
**Primary safe:** Cancel/Keep.  
**Destructive:** Explicit verb.

### SYS-07 — Undo toast

**Content:** State result and Undo.  
**Duration:** Five seconds; pauses while keyboard focus is inside toast.

### SYS-08 — Reduced motion

**Coverage:** All screens with motion.  
**State:** Crossfades/static skeletons; no shared scaling/pulse/translation.

### SYS-09 — Keyboard focus

**Coverage:** All primary actions and dialogs.  
**Deliverable:** Focus-visible frames and annotated order.

### SYS-10 — 200% text zoom

**Coverage:** Core mobile and desktop screens.  
**Deliverable:** Reflow frames or annotations showing no clipping/hidden action.

---

## 4. Figma frame checklist

The following minimum frames are required for implementation handoff:

### Onboarding — 8 frames

- Welcome
- Style none
- Style selected
- Style max
- Mood none
- Mood selected
- Submitting
- Error

### Discover — 11 frames

- Initial loading
- First-session loaded
- Return continuation
- Pagination loading
- Pagination error
- Empty
- Exhausted
- Image-error card
- Save optimistic
- Save error
- Challenge category context

### Product Detail — 9 frames

- Loading
- Loaded unsaved
- Loaded saved
- Partial data
- Image error
- Unavailable
- Mutation pending
- Mutation error
- Challenge source

### Wardrobe — 7 frames

- Loading
- Populated
- Empty
- Load error
- Remove with Undo
- Dependency confirmation
- Dependency error

### Challenge — 16 frames

- Loading
- Unstarted populated
- Unstarted empty
- Zero selected
- Partial
- All valid
- Picker loading
- Picker populated
- Picker empty
- Selected
- Invalid
- Completing
- Completion error
- Completed
- Completed item removed
- Version mismatch

### Return/system — 16 frames

- Return resolution
- Continue Challenge
- Revisit complete
- Return Wardrobe
- State failure
- Interrupted mutation
- Offline loaded
- Offline empty
- Reconnecting
- Back online
- Generic local error
- Destructive confirmation
- Undo
- Reduced motion annotation
- Keyboard focus annotation
- 200% zoom annotation

**Total baseline state frames:** 67 before responsive duplicates.

---

## 5. Traceability to PRD requirement families

| Design surface | PRD family |
|---|---|
| ONB-01–08 | ONB-001–008 |
| DIS-01–11 | FEE-001–012 |
| PDP-01–09 | PDP-001–009 |
| WAR-01–07 | WAR-001–010 |
| CHL-01–16 | CHL-001–015 |
| RET-01–06 | RET-001–008 |
| SYS-01–10 | Cross-cutting interaction, loading, accessibility, responsive, performance |

---

## 6. Screen inventory completion rule

The inventory is complete for implementation only when every Core state has:

- a Figma frame or explicit component-driven equivalent;
- content and action copy;
- navigation and back behavior;
- focus entry/return behavior;
- loading/error distinction;
- motion and reduced-motion annotation;
- mobile and desktop layout guidance;
- state ownership and mutation notes;
- analytics-sensitive state annotation.
