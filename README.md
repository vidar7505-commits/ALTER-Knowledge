# A L T E R .

A L T E R . is developed through short learning cycles in which product usage, behavioral evidence, and commercial relevance are evaluated together.

## Current phase

`WP-006 — Learning Release 001 Implementation`

The canonical foundation, Product, Design, Data, and Engineering work packages are complete. Implementation begins with `P01 — Repository Scaffold`.

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
