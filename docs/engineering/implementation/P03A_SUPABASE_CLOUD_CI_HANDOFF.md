# WP-006 P03A — Supabase Cloud Development and CI Validation Handoff

## Status

Complete. Both external gates are closed:

- Cloud linkage: `Complete`
- CI validation: `Complete`

## Completed output

Prepared a safe development-only hosted Supabase linkage workflow, a narrowly
scoped runtime remote guard, focused guard tests, and a dedicated GitHub Actions
workflow that validates the database against disposable local containers. No
LR-001 domain schema or product behavior was introduced.

## Environment model

- Local workstation: Next.js development, repository migration authoring, and
  unit/component/E2E tests; the full Supabase stack is not reliable on available
  memory.
- Hosted Supabase: the existing `alter-development` project only, containing
  disposable development data with no real users, production data, or production
  secrets.
- GitHub Actions: authoritative full Supabase startup, migration reset, database
  lint, and future pgTAP/RLS/telemetry database validation using disposable local
  Docker containers.

No staging or production project exists in P03A.

## Hosted project purpose and policy

`alter-development` is a disposable shared development target, never production.
Committed migrations are authoritative. Studio is inspection-only for hosted
schema; manual SQL experiments must become reviewed migrations or be discarded.
Undocumented Dashboard schema changes are prohibited. Destructive work requires
explicit target verification and direct confirmation, and development data may be
erased. The service-role key is prohibited from browser code.

## CLI linkage workflow

The user must enter the reference directly in a trusted PowerShell terminal:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref <ALTER_DEVELOPMENT_PROJECT_REF>
npm.cmd run supabase:linked:status -- --environment development --project-ref <ALTER_DEVELOPMENT_PROJECT_REF>
```

The reference is available from the Supabase project dashboard URL or project
settings. Linkage is never automated. The guarded status command compares the
runtime reference (or its runtime-only SHA-256 hash) with ignored local link
metadata and then uses `supabase migration list --linked`. It does not print the
target value or any credential.

External closure verification confirmed that development-project linkage and the
guarded linked status command both succeeded. No project reference or credential
value was recorded in this handoff.

## GitHub Actions workflow

`.github/workflows/database-validation.yml` runs for relevant pull-request paths
and manual dispatch. On an Ubuntu runner it:

1. checks out the repository;
2. installs Node.js 20 and dependencies with `npm ci`;
3. verifies the pinned repository-local Supabase CLI;
4. starts the full local Supabase stack in disposable Docker containers;
5. resets the local database from committed sources;
6. lints the local schema and fails on warnings;
7. runs `supabase test db` only after real SQL tests exist;
8. runs formatting, ESLint, TypeScript, unit tests, and the application build;
9. always stops the disposable stack without backup.

The workflow does not link to or receive credentials for the hosted project.
Expected cold-run time is approximately 10–20 minutes, with a 30-minute job
timeout and a required Docker-capable GitHub runner.

## Required GitHub secrets

No secrets are required by the P03A database-validation workflow. A future,
separately reviewed hosted-development migration job will require encrypted values
entered only through GitHub repository settings:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_ID` (the development project reference)

Such a job must depend on successful database validation, target development only,
deploy committed migrations, dry-run before push where supported, exclude seed by
default, and never reset the remote project automatically.

## Remote safety controls

- Empty, production, and every non-development environment is rejected.
- Exactly one project reference or lowercase SHA-256 reference hash is required at
  runtime; neither is committed.
- Runtime target intent must match the ignored linked-project metadata.
- Remote push additionally requires `--confirm development`.
- The project reference is never included in guard output.
- Passwords and keys are never accepted or printed by the guard.
- Remote commands never include seed data.
- Destructive `db reset --linked` is not exposed through package scripts.
- Warnings state that linked resets are destructive and intentionally unavailable.

## Commands added

- `npm run supabase:linked:status`
- `npm run supabase:remote:dry-run`
- `npm run supabase:remote:push`

All require runtime arguments documented in the repository README. No remote
command was executed during the original P03A implementation run. The later
external closure verification executed the guarded linked status read. No domain
migration deployment, remote reset, or seed push occurred.

## Tests added

`scripts/supabase-remote.test.mjs` verifies:

- empty environment rejection;
- production rejection;
- development acceptance and official dry-run arguments;
- runtime expected-reference-hash acceptance;
- missing push confirmation rejection;
- project reference omission from output;
- absence of linked reset and seed flags from normal package scripts.

No fake domain database tests were created.

## Commands executed and validation results

| Command                                               | Final result                                                                                                                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd install`                                     | Passed after registry/cache permission was granted; 515 packages audited and already up to date. npm reports 1 moderate and 2 high dependency vulnerabilities.                                              |
| `npm.cmd run format:check`                            | Passed. The first run identified README formatting; Prettier was applied only to allowed P03A files and the required check then passed.                                                                     |
| `npm.cmd run lint`                                    | Passed. The first attempt exceeded a 120-second outer tool timeout; the unchanged command passed under a longer timeout.                                                                                    |
| `npm.cmd run typecheck`                               | Passed.                                                                                                                                                                                                     |
| `npm.cmd run test`                                    | Passed: 4 files and 25 tests, including all 7 new guard tests.                                                                                                                                              |
| `npm.cmd run build`                                   | Passed. The sandboxed first attempt could not fetch the existing Google Fonts; the unchanged command passed with network permission.                                                                        |
| `npm.cmd run test:e2e -- --reporter=line --workers=1` | Passed: 1 Chromium test. The first attempt exceeded a five-minute outer timeout while the test was running; the unchanged command passed with a longer timeout and required local-server/font access.       |
| `npx.cmd supabase --version`                          | Passed: `2.109.1`. The CLI required permission to update its user-profile telemetry state.                                                                                                                  |
| `git diff --check`                                    | Passed; Git emitted line-ending conversion warnings only.                                                                                                                                                   |
| Prettier YAML validation                              | Passed; `database-validation.yml` parsed and formatted successfully. A separate Node YAML parse was not run because no YAML parser package is installed, and no dependency was added for a duplicate check. |

Additional focused validation passed for `scripts/supabase-remote.test.mjs`: 1 file
and 7 tests. A changed-file credential-pattern review found only the deliberate
fake test reference and code identifiers; no credential value was present.

## Actual CI-local validation status

`Complete`. The GitHub Actions `Database infrastructure validation` workflow
completed successfully, verifying the GitHub-hosted disposable Supabase
validation path. This workflow used local containers and no hosted-project
credentials.

## Actual cloud-link status

`Complete`. Supabase cloud development-project linkage succeeded in a trusted
terminal, and the guarded linked status command succeeded. The project reference
and credentials remain outside the repository and this handoff.

## Migrations deployed

None. P03A adds no domain migration, and no domain migrations were deployed. No
remote reset or seed push occurred.

## Security observations

- No project reference, access token, database password, anon key, service-role
  key, connection string, or GitHub secret value is committed.
- Management credentials remain limited to the local shell, Supabase CLI
  credential store, and future GitHub Actions secrets.
- `.env.example` was intentionally not changed; cloud management credentials do
  not belong in application runtime or `NEXT_PUBLIC_*` variables.
- GitHub database validation uses no cloud credentials.
- The dependency tree still reports 1 moderate and 2 high vulnerabilities; no
  breaking `npm audit fix --force` was run.

## Known limitations

- Full local Supabase startup remains unreliable on the constrained workstation;
  GitHub Actions is the authoritative runtime for that validation.
- The workflow's authoritative GitHub Actions validation has passed; workstation
  resource constraints remain unchanged.
- No real database SQL tests exist yet, so the workflow correctly records the skip
  until P04 adds migration tests.

## Unresolved blockers

None for P04. Verified cloud linkage, guarded linked status, and the successful
GitHub database validation workflow have unblocked `P04 — Core Migrations`.

## Recommended next package

Proceed to `P04 — Core Migrations`, which is now unblocked. Validate P04
migrations in the disposable local-container GitHub workflow before any
controlled dry run or deployment to hosted development.
