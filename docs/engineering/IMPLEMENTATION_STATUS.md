# WP-006 Implementation Status

## Current package

`P03A — Supabase Cloud Development and CI Validation`

## Status

Implemented with external validation pending. Development-only cloud-link
instructions, runtime target guards, and a disposable local-container GitHub
database workflow are configured. The cloud project has not been linked in the
trusted terminal, so status is `Cloud linkage pending`. The workflow has not run
on GitHub, so status is `Configured but awaiting CI validation`.

## Implemented scope

- Frozen workstation, hosted-development, and GitHub Actions environment model.
- Secure operator-run `login` and `link --project-ref` workflow without a committed
  project reference or automatic linking.
- Runtime guard restricted to `development`, with linked-target verification,
  explicit push confirmation, secret-safe messages, and no linked-reset path.
- Guarded linked migration status, official push dry run, and explicit
  development push commands; none include seed data.
- Dedicated GitHub Actions database workflow using the pinned Supabase CLI and
  disposable local containers for start, reset, strict lint, future pgTAP tests,
  application validation, and cleanup.
- Seven focused remote-guard tests.
- Hosted-development data, migration-authority, secret-boundary, and CI-resource
  policies.

## Explicitly deferred

- Domain schema, migrations, indexes, triggers, RLS, RPCs, and pgTAP tests.
- Supabase clients, authentication behavior, telemetry, catalog, and product code.
- Automated hosted migration deployment and every staging/production environment.
- Cloud linkage, any remote schema operation, and every cloud credential value.

## Next action

Enter the development project reference directly in a trusted terminal to complete
the documented link and guarded status check. Open a pull request or manually
dispatch `database-validation.yml`; record its first successful GitHub run before
closing P03A. Then proceed to `P04 — Core Migrations` without deploying any P03A
schema.
