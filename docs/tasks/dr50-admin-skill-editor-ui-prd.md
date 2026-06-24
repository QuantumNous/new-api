# DR-50 Admin Skill Editor UI PRD

Status: eval
Ref key: DR-50
Phase: 1
Module: M02
Reference: docs/skill-marketplace/tasks/02_UX_Design.md §4.7.3-§4.7.4

## Goal

Super Admin can create or edit a Skill draft from the Admin Skills surface, complete the sectioned form required by the Skill Marketplace UX spec, and create a new execution version whenever the instruction template changes.

## Scope

- Replace the placeholder Admin Skill edit dialog with a desktop editor containing Metadata, User Guidance, Entitlement, Execution, Safety, Promotion, Version History, and Audit Log sections.
- Add a Create Skill entry point using the same editor and the DR-46 draft creation API.
- Wire metadata/config saves to the admin Skill create/patch API and template saves to the DR-47 version creation API.
- Show an inline version-change notice once the instruction template differs from the loaded template.
- Validate `max_input_tokens` client-side when `required_plan='free'`, `monetization_type='free'`, or `free_quota_per_month` is configured.
- Add minimal admin-safe backend support for the documented `PATCH /api/v1/admin/skills/{skill_id}` and `GET /api/v1/admin/skills/{skill_id}/audit-log` contracts where missing.

## Non-Goals

- Publish checklist UI, preview execution, lifecycle mutations, and Kids approval workflows.
- Rich JSON schema builder or model alias registry picker.
- Mobile editing; mobile remains read-only per the admin UX baseline.

## Acceptance

- Admin can fill all required editor sections and save a new draft Skill.
- Admin can edit an existing Skill's metadata/config fields and reload the table with saved values.
- Editing the instruction template displays a version-change notice and creates a new Skill version on save.
- Blank `max_input_tokens` blocks save for Free/free-quota configurations with an inline error.
- Version History and Audit Log display available admin-safe records without exposing prompt text.
