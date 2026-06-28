# DR-94 Admin Per-User Skill Usage Drill-Down PRD

Status: eval
Ticket: DR-94
Owner sign-off required: Legal/privacy gate because this intentionally relaxes the aggregate-only analytics stance for consented users.

## Context

DR-75/DR-76/DR-77 kept Skill analytics aggregate-only. DR-94 adds a narrowly scoped Super Admin support/compliance API for one target user at a time. The API may expose downloaded Skills, token totals, cost estimates, last update time, and a usage timeline only when the target user has the server-side Tier 2 telemetry consent flag enabled.

## Scope

- Add a root-admin API for `GET /api/v1/admin/users/{user_id}/skill-usage`.
- Read downloaded Skill state from `user_enabled_skills`.
- Read usage/token data from `skill_usage_events` without exposing metadata, prompt text, raw input, raw output, provider payload, or instruction templates.
- Convert input/output token counts to USD cost estimates using the existing model ratio/completion ratio pricing helpers.
- Write a `skill_audit_log` row for every handler access attempt after the target user is resolved, including non-consented lookups that return no rows.
- Preserve Kids analytics pseudonymization by never joining pseudonymous Kids `session_id` events back to a real user ID.

## Out of Scope

- UI screens.
- CSV/export support.
- Prompt/raw content inspection.
- Support-role access. DR-94 defaults to Super Admin only.

## Acceptance

- Consented target user returns downloaded Skills with per-skill input/output/total tokens, estimated USD cost, last update time, and a bounded timeline.
- Non-consented target user returns an empty per-user result set and is still audit-logged.
- Non-root users are rejected by `SkillRootAuth` before the handler.
- Response payload contains no raw metadata/prompt/provider fields.
- Kids sessions remain protected: persisted Kids usage events are not de-pseudonymized or joined to the target real user.

## Verification Plan

- Handler tests for consented response, non-consented empty response with audit, Kids pseudonymization guard, and response redaction.
- Router auth regression proving the route is root-gated.
- Focused coverage for `internal/skill/handler` and router tests.

## Evaluation Notes

- 2026-06-29: Implemented backend API and moved to eval. Test evidence recorded in `docs/test-results/dr94-admin-per-user-drill-down-downloads-token-consum.txt`.
