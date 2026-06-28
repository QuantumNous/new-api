# DR-102 Client Runner Usage Telemetry PRD

Status: ship
Ticket: DR-102
References: NEW-11 gap review 2026-06-28, docs/skill-marketplace/tasks/03_Data_Model_and_API_Spec.md §9, docs/tasks/dr75-analytics-aggregation-api-prd.md

## Problem

Downloaded Skill packages can run outside DeepRouter's relay path. Today the server can observe download/enablement, but it cannot distinguish actively used downloads from zombie downloads unless a consented runner reports non-sensitive usage back.

## Goals

- Add `POST /api/v1/telemetry/skill-usage` for downloaded Skill runners.
- Authenticate with a DeepRouter API token using the existing token middleware, not dashboard access-token auth.
- Persist opted-in runner usage to `skill_usage_events` with `entry_point=downloaded_runner` so DR-75/77 analytics can count real downloaded usage.
- Read the server-side Tier 2 telemetry consent flag from the user account on every request. Consent is off by default and revocation immediately blocks future ingest.
- Accept only non-sensitive usage fields: `skill_id`, `version`, `occurred_at`, `success`, `model`, `input_tokens`, `output_tokens`, `total_tokens`, and `latency_ms`.
- Reject prompt/raw/provider-payload fields without persisting them.
- Quarantine malformed non-sensitive schema submissions for restricted operator diagnosis without writing them to production analytics.

## Non-Goals

- No UI for changing telemetry consent in this ticket.
- No runner package/client changes in this ticket.
- No raw prompt/input/output/provider payload storage in analytics or quarantine.
- No new analytics dashboard in this ticket.

## Contract

Request:

```json
{
  "skill_id": "skill-uuid",
  "version": "skill-version-id-or-package-version",
  "occurred_at": "2026-06-28T12:00:00Z",
  "success": true,
  "model": "gpt-4o-mini",
  "input_tokens": 12,
  "output_tokens": 34,
  "total_tokens": 46,
  "latency_ms": 789
}
```

Behavior:

- Missing or invalid API token returns auth failure before ingest.
- If `users.tier2_telemetry_consent` is false or absent, return 403 and do not write analytics or quarantine rows.
- Unknown or restricted sensitive keys are rejected with 400 and no persistence.
- Malformed allowlisted schema is written to `skill_telemetry_quarantines` with sanitized diagnostics only and returns 202.
- Valid consented usage writes one `skill_used` event with `entry_point=downloaded_runner`, user/tenant identity from the authenticated token, token/latency/model fields, success, and metadata `{producer:"downloaded_runner"}`.

## Tests

- Opted-in API-token request writes a `skill_used` event with `entry_point=downloaded_runner`.
- Opt-out request writes nothing and returns 403.
- Restricted raw/prompt fields are rejected and not quarantined.
- Bad non-sensitive schema is quarantined and not written to `skill_usage_events`.
- Revoked consent blocks subsequent uploads after a prior successful upload.

## Evaluation

- PR #124 merged on 2026-06-28 after local verification, self-review comments, and required GitHub checks passed.
- Client-supplied `occurred_at` is accepted as non-authoritative metadata only. The persisted analytics `occurred_at` remains server-authoritative UTC per DR-74.
