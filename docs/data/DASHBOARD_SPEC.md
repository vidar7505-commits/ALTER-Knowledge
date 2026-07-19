# A L T E R . — LR-001 Dashboard Specification

**Document ID:** DATA-DASH-LR-001  
**Work package:** WP-004 Data Foundation  
**Status:** Implementation-ready  
**Last updated:** 2026-07-19

---

## 1. Global rules

All dashboards show:

- selected range in UTC and viewer-local time;
- raw numerator and denominator beside rates;
- production traffic only by default;
- test/preview/staging toggle restricted to internal users;
- release ID and app version;
- data freshness timestamp;
- data-quality status banner;
- cohort and traffic-source filters;
- observation-window maturity;
- certified view/version used;
- no enterprise or predictive analytics.

Rates with denominator below 20 are visibly marked as small-sample and should not be used for subgroup conclusions.

## 2. Product dashboard

### Purpose

Evaluate the end-to-end LR-001 loop and locate product friction.

### Metrics

- eligible identities and sessions;
- onboarding completion and skip rates;
- onboarding persistence failure rate;
- median/p75/p90 feed depth and threshold distribution;
- qualified product impressions;
- Product Detail rate;
- product-level and user-level save rates;
- removals and net active saves;
- Wardrobe revisit rate;
- Challenge exposure, eligibility, start, completion, and invalidation;
- completion time and abandonment stage;
- continuation cue view/selection;
- D1/D3/D7 return rate;
- session duration and frequency;
- core state/mutation/error rates.

### Dimensions

- first vs return session;
- onboarding version;
- feed-order version;
- Challenge version;
- product category;
- source surface;
- platform;
- app version;
- traffic source;
- cohort.

### Filters

- date range;
- release/app version;
- platform;
- traffic source/cohort;
- first/return session;
- data-quality status;
- internal/test traffic.

### Update frequency

Hourly. Return metrics only for mature cohorts.

### Interpretation

Use as a funnel and continuity diagnostic. Feed depth/time are not meaningful preference without detail/save/return context.

## 3. Research dashboard

### Purpose

Support high-confidence evaluation of LR-001 learning questions.

### Metrics

- exposed cohort and complete observation-window counts;
- feed-depth distribution;
- unique products exposed, inspected, saved, and removed;
- save concentration by identity and product;
- Wardrobe revisit;
- Challenge eligibility, start, completion, invalidation;
- same-session vs return-session completion;
- D1/D3/D7 return;
- session-frequency distribution;
- ordered behavior sequences;
- coded qualitative observation counts;
- missing-data and instrumentation-quality indicators.

### Dimensions

- recruitment cohort;
- traffic source;
- onboarding outcome;
- preference-count bands `0`, `1–2`, `3+`;
- feed-depth bands;
- save-count bands;
- Challenge eligibility;
- first vs return;
- app/version definitions.

### Filters

- cohort start/end;
- matured return window;
- include/exclude incident-affected sessions;
- platform/app version;
- Challenge/onboarding/feed versions.

### Update frequency

Daily. Formal decision views are frozen snapshots with query version and extraction timestamp.

### Interpretation

Use distributions and sequences, not averages alone. Qualitative codes contextualize but do not alter quantitative definitions.

## 4. Growth/source-quality dashboard

### Purpose

Assess acquisition quality and whether sources produce users who enter and repeat the core loop.

### Metrics

- new eligible identities;
- first-session starts;
- onboarding completion/skip by source;
- first-session feed depth;
- first-session detail/save rates;
- Challenge start/completion by source;
- D1/D3/D7 return by source;
- sessions per acquired identity;
- source-level error/data-quality rate.

### Dimensions

- traffic source;
- controlled campaign ID;
- recruitment cohort;
- platform;
- locale;
- app version.

### Filters

- acquisition date;
- source/campaign/cohort;
- platform;
- maturity;
- exclude internal/test.

### Update frequency

Daily; acquisition counts may refresh hourly.

### Interpretation

This assesses traffic quality, not paid-marketing economics. LR-001 excludes CAC, LTV, revenue attribution, and composite growth scores.

## 5. Required visualizations

### Product

- core journey funnel;
- feed-depth histogram;
- detail/save rates by category;
- Challenge funnel and abandonment stage;
- D1/D3/D7 cohort return table;
- state/error trend.

### Research

- identity-level sequence table;
- binned depth vs save heatmap;
- save-count distribution;
- Challenge eligibility/completion matrix;
- matured cohort return curves;
- qualitative-code counts shown beside, never merged into, behavioral metrics.

### Growth

- acquisition volume by source;
- separate-metric source-quality scorecard with no composite score;
- return cohort table by source;
- first-session funnel by source.

## 6. Operational alert thresholds

These are anomaly thresholds, not product success criteria:

- valid event ingestion drops >20% hour-over-hour while session starts remain stable;
- schema rejection/quarantine >1%;
- duplicate attempted delivery >5%;
- state restoration failure >1%;
- save persistence failure >1%;
- Challenge completion event/state mismatch >0;
- active-save event/state mismatch >0;
- impression-bearing Discover sessions <90%;
- timestamp future skew >0.5%;
- dashboard freshness exceeds two expected refresh intervals.

## 7. Data-quality banner states

- **Green:** all critical checks pass; certified metrics available.
- **Amber:** known non-blocking delay, partial maturity, or minor incident; impact displayed.
- **Red:** critical reconciliation, schema, identity, or freshness failure; affected metrics disabled.

## 8. Access and privacy

- Dashboards never expose direct anonymous/user UUIDs by default.
- Identity-level tables are restricted to Data/Engineering and use pseudonymous display keys.
- Cells with high re-identification risk are suppressed.
- Raw event payloads are not embedded in dashboards.
- Export access is audited.

## 9. Dashboard acceptance criteria

- [ ] Every metric points to a certified view and definition.
- [ ] Raw counts accompany rates.
- [ ] Mature and immature cohorts are distinguished.
- [ ] Environment/test filtering is visible.
- [ ] Data freshness and DQ state are visible.
- [ ] No unsupported commercial or predictive claims are shown.
- [ ] A frozen decision snapshot can be reproduced.
