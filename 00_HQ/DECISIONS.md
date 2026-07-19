# Decision Log

## ADR-001 — Repository as source of truth

**Status:** Accepted  
**Decision:** Project decisions and deliverables are stored in the repository. Conversations are execution workspaces.  
**Reason:** Multiple specialized AI threads require a stable shared source of truth.

## ADR-002 — Parallel product and research

**Status:** Accepted  
**Decision:** Product development and research proceed in parallel. Research normally affects the next release rather than blocking the active release.  
**Reason:** Real usage is required to evaluate both retention and behavioral-data value.

## ADR-003 — Technology baseline

**Status:** Accepted  
**Decision:** Next.js, React, TypeScript, Tailwind CSS, Supabase, Git, and AI-assisted development.  
**Reason:** Fast implementation, integrated backend services, and strong ecosystem support.

## ADR-004 — Release strategy

**Status:** Accepted  
**Decision:** Use learning releases with one primary question rather than attempting the complete platform.  
**Reason:** Capital and time constraints require short evidence loops.

## ADR-005 — Experience quality

**Status:** Accepted  
**Decision:** The first release must be visually and interactively professional rather than a generic commerce prototype.  
**Reason:** Engagement quality affects both user retention and the validity of observed behavior.

## ADR-006 — LR-001 scope

**Status:** Accepted  
**Decision:** LR-001 includes onboarding, discovery feed, product detail, saving/wardrobe, outfit challenge, and event instrumentation.  
**Reason:** This is the smallest coherent loop capable of testing discovery, curation, creation, and return behavior.
