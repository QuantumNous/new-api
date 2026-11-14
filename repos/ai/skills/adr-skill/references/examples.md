# ADR Examples

These are filled-out examples showing the same decision at two levels of detail. Use these as reference when drafting ADRs — never leave placeholder text in a real ADR.

## Short Version (Simple Template)

```markdown
---
status: accepted
date: 2025-06-15
decision-makers: Sarah Chen, Joel
---

# Use SQLite for local development database

## Context and Problem Statement

Our integration tests require a database but currently hit a shared PostgreSQL instance, causing flaky tests from concurrent writes and slow CI (3+ minute setup per run). We need a fast, isolated database for local dev and CI that doesn't require infrastructure provisioning.

## Decision

Use SQLite (via better-sqlite3) for local development and CI test runs. Production remains on PostgreSQL. We'll use a thin data-access layer that abstracts the database engine, tested against both SQLite and PostgreSQL in CI.

Non-goals: we are NOT migrating production to SQLite or building a full ORM abstraction.

## Consequences

- Good, because CI setup drops from 3+ minutes to ~2 seconds (no DB provisioning)
- Good, because tests are fully isolated — no shared state between runs
- Good, because developers can run the full test suite offline
- Bad, because we must maintain compatibility between SQLite and PostgreSQL SQL dialects
- Bad, because some PostgreSQL-specific features (JSONB operators, array columns) can't be tested locally

## Implementation Plan

- **Affected paths**: `src/db/client.ts` (new abstraction layer), `src/db/sqlite-client.ts` (new), `src/db/pg-client.ts` (refactored from current inline usage), `tests/setup.ts`, `package.json`
- **Dependencies**: add `better-sqlite3@11.x` and `@types/better-sqlite3@7.x` as devDependencies; no production dependency changes
- **Patterns to follow**: existing repository pattern in `src/db/repositories/` — all queries go through repository methods, never raw SQL in business logic
- **Patterns to avoid**: do not import `better-sqlite3` or `pg` directly outside `src/db/`; do not use PostgreSQL-specific SQL (JSONB operators, `ANY()`, array literals) in shared queries

### Verification

- [ ] `npm test` passes with `DB_ENGINE=sqlite` (default for test env)
- [ ] `npm test` passes with `DB_ENGINE=postgres` against a real PostgreSQL instance
- [ ] No imports of `better-sqlite3` or `pg` outside `src/db/`
- [ ] CI pipeline total time under 90 seconds (was 5+ minutes)
- [ ] `src/db/client.ts` exports a unified interface used by all repositories

## Alternatives Considered

- Docker PostgreSQL per CI run: Reliable parity, but adds 90s+ startup and requires Docker-in-Docker on CI.
- In-memory PostgreSQL (pg-mem): Good API compatibility, but incomplete support for our schema (triggers, CTEs) and unmaintained.

## More Information

- Follow-up: create weekly CI job running full suite against real PostgreSQL (#348)
- Revisit trigger: if dialect-drift bugs exceed 2 per quarter, reconsider Docker PostgreSQL approach
```

## Long Version (MADR Template)

The same decision with full options analysis:

```markdown
---
status: accepted
date: 2025-06-15
decision-makers: Sarah Chen, Joel
consulted: Alex (DBA), Platform team
informed: Frontend team, QA
---

# Use SQLite for local development database

## Context and Problem Statement

Our integration tests require a database but currently hit a shared PostgreSQL instance. This causes two problems:

1. Flaky tests from concurrent writes (multiple developers and CI jobs sharing one DB)
2. Slow CI — each run spends 3+ minutes provisioning and seeding the database

How can we provide a fast, isolated database for local development and CI without sacrificing confidence in production compatibility?

Related: [Use PostgreSQL for production](2025-05-01-use-postgresql-for-production.md) — this decision must not compromise production database choice.

## Decision Drivers

- CI speed: current 3+ minute DB setup is the bottleneck in our 5-minute pipeline
- Test isolation: zero shared state between parallel test runs
- Production parity: must catch SQL dialect issues before they hit production
- Developer experience: should work offline, no external dependencies for `npm test`
- Maintenance cost: solution should not require a dedicated owner

## Considered Options

- SQLite via better-sqlite3
- Docker PostgreSQL per CI run
- In-memory PostgreSQL (pg-mem)

## Decision Outcome

Chosen option: "SQLite via better-sqlite3", because it eliminates the CI bottleneck (2s vs 3+ min), provides full isolation, works offline, and has minimal maintenance cost. The dialect-drift risk is mitigated by a weekly CI job against real PostgreSQL.

### Consequences

- Good, because CI database setup drops from 3+ minutes to ~2 seconds
- Good, because each test run is fully isolated (file-based DB, no shared state)
- Good, because developers can run the full test suite offline with zero infrastructure
- Bad, because we must maintain a data-access abstraction layer to paper over SQL dialect differences
- Bad, because PostgreSQL-specific features (JSONB operators, array columns, advisory locks) cannot be tested locally
- Neutral, because the abstraction layer adds ~200 lines of code but also makes future DB migrations easier

## Implementation Plan

- **Affected paths**:
  - `src/db/client.ts` — new: unified database interface (DatabaseClient type + factory function)
  - `src/db/sqlite-client.ts` — new: SQLite implementation of DatabaseClient
  - `src/db/pg-client.ts` — refactor: extract current inline pg usage into DatabaseClient implementation
  - `src/db/repositories/*.ts` — update: use DatabaseClient instead of direct pg calls
  - `tests/setup.ts` — update: initialize SQLite by default, read `DB_ENGINE` env var
  - `tests/fixtures/seed.sql` — update: ensure all seed SQL is dialect-neutral
  - `.env.test` — new: `DB_ENGINE=sqlite`
  - `.github/workflows/ci.yml` — update: remove PostgreSQL service container from main CI
  - `package.json` — add devDependencies
- **Dependencies**: add `better-sqlite3@11.x`, `@types/better-sqlite3@7.x` as devDependencies
- **Patterns to follow**:
  - Repository pattern in `src/db/repositories/` — all database access goes through repository methods
  - Use parameterized queries exclusively (no string interpolation)
  - Reference implementation: `src/db/repositories/users.ts` for the expected style
- **Patterns to avoid**:
  - Do NOT import `better-sqlite3` or `pg` directly outside `src/db/`
  - Do NOT use PostgreSQL-specific SQL in shared queries: no `JSONB` operators (`->`, `->>`), no `ANY(ARRAY[...])`, no `ON CONFLICT ... DO UPDATE`
  - Do NOT use SQLite-specific SQL either — keep queries portable
- **Configuration**: `DB_ENGINE` env var (`sqlite` | `postgres`), defaults to `sqlite` in test, `postgres` in production
- **Migration steps**:
  1. Create `DatabaseClient` interface and SQLite implementation
  2. Refactor existing pg code into pg implementation
  3. Update repositories one at a time (each can be a separate PR)
  4. Update test setup last, once all repositories use the abstraction
  5. Remove PostgreSQL service container from CI workflow

### Verification

- [ ] `DB_ENGINE=sqlite npm test` passes (all integration tests)
- [ ] `DB_ENGINE=postgres npm test` passes against a real PostgreSQL 16 instance
- [ ] `grep -r "from 'better-sqlite3'" src/ --include='*.ts' | grep -v 'src/db/'` returns no results
- [ ] `grep -r "from 'pg'" src/ --include='*.ts' | grep -v 'src/db/'` returns no results
- [ ] CI pipeline completes in under 90 seconds (measured on main branch)
- [ ] `src/db/client.ts` exports `DatabaseClient` interface and `createClient()` factory
- [ ] `.env.test` sets `DB_ENGINE=sqlite`
- [ ] Weekly PostgreSQL compatibility CI job exists in `.github/workflows/`

## Pros and Cons of the Options

### SQLite via better-sqlite3

[better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — synchronous SQLite bindings for Node.js.

- Good, because zero infrastructure — just an npm dependency
- Good, because synchronous API makes test setup/teardown trivial
- Good, because file-based DBs enable parallelism (one file per test worker)
- Neutral, because requires a thin abstraction layer (~200 LOC)
- Bad, because SQL dialect differences (no JSONB, different date handling, no arrays)
- Bad, because does not exercise PostgreSQL-specific query plans or extensions

### Docker PostgreSQL per CI run

Spin up a fresh PostgreSQL container for each CI job.

- Good, because perfect production parity — same engine, same version
- Good, because no abstraction layer needed
- Bad, because adds 90+ seconds to every CI run (image pull + startup + healthcheck)
- Bad, because requires Docker-in-Docker on CI, adding complexity and security surface
- Bad, because developers need Docker running locally for `npm test`

### In-memory PostgreSQL (pg-mem)

[pg-mem](https://github.com/oguimbal/pg-mem) — in-memory PostgreSQL emulator for testing.

- Good, because better SQL compatibility than SQLite
- Good, because no infrastructure needed
- Bad, because incomplete support for our schema features (triggers, CTEs, lateral joins)
- Bad, because last published release is 8+ months old — maintenance risk
- Bad, because debugging failures requires understanding pg-mem's emulation quirks

## More Information

- Follow-up task: create data-access abstraction layer — #347
- Follow-up task: set up weekly PostgreSQL CI job — #348
- Related: [Use PostgreSQL for production](2025-05-01-use-postgresql-for-production.md)
- Revisit trigger: if dialect-drift bugs exceed 2 per quarter, reconsider Docker PostgreSQL approach
- Code references: after implementation, key files will have `// ADR: 2025-06-15-use-sqlite-for-test-database` comments at entry points
```
