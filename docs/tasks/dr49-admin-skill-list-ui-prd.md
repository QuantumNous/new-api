# DR-49 Admin Skill List UI PRD

Status: eval
Ref key: DR-49
Phase: 1
Module: M02
Reference: docs/skill-marketplace/tasks/02_UX_Design.md §4.7.2, §7.2

## Goal

Super Admin can scan the full Skill catalog from the admin area, using the DR-45 admin list API as the data source.

## Scope

- Add an Admin Skills list route in `web/default/`.
- Show a desktop-first table with skill name, icon/category, lifecycle status, required plan, kids approval status, featured flag/rank, active version ID, last updated actor/time, and actions.
- Add filters for lifecycle status, required plan, and kids approval status.
- Keep mobile read-only: mobile users can scan skill summaries and open preview, but editing/publishing lifecycle actions are desktop-only.

## Dependencies

- DR-45 `GET /api/v1/admin/skills` is complete and supplies admin-safe list fields.

## Non-Goals

- Skill edit form implementation.
- Publish, deprecate, archive, and audit mutation APIs.
- Backend API changes.

## Acceptance

- Admin sidebar exposes a Skills admin entry.
- Admin can scan all Skills with status, plan, kids, featured, version, and updated columns.
- Admin can open edit and preview actions from desktop.
- Mobile layout is read-only and hides edit/publish/deprecate/archive/audit actions.
- Status, plan, and kids filters call through to DR-45 query params.
