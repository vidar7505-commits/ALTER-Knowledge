# ADR-ENG-005 — Feed Pagination and Restoration

**Status:** Accepted  
**Date:** 2026-07-19

## Context
Analysis requires reproducible ordering, absolute positions, deduplication, and scroll restoration.

## Decision
Persist each feed instance and exact product sequence. Use opaque cursor pagination with batches of 24 and history/sessionStorage scroll metadata.

## Alternatives considered
Offset pagination over live catalog; purely client-random order; keyset without persisted sequence.

## Rationale
Persisted sequence protects measurement validity when catalog state changes and supports deterministic restoration.

## Consequences
Additional feed tables and writes; historical unavailable products need explicit rendering.

## Reversal conditions
Replace with a ranking service only after LR-001 evidence justifies non-deterministic personalization and replay tooling exists.
