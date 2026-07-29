# P15B — Continuation Canonicalization Decision Handoff

## 1. Package

WP-006 / P15B — Continuation Canonicalization Decision.

Status: **Complete**.

Implementation commit:
`11bed0f78638f4ed246fdf07d6792dcb744566ed`
(`docs(continuation): freeze P15 canonical rules`).

This is a documentation-only package. It freezes the Product, Design, Data, and
Engineering rules required before the P15C database boundary and P15
application implementation.

## 2. Preflight

- Repository root:
  `C:\ALTER_REPOSITORY_COMPLETE_WP006_READY\ALTER`.
- `package.json`: present.
- Branch: `main`.
- Working tree before changes: clean.
- Local `main` and `origin/main`:
  `20331e1cf20c9284af31220ba31c067a25beadf2`.
- P14: Complete.
- P15A: Complete.
- P15 was textually Ready but operationally blocked by unresolved canonical
  decisions.
- All required canonical inputs were present and readable.

## 3. Canonical inputs

The complete required HQ, LR-001 release, Product, Design, Data, Engineering,
P11, P13, P14, and P15A documents were reviewed before amendment. The repository
remains the source of truth.

## 4. Discover decision

Discover is not a continuation-card candidate. When no candidate qualifies, the
return surface is normal Discover with no card.

A new return session created after strictly more than 30 minutes uses a new
session-bound feed instance. Reuse of a prior session's feed instance is
prohibited. Exact loaded-batch and scroll restoration remains unchanged inside
the same session, including return from Product Detail.

## 5. Completed Challenge decision

The latest completed Challenge qualifies only in the first return session after
completion. For latest completion `c` and current owned return session `s`,
eligibility requires:

- `c.completed_at < s.started_at`; and
- no earlier return session for the identity has both a lower session number
  than `s` and a `started_at` later than `c.completed_at`.

Completion tie-breaking is `completed_at desc, id asc`.

## 6. Meaningful destination decision

The allowlist is exactly:

- `discover`;
- `wardrobe`;
- `challenge`.

The value is identity-scoped canonical state and is recorded only after the
primary surface successfully qualifies as viewed. Product Detail and Challenge
picker inherit their parent destination. Onboarding, continuation dismissal,
and continuation activation do not directly overwrite the value.

## 7. Wardrobe decision

Wardrobe qualifies when it is the last meaningful destination and at least one
non-removed saved row exists. A Wardrobe containing only products with
currently unavailable metadata may still qualify because the saved rows remain
canonical and the P13 surface represents unavailability honestly.

## 8. Candidate resolver

The deterministic order is:

1. active incomplete Challenge with at least one valid selection;
2. latest completion in the first return session after completion;
3. Wardrobe when last meaningful and at least one non-removed saved row exists;
4. no card and normal Discover.

At most one candidate is returned. A definitive invalid candidate may be
excluded. A higher-priority query or contract failure is a typed resolver
failure and must not silently fall through to a lower candidate.

## 9. Resolver error

Discover remains usable. The continuation region shows a compact retryable
error with a Try again action. No lower-priority candidate is fabricated and no
raw database or service error is rendered.

## 10. Card consumption

Dismissal and successful activation each consume the card for the current
return session. Reload in the same session preserves consumed state. A new
strictly-greater-than-30-minute return session reevaluates candidates.

Consumption is identity-scoped, canonical-session-scoped, versioned browser
state. Telemetry is evidence, not state authority. No database persistence or
new telemetry event is required.

## 11. P15C boundary

Approved RPC:

`public.record_meaningful_destination(p_session_id uuid, p_destination text, p_operation_id uuid) returns jsonb`

P15C must:

- derive identity through `auth.uid()`;
- accept only `discover`, `wardrobe`, and `challenge`;
- validate session ownership and the active P15A threshold;
- reject foreign, ended, and stale sessions;
- use deterministic operation replay/conflict semantics;
- grant EXECUTE only to `authenticated`;
- preserve the prohibition on direct browser `anonymous_users` UPDATE;
- return canonical destination, session, server time, operation, and state
  revision without an ownership ID.

## 12. P15C package definition

- Package: **P15C — Meaningful Destination Boundary**
- Dependencies: P05, P06, P09, P15A, P15B
- Objective: record identity-scoped qualified primary destination
- Acceptance: allowlist, active-session validation, idempotency, identity
  isolation
- Commit boundary: `feat(db): add meaningful destination boundary`

## 13. Status chain

- P14: Complete.
- P15A: Complete.
- P15B: Complete.
- P15C: Ready.
- P15: Blocked pending P15C Database CI closure.
- P16: Blocked pending P15 closure.

## 14. Database and cloud status

- Database changes: None.
- New migrations: None.
- Cloud migrations deployed: None.
- Hosted development schema updated: No.
- Remote reset: not run.
- Remote migration push: not run.
- Production deployment: not run.

## 15. Scope review

No application code, tests, migrations, telemetry contracts, workflows, package
files, deployment state, or remote database state were changed. No P15 or P15C
implementation is included. P15B added no telemetry event and no database
implementation.

## 16. Files created

- `docs/engineering/implementation/P15B_CONTINUATION_CANONICALIZATION_HANDOFF.md`

## 17. Files modified

- `docs/product/LR-001_PRD.md`
- `docs/design/DESIGN_SYSTEM.md`
- `docs/design/LR-001_UX_SPEC.md`
- `docs/design/LR-001_SCREEN_INVENTORY.md`
- `docs/data/DATABASE_SCHEMA.md`
- `docs/data/ANALYTICS_SPEC.md`
- `docs/data/DATA_QUALITY.md`
- `docs/engineering/SUPABASE_IMPLEMENTATION.md`
- `docs/engineering/WP-006_IMPLEMENTATION_PLAN.md`
- `docs/engineering/IMPLEMENTATION_STATUS.md`

## 18. Validation

Required validation:

- `npm.cmd run format:check`
- `git diff --check`

Results:

- `npm.cmd run format:check`: passed.
- `git diff --check`: passed after removing Markdown hard-break trailing
  whitespace from the amended Screen Inventory entries.

## 19. Next action

Begin P15C as a forward-only database package and validate it through Database
CI. P15 remains blocked until P15C Database CI closes.

## 20. Suggested commit message

`docs(implementation): close P15B and ready P15C`
