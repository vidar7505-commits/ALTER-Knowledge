# WP-006 — LR-001 Implementation Plan

Each package is independently reviewable and uses the commit boundary shown.

| ID | Package | Depends on | Objective | Acceptance and required tests | Commit |
|---|---|---|---|---|---|
| P01 | Repository scaffold | none | Next.js/TS/Tailwind structure, tooling | build, lint, type, unit smoke | `chore(repo)` |
| P02 | Design tokens | P01 | approved CSS variables, fonts, primitives | visual, zoom, reduced-motion | `feat(design-system)` |
| P03 | Supabase local | P01 | CLI config, reset, seed harness | clean reset in CI | `chore(supabase)` |
| P04 | Core migrations | P03 | identity, catalog, state, event schema | migration and pgTAP | `feat(db)` |
| P05 | Anonymous identity | P04 | anonymous Auth bootstrap and recovery | two-user isolation, reload, loss | `feat(identity)` |
| P06 | RLS and RPC base | P04,P05 | helper functions and protected access | exhaustive RLS tests | `feat(security)` |
| P07 | Telemetry ingestion | P06 | typed endpoint, queue, session ensure | contract, dedupe, offline | `feat(telemetry)` |
| P08 | Product catalog | P04 | curated seed/import and read query | inactive/filter/image tests | `feat(catalog)` |
| P09 | Application shell | P02,P05 | mobile bottom nav, desktop rail, boundaries | keyboard, responsive, visual | `feat(shell)` |
| P10 | Onboarding | P06,P09 | three-step flow and persistence | complete/skip/retry events | `feat(onboarding)` |
| P11 | Discover | P07,P08,P09,P10 | deterministic feed, cursor, impressions | pagination, restoration, visibility | `feat(discover)` |
| P12 | Product Detail | P11 | source-aware detail and save | back restoration, save rollback | `feat(product-detail)` |
| P13 | Wardrobe | P06,P09,P12 | canonical saved grid and removal | cross-surface consistency, undo | `feat(wardrobe)` |
| P14 | Challenge | P06,P08,P13 | start/select/remove/complete | idempotency, immutability, mismatch | `feat(challenge)` |
| P15A | Strict return-session threshold | P06,P11 | make exactly 30 minutes same-session and strictly greater return | strict threshold, identity isolation, Discover compatibility | `fix(db): enforce strict return-session threshold` |
| P15B | Continuation canonicalization decision | P11,P13,P14,P15A | freeze continuation candidates, priority, recency, feed, destination, and consumption rules | canonical Product, Design, Data, and Engineering agreement | `docs(continuation): freeze P15 canonical rules` |
| P15C | Meaningful Destination Boundary | P05,P06,P09,P15A,P15B | record identity-scoped qualified primary destination | allowlist, active-session validation, idempotency, identity isolation | `feat(db): add meaningful destination boundary` |
| P15 | Continuation | P11,P13,P14,P15A,P15B,P15C | return priority and card | strictly >30 min return E2E | `feat(continuation)` |
| P16 | Offline/recovery | P07,P11-P15 | queue, retry, corrupt-state handling | offline and interrupted mutation | `feat(recovery)` |
| P17 | Analytics QA | P07,P14 | executable reconciliation and checks | full Data QA suite | `test(data-qa)` |
| P18 | Accessibility/visual polish | P10-P16 | WCAG blockers and approved visuals | axe, keyboard, zoom, snapshots | `fix(a11y)` |
| P19 | Release hardening | all | performance, observability, runbooks, release | full journey, budgets, smoke | `chore(release)` |

## Package output requirements

Every package returns code, tests, updated docs where relevant, a command log, and a handoff. No package may widen LR-001 scope. P04–P07 are the critical path; feature work must not bypass them with temporary insecure persistence.
