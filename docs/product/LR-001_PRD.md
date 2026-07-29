# A L T E R . — Learning Release 001 Product Requirements Document

**Document ID:** PRD-LR-001  
**Work package:** WP-002 Product Foundation  
**Status:** Implementation-ready  
**Owner:** Product  
**Release:** Learning Release 001  
**Last updated:** 2026-07-19  

---

## 1. Purpose

Define the product behavior, user journeys, functional requirements, scope boundaries, acceptance criteria, and learning design for Learning Release 001.

This release tests whether users naturally:

1. explore fashion products;
2. inspect products that attract them;
3. save meaningful items;
4. construct an outfit for a defined context; and
5. return to continue one or more of those activities.

The release must provide direct user value and feel intentional, fluid, distinctive, and trustworthy. It must not resemble a survey, research panel, generic marketplace, or unfinished commerce template.

---

## 2. Source-of-truth hierarchy

This PRD implements the current project constitution, operating system, roadmap, and LR-001 release definition.

Where this document is silent:

1. use the active canonical repository document for the relevant domain;
2. do not infer excluded functionality;
3. prefer the smallest professional behavior that preserves the learning objective;
4. escalate only concrete contradictions that materially affect scope, validity, privacy, or implementation.

---

## 3. Release objective

### 3.1 Primary product question

Do target users naturally explore fashion products, save meaningful items, create an outfit for a context, and return to continue the experience?

### 3.2 User value proposition

Discover products that fit your identity, keep the pieces that matter, and build outfits for situations you care about.

### 3.3 Core loop

`Discover → Inspect → Save → Combine → Reconsider → Return`

### 3.4 Primary learning objective

Determine whether the combined discovery, saving, and outfit-building loop generates sufficient voluntary behavior to justify continued investment in the current consumer product direction.

### 3.5 Release decision options

After the initial observation window, Product and HQ choose one:

- continue the current loop;
- revise the experience;
- narrow to the strongest mechanic;
- stop or pivot.

No predictive, enterprise, or platform claim may be inferred from LR-001 behavior alone.

---

## 4. Scope

### 4.1 Included

- lightweight style onboarding;
- infinite discovery feed;
- product detail;
- save and remove;
- personal wardrobe;
- one context-based outfit challenge;
- persistent user state;
- return behavior and continuation cues;
- minimum behavioral instrumentation required to answer the primary question;
- loading, empty, error, and recovery states for included capabilities.

### 4.2 Explicitly excluded

- open community posting;
- social graph, following, comments, likes, or messaging;
- simulated or fake shipping lifecycle;
- product maintenance mechanics;
- full virtual economy;
- BFF or conversational advice system;
- Aura/QIE or composite scoring;
- enterprise dashboards;
- predictive claims;
- checkout, payment, order management, or actual commerce transaction;
- seller tooling;
- user-generated product catalog;
- multi-context challenge system;
- public outfit publishing;
- collaborative wardrobes;
- notifications outside the product;
- personalization models that require complex machine learning.

### 4.3 Scope control rule

A capability is in scope only when it directly supports one of these actions:

- discover;
- inspect;
- save;
- remove;
- revisit;
- combine;
- complete a challenge;
- return and continue;
- measure the above behavior.

Anything else requires a separate work-package decision.

---

## 5. Target user and assumptions

### 5.1 Working target user

A mobile-first fashion-interested user who:

- enjoys browsing products without an immediate purchase requirement;
- uses fashion as a form of identity or self-expression;
- benefits from keeping a personal shortlist;
- can understand a lightweight outfit-building task;
- expects consumer-grade visual and interaction quality.

This is a working product definition, not a validated market segment.

### 5.2 Key assumptions to test

- users understand the product value without extensive explanation;
- lightweight preference input improves perceived feed relevance enough to justify onboarding friction;
- browsing products is intrinsically engaging;
- saving represents meaningful intent rather than indiscriminate collection;
- a constrained outfit challenge is understandable and completable;
- saved items create a reason to revisit;
- persisted progress makes return sessions feel continuous rather than repetitive.

---

## 6. Product principles for LR-001

1. **Value before extraction:** every tracked behavior must arise from a real product action.
2. **Low-friction entry:** onboarding is brief and skippable where possible.
3. **Visual primacy:** product imagery and styling decisions dominate the experience.
4. **Immediate reversibility:** saves, removals, and outfit selections can be undone.
5. **Clear state:** the user can always tell what is saved, selected, completed, or pending.
6. **Continuity:** returning users resume a coherent state.
7. **No false commerce:** the interface must not imply that payment, shipping, ownership, or delivery exists.
8. **Professional quality:** loading, empty, failure, and edge states are designed, not omitted.
9. **Measurement integrity:** events reflect observable actions, not inferred emotions or intent.
10. **Release discipline:** no speculative feature may delay the core loop.

---

## 7. Information architecture

LR-001 has four primary destinations:

1. **Discover** — infinite product feed.
2. **Wardrobe** — saved products.
3. **Challenge** — one context-based outfit task.
4. **Product Detail** — contextual destination opened from Discover, Wardrobe, or Challenge.

Onboarding precedes the first Discover session. Return sessions open into a continuation state defined in Section 13.

A persistent primary navigation mechanism must provide direct access to Discover, Wardrobe, and Challenge after onboarding. Product Detail may be presented as a full screen, route, sheet, or equivalent implementation pattern, provided state and navigation acceptance criteria are met.

---

## 8. End-to-end primary user journey

### 8.1 First session

1. User opens A L T E R .
2. User sees a concise value proposition.
3. User completes or skips lightweight style onboarding.
4. User enters Discover.
5. User scrolls through products.
6. User opens one or more product details.
7. User saves at least one product.
8. User opens Wardrobe and sees the saved product.
9. User enters the Outfit Challenge.
10. User selects products for required outfit slots.
11. User completes the outfit.
12. User may return to Discover, inspect the completed outfit, or leave.

### 8.2 Return session

1. User reopens A L T E R .
2. Product recognizes persisted state.
3. User sees a continuation cue tied to prior behavior.
4. User resumes Discover, Wardrobe, or an incomplete/completed challenge.
5. New actions update the same persisted state without duplication or loss.

### 8.3 Minimum valid journey

A release participant must be able to complete this sequence without administrative intervention:

`Open → Onboard/Skip → Browse → Open detail → Save → View Wardrobe → Start Challenge → Select items → Complete Challenge → Exit → Return → Resume`

---

## 9. Onboarding requirements

### 9.1 Goal

Provide enough context and preference input to begin a credible discovery experience without creating material abandonment.

### 9.2 Required flow

On first eligible launch:

1. show a concise product promise;
2. request lightweight style preference input;
3. make progress visible;
4. allow completion;
5. allow skipping preference collection;
6. route the user into Discover;
7. persist onboarding status and submitted preferences.

### 9.3 Preference input

The onboarding mechanism must:

- use visual or plain-language choices understandable without fashion expertise;
- require no sensitive personal data;
- avoid body measurements, protected traits, financial information, or purchase history;
- allow multiple selections when the interaction model supports it;
- clearly indicate selected and unselected states;
- provide a usable feed when the user skips or selects nothing.

The exact taxonomy and visual assets are a Design deliverable. Product requires that preference options be versioned so behavior can be interpreted against the presented onboarding set.

### 9.4 Onboarding states

- not started;
- in progress;
- completed with preferences;
- completed without preferences;
- skipped;
- recoverable error.

### 9.5 Functional requirements

**ONB-001** The product shall present onboarding only when no completed or skipped onboarding state exists for the current user state.

**ONB-002** The product shall communicate the core value proposition before requesting preference input.

**ONB-003** The user shall be able to complete onboarding without creating content, inviting contacts, making a purchase, or enabling notifications.

**ONB-004** The user shall be able to skip preference input and enter Discover.

**ONB-005** Selected preferences shall remain visibly selected while the user remains in onboarding.

**ONB-006** Completion or skip state shall persist across refresh, app restart, and return session.

**ONB-007** Failed preference persistence shall not trap the user; the product shall show a recoverable error and permit retry or continue with a fallback feed.

**ONB-008** The active onboarding definition shall have a version identifier attached to completion data.

### 9.6 Acceptance criteria

- Given a first-time user, when the product opens, then onboarding is shown before Discover.
- Given a returning user who completed or skipped onboarding, when the product opens, then onboarding is not shown again.
- Given a user has selected preferences, when they move backward and forward within onboarding, then selections remain intact.
- Given a user selects skip, when the action succeeds, then Discover opens with a valid default feed.
- Given persistence fails, when the user retries, then the system attempts persistence without duplicating completion events.
- Given onboarding completes, when the user refreshes or returns, then completion state remains valid.

---

## 10. Infinite discovery feed requirements

### 10.1 Goal

Deliver an engaging, low-friction stream of fashion products that supports inspection and saving.

### 10.2 Feed item content

Each product card must provide enough information to support a meaningful inspect/save decision. At minimum:

- primary product image;
- product name or concise identifier;
- brand or source label when available;
- category or product type;
- save state;
- clear path to Product Detail.

Price may be displayed when source data contains a valid price, but LR-001 must not imply checkout availability.

### 10.3 Feed behavior

- feed content loads in batches;
- additional content loads as the user approaches the end of loaded content;
- existing scroll position remains stable while more content loads;
- duplicate products are not shown within the same feed session unless the catalog is exhausted and repetition is explicitly handled;
- saved state is synchronized with Wardrobe;
- an exhausted or unavailable feed presents a designed terminal or recovery state;
- feed remains usable for users who skipped onboarding.

### 10.4 Ordering

LR-001 may use a simple deterministic, preference-filtered, curated, or randomized baseline. A complex recommendation model is not required.

The active ordering logic must be versioned or otherwise identifiable in event data. Product does not prescribe the technical implementation.

### 10.5 Functional requirements

**FEE-001** The product shall render an initial feed after onboarding or on direct return to Discover.

**FEE-002** The user shall be able to scroll continuously through loaded products.

**FEE-003** The product shall request additional products before the user reaches a dead end.

**FEE-004** The product shall avoid visible layout jumps when additional products load.

**FEE-005** Tapping a product card shall open Product Detail for that product.

**FEE-006** The user shall be able to save or remove a product directly from the feed if the approved design exposes that control.

**FEE-007** Save state shown in the feed shall match the canonical saved state.

**FEE-008** Returning from Product Detail shall restore the previous feed position and loaded context.

**FEE-009** A failed pagination request shall preserve already loaded products and provide a retry path.

**FEE-010** The feed shall provide a designed empty state when no products are available.

**FEE-011** Feed impression measurement shall distinguish products actually rendered into the user's view from products merely fetched.

**FEE-012** The feed shall not display purchase, delivery, shipping, or ownership claims unsupported by the release.

### 10.6 Acceptance criteria

- Given a valid catalog, when Discover opens, then at least one product card is shown after loading.
- Given the user nears the end of loaded products, when more products are available, then the next batch loads without a manual page change.
- Given a pagination failure, when it occurs, then loaded products remain visible and retry is available.
- Given the user opens a product and returns, then the prior feed position is restored.
- Given a product is saved in any included surface, when its feed card is visible, then the card shows saved state.
- Given the catalog returns no products, when loading completes, then a non-broken empty state is shown.
- Given a product card is fetched but never enters the defined visible threshold, then no product impression event is recorded for that card.

---

## 11. Product Detail requirements

### 11.1 Goal

Allow the user to inspect a product sufficiently to decide whether it belongs in their saved wardrobe or an outfit.

### 11.2 Required content

At minimum:

- product imagery;
- product name;
- brand or source label when available;
- category;
- concise descriptive attributes when available;
- current save state;
- save/remove action;
- clear route back to the originating context.

Optional content may include price, color, material, or source link when available and accurate. External commerce is not required.

### 11.3 Functional requirements

**PDP-001** Product Detail shall open for a valid product from Discover, Wardrobe, or Challenge.

**PDP-002** Product Detail shall identify the originating surface for return navigation and measurement.

**PDP-003** The user shall be able to save an unsaved product.

**PDP-004** The user shall be able to remove a saved product.

**PDP-005** Save changes shall update Discover, Wardrobe, and Challenge eligibility without requiring a full restart.

**PDP-006** The product shall preserve source context when the user returns from Product Detail.

**PDP-007** Missing optional product attributes shall not produce broken labels or placeholder text presented as real data.

**PDP-008** Invalid or unavailable products shall produce a recoverable state with a route back.

**PDP-009** Opening the same product repeatedly shall produce distinct detail-open events while preserving one canonical product identity.

### 11.4 Acceptance criteria

- Given a product card, when selected, then the matching Product Detail opens.
- Given an unsaved product, when save is selected, then the action state changes and the item appears in Wardrobe.
- Given a saved product, when remove is selected, then it leaves Wardrobe and all visible save controls update.
- Given Product Detail was opened from Discover, when back is selected, then the prior feed position is restored.
- Given optional data is missing, when detail renders, then no false or malformed attribute is displayed.
- Given a product is unavailable, when detail is requested, then the user receives a clear recovery route.

---

## 12. Saving and Wardrobe requirements

### 12.1 Goal

Give users a persistent personal collection that represents products they may want to reconsider or combine.

### 12.2 Canonical behavior

A product has one binary saved state per user state:

- saved;
- not saved.

Saving the same product repeatedly must not create duplicate wardrobe entries.

### 12.3 Wardrobe content

Each saved item must show:

- product image;
- product name or concise identifier;
- category;
- saved state;
- path to Product Detail;
- eligibility for the Outfit Challenge where applicable.

Wardrobe may group or filter products only if the behavior remains simple and does not delay the release. Grouping is not required.

### 12.4 Functional requirements

**WAR-001** Saving a product shall add one canonical wardrobe entry.

**WAR-002** Removing a product shall remove its wardrobe entry.

**WAR-003** The Wardrobe shall persist across refresh, restart, and return session.

**WAR-004** The Wardrobe shall show an intentional empty state when no products are saved.

**WAR-005** The empty state shall provide a direct path to Discover.

**WAR-006** Selecting a wardrobe item shall open Product Detail.

**WAR-007** Removing an item used in an incomplete outfit shall trigger a clear resolution behavior: remove it from the outfit automatically and inform the user, or ask for confirmation before removal. The chosen behavior must be consistent.

**WAR-008** Removing an item used in a completed outfit shall not silently corrupt the saved completion record. The implementation shall either preserve a product snapshot/reference for the completed outfit or clearly mark the item as no longer in Wardrobe while retaining historical completion integrity.

**WAR-009** Wardrobe order shall be deterministic within a session. Default ordering should be most recently saved first unless Design or implementation identifies a concrete contradiction.

**WAR-010** Save and remove operations shall be idempotent from the user's perspective.

### 12.5 Acceptance criteria

- Given an unsaved product, when saved, then exactly one wardrobe entry exists.
- Given the same product is saved twice due to repeated input or retry, then only one wardrobe entry exists.
- Given a saved product is removed, when Wardrobe is opened, then the product is absent.
- Given Wardrobe is empty, when opened, then an empty state and Discover action are shown.
- Given saved products exist, when the user returns in a later session, then those products remain.
- Given an item is part of an incomplete outfit, when removed from Wardrobe, then the defined resolution behavior occurs and outfit state remains valid.
- Given an item is part of a completed outfit, when removed from Wardrobe, then the completion record remains interpretable.

---

## 13. Outfit Challenge requirements

### 13.1 Goal

Test whether users will combine products into a coherent outfit for a context they care about.

### 13.2 Challenge definition

LR-001 includes exactly one active, context-based challenge definition at a time.

The challenge must include:

- a title;
- a concise context or scenario;
- required outfit slots or category constraints;
- completion rule;
- version identifier;
- start state;
- in-progress state;
- completed state.

Example structure: “Build a look for a specific evening context” with a small set of required slots. The final context, copy, and slot taxonomy are Design/Product content decisions and must be versioned.

### 13.3 Product eligibility

Challenge selection uses products available to the user under the approved interaction model.

Default product rule:

- saved Wardrobe items are the primary selection pool;
- when a required slot has no eligible saved item, the user receives a direct route to Discover relevant products;
- the user may save an eligible product and return to the challenge without losing progress.

The release must not generate an outfit automatically or present AI styling advice.

### 13.4 Completion rules

A challenge is complete only when:

- every required slot has one valid selected product;
- no product violates a hard slot/category constraint;
- the user explicitly confirms completion.

The same product may occupy only one slot unless the challenge definition explicitly permits reuse.

### 13.5 Functional requirements

**CHL-001** The Challenge destination shall present the active context and required slots.

**CHL-002** The user shall be able to start the challenge from an unstarted state.

**CHL-003** The user shall be able to assign eligible saved products to required slots.

**CHL-004** The interface shall distinguish empty, eligible, selected, and invalid slot states.

**CHL-005** The user shall be able to replace or remove a selected product before completion.

**CHL-006** In-progress challenge state shall persist across navigation, refresh, restart, and return session.

**CHL-007** When no eligible saved item exists for a required slot, the product shall provide a direct route to Discover without discarding challenge progress.

**CHL-008** Returning from Discover or Product Detail shall restore challenge progress.

**CHL-009** Completion shall remain disabled until all required slots are valid.

**CHL-010** The user shall explicitly confirm completion.

**CHL-011** A completed outfit shall display the selected products and challenge context.

**CHL-012** The completed state shall persist across return sessions.

**CHL-013** The product shall not imply public posting, social validation, AI judgment, purchase, or shipment.

**CHL-014** The active challenge version shall be attached to challenge events and completion data.

**CHL-015** If the challenge definition changes between sessions, the product shall preserve interpretability of prior progress. The implementation may retain the prior version for that user state or invalidate progress with an explicit message; it must not silently remap incompatible slots.

### 13.6 Acceptance criteria

- Given an unstarted challenge, when opened, then context and required slots are visible.
- Given an empty required slot, when selected, then eligible Wardrobe products can be chosen.
- Given no eligible item exists, when the slot is opened, then a direct Discover route is available.
- Given the user leaves the challenge mid-progress, when they return, then prior valid selections remain.
- Given not all slots are valid, when the user views completion controls, then completion is unavailable.
- Given all slots are valid, when the user confirms completion, then a completed outfit record is created.
- Given a completed challenge, when the user returns later, then the completed outfit remains visible.
- Given a saved item is removed during an incomplete challenge, then challenge state resolves according to WAR-007.
- Given an incompatible challenge version is introduced, then prior state is not silently misinterpreted.

---

## 14. Return behavior requirements

### 14.1 Goal

Make a later session feel like a continuation of prior value, while measuring whether users voluntarily return.

### 14.2 Persisted state

At minimum, persist:

- onboarding status and preference version;
- saved products;
- challenge status;
- challenge selections;
- challenge version;
- completed outfit record;
- last meaningful destination;
- enough feed context to provide a coherent return experience where feasible.

Exact identity and authentication implementation is outside this PRD and belongs to Engineering Foundation. LR-001 nevertheless requires a stable user state suitable for the release environment.

### 14.3 Return routing priority

After any separately owned interrupted-action recovery, resolve at most one
continuation card for a return session according to this priority:

1. continue the active incomplete Challenge when at least one valid selection
   exists;
2. show the latest completed Challenge only on the first return session after
   that completion;
3. return to Wardrobe when it is the last meaningful destination and at least
   one non-removed saved row exists;
4. otherwise show no card and open normal Discover.

The product may use a lightweight “continue” module rather than force navigation, provided the user can resume with one clear action.

Discover is the no-card fallback, not a continuation-card candidate. A new
return session created after strictly more than 30 minutes uses a new
session-bound feed instance; a prior session's feed instance must not be reused.
Exact Discover restoration remains available only inside the same session,
including return from Product Detail.

For completed Challenge eligibility, “first return session after completion”
means the current owned return session is the earliest return session whose
`started_at` is later than the latest completion's `completed_at`. No earlier
return session for the identity may have a `started_at` later than that
completion.

The only meaningful destinations are `discover`, `wardrobe`, and `challenge`.
The destination is identity-scoped and is recorded only after its primary
surface successfully qualifies as viewed. Product Detail and Challenge picker
inherit their parent primary destination. Onboarding, continuation dismissal,
and continuation activation do not directly overwrite the destination.

An unavailable-only Wardrobe still qualifies when at least one non-removed
saved row exists. A higher-priority candidate query or contract failure must not
silently fall through to a lower candidate. Instead, Discover remains usable
and the continuation area presents a compact retryable error.

Dismissal and successful activation each consume the card for the current
return session. Consumption survives reload in that session, while a new
strictly-greater-than-30-minute return session reevaluates candidates.
Consumption state is identity-scoped, session-scoped, versioned browser state;
telemetry is evidence, not state authority.

### 14.4 Functional requirements

**RET-001** A return session shall recognize valid persisted user state.

**RET-002** The user shall not be required to repeat onboarding after completion or skip.

**RET-003** Saved products shall be present on return.

**RET-004** In-progress and completed challenge state shall be present on return.

**RET-005** The initial return experience shall provide a coherent continuation cue or destination.

**RET-006** Return handling shall not trap the user in the challenge; Discover and Wardrobe remain directly accessible.

**RET-007** Corrupt or unavailable persisted state shall fail safely to a usable default experience and record an error condition.

**RET-008** Session boundaries used for return analysis shall be defined consistently in the analytics specification.

**RET-009** At most one continuation card shall be displayed in a return
session, and a consumed card shall remain hidden for that session.

**RET-010** A continuation resolver failure shall not block normal Discover or
fabricate a lower-priority candidate.

### 14.5 Acceptance criteria

- Given onboarding was completed, when the user returns, then onboarding is not repeated.
- Given saved items exist, when the user returns, then Wardrobe contains them.
- Given an incomplete challenge with at least one selection, when the user returns, then a continuation cue or restored challenge is available.
- Given the latest Challenge completion has not yet been followed by a return session, when the first later return begins, then its completed state is offered once for that session.
- Given no continuation candidate qualifies, when the user returns, then normal Discover opens without a continuation card.
- Given a continuation card is dismissed or successfully activated, when Discover reloads in the same session, then the card remains hidden.
- Given persisted state cannot be loaded, when the product opens, then a usable fallback experience appears and the failure is measurable.
- Given the user resumes a challenge, when they navigate away, then they can still access all primary destinations.

---

## 15. Cross-cutting interaction requirements

### 15.1 Navigation

- primary destinations must be reachable without returning to onboarding;
- back navigation must preserve source context;
- no included action may create an unresolvable dead end;
- deep links or direct routes to unavailable content must provide recovery.

### 15.2 Loading

Each data-backed surface must define:

- initial loading state;
- incremental loading state where applicable;
- success state;
- empty state;
- recoverable error state;
- non-recoverable fallback route.

### 15.3 Feedback

- save/remove actions receive immediate visual feedback;
- challenge selection changes are explicit;
- destructive or state-invalidating actions follow consistent confirmation or undo behavior;
- duplicate taps or retries do not create duplicate records.

### 15.4 Accessibility baseline

Implementation must support:

- semantic interactive controls;
- keyboard-operable essential flows where the platform supports keyboard input;
- visible focus state;
- text alternatives for meaningful product imagery;
- sufficient contrast according to the approved design system;
- controls that do not rely solely on color to communicate state;
- reduced-motion behavior for nonessential animation;
- readable error and validation messaging.

Formal certification is not required for LR-001, but known blockers in the primary journey are release-blocking defects.

### 15.5 Responsive behavior

The primary design target is mobile-first. The core journey must remain usable at supported mobile widths and must not become functionally broken on common desktop widths used by evaluators or test participants.

Exact breakpoints are a Design/Engineering decision.

### 15.6 Performance behavior

Product acceptance requires:

- visible loading feedback for non-instant operations;
- no repeated accidental submission caused by delayed feedback;
- feed interaction remains usable while pagination occurs;
- image loading failure does not collapse navigation or save controls;
- state-changing actions clearly resolve to success or failure.

Numeric performance budgets belong to Engineering Foundation unless a concrete user-experience defect requires Product escalation.

---

## 16. Behavioral instrumentation requirements

### 16.1 Principle

Instrumentation exists to answer the primary release question. Events must represent observed actions and system states. Event names, properties, and definitions must be version-controlled.

### 16.2 Required event families

#### Session and return

- `session_started`
- `session_ended` or equivalent derived session boundary
- `return_session_started`
- `continuation_cue_shown`
- `continuation_action_selected`

#### Onboarding

- `onboarding_viewed`
- `onboarding_preference_selected`
- `onboarding_preference_removed`
- `onboarding_completed`
- `onboarding_skipped`
- `onboarding_error`

#### Discover

- `discover_viewed`
- `feed_batch_requested`
- `feed_batch_loaded`
- `feed_load_failed`
- `product_impression`
- `feed_depth_reached`

#### Product detail

- `product_detail_opened`
- `product_detail_closed`
- `product_detail_error`

#### Saving and Wardrobe

- `product_saved`
- `product_removed`
- `wardrobe_viewed`
- `wardrobe_empty_viewed`

#### Challenge

- `challenge_viewed`
- `challenge_started`
- `challenge_slot_opened`
- `challenge_item_selected`
- `challenge_item_removed`
- `challenge_discovery_redirected`
- `challenge_completion_attempted`
- `challenge_completed`
- `challenge_state_invalidated`

### 16.3 Minimum common properties

Where applicable:

- anonymous or authenticated user-state identifier;
- session identifier;
- event timestamp;
- event schema version;
- release version;
- surface;
- source surface;
- product identifier;
- product category;
- product position or feed index;
- feed/order version;
- onboarding version;
- challenge version;
- slot identifier;
- prior state;
- resulting state;
- error code or failure class;
- experiment assignment, only when an approved experiment exists.

### 16.4 Event rules

- one user action produces one canonical state-change event;
- retries must not inflate successful state-change counts;
- impressions require a defined visibility threshold and duration;
- feed depth must use a consistent definition;
- return session classification must use a documented session boundary;
- raw events are preserved;
- derived metrics remain reproducible from event data;
- no sensitive personal data is included in event payloads;
- free-text input is not required for LR-001.

### 16.5 Instrumentation acceptance criteria

- Every functional requirement that changes persistent state has a measurable success or failure outcome.
- Product saves and removals can be reconciled against canonical Wardrobe state.
- Challenge starts, selections, invalidations, and completions can be reconstructed in sequence.
- Product impressions can be separated from fetched-but-unseen products.
- Return sessions can be separated from first sessions.
- Event payloads identify the active onboarding, feed/order, and challenge definitions.
- Duplicate delivery can be de-duplicated or identified during analysis.

---

## 17. Metric definitions

Initial indicators are directional until traffic quality, sample size, and observation window are known.

### 17.1 Onboarding completion rate

`users completing onboarding / users viewing onboarding`

Report skipped users separately. Do not combine completion and skip without an explicit secondary measure.

### 17.2 Meaningful feed depth

Report at least:

- median maximum visible product index per eligible session;
- distribution at defined thresholds;
- time spent alone is not sufficient evidence.

The threshold for “meaningful” must be fixed before analysis.

### 17.3 Product-detail open rate

`unique product detail opens / qualified product impressions`

Also report session-level detail engagement.

### 17.4 Save rate

Report both:

- `unique products saved / qualified product impressions`;
- `users saving at least one product / eligible users`.

Repeated saves of the same product do not increase unique-product save rate.

### 17.5 Wardrobe revisit

`returning users who view Wardrobe / returning users with at least one saved product`

A first-session Wardrobe view is not a revisit.

### 17.6 Outfit start rate

`users starting the challenge / users exposed to the challenge entry point`

Also report starts among users with sufficient eligible saved products.

### 17.7 Outfit completion rate

`users completing the challenge / users starting the challenge`

Report completion time and abandonment stage descriptively.

### 17.8 Return session rate

At minimum:

`eligible users with a subsequent session inside the defined observation window / eligible first-session users`

The observation window and session boundary must be fixed before release analysis.

### 17.9 Qualitative evidence

Capture structured notes from observed usability sessions or feedback channels under:

- delight;
- comprehension;
- confusion;
- friction;
- distrust;
- missing value;
- unintended behavior.

Qualitative observations must remain separate from quantitative behavior and from commercial claims.

---

## 18. Learning-release design

### 18.1 Release population

Use a clearly identified test population consistent with the active recruitment plan. Product requires that traffic source or cohort be identifiable for analysis because traffic quality materially affects directional metrics.

### 18.2 Baseline release

The first implementation should use one coherent experience rather than multiple simultaneous variants unless a specific uncertainty cannot be resolved through observation of the baseline.

### 18.3 Observation sequence

1. internal product QA;
2. task-based usability validation of the minimum valid journey;
3. limited external release;
4. behavioral observation;
5. qualitative follow-up where available;
6. analysis against pre-declared metric definitions;
7. continue/revise/narrow/stop decision.

### 18.4 Release gates

LR-001 may enter limited external use only when:

- all minimum valid journey steps are executable;
- persistent state survives a return test;
- save state is consistent across surfaces;
- challenge completion is valid and reconstructable;
- critical instrumentation is verified;
- no excluded feature is represented as available;
- no known blocker compromises privacy, safety, or measurement validity;
- primary loading, empty, and error states exist.

### 18.5 Defect severity for release

**Blocker**

- user cannot enter Discover;
- save state is lost or materially inconsistent;
- challenge cannot be completed despite valid selections;
- return state is not persisted;
- events required for the primary question are absent or materially wrong;
- false commerce, privacy, security, or data-integrity risk.

**Major**

- one included surface is intermittently unusable;
- feed position is frequently lost;
- challenge progress recovery is unreliable;
- empty/error states create dead ends;
- accessibility defect blocks the core journey for a supported interaction mode.

**Minor**

- visual, copy, or non-blocking interaction defect that does not corrupt state or materially bias learning.

Blockers must be resolved before limited external release. Major defects require explicit Product acceptance with documented measurement impact.

---

## 19. Requirement traceability matrix

| Learning behavior | Primary capability | Key requirements | Required evidence |
|---|---|---|---|
| Explore products | Discover | FEE-001–012 | impressions, depth, pagination, sessions |
| Inspect products | Product Detail | PDP-001–009 | detail opens, source surface, closes/errors |
| Save meaningful items | Save/Wardrobe | WAR-001–010 | saves, removals, wardrobe state/revisits |
| Combine products | Challenge | CHL-001–015 | starts, selections, redirects, completions |
| Return and continue | Return behavior | RET-001–008 | return sessions, persisted state, continuation |
| Enter with low friction | Onboarding | ONB-001–008 | viewed, completed, skipped, errors |

---

## 20. Dependencies and domain handoff boundaries

### 20.1 Design must provide

- visual direction and design tokens;
- onboarding option presentation;
- Discover card and feed behavior;
- Product Detail layout;
- Wardrobe states;
- challenge context, slot presentation, and completion state;
- navigation pattern;
- motion and transition principles;
- loading, empty, error, and recovery states;
- accessibility-conscious component states;
- implementation-ready screen specifications or prototype.

### 20.2 Engineering must provide

- architecture consistent with the frozen technical work package;
- stable user-state mechanism;
- product catalog access;
- persistence for onboarding, Wardrobe, and Challenge;
- idempotent state-changing operations;
- feed pagination;
- event delivery and schema implementation;
- error handling and observability;
- deployment and environment controls.

### 20.3 Data must provide

- canonical event specification;
- session and return definitions;
- impression and feed-depth definitions;
- validation queries or test plan;
- release dashboard or analysis outputs appropriate to LR-001;
- event QA before external release.

### 20.4 Product retains ownership of

- scope;
- requirement interpretation;
- user journey;
- challenge rules;
- acceptance;
- release gating;
- learning question;
- metric meaning;
- continue/revise/narrow/stop recommendation.

---

## 21. Key product risks and mitigations

### Risk 1 — Onboarding friction suppresses discovery

**Mitigation:** keep input lightweight, support skip, measure completion and skip separately, ensure valid default feed.

### Risk 2 — Feed engagement reflects novelty rather than durable value

**Mitigation:** measure return behavior and continuation, not only first-session depth.

### Risk 3 — Saving becomes indiscriminate collection

**Mitigation:** analyze unique saves, removal behavior, Wardrobe revisits, and use in Challenge rather than raw save count alone.

### Risk 4 — Challenge completion is constrained by catalog or Wardrobe composition

**Mitigation:** define eligible slots clearly, provide relevant Discover route, preserve progress, segment analysis by users with sufficient eligible items.

### Risk 5 — Persistence defects invalidate return learning

**Mitigation:** return-state QA is a release gate and persistence failures are measurable.

### Risk 6 — Generic visual quality reduces experimental validity

**Mitigation:** WP-003 must produce a distinctive, professional experience before external learning is interpreted.

### Risk 7 — Instrumentation records system activity rather than user exposure

**Mitigation:** define qualified impressions, visible depth, idempotent state changes, and reconstructable challenge sequences.

### Risk 8 — False commerce cues create distrust

**Mitigation:** prohibit unsupported checkout, shipping, delivery, or ownership claims throughout LR-001.

---

## 22. Open implementation decisions that do not reopen strategy

These decisions may be resolved by Product, Design, Engineering, or Data during WP-003/WP-004 without changing the release thesis:

- exact onboarding preference taxonomy;
- exact challenge context and slot taxonomy;
- exact primary navigation pattern;
- whether save control appears directly on feed cards;
- deterministic baseline feed-order method;
- exact session-boundary duration;
- exact qualified-impression threshold;
- exact return observation window;
- confirmation versus undo pattern for removals affecting in-progress outfits;
- stable user-state implementation before formal authentication.

Each decision must preserve the requirements and measurement integrity in this PRD.

---

## 23. Definition of done for WP-002

WP-002 is complete when:

- this PRD is accepted as the canonical LR-001 product definition;
- the primary journey is unambiguous;
- included and excluded scope is explicit;
- each included capability has functional requirements and acceptance criteria;
- cross-surface state behavior is defined;
- the learning instrumentation surface is defined;
- release gates and defect severity are defined;
- WP-003 and WP-004 can begin without reconstructing product history.
