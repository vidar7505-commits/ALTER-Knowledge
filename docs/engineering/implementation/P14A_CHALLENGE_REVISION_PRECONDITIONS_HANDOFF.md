# P14A — Challenge Revision Preconditions Handoff

## Status

`Complete`.

P13 remains Complete. P14A is Complete after verified GitHub Database
infrastructure validation. P14 is Ready. P15 remains blocked.

## 1. Exact blocker resolved

The existing Challenge mutation functions locked owned progress and returned
`challenge_progress.state_revision`, but accepted no expected revision. A stale
selection could replace a newer slot, a stale removal could mutate a newer
outfit, and a stale completion could snapshot a different four-item set than
the caller reviewed.

P14A adds an optimistic revision precondition to all three active-state
Challenge mutations. A fresh request must now match the locked canonical
revision before any progress item, status, revision, or completion snapshot can
change.

## 2. Migration created

`supabase/migrations/20260729000100_challenge_revision_preconditions.sql`

The migration is forward-only. No validated P04–P13 migration was edited.

## 3. Function signatures before and after

Before:

- `select_challenge_item(uuid,text,uuid,uuid)`
- `remove_challenge_item(uuid,uuid)`
- `complete_challenge(uuid,uuid)`

After:

- `select_challenge_item(uuid,text,uuid,bigint,uuid)`
- `remove_challenge_item(uuid,bigint,uuid)`
- `complete_challenge(uuid,bigint,uuid)`

The new `bigint` argument is named `expected_state_revision` and appears
immediately before `operation_id`.

## 4. Old-signature transition

The migration explicitly revokes the old functions from `PUBLIC`, `anon`, and
`authenticated`, then drops them before creating the revised signatures. The
old signatures are absent after migration, so no executable revision-bypass
overload or PostgREST ambiguity remains.

## 5. Revision-precondition model

For each revised RPC:

1. resolve the current anonymous owner through the existing P06 helper;
2. validate a non-null, nonnegative expected revision;
3. claim or replay the typed mutation operation;
4. locate, ownership-check, and lock the relevant
   `public.challenge_progress` row;
5. compare the locked `state_revision` with `expected_state_revision`;
6. raise SQLSTATE `40001` with message `challenge_revision_mismatch` when they
   differ;
7. run the existing domain validation and mutation only after a match.

Every successful canonical state change increments the revision exactly once.

## 6. Ownership model

Ownership remains:

`request JWT → auth.uid() → anonymous_users.auth_user_id → anonymous_users.id`

Selection and completion lock progress by progress ID and validate the resolved
owner. Removal resolves progress through the supplied progress-item ID, filters
by the resolved owner, and locks progress before reading or changing the item.
No caller-controlled owner, user, or Wardrobe ID was added.

## 7. Operation fingerprint changes

`expected_state_revision` is a required non-null `bigint` and is encoded through
`to_jsonb(expected_state_revision)` in each deterministic JSONB fingerprint.
The remaining fingerprint fields are unchanged:

- selection: progress ID, slot ID, product ID, expected revision;
- removal: progress-item ID, expected revision;
- completion: progress ID, expected revision.

## 8. Replay semantics

The existing ledger claim occurs before canonical revision validation. An
identical successful replay returns the stored canonical result immediately and
does not re-run revision validation. Ownership is still resolved and checked by
`private.claim_mutation_operation`, preventing another owner from replaying the
record.

## 9. Conflict semantics

Reuse of a completed operation ID with a different expected revision or other
fingerprint field remains `operation_id conflict` with SQLSTATE `22023`.
Operation conflict is distinct from revision mismatch.

## 10. Mismatch semantics

A revision mismatch raises `challenge_revision_mismatch`. PostgreSQL rolls back
the entire failed statement, including the provisional ledger claim. Therefore:

- no misleading ledger success or incomplete ledger row remains;
- no item, status, snapshot, or revision changes;
- after refetch, the caller may retry the same logical operation ID with the
  newer expected revision;
- that retry is not silently converted into an operation conflict.

## 11. Selection behavior

After revision match, selection preserves all P06 validation:

- progress must be `in_progress` or `ready_to_complete`;
- Challenge definition must remain active;
- slot must exist in the exact definition;
- product must be active and eligible for the slot;
- product must be actively saved in the caller's Wardrobe;
- the same product cannot occupy another active slot.

Replacement remains a soft removal plus a new selection. A canonical selection
or replacement increments revision once. Stale selection changes nothing.

## 12. Removal behavior

Removal resolves the progress row through the progress-item ID, confirms the
owner, locks progress, and compares revision before locking or soft-removing the
item. The item must remain active and progress must remain mutable. Success
soft-removes the item, returns progress to `in_progress`, and increments
revision once. Stale or cross-user removal changes nothing.

## 13. Completion behavior

Completion locks and ownership-checks progress, then compares revision before
checking completion state or creating a snapshot. After a match, the existing
exact-slot, active-product, eligibility, active-save, active-definition, and
unique-selection validations remain. Success inserts one immutable completion,
sets progress to `completed`, and increments revision once.

A stored successful replay returns the original completion. A new operation
against an already completed canonical revision recovers the existing
completion without rewriting it.

## 14. Immutability preservation

Selection and removal still reject completed progress. Completion snapshots
remain insert-only through the approved RPC, owner-readable through RLS, and
unmodifiable by browser roles. Wardrobe or catalog changes still cannot rewrite
completed history.

## 15. RLS and grants

Existing table RLS policies are unchanged:

- `challenges_select_active`
- `products_select_active`
- `saved_products_select_own`
- `challenge_progress_select_own`
- `challenge_progress_items_select_own`
- `challenge_completions_select_own`

The revised function signatures grant execution only to `authenticated`.
`PUBLIC` and `anon` execution is revoked. No direct browser DML grant was added.

## 16. Function-security review

All three corrected functions:

- are explicitly postgres-owned;
- remain `SECURITY DEFINER`;
- use `SET search_path = ''`;
- schema-qualify domain tables and the private operation ledger;
- contain no dynamic SQL;
- expose exactly one signature per function name;
- accept no ownership parameter;
- preserve the existing narrow mutation boundary.

## 17. pgTAP inventory

Created `supabase/tests/010_challenge_revision_preconditions.sql` with
deterministic two-user fixtures covering:

- exact revised signatures and absent old signatures;
- ownership, security-definer, search-path, dynamic-SQL, and grant checks;
- matching, stale, replayed, conflicting, invalid, inactive, cross-user, and
  completed selection;
- matching, stale, retried, replayed, conflicting, cross-user, and completed
  removal;
- incomplete, stale, retried, replayed, conflicting, cross-user, and completed
  completion;
- no mismatch ledger residue;
- no stale canonical mutation;
- exact N → N+1 → stale rejection → retry → N+2 sequence;
- immutable single completion and two-user isolation.

## 18. Existing-test changes

`supabase/tests/006_transactional_rpcs.sql` now:

- uses the revised exact allow-list signatures;
- supplies the expected revision to all selection, removal, and completion
  calls;
- preserves original replay and convergence expectations;
- retains ownership, eligibility, Wardrobe dependency, completion snapshot, and
  operation-ledger regression coverage.

No assertion or prior behavior was weakened.

## 19. Validation outcomes

- `npx.cmd supabase --version`: passed, version `2.109.1`.
- `npx.cmd supabase db reset --local`: blocked because
  `//./pipe/dockerDesktopLinuxEngine` does not exist.
- `npx.cmd supabase db lint --local --fail-on warning`: blocked with
  `LegacyDbConnectError`.
- `npx.cmd supabase test db`: blocked with `LegacyDbConnectError`.
- `npm.cmd run format:check`: passed.
- `npm.cmd run lint`: passed with zero errors or warnings.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test`: passed (28 test files / 139 tests).
- `npm.cmd run build`: passed after allowing the repository's existing Google
  font fetch.
- `git diff --check`: passed with working-copy line-ending warnings only.
- GitHub Database infrastructure validation: passed.
- Clean database reset: passed.
- Strict database lint: passed.
- All pgTAP suites: passed.
- `supabase/tests/006_transactional_rpcs.sql`: passed.
- `supabase/tests/010_challenge_revision_preconditions.sql`: passed.
- Application validation gates: passed.

No unsafe Docker workaround was attempted and no test was weakened.

## 20. Local Supabase runtime status

The Supabase CLI is available, but Docker Desktop's Linux engine and local
PostgreSQL are unavailable. Clean reset, strict SQL lint, and pgTAP therefore
require authoritative GitHub Database infrastructure validation.

## 21. GitHub CI status

Passed. GitHub Database infrastructure validation proved clean database reset,
strict database lint, all pgTAP suites, and application validation gates.
`006_transactional_rpcs.sql` and
`010_challenge_revision_preconditions.sql` both passed.

The passing suites validate revision mismatch behavior for select, remove, and
complete; replay and operation-conflict semantics; two-user isolation; absent
or non-executable old bypass signatures; and authenticated-only execution for
the new signatures.

## 22. Cloud status

- Cloud migrations deployed: None.
- Hosted development schema updated: No.
- Remote reset: not run.
- Remote migration push: not run.
- Remote seed push: not run.
- Production deployment: not run.
- Supabase project linking: unchanged.

## 23. Security review

No owner IDs, service-role credentials, session tokens, generic update
function, direct client DML, dynamic SQL, or mutable completion path was added.
Revision mismatch is checked under the owned row lock. Replay remains
owner-bound, and conflict cannot overwrite an accepted operation.

## 24. Scope review

Implemented only the P14A revision-precondition migration, pgTAP coverage,
required P06 regression updates, status, and handoff. No Challenge UI, P14
application code, P13 behavior, slot inventory, product eligibility, telemetry
contract, unrelated database object, remote state, deployment, commit, or push
was changed.

## 25. Known limitations

Local database execution remains unavailable on this workstation. Authoritative
GitHub Database infrastructure validation passed, so this does not block P14A
closure.

`remove_product` can still atomically clear an incomplete Challenge dependency
as defined by P06/P13. It is outside P14A because it is a Wardrobe mutation, not
one of the three client-driven Challenge active-state mutations named by this
corrective package.

## 26. Exact changed-file inventory

Created:

- `supabase/migrations/20260729000100_challenge_revision_preconditions.sql`
- `supabase/tests/010_challenge_revision_preconditions.sql`
- `docs/engineering/implementation/P14A_CHALLENGE_REVISION_PRECONDITIONS_HANDOFF.md`

Modified:

- `supabase/tests/006_transactional_rpcs.sql`
- `docs/engineering/IMPLEMENTATION_STATUS.md`

## 27. Recommended next action

P14 — Challenge is Ready. Its dependencies are P06, P08, P13, and P14A; its
scope is start, select, remove, and complete; its acceptance boundary is
idempotency, immutability, and mismatch; and its commit boundary is
`feat(challenge)`. P15 remains blocked.

## 28. Suggested commit message

`feat(db): enforce challenge revision preconditions`
