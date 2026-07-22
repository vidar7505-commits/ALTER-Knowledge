# A L T E R .

A L T E R . is developed through short learning cycles in which product usage, behavioral evidence, and commercial relevance are evaluated together.

## Current phase

`WP-006 — Learning Release 001 Implementation`

The canonical foundation, Product, Design, Data, and Engineering work packages are complete. P03 local Supabase tooling is configured but awaits Docker-based validation. P03A adds a development-only hosted-project linkage boundary and disposable local-container database validation for GitHub Actions; cloud linkage and the first workflow run remain pending.

## Operating rule

Build the smallest professional product capable of generating real user behavior. Research may inform the next release but does not block the current release unless it reveals a critical legal, ethical, privacy, security, or measurement-validity risk.

## Repository map

- `00_HQ/` — Constitution, operating rules, roadmap, decision log, and work-package templates.
- `06_RELEASES/` — frozen release scopes and release records.
- `docs/product/` — LR-001 product requirements and handoff.
- `docs/design/` — design system, UX specification, screen/state inventory, and handoff.
- `docs/data/` — event contract, database schema, analytics, dashboards, data quality, and handoff.
- `docs/engineering/` — architecture, implementation protocol, operations, testing, and WP-006 plan.
- `docs/decisions/engineering/` — accepted Engineering ADRs.

## Active work packages

1. `WP-001 — Foundation` — Complete
2. `WP-002 — Product Foundation` — Complete
3. `WP-003 — Design Foundation` — Complete
4. `WP-004 — Data Foundation` — Complete
5. `WP-005 — Engineering Foundation` — Complete
6. `WP-006 — LR-001 Implementation and Release` — Ready

The source of truth for sequence and status is `00_HQ/ROADMAP.md`.

## Local setup

Requirements:

- Node.js 20.9 or newer.
- npm 10 or newer.
- Docker Desktop (or another Docker-compatible engine) running locally.

Create local environment values and install dependencies:

```bash
cp .env.example .env.local
npm install
npm run dev
```

The health page is available at `http://localhost:3000` and displays
`A L T E R . — LR-001 development environment`.

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are browser-safe
configuration. `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never use the
`NEXT_PUBLIC_` prefix or be imported through the browser environment module.

### Local Supabase

Install dependencies, start the local stack, and inspect its generated local-only
credentials:

```bash
npm install
npm run supabase:bootstrap
npm run supabase:status
```

Copy `.env.example` to the Git-ignored `.env.local`, then replace the key
placeholders with the local anon and service-role keys printed by status. Never
commit those generated credentials. The canonical local endpoints are:

| Service       | Local URL/port           |
| ------------- | ------------------------ |
| Application   | `http://127.0.0.1:3000`  |
| Supabase API  | `http://127.0.0.1:54321` |
| PostgreSQL    | `127.0.0.1:54322`        |
| Studio        | `http://127.0.0.1:54323` |
| Email capture | `http://127.0.0.1:54324` |

These are the Supabase CLI defaults and are committed in `supabase/config.toml`.
Use `npm run supabase:stop` when finished and `npm run supabase:reset` to rebuild
the local database from committed migrations and the intentionally empty P03 seed.
These commands are local-only and do not link or target a remote project.

### Supabase environment model

P03A uses three deliberately separate execution boundaries:

- The local workstation runs Next.js, owns repository migrations, and runs unit,
  component, and E2E tests. Its available memory is not sufficient for a reliable
  full Supabase stack.
- The existing `alter-development` Supabase project holds disposable development
  data only. It is not staging or production, must contain no real users or
  production data, and may be erased.
- GitHub Actions is authoritative for full local Supabase startup, database reset,
  lint, and future pgTAP, RLS isolation, and telemetry reconciliation tests. The
  job uses disposable Docker containers and no hosted-project credentials.

No staging or production Supabase project exists in P03A. Do not weaken database
tests because the workstation cannot run the full stack.

### Link hosted development securely

Run linkage only in a trusted PowerShell terminal. The project reference is in the
Supabase project dashboard URL or project settings. Enter it yourself; never put
it in a repository file, package script, command example with a real value, or
support transcript.

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref <ALTER_DEVELOPMENT_PROJECT_REF>
```

The repository does not run `supabase link` automatically. After a successful
link, verify the target and compare migration history without printing the project
reference, passwords, or keys:

```powershell
npm.cmd run supabase:linked:status -- --environment development --project-ref <ALTER_DEVELOPMENT_PROJECT_REF>
```

The guard compares the runtime reference with the ignored local link metadata,
does not echo the value, and permits only `development`. It also accepts a
runtime-only lowercase SHA-256 reference hash through
`--project-ref-sha256 <EXPECTED_SHA256>` instead of `--project-ref`.

Preview a future committed migration deployment with the official dry-run path:

```powershell
npm.cmd run supabase:remote:dry-run -- --environment development --project-ref <ALTER_DEVELOPMENT_PROJECT_REF>
```

Only after local-container database validation passes and the dry run is reviewed,
an operator may explicitly confirm a development push:

```powershell
npm.cmd run supabase:remote:push -- --environment development --project-ref <ALTER_DEVELOPMENT_PROJECT_REF> --confirm development
```

P03A has no domain migration and no remote push should be run. The remote scripts
never include seed data. A linked database reset is destructive and is
intentionally not exposed by package scripts.

### Hosted-development policy

- Committed migrations are authoritative. Do not make manual schema changes in
  the hosted Dashboard.
- Studio may inspect development state, but any useful SQL experiment must become
  a reviewed migration or be discarded.
- Destructive remote work requires explicit target verification and human
  confirmation. Hosted development data is disposable.
- Never use real users, production data, or production secrets in
  `alter-development`.
- Never put the service-role key in browser code or a `NEXT_PUBLIC_*` variable.

Management credentials belong only in the local shell, the Supabase CLI credential
store, or GitHub Actions secrets. They do not belong in `.env.local`, Next.js
client configuration, committed files, logs, or documentation containing real
values. `.env.example` remains limited to application runtime placeholders.

### Database validation in GitHub Actions

`.github/workflows/database-validation.yml` runs for relevant Supabase, database
script, package, and workflow changes, and supports manual dispatch. It installs
the pinned CLI, starts a disposable local Supabase stack, resets from committed
sources, lints with warnings treated as failures, runs pgTAP only when SQL tests
exist, runs application gates, and always stops the stack. It requires an Ubuntu
GitHub runner with Docker and is expected to take roughly 10–20 minutes on a cold
runner, within its 30-minute timeout.

The validation job does not link to `alter-development` and receives no cloud
credentials. A future, separately reviewed hosted-development migration job would
require these encrypted GitHub Actions secrets, entered only through repository
settings:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_ID` (the project reference)

That future job must run only after database validation, target development only,
deploy committed migrations, review `supabase db push --dry-run` before push,
exclude seed by default, and never reset the remote project automatically. No such
deployment job exists in P03A.

## Commands

| Command                           | Purpose                                                         |
| --------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                     | Start the local Next.js development server.                     |
| `npm run build`                   | Create a production build.                                      |
| `npm run start`                   | Serve the production build.                                     |
| `npm run format`                  | Format supported files with Prettier.                           |
| `npm run format:check`            | Check formatting without changing files.                        |
| `npm run lint`                    | Run ESLint.                                                     |
| `npm run lint:fix`                | Apply safe ESLint fixes.                                        |
| `npm run typecheck`               | Run TypeScript without emitting files.                          |
| `npm run test`                    | Run Vitest once.                                                |
| `npm run test:watch`              | Run Vitest in watch mode.                                       |
| `npm run test:e2e`                | Run Playwright Chromium tests.                                  |
| `npm run test:e2e:ui`             | Open Playwright's interactive test UI.                          |
| `npm run supabase:bootstrap`      | Verify prerequisites, start Supabase, and print setup guidance. |
| `npm run supabase:start`          | Start the local Supabase stack.                                 |
| `npm run supabase:stop`           | Stop the local Supabase stack.                                  |
| `npm run supabase:status`         | Print local service status, URLs, and credentials.              |
| `npm run supabase:reset`          | Reset the local database from committed sources.                |
| `npm run supabase:db:lint`        | Lint the local database schema.                                 |
| `npm run supabase:linked:status`  | Guard and list linked development migration status.             |
| `npm run supabase:remote:dry-run` | Guard and preview a development migration push.                 |
| `npm run supabase:remote:push`    | Guard and explicitly apply migrations to development.           |
| `npm run check`                   | Run all mandatory non-E2E validation gates.                     |

Playwright requires a local browser binary. Install Chromium when needed:

```bash
npx playwright install chromium
```

## Repository boundaries

- `src/app/` — Next.js routes and layouts.
- `src/lib/validation/` — shared validation schemas.
- `src/lib/environment/` — typed browser and server environment access.
- `src/test/mocks/` — MSW handlers and server lifecycle.
- `src/test/fixtures/` — reusable test fixtures.
- `tests/e2e/` — Playwright browser tests and accessibility checks.
- `supabase/` — committed local configuration, migrations, seed, and database tests.
- `scripts/` — repository automation, including the local Supabase bootstrap helper.

## Canonical implementation inputs

Implementation agents must read the applicable canonical documents before modifying code. If a required input is unavailable, the agent must stop and report the missing path rather than infer the decision.

Engineering implementation follows:

- `docs/engineering/AI_DEVELOPMENT_PROTOCOL.md`
- `docs/engineering/WP-006_IMPLEMENTATION_PLAN.md`

## GitHub

This repository is configured for the existing `origin` remote. Before beginning implementation, verify:

```bash
git remote -v
git status
git pull --ff-only origin main
```

Do not commit credentials or local environment files.
