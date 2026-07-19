# ADR-ENG-004 — State Management

**Status:** Accepted  
**Date:** 2026-07-19

## Context
The product needs synchronized saved/challenge state but remains small.

## Decision
Use Server Components, Server Actions, React local state, `useOptimistic`, URL state, and limited browser persistence. Add no global state library.

## Alternatives considered
Redux Toolkit; Zustand; fully client-side cache.

## Rationale
Canonical state is server-owned; framework primitives cover LR-001 without parallel caches.

## Consequences
Feature boundaries must avoid prop drilling through focused composition; mutation responses must refresh affected routes.

## Reversal conditions
Introduce a client cache only if real-time multi-surface editing or materially complex cross-route workflows emerge.
