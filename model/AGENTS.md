# model/ — Data Models & DB Access

## Overview
39 files. GORM v2 ORM with dual DB support (primary + LOG_DB), in-memory SQLite for tests.

## Where to Look
| Task | Location | Notes |
|---|---|---|
| Cross-DB helpers | `main.go` | `commonGroupCol`, `commonKeyCol`, `commonTrueVal`, `commonFalseVal` |
| DB initialization | `main.go` | SQLite/MySQL/PostgreSQL branching |
| Task model | `task.go` | **WARNING: TaskBulkUpdateByID has NO CAS guard** |
| Channel model | `channel.go` | |
| User model | `user.go` | |
| Cache read-through | `cache.go` | Redis → DB → async update |

## Conventions
- GORM abstractions preferred over raw SQL.
- Reserved-word columns use `commonGroupCol` / `commonKeyCol`.
- Boolean branching: `commonTrueVal` / `commonFalseVal`.
- Migrations work on all three databases.

## Anti-Patterns
- **NEVER use `TaskBulkUpdateByID()` in billing/quota flows** — use `Task.UpdateWithStatus()` instead.
- Do NOT use raw SQL without cross-DB fallback.
- Do NOT use `ALTER COLUMN` in SQLite.
