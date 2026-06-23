# DR-47 Skill Version API PRD

Status: eval
Ticket: DR-47
Refs: docs/skill-marketplace/tasks/03_Data_Model_and_API_Spec.md §10.4, §4.2

## Objective

Implement the Super Admin API for creating, listing, inspecting, and activating Skill execution versions.

## Scope

- `POST /api/v1/admin/skills/{skill_id}/versions` creates a draft `skill_versions` row from `instruction_template`, optional `prompt_guard_template`, and optional `output_schema`.
- Creation computes `instruction_template_sha256` and snapshots `skills.model_whitelist`, `required_plan`, monetization settings, and `max_input_tokens`.
- `POST /api/v1/admin/skills/{skill_id}/versions/{version_id}/activate` atomically marks the selected version active, demotes the previous active version to inactive, updates `skills.active_version_id`, and respects the one-active index.
- `GET /api/v1/admin/skills/{skill_id}/versions` lists version metadata only.
- `GET /api/v1/admin/skills/{skill_id}/versions/{version_id}` returns Super Admin detail, including templates.
- `skill_audit_log` records `version_created` and `version_activated` with sha256 and metadata only, never prompt text.

## Non-Goals

- No public package download behavior changes.
- No UI changes.
- No deprecated patch one-step activation beyond the normal explicit activation endpoint in this ticket.

## Acceptance

- Version rows store the template, sha256, optional prompt guard/schema, and immutable execution snapshots.
- Activation leaves exactly one active version per Skill and updates the parent Skill pointer.
- Audit entries are written for create and activate actions and do not contain `instruction_template` or `prompt_guard_template`.
- List responses exclude template fields; detail response is only under the Super Admin admin route.
