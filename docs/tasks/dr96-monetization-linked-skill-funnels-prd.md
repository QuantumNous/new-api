# DR-96 Monetization-Linked Skill Funnels PRD

Status: eval

## Context

DR-75/DR-76 provide aggregate Skill analytics, but revenue-adjacent questions are still missing from the operator view:

- after a successful recharge/top-up, did the user reach first Skill use;
- after using a Skill, did the user recharge again.

These metrics join billing top-up rows with `skill_first_use` and successful `skill_used` events. They must remain aggregate-only and visibly attributional until finance reconciliation exists.

## Scope

- Extend the Skill analytics overview API with:
  - recharge -> first Skill use conversion;
  - median time to first Skill use after recharge;
  - Skill use -> repeat recharge retention;
  - revenue attribution from repeat recharges.
- Extend per-Skill analytics rows with the same monetization funnel slices, grouped by Skill and existing plan field.
- Gate all monetization metrics behind charging/top-up enablement.
- Display the new aggregate cards and per-Skill monetization table on the existing Skill Analytics dashboard.
- Add focused backend and frontend tests.

## Non-Goals

- No raw billing event export.
- No user-level drilldown.
- No reconciled finance ledger or GA revenue recognition.
- No persona filter UI in this ticket; persona remains available in the underlying event schema for a later dashboard filter.

## Acceptance

- Dashboard shows recharge -> first Skill use conversion and median time-to-first-use when charging is enabled.
- Dashboard shows Skill use -> repeat recharge retention and attribution revenue when charging is enabled.
- Per-Skill dashboard slice shows the monetization rates by Skill and existing required-plan column.
- Charging disabled hides monetization cards/table values.
- Values are labeled as attribution.

## Evaluation Notes

- Implementation is complete and awaiting PR review/checks.
- Metrics are aggregate-only and gated by charging enablement.
- Current attribution uses successful `top_ups.complete_time` inside the selected period and server-side Skill usage events inside the same period.
