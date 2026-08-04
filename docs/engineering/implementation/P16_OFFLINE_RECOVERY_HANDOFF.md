# P16 — Offline / Recovery Handoff

Final local status: **Configured but awaiting CI validation**.

## 1. Preflight

- Repository root: `C:\ALTER_REPOSITORY_COMPLETE_WP006_READY\ALTER`.
- `package.json`: present.
- Branch: `main`.
- Initial working tree: clean.
- `origin/main` fetched successfully.
- Local `main` and `origin/main` both resolved to
  `9c13ea767c679070d952b892a8bb7348b14d5c29`.
- P07 and P11–P15: Complete. P16: Ready before implementation.
- No prior P16 implementation or handoff existed.
- All required paths existed; no path was substituted.

## 2. Canonical inputs

Read completely before modification:

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
- every P05, P06, P07, P09, P10, P11, P11A, P12, P13, P14, P14A, P15A,
  P15B, P15C, and P15 implementation handoff named in the P16 assignment.

## 3. Exact package definition

- Package: **P16 — Offline / Recovery**
- Dependencies: P07 and P11–P15
- Scope: queue, retry, corrupt-state handling
- Acceptance: offline behavior and interrupted mutation behavior
- Commit boundary: `feat(recovery)`

No service worker, PWA framework, migration, cloud change, or post-P16 product
scope was introduced.

## 4. Mutation inventory

| Mutation/boundary      | Owner                            | Canonical call                  | Stable ID                         | Revision                | Existing replay                     | Persist  |
| ---------------------- | -------------------------------- | ------------------------------- | --------------------------------- | ----------------------- | ----------------------------------- | -------- |
| Identity bootstrap     | Identity                         | anonymous auth/bootstrap        | No                                | No                      | bootstrap recovery                  | No       |
| Session reuse/create   | Session                          | `ensure_session`                | candidate, not mutation ledger ID | server threshold        | session canonicalization            | No       |
| Discover read/page     | Discover                         | feed RPCs                       | read request only                 | feed revision           | deterministic read                  | No       |
| Save product           | Product Detail/Wardrobe/Discover | `save_product`                  | Yes                               | ledger fingerprint      | identical prior result              | Yes      |
| Remove product         | Product Detail/Wardrobe          | `remove_product`                | Yes                               | ledger fingerprint      | identical prior result              | Yes      |
| Start Challenge        | Challenge                        | `start_challenge`               | Yes                               | ledger fingerprint      | identical prior result              | Yes      |
| Select Challenge item  | Challenge                        | `select_challenge_item`         | Yes                               | expected state revision | identical prior result; typed stale | Yes      |
| Remove Challenge item  | Challenge                        | `remove_challenge_item`         | Yes                               | expected state revision | identical prior result; typed stale | Yes      |
| Complete Challenge     | Challenge                        | `complete_challenge`            | Yes                               | expected state revision | identical prior result; typed stale | Yes      |
| Meaningful destination | Continuation                     | `record_meaningful_destination` | Yes                               | active session          | session-scoped                      | No       |
| Telemetry delivery     | P07                              | ingestion transport             | event ID                          | event schema            | event retry                         | P07 only |

Product Detail and Wardrobe Undo is the canonical inverse save operation with
its own stable operation ID. FIFO retains the remove then Undo meaning.

## 5. Queue eligibility matrix

Eligible kinds are exactly `save_product`, `remove_product`,
`start_challenge`, `select_challenge_item`, `remove_challenge_item`, and
`complete_challenge`. All are identity scoped, use RPCs that derive ownership,
carry a stable operation ID, and return a canonical envelope containing the
matching operation ID. The three revision-dependent Challenge mutations retain
their exact expected revision.

## 6. Excluded operations

Reads, authentication, anonymous bootstrap, session creation/reuse, feed
pagination, route/navigation/restoration, continuation candidate resolution,
and UI state are never queued. Meaningful-destination recording is excluded
because its meaning is bound to one active session and cannot be moved to a
later session. No secret, token, owner ID, raw error, response body, Supabase
client, or dynamic function name is persisted.

## 7. Server-boundary audit

No missing acceptance-critical boundary was found. The eligible RPCs already
provide idempotency-ledger replay, operation-fingerprint conflict detection,
server-derived ownership, and canonical responses. Challenge preconditions
remain server-authoritative. P16 adds no server guarantee and no SQL.

## 8. Persistence architecture

`IndexedDbRecoveryPersistence` uses database `alter-recovery-v1`, object store
`identity-queues`, and one document key per canonical anonymous identity.
Browser APIs are opened only inside async client-side operations. A memory
implementation supports deterministic tests. Storage errors become a safe
public recovery state; malformed payload content is never rendered.

## 9. Queue schema and version

Schema version is `1`. A document contains `version`, `nextSequence`, and
`items`. An item contains version, closed mutation kind, identity scope, null
session scope, stable operation ID, minimal canonical payload, creation
sequence, creation timestamp, attempt count, last-attempt timestamp, and retry
state. Limits are 50 items, 16 KiB per item, and 256 KiB per queue.

## 10. Identity/session scoping

Storage is keyed by identity and every decoded item must repeat the same valid
identity UUID. Foreign items are discarded before exposure or dispatch.
Eligible P16 items require a null session scope; non-null/cross-session records
are rejected. An identity generation token invalidates the prior processor and
pending results when identity changes.

## 11. Ordering rules

Monotonic logical sequence is FIFO. Duplicate records collapse only when their
complete canonical fingerprints match. Same-operation conflicting
fingerprints are removed as hard corruption. Duplicate sequence numbers are
rejected. A successful replay removes only the matching operation ID. One
in-flight drain promise coalesces Strict Mode, manual, reconnect, and rapid
online triggers.

## 12. Retry policy

There was no product-visible canonical schedule. P16 therefore uses the
smallest bounded technical policy: at most three attempts with deterministic
0/1/3-second technical delays. Tests inject the scheduler and do not wait.
Only transient/network/ambiguous failures retry automatically. Validation,
authorization, operation conflict, stale revision, and malformed contract
responses do not. Manual retry resets a recoverable exhausted item without
changing its operation ID.

## 13. Interrupted-request semantics

If dispatch may have committed but the response is lost, the original payload
and operation ID are retained. Online drain calls the same RPC with that same
ID. The server mock records the first canonical commit and returns the prior
result for the identical replay. The client removes the item only after the
matching canonical response and remounts the feature data boundary once.

## 14. Reconciliation model

Queued state is explicitly pending and never labeled saved/completed. Canonical
success increments the shell recovery revision so the owning server-backed
feature refetches. Challenge revision mismatch discards the now-invalid local
intent and triggers canonical refresh instead of overwriting newer state.

## 15. Corrupt-state handling

Strict Zod decoding handles malformed JSON, non-object roots, future versions,
missing fields, unknown kinds, invalid UUID/revision/attempt values, oversized
state, partial corruption, conflicting duplicates, foreign identity/session,
and impossible duplicate ordering. Independently valid items survive only when
their ordering remains unambiguous. Recovered documents are rewritten once.
Read, write, and quota failures leave the application usable.

## 16. Feature integrations

- Discover/Product Detail/Wardrobe save and remove adapters retain their
  existing operation IDs and canonical RPC parsing.
- Challenge start/select/remove/complete adapters retain operation IDs and
  exact expected revisions.
- Discover reads/pagination are unchanged and never enter the queue.
- Continuation resolution and destination recording remain unchanged and
  excluded.

## 17. Offline UI

One token-based shell banner presents offline, retained, retrying, retry
available, conflict, corruption, storage failure, and success copy. The prior
connectivity banner is used only for the short restored state, preventing
duplicate offline banners. Underlying loaded content and navigation remain
available.

## 18. Error taxonomy

Browser-offline is a hint and drain trigger, not reachability authority.
Transient and ambiguous failures retain intent. Authorization blocks automatic
retry. Typed conflict and stale revision require reconciliation. Validation and
malformed canonical contracts become terminal/manual states. Storage and
corruption have separate safe public states; raw errors are not exposed.

## 19. Telemetry usage or evidence gap

The registered event specification has no P16 offline/queue/retry/corruption
events, so none were invented. P07 remains the sole telemetry authority. Its
existing memory buffer is augmented with bounded, session-keyed IndexedDB
persistence while retaining immutable event IDs and non-blocking failure
behavior. Queue payloads and ownership data never enter telemetry.

## 20. Concurrency protections

The runtime has one drain promise, identity generation cancellation, exact
identity checks before/after dispatch, injected bounded timers, timer
cancellation on identity change/dispose/manual retry, and one closed dispatcher
switch. Route changes do not create processors because the browser runtime is a
single module authority.

## 21. Security review

No service role, token, browser owner parameter, raw SQL, direct canonical
table mutation, unsafe HTML, prototype merge, or dynamic RPC dispatch exists.
RLS and RPC ownership remain authoritative. Persisted strings can select only a
strict discriminated-union kind that maps through a compile-time closed switch.

## 22. Accessibility

Recovery uses named semantic status/alert regions, text equivalents independent
of color, non-modal presentation, and no focus theft. Pending and canonical
success use different copy. Automated axe coverage is included.

## 23. Keyboard

The retry action is a native design-system button with an explicit name,
44-pixel minimum target, native keyboard activation, and inherited visible
focus. There is no trap or automatic focus movement.

## 24. Responsive behavior

The surface uses design tokens, wraps below 480 pixels, respects mobile and
desktop shell geometry, and disables animation/transitions under reduced
motion. Visual certification found that long copy plus count and retry could
shrink or clip the retry action. The smallest correction gives the message a
wrapping flexible width and makes count/retry non-shrinking. The dedicated E2E
now checks page and banner-local overflow plus retry viewport bounds.

## 25. Tests

Deterministic persistence, runtime, view, telemetry, feature, shell, and
regression suites cover parsing/corruption, bounds/storage failures, offline
retention, re-entrant drain, stable operation IDs, ambiguous failure, terminal
classification, revision reconciliation, identity isolation, FIFO remove/Undo,
bounded retry, closed dispatch, accessible state copy, retry, and axe.

## 26. E2E

`tests/e2e/recovery.spec.ts` and the extended identity/RPC mock cover offline
save across reload/reconnect, one canonical dispatch, post-commit response
interruption with the same operation ID on replay, and small-viewport
accessibility/overflow. Dedicated P16 Playwright passed 3/3 in Chromium with one
worker. Full Playwright passed 73/73 in Chromium with one worker.

## 27. Visual certification

`tests/e2e/recovery-visual.spec.ts` produced and inspected 75 artifacts. Every
cell below passed automated geometry, banner/shell uniqueness, horizontal and
banner-local overflow, content obstruction, mobile-navigation/desktop-rail
clearance, readable and non-color-only copy, 44-pixel retry target, focus
retention/ring, reduced motion, and stable-layout assertions.

| State                       | 320×700 | 390×844 | 768×1024 | 1200×900 | 1440×1024 |
| --------------------------- | ------- | ------- | -------- | -------- | --------- |
| Online normal               | Passed  | Passed  | Passed   | Passed   | Passed    |
| Offline                     | Passed  | Passed  | Passed   | Passed   | Passed    |
| Pending retained mutation   | Passed  | Passed  | Passed   | Passed   | Passed    |
| Retrying                    | Passed  | Passed  | Passed   | Passed   | Passed    |
| Retry available             | Passed  | Passed  | Passed   | Passed   | Passed    |
| Retry exhausted             | Passed  | Passed  | Passed   | Passed   | Passed    |
| Conflict/reconciliation     | Passed  | Passed  | Passed   | Passed   | Passed    |
| Corrupt-state recovery      | Passed  | Passed  | Passed   | Passed   | Passed    |
| Storage unavailable         | Passed  | Passed  | Passed   | Passed   | Passed    |
| Reconnect success           | Passed  | Passed  | Passed   | Passed   | Passed    |
| Long canonical copy         | Passed  | Passed  | Passed   | Passed   | Passed    |
| Keyboard focus on retry     | Passed  | Passed  | Passed   | Passed   | Passed    |
| Reduced motion              | Passed  | Passed  | Passed   | Passed   | Passed    |
| Mobile navigation clearance | Passed  | Passed  | Passed   | Passed   | Passed    |
| Desktop rail clearance      | Passed  | Passed  | Passed   | Passed   | Passed    |

## 28. Validation matrix

| Gate                                                  | Result                               |
| ----------------------------------------------------- | ------------------------------------ |
| `npm.cmd run format:check`                            | Passed                               |
| `npm.cmd run lint`                                    | Passed; zero warnings/errors         |
| `npm.cmd run typecheck`                               | Passed                               |
| `npm.cmd run test`                                    | Passed; 38 files / 202 tests         |
| Focused P16 unit/integration                          | Passed; 4 files / 45 tests           |
| `npm.cmd run build`                                   | Passed; 10 routes generated          |
| Dedicated P16 Playwright                              | Passed; 3/3; Chromium; one worker    |
| Dedicated P16 visual Playwright                       | Passed; 5/5 tests; 75 artifacts      |
| `npm.cmd run test:e2e -- --reporter=line --workers=1` | Passed; 73/73; Chromium; 4.7 minutes |
| `git diff --check`                                    | Passed; line-ending warnings only    |

The first restricted build exited 1 because Next.js could not connect to the
Google Fonts stylesheets for Instrument Serif and Inter. Both exact endpoints
then returned HTTP 200 with direct network access, and the unchanged build
exited 0. Classification: transient environment/network failure against the
pre-existing `next/font/google` download dependency; not a P16 regression and
not a deterministic offline-build defect. Typography configuration was not
changed.

GitHub Application CI remains authoritative.

## 29. Process teardown

The original restricted run completed its browser work but hung with Playwright
CLI and the managed Next.js tree still present. Playwright 1.61 uses Windows
`taskkill /T /F` for web-server teardown; the restricted environment returned
Access denied and Playwright then waited for the child close event. No Chromium
process remained, so this was not an unfinished application test.

The unchanged permitted focused and full runs returned normally. Immediate
`Get-CimInstance Win32_Process` and `netstat -ano` inspection found no
ALTER-related Node process, Playwright process, managed Next.js server, or
port-3000 listener. The clean test output and absent process tree provide no
evidence of an active retry timer, listener, IndexedDB promise, or drain loop.

## 30. Database status

- Database changes: None
- New migrations: None
- Remote reset: not run
- Remote migration push: not run

## 31. Cloud status

- Cloud migrations deployed: None
- Hosted development schema updated: No
- Project linking: not run
- Production deployment: not run

## 32. Scope review

No database migration, workflow, package dependency, service worker, PWA,
telemetry taxonomy, recommendation, notification, community, deployment, or
post-P16 feature was added. Existing feature RPC and error adapters were
changed only at eligible mutation boundaries.

## 33. Known limitations

Persistent multi-tab lease ownership is not implemented. Two tabs can both ask
the idempotent server boundary to replay the same operation; the server ledger
prevents a second logical mutation, while each tab reconciles its local copy.

## 34. Exact changed-file inventory

Created:

- `src/features/recovery/persistence.test.ts`
- `src/features/recovery/persistence.ts`
- `src/features/recovery/recovery-banner.test.tsx`
- `src/features/recovery/recovery-banner.tsx`
- `src/features/recovery/recovery.module.css`
- `src/features/recovery/runtime.test.ts`
- `src/features/recovery/runtime.ts`
- `src/features/recovery/types.ts`
- `src/features/telemetry/persistence.ts`
- `tests/e2e/recovery-visual.spec.ts`
- `tests/e2e/recovery.spec.ts`
- `docs/engineering/implementation/P16_OFFLINE_RECOVERY_HANDOFF.md`

Modified:

- `src/components/shell/app-shell.tsx`
- eligible mutation adapters in Discover, Product Detail, Wardrobe, Challenge
- P07 telemetry service, its persistence regression test, and the existing
  feature telemetry factories
- `tests/e2e/identity-mock.ts`
- `docs/engineering/IMPLEMENTATION_STATUS.md`

No migration, package, workflow, or cloud file changed.

Completion corrections changed exactly:

- `src/features/recovery/recovery.module.css`
- `tests/e2e/recovery-visual.spec.ts`
- `docs/engineering/implementation/P16_OFFLINE_RECOVERY_HANDOFF.md`
- `docs/engineering/IMPLEMENTATION_STATUS.md`

## 35. Suggested commit message

`feat(recovery)`
