# WP-006 P05 — Anonymous Identity Handoff

## Status

`Complete`.

The LR-001 anonymous identity application boundary is implemented. The GitHub
Actions `Database infrastructure validation` workflow passed after lockfile
synchronization: `npm ci` succeeded, clean reset applied all five migrations,
strict database lint passed, and all four pgTAP suites passed. Application
formatting, ESLint, TypeScript, unit/integration tests, production build, and
Playwright passed.

Cloud migrations deployed: None.

## Preflight

- Repository root:
  `C:\ALTER_REPOSITORY_COMPLETE_WP006_READY\ALTER`.
- `package.json`: present and readable.
- Initial Git working tree: clean.
- P04: `Complete`.
- Every required canonical input existed, was readable, and was read before any
  modification.

## Canonical inputs read

- `00_HQ/CONSTITUTION.md`
- `00_HQ/OPERATING_SYSTEM.md`
- `00_HQ/ROADMAP.md`
- `06_RELEASES/LR-001.md`
- `docs/product/LR-001_PRD.md`
- `docs/product/WP-002_HANDOFF.md`
- `docs/design/LR-001_UX_SPEC.md`
- `docs/design/LR-001_SCREEN_INVENTORY.md`
- `docs/design/WP-003_HANDOFF.md`
- `docs/data/EVENT_SPECIFICATION.md`
- `docs/data/DATABASE_SCHEMA.md`
- `docs/data/ANALYTICS_SPEC.md`
- `docs/data/DATA_QUALITY.md`
- `docs/data/WP-004_HANDOFF.md`
- `docs/engineering/SUPABASE_IMPLEMENTATION.md`
- `docs/engineering/TESTING_STRATEGY.md`
- `docs/engineering/WP-006_IMPLEMENTATION_PLAN.md`
- `docs/engineering/IMPLEMENTATION_STATUS.md`
- `docs/engineering/implementation/P03_SUPABASE_LOCAL_SETUP_HANDOFF.md`
- `docs/engineering/implementation/P03A_SUPABASE_CLOUD_CI_HANDOFF.md`
- `docs/engineering/implementation/P04_CORE_MIGRATIONS_HANDOFF.md`

## Architecture decision

P05 uses five narrow layers:

1. a lazy browser-only Supabase singleton configured with the public URL and anon
   key;
2. an injected client adapter limited to the Auth methods and bootstrap RPC;
3. a session/bootstrap service that owns recovery and provisioning;
4. a typed React provider and hook;
5. one identity-specific security-definer RPC.

No UI component calls Supabase directly. The React context exposes only the
canonical anonymous identity ID, Wardrobe ID, session disposition, recovery
status, and public error state. It does not expose access tokens, refresh tokens,
or the Supabase session object.

`@supabase/supabase-js` is pinned at `2.109.0`, whose package metadata supports
the repository's Node 20 CI baseline. The latest checked v2 release required Node
22 and was not retained.

## Supabase browser client boundary

`src/lib/supabase/browser.ts`:

- reads configuration lazily so static rendering does not require browser
  credentials at module evaluation;
- accepts only `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- enables session persistence and automatic refresh;
- disables URL-session detection because P05 implements anonymous Auth only;
- adapts the full Supabase client to the minimal `IdentityBootstrapClient`
  interface;
- keeps one browser client instance so remounts share Auth storage and in-flight
  work.

Missing public configuration produces an explicit unrecoverable
`configuration_missing` state. No service-role configuration is imported or
required by browser code.

## Bootstrap state machine

Public states:

```text
idle
  → loading
    → ready
    → recoverable_error → retry → loading
    → unrecoverable_error
```

`ready` includes:

- `anonymousUserId`;
- `wardrobeId`;
- `sessionDisposition`: `reused`, `created`, or `replaced`;
- `recoveryStatus`: `canonical`, `refreshed`, or `identity_replaced`.

Recoverable failures preserve local Auth state unless the SDK identifies the
session as invalid. Configuration, disabled anonymous Auth, missing RPC/grants,
permanent-account sessions, or malformed RPC responses are unrecoverable until
deployment/configuration is corrected or a later account-upgrade package owns
the flow.

## Existing-session flow

1. Call the supported Supabase `getSession()` API, which performs normal SDK
   refresh behavior when required.
2. Reuse a valid session without anonymous sign-in.
3. Call `ensure_anonymous_identity()`.
4. Return the same analytical identity and Wardrobe.
5. Report `sessionDisposition: reused`.

Reloads and return sessions reuse Supabase's persisted browser session and
therefore recover the same `auth.users.id` mapping.

## New-session flow

1. `getSession()` returns no session and no error.
2. Call `signInAnonymously()` exactly once for the shared bootstrap.
3. Require the result to contain an authenticated session.
4. Call `ensure_anonymous_identity()`.
5. Return the canonical analytical identity and Wardrobe.
6. Report `sessionDisposition: created`.

## Invalid-session recovery flow

1. Distinguish SDK invalid-session codes from transient network/service errors.
2. For invalid local state, call the supported `refreshSession()` API.
3. If refresh succeeds, reuse the session and report
   `recoveryStatus: refreshed`.
4. If refresh proves the session irrecoverable, call
   `signOut({ scope: 'local' })`; global sign-out is never used.
5. Create a new anonymous session and provision its canonical rows.
6. Report `sessionDisposition: replaced` and
   `recoveryStatus: identity_replaced`.

Transient failures do not clear local Auth storage and surface as
`recoverable_error`. Missing browser storage with no detectable prior session
creates a new identity but does not falsely claim that an earlier analytical
identity was preserved.

## Concurrent bootstrap and React Strict Mode

`bootstrapAnonymousIdentity()` stores one in-flight Promise per client in a
`WeakMap`. Concurrent calls receive that exact Promise. The entry is removed only
after resolution or rejection so later retries can run.

The browser adapter is a singleton. React Strict Mode effect replay therefore
uses the same client and same in-flight operation. Duplicate effects cannot
create multiple anonymous sessions. Database uniqueness and conflict handling
remain the second idempotency layer if duplicate network calls arrive.

## Database provisioning

Migration:

`supabase/migrations/20260723000500_anonymous_identity_bootstrap.sql`

It creates only `public.ensure_anonymous_identity()`:

- zero caller-supplied arguments;
- derives the Auth owner exclusively from `auth.uid()`;
- verifies the mapped `auth.users` row is anonymous;
- rejects a missing or permanent authenticated identity with SQLSTATE `28000`;
- inserts or recovers one `anonymous_users` row using the validated unique
  `auth_user_id` constraint;
- inserts or recovers one Wardrobe using the validated unique
  `anonymous_user_id` constraint;
- returns only `anonymous_user_id` and `wardrobe_id`;
- uses `security definer` with an explicitly empty `search_path` and fully
  qualified objects;
- revokes function execution from `public` and `anon`;
- grants execution only to `authenticated`;
- explicitly denies direct `anonymous_users` and `wardrobes` table access to
  `anon` and `authenticated`.

No P04 migration was edited. No general-purpose mutation function, broad policy,
domain behavior, Auth trigger, service-role path, or client-supplied ownership ID
was added.

## Application test inventory

New deterministic tests cover:

- existing valid session reuse;
- rejection of permanent-account sessions because account upgrade is deferred;
- missing-session anonymous sign-in;
- canonical anonymous identity and Wardrobe results;
- repeated bootstrap stability;
- concurrent callers sharing one in-flight operation;
- React Strict Mode duplicate-effect convergence;
- successful invalid-session refresh;
- local-only invalid-session clearing and explicit identity replacement;
- preservation of local state on transient Auth failure;
- recoverable Auth/RPC errors;
- unrecoverable disabled Auth, missing RPC, configuration, and contract errors;
- provider loading, ready, recoverable-error, and identifier-only context;
- browser-safe public configuration with no service-role requirement.

Focused identity result: 3 files and 18 tests passed. Full application result: 7
files and 43 tests passed.

## SQL test inventory

`supabase/tests/004_anonymous_identity_bootstrap.sql` verifies:

- function existence;
- `security definer`;
- fixed empty `search_path`;
- authenticated-only execution;
- denied direct identity and Wardrobe inserts;
- rejection without `auth.uid()`;
- rejection of permanent-account Auth identities;
- successful provisioning;
- stable repeated results;
- exactly one identity and one Wardrobe after repeated calls;
- two Auth identities receive separate analytical identities and Wardrobes;
- the Wardrobe uniqueness constraint prevents duplicate roots.

True simultaneous database requests are not orchestrated inside pgTAP. The
single-statement identity upsert, Wardrobe conflict handling, unique constraints,
repeated-call tests, and application shared-Promise tests jointly cover practical
convergence. The disposable GitHub database workflow remains authoritative for
runtime SQL validation.

## Validation commands and outcomes

| Command                                                      | Outcome                                                                                                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm.cmd install --save-exact @supabase/supabase-js@2.109.0` | Passed; 2.109.0 was pinned because it supports Node 20. npm reports the existing total of 1 moderate and 2 high dependency vulnerabilities.                                          |
| `npx.cmd supabase --version`                                 | Passed: `2.109.1`. The sandboxed attempt could not update the user-profile telemetry file; the unchanged command passed with permission.                                             |
| Focused identity Vitest run                                  | Passed: 3 files, 18 tests.                                                                                                                                                           |
| `npm.cmd run lint`                                           | Passed. The first run found one React effect-state lint error; the provider was corrected to perform bootstrap resolution asynchronously, and the unchanged required command passed. |
| `npm.cmd run typecheck`                                      | Passed after incomplete mock signatures and the SDK's optional `is_anonymous` field mapping were typed explicitly.                                                                   |
| `npm.cmd run test`                                           | Passed: 7 files, 43 tests.                                                                                                                                                           |
| `npm.cmd run build`                                          | Passed. The sandboxed attempt could not fetch the existing Instrument Serif and Inter Google Fonts; the unchanged command passed with network permission.                            |
| `npm.cmd run test:e2e -- --reporter=line --workers=1`        | Passed: 1 Chromium test in 13.9 seconds. The sandboxed attempt timed out after 360 seconds while the test was running; the unchanged command passed with local-server/font access.   |
| `npx.cmd supabase db reset --local`                          | Blocked: Docker Desktop Linux-engine pipe `//./pipe/dockerDesktopLinuxEngine` was not found.                                                                                         |
| `npx.cmd supabase db lint --local --fail-on warning`         | Blocked: `LegacyDbConnectError`; local PostgreSQL was unavailable.                                                                                                                   |
| `npx.cmd supabase test db`                                   | Blocked: `LegacyDbConnectError`; local PostgreSQL was unavailable.                                                                                                                   |
| CI `npm ci`                                                  | Passed after lockfile synchronization.                                                                                                                                               |
| GitHub Actions `Database infrastructure validation`          | Passed: clean reset applied all five migrations; strict database lint and all four pgTAP suites passed.                                                                              |
| `npm.cmd run format:check`                                   | Passed after Prettier was applied only to the new P05 provider and handoff; the first final check identified those two files.                                                        |
| `git diff --check`                                           | Passed; Git emitted LF-to-CRLF working-copy warnings only.                                                                                                                           |

No unsafe Docker workaround was attempted. Tests and CI gates were not weakened.

## Runtime and deployment status

- Local application tests: passed.
- Workstation-local migration application: blocked by missing Docker Desktop
  Linux engine.
- Workstation-local database lint: blocked because local PostgreSQL is
  unavailable.
- Workstation-local pgTAP: blocked because local PostgreSQL is unavailable.
- GitHub Actions validation with P05: passed.
- CI dependency installation: passed after lockfile synchronization.
- Clean database reset in CI: passed.
- Migration application in CI: passed; all five migrations applied
  successfully.
- Strict database lint in CI: passed.
- pgTAP in CI: passed; all four suites passed.
- Hosted development schema updated: No.
- Cloud migrations deployed: None.
- Remote reset: not run.
- Remote seed push: not run.

## Security model and credential boundaries

- Supabase Auth is the authorization root.
- Browser code uses only the public URL and anon key.
- No service-role key, management credential, project reference, password,
  access token, connection string, or session token is committed or exposed
  through React context.
- The client cannot supply an owner ID to the bootstrap RPC.
- The RPC resolves ownership from `auth.uid()` and exposes only two canonical
  UUIDs.
- Direct identity/Wardrobe table writes remain unavailable to client roles.
- The function's empty `search_path` prevents caller-controlled object
  resolution.
- P05 does not claim complete authorization or cross-user isolation for the
  broader schema.

## Scope review

Implemented only anonymous Auth bootstrap, session recovery, identity/Wardrobe
provisioning, typed state, client/provider boundaries, and their tests.

Not implemented:

- onboarding UX or persistence operations;
- feed generation or catalog access/import;
- product save/remove;
- Challenge behavior;
- analytics sessions, events, ingestion, or dashboards;
- account upgrade or identity merge;
- broad RLS, general mutation RPCs, or application-wide authorization;
- hosted deployment.

No frozen Product, Design, Data, Engineering Foundation, Release, ADR, P04
migration, seed, Supabase configuration, workflow, or unrelated application
surface was modified.

## Known limitations and deferred P06 work

- Browser storage clearing or explicit anonymous sign-out loses the only
  credential capable of recovering that anonymous Auth identity.
- When an invalid session cannot be refreshed, a new identity is created and
  replacement is reported; P05 does not merge the lost identity.
- Full RLS activation, private-table SELECT policies, exhaustive two-user
  isolation, grants across the remaining schema, application-role immutability,
  and all non-bootstrap transactional RPCs remain P06.
- Production anonymous-sign-in abuse controls and hosted environment enablement
  require separately reviewed deployment configuration.

## Exact files created

- `src/features/identity/bootstrap.ts`
- `src/features/identity/bootstrap.test.ts`
- `src/features/identity/identity-provider.tsx`
- `src/features/identity/identity-provider.test.tsx`
- `src/features/identity/types.ts`
- `src/lib/environment/browser.test.ts`
- `src/lib/supabase/browser.ts`
- `supabase/migrations/20260723000500_anonymous_identity_bootstrap.sql`
- `supabase/tests/004_anonymous_identity_bootstrap.sql`
- `docs/engineering/implementation/P05_ANONYMOUS_IDENTITY_HANDOFF.md`

## Exact files modified

- `package.json`
- `package-lock.json`
- `vitest.config.ts`
- `src/app/layout.tsx`
- `src/lib/environment/browser.ts`
- `docs/engineering/IMPLEMENTATION_STATUS.md`

## Recommended next action

P06 — RLS and RPC Foundation is now unblocked. Proceed to P06 for broad RLS,
private-table SELECT policies, exhaustive two-user isolation, remaining grants,
application-role immutability, and non-bootstrap transactional RPCs. Hosted
migration deployment remains a separate reviewed action.

## Suggested commit message

`feat(identity): add anonymous auth bootstrap`
