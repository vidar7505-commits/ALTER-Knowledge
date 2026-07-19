# ADR-ENG-003 — Mutation Idempotency

**Status:** Accepted  
**Date:** 2026-07-19

## Context
Double taps, retries, and offline delivery can repeat mutations. Challenge start needs explicit idempotency.

## Decision
Use operation IDs stored on domain records. Add a dedicated unique `start_operation_id` to challenge progress rather than a generalized ledger.

## Alternatives considered
General mutation ledger; request hash; client debouncing only.

## Rationale
LR-001 has few mutations and existing domain operation fields. A ledger adds abstraction and cleanup complexity without current benefit.

## Consequences
Each mutation schema needs a unique operation column/index; replay returns canonical current state.

## Reversal conditions
Adopt a generalized ledger when mutation count or multi-entity workflows make domain columns materially repetitive.
