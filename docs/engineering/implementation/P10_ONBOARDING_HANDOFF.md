# P10 — Onboarding handoff

## 1. Package and scope

Confirmed package: **P10 — Onboarding** (`feat(onboarding)`). Scope is the approved three-step LR-001 onboarding flow, persistence through the P06 RPC boundary, and complete/skip/retry event validation. Discover behavior, Product Detail, Wardrobe UI, Outfit Challenge UI, return continuation, durable offline queues, dashboards, deployment, and account merge remain out of scope.

## 2. Preflight and canonical inputs

The repository root and `package.json` were confirmed. P09 is marked Complete in `IMPLEMENTATION_STATUS.md`. All 25 canonical inputs named by the assignment resolved and were read completely. The working tree contained pre-existing P10 edits at handoff; those changes were preserved and reviewed rather than discarded.

## 3. Architecture

- `OnboardingService` owns typed state/taxonomy queries and complete/skip mutations.
- `SupabaseOnboardingDataSource` is the only browser Supabase boundary; mutations use `complete_onboarding` and `skip_onboarding` RPCs and never write onboarding tables directly.
- Zod contracts map database/RPC failures to typed `OnboardingError` categories without exposing raw errors.
- `OnboardingExperience` is the narrow client controller for route resolution, draft persistence, selection, focus, retry, and terminal navigation.
- `ProductOnboardingGuard` gates product routes until a terminal onboarding state is confirmed.

## 4. Route and entry behavior

`/` resolves anonymous identity and onboarding state, then routes to `/onboarding/welcome`, `/onboarding/style`, or `/onboarding/mood`. Terminal `completed_with_preferences`, `completed_without_preferences`, and `skipped` states route to `/discover`. Product routes retain the P09 shell only after a terminal state is loaded. Onboarding has no product navigation.

## 5. Three-step inventory

1. Welcome — “Find the pieces that feel like you.” / “Explore, save, and build a look without the pressure to buy.”; Start or Skip for now.
2. Style — “What pulls you in?”; six canonical visual choices; up to four selections; Continue and Back; “1 of 2”.
3. Mood and use — “What are you dressing for lately?”; six canonical context choices; zero or more selections; Show my feed, Skip choices, and Back; “2 of 2”.

## 6. Taxonomy and state machine

Active `onboarding-style-v1` values are loaded from `onboarding_preferences`, validated as six style and six mood values, and deterministically ordered by group, display order, and ID. No UI taxonomy copy is used as a fallback. Selection state uses canonical IDs and the style maximum of four. Canonical statuses are preserved: `not_started`, `in_progress`, `completed_with_preferences`, `completed_without_preferences`, `skipped`, and `recoverable_error`.

## 7. Persistence, complete, skip, retry, and operation IDs

Draft step, selected IDs, revision, and operation IDs are stored under an identity-scoped local-storage key so reloads and restarts resume safely. Terminal state and versions remain server-authoritative. Completion sends only onboarding version, preference-set version, selected canonical IDs, and one stable operation ID. Skip uses a separate stable operation ID and the skip RPC. Repeated retries reuse the stored operation ID; RPC replay/conflict errors are mapped to typed application errors. Successful mutation clears the draft before redirecting.

## 8. Telemetry

Only registered P07 events are emitted: `onboarding_viewed`, `onboarding_step_viewed`, `onboarding_preference_selected`, `onboarding_preference_removed`, `onboarding_completed`, `onboarding_skipped`, and `onboarding_persistence_failed`. Events use version 1, `surface: onboarding`, allowed properties only, stable operation IDs, and non-blocking delivery. Telemetry failure never rolls back successful onboarding state.

## 9. Loading, errors, accessibility, keyboard, responsive, and design system

Identity, state, and taxonomy loading have announced status surfaces. Recoverable failures expose Try again; contract/configuration failures are non-retryable. Mutation errors preserve choices and focus the alert/retry surface. Choice cards are keyboard-operable checkbox semantics with visible selected state, progressbar semantics, logical focus transfer to each step heading, visible focus, reduced-motion handling, safe-area spacing, and token-only layout/styling across 320, 390, 768, 1200, and 1440px classes.

## 10. Tests and validation

Unit/service coverage validates taxonomy ordering, malformed data, selection normalization, ownership-field exclusion, terminal distinction, and contract error mapping. Playwright coverage adds new-user keyboard/back/completion and skip/reload flows, updates shell fixtures for terminal gating, and certifies the onboarding visual states. `format:check`, `lint`, `typecheck`, and `test` passed (18 files, 97 tests). `build` passed with the deterministic local Supabase environment and network access for the existing fonts. The full E2E suite passed: 10 Chromium tests with one worker. `git diff --check` passed with line-ending normalization warnings only.

## 11. Database, CI, cloud, security, and scope review

Database changes: **None**. Cloud migrations deployed: **None**. No validated migration was edited, no remote command or deployment was run, and no service-role credential is used. Caller ownership IDs and Supabase sessions remain outside UI props. The implementation does not claim Discover, Product Detail, Wardrobe, Challenge, continuation, offline queueing, dashboards, or production deployment.

## 12. Final visual certification record

The existing Playwright/browser screenshot setup inspected every listed state at
320×700, 390×844, 768×1024, 1200×900, and 1440×1024: Welcome; Style with no
selection; Style with four selections; the style selection-limit message; Mood;
back-navigation with preserved selections; identity loading; recoverable query
error; recoverable mutation error; completion; and skip. Checks covered
overflow, clipping, sticky-control overlap, safe-area spacing, long labels,
focus visibility, heading/progress semantics, loading/error geometry, touch
targets, reduced motion, absence of product navigation during onboarding, and
product-shell composition after terminal transitions. One concrete defect was
fixed: mobile sticky controls overlapped the lower preference cards; controls
now remain in normal document flow.

## 13. Changed-file list

Created: `src/app/onboarding/**`, `src/features/onboarding/**`, `public/onboarding/**`, `tests/e2e/onboarding.spec.ts`, this handoff.

Modified: `src/app/page.tsx`, `src/app/page.test.tsx`, `src/app/(product)/layout.tsx`, `tests/e2e/identity-mock.ts`, `tests/e2e/shell.spec.ts`, `tests/e2e/onboarding-visual.spec.ts`, and `docs/engineering/IMPLEMENTATION_STATUS.md`.

Local browser visual certification is complete; GitHub CI confirmation remains pending. Recommended next package: **P11 — Discover**, deterministic feed and impressions, dependent on P07, P08, P09, and P10.

Suggested commit message: `feat(onboarding): implement LR-001 three-step onboarding flow`
