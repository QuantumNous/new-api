# internal/skill/enums

Shared typed-string enum constants for the Skill Marketplace. All string values
are derived verbatim from the CHECK constraints in
`docs/skill-marketplace/tasks/03_Data_Model_and_API_Spec.md §3`.

## Types

| Type | Values | Use |
|---|---|---|
| `SkillStatus` | draft, published, deprecated, archived | skills.status |
| `RequiredPlan` | free, pro, enterprise | skills.required_plan |
| `MonetizationType` | free, plan_included, token_markup, one_time | skills.monetization_type |
| `SkillVersionStatus` | draft, active, inactive, archived | skill_versions.status |
| `ReviewStatus` | open, assigned, escalated, resolved, reopened | skill_reviews.status |
| `KidsApprovalStatus` | not_required, pending, approved, emergency_approved, rejected, revoked | skills.kids_approval_status |
| `BlockReason` | see below | skill_usage_events.block_reason |
| `EntryPoint` | marketplace_card, skill_detail, my_skills, saved_list, featured, popular, new, new_week, trending, recommended, reco_personal, reco_codownload, leaderboard_weekly, leaderboard_monthly, user_home, digest, reengage, admin_preview, search_results, paywall, skill_package, api_token, downloaded_runner, playground_picker (legacy only) | skill_usage_events.entry_point |

## BlockReason naming

`BlockReason` uses a mixed prefix pattern that matches tasks/03 §3 exactly:

- `skill_not_found`, `skill_not_published`, `skill_not_enabled` keep the `skill_` prefix.
- All other values (`plan_required`, `subscription_inactive`, `auth_required`, etc.) do not.

This is intentional. Do not rename to unify the prefix — any change must go through
a dedicated doc ticket and be reflected in the DB CHECK constraint.

## Usage

Every type has a `Valid() bool` method backed by an unexported set map.
Use it to validate values received from external sources (API requests, DB reads):

```go
if !enums.BlockReasonPlanRequired.Valid() { ... }

br := enums.BlockReason(rawString)
if !br.Valid() {
    return fmt.Errorf("unknown block_reason: %q", rawString)
}
```

For the mapping between `BlockReason` and the API `ErrorCode`, see
`internal/skill/errcodes`.

## EntryPoint lifecycle

`skill_package` is the primary R2 execution entry point for downloaded Skill
packages calling the public routing API. `playground_picker` remains valid for
historical analytics rows only; new execution producers must not emit it.

## Relationship to errcodes

`BlockReason` is the lowercase data-model value stored in the DB and events.
`errcodes.ErrorCode` is the uppercase API value returned in error envelopes.
They are related but not identical — use `errcodes.ErrorCodeFor` / `errcodes.BlockReasonFor`
to translate between them; never use string manipulation.
