# DR-52 Marketplace List API PRD

Status: eval
Ref: DR-52
Phase: 1
Module: M03
Updated: 2026-06-23

## Scope

Implement `GET /api/v1/marketplace/skills` as the public Skill catalog list endpoint defined by `docs/skill-marketplace/tasks/03_Data_Model_and_API_Spec.md` §8.1 and `tasks/01` FR-U1/FR-U8/FR-U10.

## Requirements

- Anonymous callers can browse published Skills.
- Only public list fields are returned: `id`, `slug`, `name`, `category`, `short_description`, `required_plan`, `availability`, `badges`, `featured`, `is_kids_safe`, `is_kids_exclusive`.
- Only `status=published` Skills are discoverable. `draft`, `archived`, and `deprecated` are hidden from the list.
- Filters:
  - `category`
  - `query`, searching public text only: `name`, `short_description`, and detail `description`, matching `idx_skills_public_search`
  - `plan`: `free`, `pro`, `enterprise`
  - `featured`: boolean
  - `kids_safe`: boolean
  - `page` / `limit`
  - `locale`, accepted for API compatibility; localized rows are not available in this branch yet, so base public fields are returned.
- Availability:
  - Anonymous: `enabled=null`, `locked=true`, `lock_code=AUTH_REQUIRED`, `cta=login`.
  - Authenticated: browser session and platform access-token callers resolve with the shared availability resolver from DR-72, using current user plan, Kids mode, and `user_enabled_skills`.
- The response uses the existing DR-44 list envelope.

## Acceptance

- Published Skills list with the DR-52 public field shape and availability.
- Search does not inspect internal prompt fields, tags, examples, model whitelist, or any private version/package content.
- PostgreSQL search uses the DR-81 `idx_skills_public_search` full-text index expression; SQLite/MySQL keep a portable LIKE fallback.
- Draft, archived, and deprecated Skills are not listed.
- Pagination envelope is preserved.
- Focused tests cover anonymous availability, public-field redaction, filters, public-text search boundary, hidden lifecycle states, and authenticated availability.
