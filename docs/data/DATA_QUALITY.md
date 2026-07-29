# A L T E R . — LR-001 Data Quality Specification

**Document ID:** DATA-DQ-LR-001  
**Work package:** WP-004 Data Foundation  
**Status:** Implementation-ready  
**Last updated:** 2026-07-19

---

## 1. Objective

Ensure LR-001 behavior can be reconstructed and interpreted without silent duplication, missing critical observations, cross-user leakage, invalid sessionization, or disagreement between canonical state and telemetry.

## 2. Quality dimensions

- **Validity:** payload matches the approved contract.
- **Completeness:** expected critical observations exist.
- **Uniqueness:** retries do not inflate canonical successes.
- **Consistency:** events agree with canonical product state.
- **Timeliness:** ingestion and dashboards meet freshness expectations.
- **Ownership integrity:** identity/session/state references belong to the authenticated user.
- **Reproducibility:** certified metrics can be recreated from versioned definitions.
- **Privacy:** prohibited fields never enter telemetry or logs.

## 3. Duplicate prevention

- `event_id` is globally unique.
- State mutation operation IDs are unique by domain.
- Duplicate event delivery is accepted without second insert.
- Duplicate state mutation returns canonical prior result where operation ID matches.
- Double taps must create one active state row and one successful state-change event.
- Duplicate attempts are measured separately from successful unique operations.

## 4. Missing-event detection

Critical transition expectations:

- `onboarding_completed`/`skipped` must reconcile with canonical onboarding terminal state;
- `product_saved`/`removed` must reconcile with active saved-product history;
- `challenge_started`, selection/removal events, and completion must reconstruct canonical progress;
- `challenge_completed` must reconcile one-to-one with immutable completion;
- qualified Discover sessions should have `discover_viewed` and, where cards qualify, impressions;
- return sessions require a valid prior eligible session.
- meaningful destination changes must reconcile with a qualified
  `discover_viewed`, `wardrobe_viewed`, or `challenge_viewed` in the same owned
  active session;
- continuation priority must reconcile to one candidate at most, and a
  higher-priority query or contract failure must not appear as a lower-priority
  selection;
- completed-look cues must occur only in the first return session after the
  latest completion;
- later return sessions must not attach qualified feed depth to a prior
  session's feed instance.

Missing-event rate is reported by app version, platform, environment, and traffic source.

## 5. Corrupted session recovery

A session is corrupted when:

- referenced session does not exist;
- event identity differs from session identity;
- timestamps imply invalid session numbering/overlap;
- inactivity gap exceeds 30 minutes inside one session;
- sequence regresses without a documented reinstall/reset marker.

Recovery:

1. preserve raw event;
2. validate identity;
3. create/split a derived recovered session where deterministic;
4. mark `recovery_status`;
5. exclude irrecoverable records from certified session metrics;
6. report affected volume and root cause.

## 6. Timestamp consistency

- Producers use ISO-8601 UTC.
- PostgreSQL stores `timestamptz`.
- `received_at` is server-generated.
- Future skew >5 minutes is flagged; >24 hours is quarantined.
- Offline events retain original occurrence time.
- Analytical order: `occurred_at`, `client_sequence`, `received_at`.
- Session duration is capped at four hours.
- Late-arrival rate and p50/p95 ingestion latency are monitored.

## 7. Schema compatibility

- JSON Schema/TypeScript validators derive from one contract source.
- Ingestion validates `event_name + event_version`.
- Unknown fields are allowed only within explicitly extensible objects.
- Missing required/wrong-type payloads enter quarantine.
- Unsupported future versions remain stored but excluded from certified views.
- Consumers test current and immediately prior supported versions.

## 8. Validation rules

### Envelope

- valid UUIDs;
- allowed enumerations;
- `event_version >= 1`;
- `release_id = LR-001`;
- production app version allow-list;
- valid `surface`;
- properties maximum 16 KB;
- batch maximum 100 events;
- trusted owner/environment/test fields overwritten by server.

### Event-specific

- product events require an existing product;
- feed positions are positive integers;
- impressions require ratio ≥0.5 and continuous duration ≥1,000 ms;
- one impression per session/feed/product;
- `product_saved` prior state false and matching canonical row/operation;
- `product_removed` prior state true and matching removal operation;
- Challenge slot exists in the exact Challenge version;
- selected product satisfies slot eligibility at mutation time;
- completion snapshot covers every required slot exactly once;
- immutable completion cannot be changed through application roles.

## 9. Event QA checklist

### Before implementation merge

- [ ] Event name follows convention.
- [ ] Trigger is observable and unambiguous.
- [ ] Success occurs only after persistence.
- [ ] Expected domain failure path is typed.
- [ ] Required properties are allow-listed and typed.
- [ ] No PII, secrets, or free text.
- [ ] Event version assigned.
- [ ] Valid and invalid fixtures added.
- [ ] Requirement/metric traceability documented.
- [ ] Server-controlled fields cannot be forged.

### Staging journey QA

- [ ] New anonymous auth identity maps to one stable analytical identity.
- [ ] Two identities cannot access one another’s state.
- [ ] Session starts exactly once per boundary.
- [ ] Onboarding view, selection, completion/skip sequence is correct.
- [ ] Retry does not duplicate completion.
- [ ] Fetched unseen product emits no impression.
- [ ] Card below 50% emits no impression.
- [ ] Card at ≥50% for <1s emits no impression.
- [ ] Card at ≥50% for ≥1s emits exactly one impression.
- [ ] Background tab cancels impression timer.
- [ ] Feed depth equals maximum qualified absolute position.
- [ ] Detail source and position persist.
- [ ] Double-tap save creates one active row and one success event.
- [ ] Wardrobe matches canonical save state.
- [ ] Challenge start operation is idempotent.
- [ ] Challenge sequence reconstructs correctly.
- [ ] Invalid completion attempt is distinct from successful completion.
- [ ] Completion snapshot is immutable.
- [ ] Return after >30 minutes creates new session and restores state.
- [ ] State restore failure produces usable fallback.
- [ ] Offline telemetry preserves IDs and occurrence times.
- [ ] Preview/staging/internal traffic is excluded from production views.

### Release gate

- [ ] 100% of critical event fixtures pass.
- [ ] No cross-user ownership failure.
- [ ] No Challenge completion mismatch.
- [ ] No active-save reconciliation mismatch.
- [ ] Schema rejection <1%.
- [ ] State restoration failure <1%.
- [ ] Impression-bearing Discover sessions ≥90%, unless catalog empty incident documented.
- [ ] Event freshness within SLA.
- [ ] DQ dashboard reviewed by Data and Engineering.
- [ ] Known measurement-impact incidents documented.

## 10. Reconciliation checks

Required daily comparisons:

1. active saved products vs net save/remove events by identity/product;
2. Challenge progress items vs selection/removal events;
3. Challenge completions vs completion events;
4. session first/last activity vs event bounds;
5. feed instance maximum qualified position vs impressions;
6. onboarding state vs terminal event;
7. identity/session ownership consistency;
8. production certified events vs environment/test/namespace fields.

Difference classes:

- transport lag;
- valid late arrival;
- duplicate suppressed;
- canonical product-state defect;
- telemetry defect;
- identity/authorization defect;
- unresolved.

## 11. Executable check schedule

| Check | CI | Staging | Post-deploy | Daily | Pre-release |
|---|---:|---:|---:|---:|---:|
| Contract fixtures | yes | yes | sample | yes | yes |
| RLS/two-user isolation | yes | yes | no | no | yes |
| RPC idempotency | yes | yes | no | no | yes |
| Meaningful-destination allowlist/session/identity isolation | yes | yes | no | no | yes |
| Continuation priority and first-return completion | fixture | yes | sample | yes | yes |
| Continuation consumption key/version/session isolation | fixture | yes | sample | no | yes |
| Impression boundary tests | yes | yes | sample | no | yes |
| State/event reconciliation | fixture | yes | yes | yes | yes |
| Completion immutability | yes | yes | no | daily check | yes |
| Environment exclusion | yes | yes | yes | yes | yes |
| Privacy payload scan | yes | yes | yes | yes | yes |
| Dashboard freshness | no | yes | yes | hourly | yes |

## 12. Monitoring and ownership

| Check | Frequency | Owner | Severity |
|---|---|---|---|
| Ingestion availability | 5 min | Engineering | blocker |
| Schema rejection | 15 min | Data | major/blocker |
| Ownership/RLS failures | every build + incident | Engineering | blocker |
| State/event reconciliation | daily | Data | blocker for core journey |
| Dashboard freshness | hourly | Data | major |
| Privacy payload scan | CI + daily | Data/Engineering | blocker |
| Event contract tests | every build | Engineering | blocker |

## 13. Privacy controls

- Payload allow-list, not deny-list.
- CI rejects prohibited property names and oversized arbitrary strings.
- Production sampling detects unexpected high-cardinality strings.
- Raw event access is limited to approved Data/Engineering service roles.
- Dashboards suppress direct identity values.
- Logs exclude event payloads, tokens, cookies, and secrets.
- Deletion/anonymization removes identity links and user-owned state under policy.

## 14. Incident handling

Every measurement incident records:

- start/end time;
- affected versions, environments, cohorts, and events;
- metric impact;
- exclusion or backfill rule;
- remediation;
- validation evidence;
- owner and closure date.

Silent metric repair is prohibited. Certified view version increments when semantics or exclusion rules materially change.
