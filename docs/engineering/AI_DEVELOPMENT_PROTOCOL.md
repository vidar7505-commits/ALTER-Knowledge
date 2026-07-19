# A L T E R . — AI-Assisted Development Protocol

## 1. Source-of-truth hierarchy

1. `00_HQ/CONSTITUTION.md`
2. `00_HQ/OPERATING_SYSTEM.md`
3. `00_HQ/ROADMAP.md`
4. `06_RELEASES/LR-001.md`
5. Product, Design, Data canonical documents
6. WP-005 engineering documents and ADRs
7. Current implementation package specification
8. Existing code and tests

An agent may report a contradiction but may not redesign product behavior, measurement definitions, or architecture.

## 2. Task size

One agent task should modify one coherent feature slice, normally ≤ 8 production files plus tests and documentation. Database migrations, cross-feature refactors, and visual-system changes are separate tasks.

## 3. Required implementation prompt

```text
Package:
Objective:
Canonical inputs:
Allowed files:
Forbidden scope:
Required behavior:
Required tests:
Acceptance criteria:
Migration impact:
Telemetry impact:
Output and handoff:
```

## 4. Rules

- Change only allowed files.
- Do not add dependencies without explicit justification.
- Do not bypass RLS with service role for user operations.
- Do not invent event names or properties.
- Do not alter migrations after they have reached shared staging; create a new migration.
- Update generated database types after schema changes.
- Preserve approved tokens and interaction states.
- Add tests before declaring completion.
- Run formatting, lint, types, targeted tests, and build.
- Never commit secrets, production data, or copied event payloads.

## 5. Self-review checklist

Scope, security, RLS, validation, idempotency, rollback, telemetry ordering, accessibility, responsive behavior, loading/error/offline states, test coverage, documentation, dead code, and dependency impact.

## 6. Commit format

`<type>(<domain>): <imperative summary> [WP-006-P##]`

Examples: `feat(identity): add anonymous auth bootstrap [WP-006-P05]`

One implementation package should normally be one reviewable commit or a short ordered series: migration, implementation, tests/docs.

## 7. Handoff format

Completed output; canonical decisions used; files changed; migrations; tests run and results; telemetry changes; known limitations; unresolved risks; recommended next package.
