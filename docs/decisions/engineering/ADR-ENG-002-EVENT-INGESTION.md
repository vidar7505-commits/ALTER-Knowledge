# ADR-ENG-002 — Event Ingestion

**Status:** Accepted  
**Date:** 2026-07-19

## Context
Events require strict validation, offline replay, deduplication, and server-derived identity.

## Decision
Use a Next.js route handler as the public ingestion boundary and one PostgreSQL `ingest_events` RPC as the transactional insert boundary.

## Alternatives considered
Direct table insert; Supabase Edge Function; client-only analytics SDK.

## Rationale
Keeps validation with shared TypeScript contracts while preserving database idempotency and avoiding another runtime.

## Consequences
Vercel endpoint availability affects ingestion; queue/retry is required; endpoint must enforce rate limits.

## Reversal conditions
Move endpoint to an Edge Function if deployment limits, latency, or regional requirements materially degrade ingestion.
