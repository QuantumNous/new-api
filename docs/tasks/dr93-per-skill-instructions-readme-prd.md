# DR-93 Per-Skill Instructions and Package README PRD

Status: eval
Owner: DeepRouter
Ticket: DR-93
Refs: NEW-16, DR-40, DR-50, DR-60, DR-79, DR-87, DR-106, gap review 2026-06-28

## Problem

Published Skills have examples and generic package copy, but they do not have versioned, structured download and usage instructions. Users can see a Skill detail page and download a zip without a clear per-Skill setup path, and package consumers do not receive a generated README that matches the active immutable SkillVersion.

## Goals

- Store per-version structured instruction content on `skill_versions`.
- Require download and usage instructions before a SkillVersion can be published or activated for a published Skill.
- Expose the structured instructions on the Skill detail API and admin version API.
- Render the instructions on the Skill detail page.
- Include a generated `README.md` in the downloaded Skill package.
- Keep existing English/Chinese fallback compatible with the current default-locale model until DR-87 `skills_i18n` lands.

## Non-Goals

- Implement a full `skills_i18n` table if DR-87 has not landed in this branch.
- Change runtime authorization, public routing API identity, or download entitlement rules.
- Replace `SKILL.md`; it remains the runtime wrapper required by DR-79/D-09.
- Add an object store for package docs.

## Requirements

- `skill_versions` stores:
  - `download_instructions` text.
  - `usage_instructions` text.
  - `prerequisites` JSON array.
  - `quickstart` JSON array.
  - `example_io` JSON array.
- Version creation accepts and persists these fields.
- Version detail returns these fields to admin editors.
- Marketplace detail returns the active version's structured instructions for published Skills.
- Publish and published-Skill version activation fail when `download_instructions` or `usage_instructions` are blank.
- Package build emits a generated top-level `README.md` containing the stored fields, Skill metadata, and DeepRouter runtime environment names.
- Legacy existing rows migrate without failing; new publish/activation is the enforcement boundary.
- Fallback behavior:
  - Current branch uses Skill default locale and base fields.
  - When translated rows become available under DR-87, the API contract can serve localized values in the same response shape without package/schema changes.

## Acceptance

- A published Skill detail response includes non-empty download and usage instructions.
- The downloaded zip contains `README.md` with the same instructions as the active SkillVersion.
- Admins can edit instruction fields by creating a SkillVersion through the admin editor.
- Publish/activation is blocked when download or usage instructions are missing.
- Existing version rows can still be read and migrated.
- Backend and frontend tests cover creation, validation, detail rendering, and README packaging.

## Verification

- Focused Go handler/model tests for SkillVersion migration, create/detail payloads, publish/activation required-on-publish validation, and package README content.
- Focused frontend tests for Skill detail instruction rendering and admin editor payload/validation.
- Related package tests for `internal/skill/...` and marketplace/admin-skills frontend suites with coverage.
