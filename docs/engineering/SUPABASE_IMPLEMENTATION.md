# A L T E R . — Supabase and PostgreSQL Implementation

## 1. Canonical identity correction

Use Supabase anonymous Auth. `auth.users.id` is the authorization identity for anonymous and upgraded accounts. Add `auth_user_id uuid not null unique references auth.users(id)` to `public.anonymous_users`, and derive ownership from `auth.uid()`.

This replaces the Data document's proposed client-carried `anonymous_user_id` claim. The analytic `anonymous_user_id` remains stable and separate, but clients cannot choose it.

## 2. Migration order

1. extensions, enums, helper functions;
2. `anonymous_users`, `users`, auth trigger;
3. onboarding state;
4. sessions;
5. products and product assets;
6. wardrobes and saved products;
7. challenges, progress, items, completions;
8. feed instances and feed products;
9. mutation-operation columns and constraints;
10. events and quarantine;
11. indexes and updated-at triggers;
12. RLS policies;
13. RPCs;
14. certified views and QA functions;
15. seed challenge, onboarding taxonomy, and catalog.

Every migration is forward-only, timestamped, reviewed, and tested against a clean database plus an upgrade from the previous schema.

## 3. Required schema corrections

1. Add `anonymous_users.auth_user_id` and make it immutable.
2. Create one anonymous profile and Wardrobe in an `auth.users` insert trigger.
3. Add `onboarding_state` table; it is required by Product but absent from the displayed core schema.
4. Add `challenge_progress.start_operation_id uuid unique` for deterministic start idempotency.
5. Add unique `completion_operation_id` to challenge completions.
6. Add unique partial index on active challenge item removal operation IDs.
7. Add `continuation_dismissals` only if dismissal persists across sessions; otherwise keep dismissal session-local.
8. Do not accept `anonymous_user_id`, `user_id`, `environment`, or `is_test` from untrusted event payloads; derive them server-side.
9. Replace unrestricted `image_urls text[]` ingestion with curated catalog import validation and approved hosts.
10. Completed challenge snapshots are append-only; revoke UPDATE/DELETE from application roles.
11. Add `record_meaningful_destination(uuid, text, uuid)` as the only
    application write boundary for `anonymous_users.last_meaningful_destination`.
    It derives identity through `auth.uid()`, accepts only `discover`,
    `wardrobe`, or `challenge`, validates an owned active session, and uses
    deterministic operation replay/conflict semantics.

## 4. Ownership and deletion

- Catalog and challenge definitions: HQ/Data-owned; client read-only.
- Wardrobe, onboarding, progress, feed instance, sessions: identity-owned.
- Events: append-only, server-ingested, no client reads.
- Saved product removal: soft-delete using `removed_at`.
- Challenge item removal: soft-delete using `removed_at`.
- Anonymous identity deletion: hard-delete owner state after retention workflow; historical events are anonymized or deleted according to reviewed policy.
- Completed challenge records: immutable until account deletion/retention execution.

## 5. Constraints and triggers

- `updated_at` trigger on mutable state tables.
- Ownership consistency trigger verifies child `anonymous_user_id` matches parent.
- Challenge completion function verifies exact required slots, uniqueness, eligibility, active progress revision, and challenge version.
- Session function enforces monotonically increasing session number per identity.
- Event insert function verifies session/identity match and timestamp bounds.
- Product currency uses ISO 4217 uppercase check.
- Required JSON documents validate against SQL checks where practical and application Zod schemas everywhere.

## 6. RPC boundary

Security-definer RPCs with fixed `search_path`, explicit grants, and `auth.uid()` lookup:

- `complete_onboarding`
- `skip_onboarding`
- `save_product`
- `remove_product`
- `start_challenge`
- `select_challenge_item`
- `remove_challenge_item`
- `complete_challenge`
- `ensure_session`
- `ensure_feed_instance`
- `append_feed_batch`
- `record_meaningful_destination`
- `ingest_events`

RPCs return `{ok, operation_id, state_revision, data, event_id}`. A repeated operation returns the original canonical result.

Direct browser UPDATE of `anonymous_users` remains prohibited. Meaningful
destination recording occurs only after the primary surface qualifies as
viewed. A later return session receives a new session-bound feed; prior-session
feed reuse is prohibited. Continuation dismissal/activation consumption remains
identity-scoped, session-scoped, versioned browser state and requires no
database table.

## 7. Local development

Use Supabase CLI, checked-in migrations, `seed.sql`, and generated TypeScript types. `supabase db reset` must create a fully usable LR-001 environment. Seed data must include:
- onboarding-style-v1 choices;
- challenge-evening-v1;
- products covering all four slots;
- unavailable and incomplete-metadata products;
- deterministic test identities created by test helpers, not static production credentials.
