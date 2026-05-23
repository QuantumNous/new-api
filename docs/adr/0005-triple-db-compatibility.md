# ADR 0005 — SQLite + MySQL + PostgreSQL compatibility is a hard constraint

- **Status**: Accepted (inherited from upstream)
- **Date**: 2026-05-12
- **Affects**: `deeprouter/`

## Context

Upstream `QuantumNous/new-api` supports three databases:
- **SQLite** — single-binary deployments, demos, small self-hosted instances
- **MySQL ≥ 5.7.8** — popular self-hosted choice; some enterprises mandate it
- **PostgreSQL ≥ 9.6** — our default for SaaS deployment (and recommended in docker-compose.yml)

GORM (the ORM in use) abstracts away most of the differences for `Create / Find / Where / Updates`. But several gaps exist where you can write code that compiles fine and works on one database but breaks on another:

- Reserved-word column names: PostgreSQL quotes with `"col"`, MySQL/SQLite with `` `col` ``. Columns named `group`, `key`, `order` are common offenders.
- Boolean literals: PostgreSQL accepts `true` / `false`; MySQL & SQLite expect `1` / `0` in some contexts.
- JSON: PostgreSQL has `JSONB` + operators (`@>`, `?`); MySQL ≥ 5.7 has `JSON` + `JSON_EXTRACT`; SQLite has neither (use TEXT + app-level parse).
- Aggregation: MySQL has `GROUP_CONCAT`; PostgreSQL has `STRING_AGG`; SQLite has both. Not interchangeable.
- DDL: SQLite cannot `ALTER COLUMN`; you need add-column workarounds.

If we drop SQLite, single-binary self-hosted is harder (need to bundle Postgres or instruct users to install it). If we drop MySQL, some enterprises veto deployment. Dropping Postgres isn't on the table.

## Decision

Triple compatibility is **mandatory** for any code committed to this repo. This is **AGENTS.md Rule 2**.

In practice that means:
- Prefer GORM's high-level methods (`Create`, `Find`, `Where`, `Updates`). They generate correct SQL for all three.
- When you must write raw SQL: branch on `common.UsingPostgreSQL`, `common.UsingMySQL`, `common.UsingSQLite` flags.
- Use `commonGroupCol`, `commonKeyCol`, `commonTrueVal`, `commonFalseVal` helpers from `model/main.go` to handle reserved words and booleans portably.
- Store JSON in `TEXT` columns and parse in Go (via `common.Unmarshal`). Don't use `JSONB` operators in WHERE clauses.
- For migrations, prefer `ALTER TABLE ... ADD COLUMN` (works on all three). Avoid `ALTER COLUMN` (SQLite doesn't support it) — if you need to change a column type, do the add-new + backfill + drop-old dance.
- Never use database-specific functions (`GROUP_CONCAT`, `STRING_AGG`, `JSON_EXTRACT`) without a code-side fallback.

Migrations that work on all three databases are validated by CI: the test suite spins up each backend.

## Consequences

**Good**:
- Deployment flexibility: SQLite for demos and tiny instances, MySQL for some enterprise customers, Postgres for our managed SaaS. Same binary, different `SQL_DSN`.
- One codebase, no per-database forks.
- Lower bar for community contributions — contributors with any backend can develop and test locally.
- Easier to migrate between databases (no schema rewrite, just dump-restore-restart).

**Bad**:
- Cannot use Postgres-specific power features. JSONB operators, full-text indexes, partial indexes, generated columns — all off the table. We do JSON in app code instead, which is slower for heavy filtering but rarely on hot paths.
- Code is wordier: a "simple" raw-SQL branch becomes three branches.
- Performance ceilings are lower than a Postgres-only design could achieve. For our scale (V0: O(1k req/sec), V1 target: O(10k req/sec), we're well within reach with portable SQL.
- Migrations that would be one-line `ALTER COLUMN` in MySQL/Postgres take three statements on SQLite. Slows schema evolution.

**Neutral**:
- The cross-DB helpers in `model/main.go` carry a small ongoing maintenance burden. Trivial in practice.

## Alternatives considered

1. **Postgres-only** — fastest, most expressive, but rejected because it would break self-hosting for the SQLite/MySQL segment of users and force community contributors to install Postgres. We may revisit if SaaS becomes the only deployment path we care about.
2. **MySQL + Postgres (drop SQLite)** — would slightly simplify schema migrations (`ALTER COLUMN` works on both). Rejected for the same reason: SQLite is a real deployment option for small instances.
3. **Per-database forks of the code** — never seriously considered; explosion of paths to maintain.
4. **Abstract DB driver layer above GORM** — over-engineering. GORM already provides most of what we need.

## Trigger to revisit

Reopen if:
- SQLite usage drops to < 1% of deployments — could drop SQLite specifically and keep MySQL + Postgres. Would let us use `ALTER COLUMN` and JSON operators in MySQL.
- We add a feature that fundamentally requires Postgres (e.g., logical replication for change-data-capture, advanced full-text search) — at that point, either drop SQLite (controversial) or rebuild the feature in app code (often the right call anyway).
- Performance ceiling becomes the binding constraint (currently we're well below it). At that point, a Postgres-only fast-path inside the same codebase could be added with the others falling back to the slow path.
