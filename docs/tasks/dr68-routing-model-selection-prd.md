# DR-68 — Server-side Routing / Model-Selection + Provider Call

**Status**: ✅ spec → 🚧 ship

## Scope

R2/D-09: The `instruction_template` is no longer a confidentiality boundary — it ships
inside the downloadable package. The moat is server-side routing + provider credentials
that never leave the server. The package cannot override model selection or routing.

## Acceptance criteria (from WBS M05 + Jira DR-68)

| # | Criterion |
|---|-----------|
| A1 | `model_whitelist_snapshot` is loaded from the **active `skill_versions` row** at request time, not from the client payload or the parent `skills` row. |
| A2 | Model selected for the provider call comes exclusively from `model_whitelist_snapshot`. Client-supplied `model` field is discarded. |
| A3 | Provider call body contains only `instruction_template` (as system message) + last user message. All prior-turn history is stripped (FR-G19 stateless single-turn). |
| A4 | Provider credentials stay server-side; `instruction_template` is NOT a secret and is not redacted from analytics/logs. |
| A5 | `SkillRelayContext.SkillVersionID` is populated with the resolved version ID before provider call. |
| A6 | Empty or missing `model_whitelist_snapshot` → `SKILL_INTERNAL_ERROR` (admin misconfiguration). |
| A7 | Request with no user message → `INVALID_REQUEST`. |

## Out of scope for this PR (future tickets)

- Plan gate enforcement (`required_plan_snapshot` vs user plan) → DR-67
- `max_input_tokens_snapshot` enforcement → DR-67
- Kids-session model filtering (kids-safe-tier only) → DR-10
- Subscription / quota checks → DR-M06

## Implementation

- **`internal/skill/relay/executor.go`** — `LoadAndApply()`, `loadSnapshot()`, `selectModel()`, `rewriteForSingleTurn()`
- **`internal/skill/relay/context.go`** — add `SkillVersionID string` field
- **`relay/compatible_handler.go`** — call `skillrelay.LoadAndApply()` after `skillrelay.Set()`
- **`internal/skill/relay/executor_test.go`** — unit tests for all executor paths
