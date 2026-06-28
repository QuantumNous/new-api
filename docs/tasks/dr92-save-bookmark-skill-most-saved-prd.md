# DR-92 Save/Bookmark Skill + Most-Saved Metric PRD

Status: eval
Ticket: DR-92
Date: 2026-06-29

## Problem

My Skills currently means enabled/downloaded Skills, not user intent. Users need a low-commitment way to save Skills for later, and admins need demand analytics that distinguishes saved-but-unused interest from actual runs.

## Scope

- Add tenant-scoped saved Skill persistence independent of `user_enabled_skills`.
- Add idempotent `POST /api/v1/marketplace/skills/{id}/save` and `DELETE /api/v1/marketplace/skills/{id}/save`.
- Add `GET /api/v1/marketplace/saved-skills` as the Saved list surface.
- Emit `skill_saved` and `skill_unsaved` analytics events with server-side `entry_point`.
- Extend per-skill analytics rows with saved users/count, saved-but-unused users, and a most-saved sort.
- Expose Save/Unsave controls in Marketplace and Skill Detail UI, plus a Saved Skills user surface.
- Update the Skill Analytics dashboard to show most-saved demand rows.

## Non-Scope

- Social favorites, ratings, or user-generated Skill collections.
- Changing runtime execution authorization; saved state is not an execution grant.
- Billing or revenue attribution changes.

## Acceptance

- Save and unsave are idempotent and scoped to `(user_id, tenant_id, skill_id)`.
- Saved list returns only currently saved rows and works independently from My Skills.
- Save/unsave events are written without prompt/raw metadata and include `entry_point`.
- Per-skill analytics includes saved counts and saved-but-unused counts.
- Admin can sort per-skill analytics by most-saved demand.
- UI can save/unsave from list/detail and browse Saved Skills.
