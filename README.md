# A L T E R .

A L T E R . is developed through short learning cycles in which product usage, behavioral evidence, and commercial relevance are evaluated together.

## Current phase

`WP-006 — Learning Release 001 Implementation`

The canonical foundation, Product, Design, Data, and Engineering work packages are complete. P03 local Supabase tooling is configured but awaits Docker-based validation.

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
All scripts are local-only and do not link or target a remote project.

## Commands

| Command                      | Purpose                                                         |
| ---------------------------- | --------------------------------------------------------------- |
| `npm run dev`                | Start the local Next.js development server.                     |
| `npm run build`              | Create a production build.                                      |
| `npm run start`              | Serve the production build.                                     |
| `npm run format`             | Format supported files with Prettier.                           |
| `npm run format:check`       | Check formatting without changing files.                        |
| `npm run lint`               | Run ESLint.                                                     |
| `npm run lint:fix`           | Apply safe ESLint fixes.                                        |
| `npm run typecheck`          | Run TypeScript without emitting files.                          |
| `npm run test`               | Run Vitest once.                                                |
| `npm run test:watch`         | Run Vitest in watch mode.                                       |
| `npm run test:e2e`           | Run Playwright Chromium tests.                                  |
| `npm run test:e2e:ui`        | Open Playwright's interactive test UI.                          |
| `npm run supabase:bootstrap` | Verify prerequisites, start Supabase, and print setup guidance. |
| `npm run supabase:start`     | Start the local Supabase stack.                                 |
| `npm run supabase:stop`      | Stop the local Supabase stack.                                  |
| `npm run supabase:status`    | Print local service status, URLs, and credentials.              |
| `npm run supabase:reset`     | Reset the local database from committed sources.                |
| `npm run supabase:db:lint`   | Lint the local database schema.                                 |
| `npm run check`              | Run all mandatory non-E2E validation gates.                     |

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
