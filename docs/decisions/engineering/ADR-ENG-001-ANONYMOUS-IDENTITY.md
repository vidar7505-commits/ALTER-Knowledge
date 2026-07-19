# ADR-ENG-001 — Anonymous Identity

**Status:** Accepted  
**Date:** 2026-07-19

## Context
LR-001 needs durable anonymous state without trusting a client-generated authorization identifier.

## Decision
Use Supabase anonymous Auth. Map `auth.uid()` one-to-one to an analytic `anonymous_users.id`; all RLS ownership derives from `auth.uid()`.

## Alternatives considered
Client UUID cookie; custom signed installation token; mandatory account creation.

## Rationale
Smallest secure Supabase-native solution with session recovery and future account linking.

## Consequences
Browser storage loss can lose identity; anonymous Auth abuse must be rate-limited; analytic ID remains separate from Auth ID.

## Reversal conditions
Move to mandatory accounts or a custom identity service only when cross-device recovery or regulatory requirements demand it.
