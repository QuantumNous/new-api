# Skill Versions Table Migration PRD

Status: eval
Owner: DeepRouter
Ticket: DR-41

## Problem

Skills need immutable version records so runtime execution can reference the exact configuration that was active when a skill was published or invoked. The current `skills` table stores the latest definition only, which makes future rollback, audit, and historical execution semantics harder to support.

## Goals

- Add a cross-database `skill_versions` table migration for SQLite, MySQL, and PostgreSQL.
- Enforce one active version per skill across supported databases.
- Preserve immutable execution configs by preventing parent skill deletion or ID mutation while versions exist.
- Wire the migration into application startup.

## Non-Goals

- Build UI for creating or browsing skill versions.
- Implement runtime version selection or rollback behavior.
- Backfill historical versions from production data.

## Requirements

- `skill_versions` stores version number, status, execution config, metadata, lifecycle timestamps, and parent `skill_id`.
- Active-version uniqueness works for SQLite, MySQL, and PostgreSQL.
- Parent skill deletion and ID updates are restricted when version rows exist.
- Migration tests cover empty-database startup and MySQL active-version uniqueness.
- The app startup migration path invokes skill version migration after skills are migrated.

## Acceptance

- `go test -count=1 ./internal/skill/model/` passes.
- `go test -count=1 ./internal/skill/...` passes.
- `go build ./internal/skill/... ./model/...` passes.
- `go vet ./internal/skill/...` passes.
