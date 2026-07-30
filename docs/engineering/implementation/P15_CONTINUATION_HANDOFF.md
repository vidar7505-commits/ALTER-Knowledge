# P15 — Continuation Handoff

## 1. Preflight

- Repository root: `C:\ALTER_REPOSITORY_COMPLETE_WP006_READY\ALTER`.
- `package.json`: present and readable.
- Branch: `main`.
- Initial working tree: clean.
- `origin/main` fetched successfully.
- Initial local `main` and `origin/main`:
  `52ec360fb003ba16e866370e6d0f9acbe4a55420`.
- P15A, P15B, and P15C: Complete.
- P15: Ready before implementation.
- P16: blocked pending P15 closure.
- Every required canonical path existed and was read before modification.

## 2. Canonical inputs

Read completely:

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
- `docs/engineering/implementation/P07_TELEMETRY_FOUNDATION_HANDOFF.md`
- `docs/engineering/implementation/P09_APPLICATION_SHELL_HANDOFF.md`
- `docs/engineering/implementation/P11_DISCOVER_HANDOFF.md`
- `docs/engineering/implementation/P12_PRODUCT_DETAIL_HANDOFF.md`
- `docs/engineering/implementation/P13_WARDROBE_HANDOFF.md`
- `docs/engineering/implementation/P14_CHALLENGE_HANDOFF.md`
- `docs/engineering/implementation/P15A_STRICT_RETURN_SESSION_THRESHOLD_HANDOFF.md`
- `docs/engineering/implementation/P15B_CONTINUATION_CANONICALIZATION_HANDOFF.md`
- `docs/engineering/implementation/P15C_MEANINGFUL_DESTINATION_BOUNDARY_HANDOFF.md`

The current Discover route, P11 restoration and feed services, Wardrobe reads,
Challenge recovery, shell navigation, identity provider, telemetry contracts,
session integration, P15C integration status, and deterministic E2E mocks were
also inspected completely.

## 3. Confirmed P15 scope

- Package: **P15 — Continuation**
- Effective dependencies: P11, P13, P14, P15A, P15B, P15C
- Scope: return priority and continuation card
- Acceptance: strictly greater-than-30-minute return E2E
- Commit boundary: `feat(continuation)`

No recommendation, notification, community, general activity, P16 recovery, or
production-deployment behavior is included.

## 4. Return-session rule

`public.ensure_session` remains the server authority:

- elapsed less than 30 minutes: same session;
- elapsed exactly 30 minutes: same session;
- elapsed greater than 30 minutes: new return session.

The client does not calculate the threshold. It submits the current
session-candidate UUID. A typed expired-session response causes one retry with a
new UUID, persists the returned canonical session ID, and clears old Discover
restoration. Ordinary navigation and same-session reload retain the session.

## 5. Candidate inventory

Only these candidates exist:

1. active incomplete Challenge with at least one currently valid saved
   selection;
2. latest completed Challenge in its first later return session;
3. Wardrobe when it is the last meaningful destination and has a non-removed
   saved row.

Discover is never a candidate. No arbitrary history or recommendation candidate
exists.

## 6. Priority resolver

`ContinuationService` evaluates the inventory sequentially in the frozen order
and returns at most one typed candidate. Owner-scoped RLS reads provide
canonical state. Active Challenge selections must still be saved and resolve to
an active catalog product. Definitively absent candidates are excluded.

A higher-priority query or contract failure rejects the resolution. It never
falls through to Wardrobe or another lower-priority result. Resolution is
deduplicated per canonical session and can be explicitly invalidated for retry.

## 7. Completed-Challenge first-return rule

The latest owned completion is ordered by `completed_at DESC, id ASC`. It must
precede the current session start. Owned return sessions beginning after the
completion are deterministically ordered by `session_number`, then `id`; the
completion qualifies only when the current session is the first such result.
No invented duration is used.

## 8. Wardrobe eligibility

Wardrobe qualifies only when canonical
`last_meaningful_destination = 'wardrobe'` and at least one non-removed saved
row exists. Availability metadata is deliberately not an eligibility filter,
so unavailable-only Wardrobes remain eligible. Empty or removed-only Wardrobes
do not qualify.

## 9. Discover fallback and new-feed behavior

No candidate renders normal Discover without a card. Same-session Product
Detail restoration retains P11 feed instance, order, cursor, anchor, and scroll
semantics. A typed expired-session rotation clears session-scoped restoration;
the new return session then obtains its own feed through the unchanged P11
boundary. No old feed ID, synthetic cursor, or caller-supplied ownership is
used.

## 10. Architecture

- `ContinuationService`: typed deterministic candidate resolution.
- `SupabaseContinuationDataSource`: owner-scoped canonical reads.
- `ContinuationCard`: placement, state transitions, actions, error surface, and
  telemetry.
- continuation storage: versioned display/consumption evidence only.
- session helper: one typed expired-candidate rotation.
- meaningful-destination service: validated P15C RPC envelope and typed errors.
- existing Discover, Wardrobe, and Challenge experiences: qualified-view
  integration only.

## 11. Files created

- `src/features/continuation/continuation-card.tsx`
- `src/features/continuation/continuation-card.test.tsx`
- `src/features/continuation/continuation.module.css`
- `src/features/continuation/destination.ts`
- `src/features/continuation/destination.test.ts`
- `src/features/continuation/destination-supabase.ts`
- `src/features/continuation/service.ts`
- `src/features/continuation/service.test.ts`
- `src/features/continuation/session.ts`
- `src/features/continuation/session.test.ts`
- `src/features/continuation/storage.ts`
- `src/features/continuation/storage.test.ts`
- `src/features/continuation/supabase.ts`
- `src/features/continuation/telemetry.ts`
- `src/features/continuation/types.ts`
- `tests/e2e/continuation.spec.ts`
- `tests/e2e/continuation-visual.spec.ts`
- `docs/engineering/implementation/P15_CONTINUATION_HANDOFF.md`

## 12. Files modified

- `src/features/challenge/challenge-experience.tsx`
- `src/features/discover/discover-experience.tsx`
- `src/features/discover/discover.module.css`
- `src/features/discover/storage.ts`
- `src/features/discover/supabase.ts`
- `src/features/discover/types.ts`
- `src/features/wardrobe/supabase.ts`
- `src/features/wardrobe/types.ts`
- `src/features/wardrobe/wardrobe-experience.tsx`
- `tests/e2e/challenge.spec.ts`
- `tests/e2e/identity-mock.ts`
- `tests/e2e/product-detail.spec.ts`
- `docs/engineering/IMPLEMENTATION_STATUS.md`

## 13. Placement

The continuation region is inside the existing Discover primary surface,
between its canonical header and product grid. It creates no route, shell, rail,
bottom navigation, or duplicate primary navigation. Discover remains usable
while continuation resolves or fails.

## 14. Card behavior

The card is non-modal and renders one destination action plus an explicit
Dismiss control. Canonical variants are:

- active Challenge: “Continue your look” / “After Dark” / selection count /
  “Continue”;
- completed Challenge: “Your latest look” / “After Dark” / “Completed” /
  “View look”;
- Wardrobe: “Pick up where you left off” / “Your Wardrobe” / saved count /
  “Open Wardrobe”.

An immediate action lock prevents duplicate activation or dismissal. Activation
enters a navigating state and uses the canonical `/challenge` or `/wardrobe`
destination.

## 15. Consumption state

The exact local-storage key is:

`alter:continuation:v1:<anonymous-user-id>:<session-id>`

The strict version-1 record stores matching identity/session UUIDs, `shown`, and
distinct `dismissed` or `activated` consumption. Malformed or mismatched data is
ignored safely. Consumption persists through reload in the same identity and
session; a new identity or return session uses a different key and reevaluates.
Browser state is never candidate authority.

## 16. Meaningful-destination integration

After each primary surface reaches its canonical successful viewed state:

- Discover records `discover`;
- Wardrobe records `wardrobe`;
- Challenge active or completed state records `challenge`.

Each mounted qualified view has a stable operation UUID. The P15C service sends
only session ID, allowlisted destination, and operation ID, then validates the
exact result envelope. Strict Mode deduplication uses the stable view operation.
Errors, including typed stale-session and operation-conflict results, are
non-destructive. Product Detail, Challenge picker, continuation activation, and
dismissal perform no destination write.

## 17. Telemetry

Only P07 registered events are emitted:

- `continuation_cue_viewed`;
- `continuation_action_selected`;
- `continuation_cue_dismissed`.

They use canonical continuation/discover surfaces, cue type, target surface, and
registered properties. Shown evidence prevents rerender/reload duplication;
the action lock prevents duplicate selected/dismissed capture. Telemetry errors
are swallowed and never block card display or navigation. No owner identifiers,
raw timestamps, or new taxonomy were added.

## 18. State model

The discriminated continuation state is:

- `resolving`;
- `same_session`;
- `no_continuation`;
- `ready`;
- `recoverable_error`;
- `contract_error`;
- `navigating`;
- `consumed`.

Ready/navigating carry the typed candidate; error states carry a typed
`ContinuationError`. Identity, canonical session, request version, consumption,
action lock, and telemetry/service dependencies remain explicit rather than
parallel status booleans.

## 19. Concurrency and stale-response handling

Effects increment request versions and cancel state application on cleanup.
Identity/session changes therefore invalidate prior work. Per-session in-flight
resolution is shared through the service. A synchronous action lock guards
rapid actions before React updates. Stable view and destination operation IDs
make Strict Mode replay safe. There are no polling loops, background retries,
or uncleaned event listeners.

## 20. Error and recovery

No candidate is ordinary absence, not an error. Query, stale-session, and
malformed-contract failures map to typed continuation errors. The compact alert
appears above Discover, hides raw service details, keeps the feed available, and
offers retry for resolver failures. Retry invalidates only the cached
resolution. Destination and telemetry failures remain invisible and
non-destructive to a successfully loaded primary surface.

## 21. Accessibility

The existing Discover h1 remains first. The card uses a semantic h2 and named
section, explicit action labels, no nested controls, non-color status text,
44px minimum controls, and visible focus. The resolver error uses alert
semantics. Card insertion does not move focus or reorder the underlying
Discover grid. Automated axe coverage reports no structural violations.

## 22. Keyboard

Native buttons provide Tab/Shift+Tab traversal and Enter/Space activation for
destination, dismissal, and retry. No custom arrow-key model or focus trap was
added. Dismissal removes the cue without forced focus movement; normal route
focus behavior remains owned by the shell/destination.

## 23. Responsive behavior

The card uses the existing content width and spacing. Desktop presents copy and
actions in two columns; narrow screens use one column with wrapping controls.
It adds no fixed positioning, so existing shell rail, bottom navigation, safe
area, and content clearance remain authoritative. The layout has no horizontal
overflow at the five canonical viewports.

## 24. Design-system usage

The implementation reuses existing `Heading`, `Text`, and `Button` primitives
and established color, spacing, radius, border, focus, and breakpoint tokens.
It introduces no new typography, glass system, animation language, or shell
pattern. Reduced-motion explicitly removes continuation transitions.

## 25. Unit/component/integration tests

New deterministic tests cover same-session exclusion; canonical Challenge,
completion, Wardrobe, and Discover outcomes; first-return completion
eligibility; priority short-circuiting; invalid/malformed state; typed
destination envelopes; canonical session rotation; identity/session-scoped
consumption; malformed storage; rapid activation; distinct dismissal;
telemetry; and axe accessibility. Existing Discover, Wardrobe, Challenge,
identity, telemetry, and shell suites remain in the full regression run.

No hosted credentials, wall-clock waiting, owner IDs, service role, direct DML,
new feed creation during restoration, or P16 behavior appears in unit tests.

## 26. E2E

Dedicated one-worker Chromium coverage includes first visit, same session,
exactly 30 minutes, strict return, active Challenge priority and resume,
completed-Challenge first return, Wardrobe, dismissal/reload consumption,
activation, new feed identity, resolver failure/retry without fallback,
qualified meaningful-destination writes, keyboard behavior, and telemetry
capture. Deterministic mock modes replace real waiting.

Dedicated P15 result: 14 tests passed with one worker: 8 functional E2E tests
and 6 visual-certification tests. The historical
source-aware Challenge navigation and direct-entry Product Detail telemetry
assertions retain their exact outcomes with bounded cold-compilation/hydration
allowances for the expanded local one-worker suite.

## 27. Visual certification

The dedicated deterministic visual suite certified every required state at all
five canonical viewports:

| Canonical state                            | 320 × 700 | 390 × 844 | 768 × 1024 | 1200 × 900 | 1440 × 1024 |
| ------------------------------------------ | --------- | --------- | ---------- | ---------- | ----------- |
| Same-session, no card                      | Passed    | Passed    | Passed     | Passed     | Passed      |
| Exactly 30 minutes, no card                | Passed    | Passed    | Passed     | Passed     | Passed      |
| Return: active Challenge                   | Passed    | Passed    | Passed     | Passed     | Passed      |
| Return: completed Challenge                | Passed    | Passed    | Passed     | Passed     | Passed      |
| Return: Wardrobe                           | Passed    | Passed    | Passed     | Passed     | Passed      |
| Return: no candidate                       | Passed    | Passed    | Passed     | Passed     | Passed      |
| Resolver recoverable error                 | Passed    | Passed    | Passed     | Passed     | Passed      |
| Resolver retry/loading                     | Passed    | Passed    | Passed     | Passed     | Passed      |
| Activation pending                         | Passed    | Passed    | Passed     | Passed     | Passed      |
| Dismissed/consumed                         | Passed    | Passed    | Passed     | Passed     | Passed      |
| Same-session reload after consumption      | Passed    | Passed    | Passed     | Passed     | Passed      |
| Long canonical continuation copy           | Passed    | Passed    | Passed     | Passed     | Passed      |
| Keyboard focus: primary destination action | Passed    | Passed    | Passed     | Passed     | Passed      |
| Keyboard focus: dismiss action             | Passed    | Passed    | Passed     | Passed     | Passed      |
| Reduced-motion continuation                | Passed    | Passed    | Passed     | Passed     | Passed      |

The Wardrobe artifact also supplies the canonical long-copy state, so the 15
required matrix rows are represented by 14 distinct rendered states and 70
viewport PNG artifacts. The retry/loading implementation intentionally exposes
no transient loading card; its capture verifies the reserved no-card slot and
stable Discover geometry.

Automated assertions cover one shell, at most one continuation card, semantic
heading order, no nested interactive controls, 44px controls, visible focus,
no horizontal overflow, card/grid separation, stable reserved geometry, and
mobile bottom-navigation or desktop-rail clearance. Manual contact-sheet review
of every viewport confirmed readable copy, responsive stacking, safe-area
clearance, no shell duplication, no card/grid collision, and no excessive glass
effect.

Certification found one reduced-motion defect: continuation controls retained
their short transition. The continuation stylesheet now disables animation and
transition on the card, error surface, and their controls under
`prefers-reduced-motion: reduce`. The focused visual suite passed 6/6 after the
correction.

## 28. Validation results

| Command                                               | Outcome                                                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm.cmd run format:check`                            | Passed; all matched files use Prettier formatting.                                                 |
| `npm.cmd run lint`                                    | Passed with zero warnings/errors.                                                                  |
| `npm.cmd run typecheck`                               | Passed.                                                                                            |
| `npm.cmd run test`                                    | Passed: 35 files / 161 tests. Vitest emitted only the existing jsdom canvas implementation notice. |
| `npm.cmd run build`                                   | Passed after allowing the existing Google Font fetch; all 10 routes generated.                     |
| `npm.cmd run test:e2e -- --reporter=line --workers=1` | Passed: 65 tests / Chromium / one worker.                                                          |
| `git diff --check`                                    | Passed with working-copy LF-to-CRLF notices only.                                                  |
| Accessibility-specific package command                | Not run; `package.json` defines none. Axe coverage passed inside Vitest and Playwright coverage.   |

## 29. Process teardown

After the full E2E run,
`Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"` returned no Node
processes. No ALTER-related Next.js or Playwright process remained.

## 30. Database status

- Database changes: None.
- New migrations: None.
- Existing P15A and P15C database contracts are consumed unchanged.

## 31. CI status

P15 status: **Configured but awaiting CI validation**.

P15 must not be marked Complete until GitHub application CI passes.

## 32. Cloud status

- Cloud migrations deployed: None.
- Hosted development schema updated: No.
- Remote reset: not run.
- Remote migration push: not run.
- Production deployment: not run.
- Project linking: not run.

## 33. Security review

- Identity comes only from the existing P05/P09 provider.
- Resolver reads rely on owner-scoped RLS; no caller-controlled owner ID exists.
- P15C accepts only session, destination, and operation IDs.
- No auth token is exposed.
- No direct Challenge or anonymous-user DML is performed.
- No service-role browser path exists.
- Cross-identity and cross-session storage keys are distinct.
- Raw Supabase/PostgreSQL failures are never rendered.

## 34. Scope review

Implemented only strict-return session integration, frozen candidate priority,
one continuation card, consumption, qualified meaningful-destination writes,
registered telemetry, deterministic tests/mocks, and documentation.

No Discover candidate, recommendation/ranking, arbitrary activity, notification,
community, new telemetry event/property, migration, workflow, package change,
deployment, or P16 recovery queue was added.

## 35. Known limitations

- Local mocks deterministically exercise the already-validated P15A/P15C
  contracts; no remote Supabase environment was used.
- Completion display is the frozen LR-001 “After Dark” Challenge because P14
  exposes one canonical Challenge.
- Candidate queries are intentionally sequential to preserve priority and
  failure semantics rather than optimize speculative lower-priority reads.

## 36. Deferred P16 work

Offline mutation queues, retry orchestration, corrupt-state recovery beyond
P15’s safe parsing, and interrupted-mutation recovery remain P16 scope. P16
remains blocked pending P15 closure.

## 37. Exact changed-file inventory

Created:

- `src/features/continuation/continuation-card.tsx`
- `src/features/continuation/continuation-card.test.tsx`
- `src/features/continuation/continuation.module.css`
- `src/features/continuation/destination.ts`
- `src/features/continuation/destination.test.ts`
- `src/features/continuation/destination-supabase.ts`
- `src/features/continuation/service.ts`
- `src/features/continuation/service.test.ts`
- `src/features/continuation/session.ts`
- `src/features/continuation/session.test.ts`
- `src/features/continuation/storage.ts`
- `src/features/continuation/storage.test.ts`
- `src/features/continuation/supabase.ts`
- `src/features/continuation/telemetry.ts`
- `src/features/continuation/types.ts`
- `tests/e2e/continuation.spec.ts`
- `tests/e2e/continuation-visual.spec.ts`
- `docs/engineering/implementation/P15_CONTINUATION_HANDOFF.md`

Modified:

- `src/features/challenge/challenge-experience.tsx`
- `src/features/discover/discover-experience.tsx`
- `src/features/discover/discover.module.css`
- `src/features/discover/storage.ts`
- `src/features/discover/supabase.ts`
- `src/features/discover/types.ts`
- `src/features/wardrobe/supabase.ts`
- `src/features/wardrobe/types.ts`
- `src/features/wardrobe/wardrobe-experience.tsx`
- `tests/e2e/challenge.spec.ts`
- `tests/e2e/identity-mock.ts`
- `tests/e2e/product-detail.spec.ts`
- `docs/engineering/IMPLEMENTATION_STATUS.md`

## 38. Suggested commit message

`feat(continuation)`
