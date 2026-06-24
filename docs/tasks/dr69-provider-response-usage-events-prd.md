# DR-69 Provider Response Return + Usage Events PRD

Status: eval
Ticket: DR-69
Date: 2026-06-22

## Problem

After DR-68 routes a Skill package request through the server-selected provider path, successful executions need a client-visible AI disclosure and P0 lifecycle analytics. Product dashboards must be able to count every successful run, first successful use per user/Skill, and later repeat runs without storing prompt text, full user input, provider payloads, or model output.

## Scope

- Return provider output unchanged through the existing OpenAI-compatible relay response path.
- Add a server-owned AI disclosure UX copy carrier for Skill execution responses.
- Emit `skill_used` for every successful Skill execution.
- Emit `skill_first_use` for the first successful execution per `(user_id, skill_id)`.
- Emit `skill_repeat_use` for later successful executions and store `metadata.repeat_index`.
- Populate required execution fields: `skill_id`, `skill_version_id`, `entry_point`, `model`, `latency_ms`, token counts, `success=true`, and safe metadata.
- Use DR-73's current canonical entry point for new package execution: `skill_package`.

## Non-Scope

- Streaming output safety scanning or replacement.
- Skill billing ledger implementation.
- Full Kids pseudonymous salt infrastructure beyond the existing model guard.
- Frontend rendering changes for disclosure.

## Acceptance

- Successful Skill execution returns the provider response plus AI disclosure UX copy that is not model output.
- `skill_used` and exactly one of `skill_first_use` / `skill_repeat_use` are inserted on success.
- Repeat events include positive `metadata.repeat_index`, starting at `2`.
- Usage events contain `skill_id`, `skill_version_id`, `entry_point=skill_package`, `model`, `latency_ms`, available token counts, and `success=true`.
- Usage event metadata contains only allowlisted keys and no prompt text, raw messages, provider payload, or model output.
