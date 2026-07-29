# P14 — Challenge Handoff

## 1. Preflight

Repository root was confirmed as
`C:\ALTER_REPOSITORY_COMPLETE_WP006_READY\ALTER`. `package.json` exists. The
branch is `main`; the working tree was clean before implementation. After a
fresh `git fetch origin main`, local `main` and `origin/main` both resolved to
`e18d0476401de5f98a56c0d96e0d7a0d18f92fb5`. P13 and P14A were Complete, P14
was Ready, and every required canonical input was readable.

## 2. Canonical inputs

Read completely: the four HQ/release files; both Product files; all four Design
files; all six Data files; the three Engineering foundation documents; the
implementation plan and status; the P06–P14A implementation handoffs; the
authoritative P14A migration; and pgTAP suites 006 and 010.

## 3. Confirmed scope

P14 depends on P06, P08, P13, and P14A. Scope is start, select, remove, and
complete. Acceptance is idempotency, completed-state immutability, and typed
revision mismatch. Commit boundary is `feat(challenge)`. P15 continuation,
community, commerce, custom/multiple challenges, optional slots, AI/ranking,
durable offline queues, dashboards, and deployment remain excluded.

## 4. Architecture

The existing `/challenge` placeholder was replaced with one client experience
inside the unchanged P09 product shell. A typed service validates Challenge
definition/progress/item/completion reads and every mutation envelope. The
Supabase adapter performs owner-scoped RLS reads and calls only the five
approved boundaries. The component owns one discriminated view model plus
per-operation tasks, revision/request versions, immediate ref locks, focus
recovery, and telemetry coordination. Browser storage is not Challenge
authority.

## 5. Files created

- `src/features/challenge/types.ts`
- `src/features/challenge/service.ts`
- `src/features/challenge/supabase.ts`
- `src/features/challenge/telemetry.ts`
- `src/features/challenge/challenge-experience.tsx`
- `src/features/challenge/challenge.module.css`
- `src/features/challenge/supabase.test.ts`
- `src/features/challenge/challenge-experience.test.tsx`
- `tests/e2e/challenge.spec.ts`
- `tests/e2e/challenge-visual.spec.ts`
- `tests/e2e/z-challenge-edge.spec.ts`
- `docs/engineering/implementation/P14_CHALLENGE_HANDOFF.md`

## 6. Files modified

- `src/app/(product)/challenge/page.tsx`
- `tests/e2e/identity-mock.ts`
- `docs/engineering/IMPLEMENTATION_STATUS.md`

## 7. Route behavior

`/challenge` is canonical in the screen inventory, frontend architecture, and
P09 shell. The route renders in the existing shell and keeps its primary
navigation; there is no duplicate header, rail, bottom navigation, identity
provider, or onboarding guard.

## 8. Start and recovery

The route waits for the existing anonymous identity boundary, reads the active
canonical definition and owner-visible progress, and never flashes an empty or
unstarted state before resolution. Explicit start calls
`start_challenge(uuid,uuid)`. Immediate duplicate input is guarded, retry keeps
the logical operation ID, server idempotency converges repeated starts, active
progress resumes, completed progress remains completed, and reload always
reconstructs server truth. No new Challenge is created after completion.

## 9. Slot inventory

The validated required slots are `top`, `bottom`, `shoes`, and
`layer_or_accessory`, labelled Top, Bottom, Shoes, and Layer or Accessory.
Server `display_order` is validated against that deterministic semantic order.
Every slot is required; no custom or browser-generated slot exists.

## 10. Product eligibility

The picker calls `list_products_for_challenge_slot(uuid,text,uuid,integer)`.
The catalog service validates active products, supported slot eligibility,
strict canonical-ID ordering, and stable pagination. The display pool is the
intersection of that server-qualified result and the current canonical
Wardrobe read; the select RPC remains final authority for active status,
eligibility, and saved membership. Empty results and query errors are distinct.

## 11. Selection

Selection calls
`select_challenge_item(uuid,text,uuid,bigint,uuid)` with progress ID, canonical
slot, product, current expected revision, and stable operation ID. The adapter
has no owner parameter. Input is ref-guarded synchronously and visibly busy.
No local success is fabricated: the UI reloads canonical truth after the
validated response. Replacement uses the server boundary. Request versions
reject stale picker and mutation responses.

## 12. Removal

Removal calls `remove_challenge_item(uuid,bigint,uuid)` with the canonical
progress-item ID, current expected revision, and stable operation ID. It never
substitutes product ID or adds an owner. Duplicate input is guarded, failure
keeps the canonical selection, success reloads server truth, and no Wardrobe
Undo behavior is reused.

## 13. Completion

Completion is enabled only when all four selections exist and server status is
`ready_to_complete`. Explicit activation emits the registered attempt event,
then calls `complete_challenge(uuid,bigint,uuid)`. The current revision and a
stable operation ID are mandatory. There is no local completion. Success
validates the response, emits `challenge_completed` once, reloads, and removes
all mutation controls.

## 14. Revision mismatch

SQLSTATE `40001` with `challenge_revision_mismatch` maps to the typed
`revision_mismatch` error. The stale mutation is not retried and does not update
visible canonical state. The client invalidates caches, reloads the Challenge,
announces that the Challenge changed and was refreshed, and restores safe
focus. Raw Supabase or SQL text is never displayed.

## 15. Idempotency and replay

Each new logical action receives one UUID. A recoverable retry at the same
revision reuses it. Immediate duplicate input is blocked. Server replay
envelopes validate like first success and converge through the same canonical
reload path. React Strict Mode shares in-flight recovery and does not duplicate
start mutation or page-view telemetry.

## 16. Operation conflict

Operation-ID fingerprint reuse maps independently to `operation_conflict`.
Conflict never changes Challenge state, never regenerates an ID to hide the
collision, and never exposes raw persistence text.

## 17. Immutability

Completed progress renders the immutable completion state. Selection,
replacement, removal, and second completion controls are absent. Reload
preserves completion. Product rendering can use the stored completion snapshot
even when current catalog availability changes, so historical integrity does
not depend on active Wardrobe/catalog membership.

## 18. Product Detail integration

Every selected/completed product link uses only
`/product/{productId}?from=challenge`. No feed instance or position is created.
P12 maps Back to `/challenge`. Wardrobe saved state and Challenge selection
state remain separate.

## 19. Telemetry

Only P07 registry events are used: `session_started`, `challenge_viewed`,
`challenge_started`, `challenge_slot_opened`, `challenge_item_selected`,
`challenge_item_removed`, `challenge_discovery_redirected`,
`challenge_completion_attempted`, `challenge_completed`, and
`challenge_operation_failed`. Canonical versions/surfaces and stable operation
IDs are supplied; ownership identifiers are absent. Capture failure is quiet
and cannot roll back a successful domain mutation.

## 20. Loading, empty, error, and recovery

Implemented states cover identity resolution, initial recovery, unstarted,
active empty/partial/ready, picker loading/populated/empty/error, selection,
removal and completion busy/error, typed mismatch refresh, conflict,
validation mismatch, malformed contract, unavailable selected product, and
immutable completion. Loading uses status semantics, errors use alert
semantics, recoverable failures offer Retry, and no fake data is rendered.

## 21. Accessibility

The surface has one `h1`, semantic required-slot list structure, explicit
selected/required/completed text, labelled removal/replacement controls,
programmatic completion explanation, polite loading status, alert errors,
meaningful image alternatives, 44 px controls, visible focus through the
existing system, no nested interactive controls, and no color-only state.
Component axe coverage passes.

## 22. Keyboard

Native buttons/links support Tab, Shift+Tab, Enter, and Space. Picker selection,
remove, completion, retry, Product Detail, and Back are keyboard reachable.
Picker close receives focus, Escape closes it, and close returns focus to the
originating slot. No drag/drop or custom arrow-key model exists.

## 23. Responsive behavior

Mobile uses vertical slots, a completion bar above the bottom navigation, and a
bottom picker. Tablet/desktop use a two-column slot canvas and centered picker.
Desktop preserves rail clearance. Safe-area bottom padding, reduced-motion
static skeletons, long-name wrapping, stable image geometry, and horizontal
overflow checks are present.

## 24. Design-system usage

The implementation reuses P02 tokens/primitives and P09 shell geometry:
Instrument Serif display hierarchy, warm paper/ink surfaces, restrained
signal/focus roles, semantic borders, 44 px controls, two-column desktop
composition, and reduced motion. It adds no new visual language.

## 25. Tests

Unit/component coverage verifies exact revised signatures without ownership
parameters, typed mismatch/conflict mapping, duplicate start/selection guards,
deterministic required slots, incomplete completion blocking, expected
revision, stable operation ID, no fake local success, mismatch reconciliation,
completed immutability, Challenge-source detail links, raw-error hiding,
telemetry, and axe.

## 26. E2E

Dedicated one-worker P14 E2E covers start/recovery/reload, deterministic slots,
keyboard selection, replacement, duplicate select/remove/complete input,
removal, Product Detail/Back, incomplete blocking, completion/reload,
immutability, revision refresh, load/picker retries, and five-viewport overflow.
Mocks enforce revision increments, eligibility, replacement, removal,
completion, mismatch, conflict, active/completed recovery, and failures.

## 27. Visual certification

Dedicated visual tests capture active, picker, and immutable completed states at
320×700, 390×844, 768×1024, 1200×900, and 1440×1024. Mobile picker and desktop
completion images were manually inspected. A transparent-sheet token alias
defect found during inspection was corrected and recertified.

## 28. Validation results

- `npm.cmd run format:check`: passed.
- `npm.cmd run lint`: passed with zero warnings/errors.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test`: passed, 30 files / 147 tests.
- `npm.cmd run build`: passed. The sandboxed first attempt could not reach the
  two existing Google font URLs; the approved network-enabled rerun compiled,
  typechecked, generated all 10 static pages, and included `/challenge`.
- `npm.cmd run test:e2e -- --reporter=line --workers=1`: passed, 51 tests.
- `git diff --check`: passed with working-copy line-ending warnings only.
- No separate accessibility script exists in `package.json`; component axe
  coverage passed through the main test command.
- Final Node-process inspection returned no processes, so there is no
  ALTER-related Next.js or Playwright orphan.

## 29. Database status

Database changes: None. New migrations: None. P14A semantics and validated
historical migrations are unchanged.

## 30. CI status

Configured but awaiting CI validation. P14 is not marked Complete locally.

## 31. Cloud status

Cloud migrations deployed: None. Hosted development schema updated: No. Remote
reset: not run. Remote migration push: not run. Production deployment: not run.

## 32. Security review

No service role, secret, caller-controlled owner ID, direct Challenge-table
mutation, browser DML mutation, new policy, or migration exists. Mutation RPCs
derive ownership through `auth.uid()`/the established identity boundary. Reads
remain owner-scoped by existing RLS.

## 33. Scope review

No P15 continuation, community/social, AI, custom challenges/slots, multiple
active Challenges, edit-after-completion, commerce, offline queue, dashboard,
remote database, deployment, commit, or push work was added.

## 34. Known limitations

P16 still owns durable offline mutation queues. P18 owns release-wide final
accessibility/visual polish. Local deterministic mocks cannot substitute for
the already completed P14A hosted database validation.

## 35. Deferred P15 work

P15 remains blocked until P14 closes. Its confirmed package is Continuation,
depending on P11, P13, and P14; scope is return priority and card behavior;
acceptance is the `>30 min` return E2E; commit boundary is
`feat(continuation)`.

## 36. Exact changed-file inventory

The complete inventory is the files in Sections 5 and 6. No generated
Playwright report/test-result artifacts are intended source changes.

## 37. Suggested commit message

`feat(challenge)`
