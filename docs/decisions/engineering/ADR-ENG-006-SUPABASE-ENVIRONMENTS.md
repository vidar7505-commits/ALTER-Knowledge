# ADR-ENG-006 — Supabase Environments

**Status:** Accepted  
**Date:** 2026-07-19

## Context
Production data and test traffic must remain isolated while preview cost stays controlled.

## Decision
Use local ephemeral stacks, one shared synthetic-only preview project, dedicated staging, and dedicated production.

## Alternatives considered
One project for all environments; project per preview; production branch database.

## Rationale
Balances isolation, cost, and operational simplicity for a small team.

## Consequences
Preview data needs namespace cleanup; staging migrations must precede production.

## Reversal conditions
Adopt per-preview branches when concurrency or migration conflict cost exceeds project/branch cost.
