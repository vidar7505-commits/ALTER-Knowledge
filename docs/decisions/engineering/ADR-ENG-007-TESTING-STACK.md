# ADR-ENG-007 — Testing Stack

**Status:** Accepted  
**Date:** 2026-07-19

## Context
LR-001 requires browser, accessibility, database, RLS, telemetry, and visual confidence.

## Decision
Use Vitest/RTL/MSW, Playwright/axe, pgTAP on Supabase local, and Playwright visual snapshots.

## Alternatives considered
Jest/Cypress; only E2E; hosted-database integration tests.

## Rationale
Fast TypeScript feedback plus first-class browser and database-policy coverage with minimal duplicated tooling.

## Consequences
CI must run the Supabase local stack and manage deterministic fonts/images for visual tests.

## Reversal conditions
Change tools only when maintenance or platform support materially blocks delivery; preserve equivalent coverage.
