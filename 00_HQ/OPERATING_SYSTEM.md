# A L T E R . Operating System v1

## Operating loop

`Question → Specification → Design → Build → Instrument → Release → Observe → Decide`

## Source-of-truth rule

Every domain has one canonical document. Chat conversations are working environments, not permanent sources of truth. Material outputs must be transferred to the repository.

## HQ responsibilities

The HQ thread owns:

- strategy and capital allocation;
- active roadmap;
- work-package creation and closure;
- cross-domain conflict resolution;
- synthesis of reports;
- decision log;
- go / revise / stop decisions.

HQ does not perform prolonged implementation work when a dedicated domain thread is available.

## Domain threads

- Research
- Product
- Design
- Engineering
- Data
- Business

Each thread receives a bounded mission, inputs, constraints, deliverables, and completion criteria. It returns files or repository-ready text plus a short handoff report.

## Work-package lifecycle

1. HQ opens a work package.
2. Domain tasks are issued.
3. Domain outputs are reviewed against completion criteria.
4. Conflicts are resolved by HQ.
5. Repository files are updated.
6. Work package is closed or revised.

## Execution constraints

- One primary learning objective per release.
- No unbounded feature exploration inside an active work package.
- No redesign without a measurable defect or violated design principle.
- No complex machine-learning model before a simple baseline exists.
- No B2B predictive claim without calibrated outcome data.
- No collection of sensitive or unnecessary personal data.

## Reporting format

Every domain handoff must contain:

1. Completed output
2. Key assumptions
3. Unresolved risks
4. Files created or changed
5. Recommended next action

## Decision logging

Record decisions only when they affect scope, architecture, measurement, positioning, cost, risk, or schedule. Minor implementation details remain in commits and technical documentation.

## Token and cost discipline

- Use one agent for a task unless independent parallel work has clear value.
- Search broadly, analyze narrowly.
- Summarize sources into decisions rather than storing redundant prose.
- Reuse canonical context files instead of repeatedly restating project history.
- Stop research when the next action is sufficiently supported.
