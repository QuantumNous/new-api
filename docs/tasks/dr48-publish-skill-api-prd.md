# DR-48 Publish Skill API PRD

Status: eval

## Scope

Implement the Phase-1 minimal publish API for official Skills:

- `POST /api/v1/admin/skills/{skill_id}/publish`
- Transition a draft Skill to `published`.
- Require a non-empty publish reason.
- Require the minimal publish checklist from tasks/03 §10.7 and tasks/02 §4.7.4.
- Set `published_at` and `active_version_id`.
- Emit audit and analytics records for the admin publish action.

## Requirements

- Publish is Super Admin only through the existing admin Skill router middleware.
- Publish requires an already active SkillVersion for the Skill.
- Publish fails unless required metadata is complete: name, short description, description, category, tags, and icon.
- Publish fails unless there is at least one example input and at least one example output.
- Publish fails unless `required_plan` and `monetization_type` are valid.
- Publish fails unless `model_whitelist` contains at least one model.
- Publish fails unless `max_input_tokens` and the active version `max_input_tokens_snapshot` are set and match when the Skill is Free, monetization is Free, or `free_quota_per_month` is configured.
- Publish must lock the draft Skill row and active SkillVersion row, and use a conditional `draft` + active-version snapshot update so concurrent publish or version changes fail with conflict before audit/event writes; activation must also lock the Skill row before mutating version state.
- Successful publish writes `skill_audit_log` with the reason and no prompt text.
- Successful publish emits `skill_usage_events.event_type='skill_admin_action'` with analytics allowlist metadata only; the publish reason is restricted to `skill_audit_log.action_reason`.
- After publish, marketplace list/detail APIs can discover the Skill through existing `status='published'` filtering.

## Out Of Scope

- Full Phase-2 blocking checklist endpoint (`GET /publish-checklist`, DR-106).
- Evaluation pipeline checks.
- Package build checks.
- Kids approval enforcement beyond the existing Phase-1 fields.
