# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

<!--
Document your project's database conventions here.

Questions to answer:
- What ORM/query library do you use?
- How are migrations managed?
- What are the naming conventions for tables/columns?
- How do you handle transactions?
-->

(To be filled by the team)

---

## Query Patterns

<!-- How should queries be written? Batch operations? -->

(To be filled by the team)

---

## Migrations

<!-- How to create and run migrations -->

(To be filled by the team)

---

## Naming Conventions

<!-- Table names, column names, index names -->

(To be filled by the team)

---

## Database verification isolation (local development)

- Run **all** local database-related tests in task-scoped disposable Docker containers, including SQLite-only tests and their Go test runner. Never install, initialize, reconfigure or start a database service on the developer's host; never modify host database data directories, connect to an existing host database/socket, or use the host as a fallback. Keep test-generated files and caches inside task-owned containers/volumes, not the host checkout.
- Give each container a task-specific database and ephemeral storage. Exercise all three real engines when the database compatibility rule requires the matrix; for schema/migration changes, verify fresh schema, latest-release upgrade, and a second migration in each. Record image tags, engine versions, and commands. If Docker is unavailable, report verification as blocked instead of substituting a host installation.
- Stop/remove only task-owned containers, volumes, and scratch files after the user approves cleanup. Never uninstall pre-existing host software or delete pre-existing data to tidy a test run.

## Scenario: Docker Desktop proxy stalls container start during database verification

### 1. Scope / Trigger

On macOS Docker Desktop, `docker info` and `docker create` can succeed while
`docker start` through the configured `~/.docker/run/docker.sock` hangs. Do not
mistake a responsive daemon API for working containers, or replace the required
isolated database matrix with host services.

### 2. Signatures

- Desktop proxy endpoint: `docker context inspect desktop-linux` / `docker info`.
- If present, the same Desktop engine's raw endpoint is
  `unix://$HOME/Library/Containers/com.docker.docker/Data/docker.raw.sock`;
  use `docker -H "unix://$RAW" start <task-owned-container>` and the same
  `-H` for `exec`, `logs` and `ps` during that verification.
- The Go runner can select verified task-local source copies with
  `go test -overlay=/tmp/<task>-overlay.json ./model ...`.

### 3. Contracts

- Check the normal socket first. If only `start` hangs, compare against the
  raw socket with a task-owned no-port probe; the raw endpoint is a diagnostic
  fallback, not proof that the Desktop proxy was fixed. Do not change Desktop
  settings, prune shared caches/images, publish host ports, or touch unrelated
  containers as part of the fallback.
- Give MySQL, PostgreSQL and the Go/SQLite runner a task-specific network,
  database and ephemeral storage. Record image tags, actual server versions,
  Go version, exact commands, tests and skips; an image tag alone does not
  establish a running database version.
- A read-only host bind mounted through this fallback may show stale source
  content. Compare SHA-256 of every changed Go file on the host and in the
  runner immediately before testing. If different, copy only task-owned source
  files into the runner and map them via a Go overlay; verify the copied hashes
  match the host. Never report stale-code tests as verification.
- Keep task-owned containers, networks, volumes and overlay files until the
  user approves cleanup; do not clean unrelated Docker resources.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Desktop proxy responds to `info` but `start` hangs; raw endpoint starts the task probe | Use the raw endpoint consistently for isolated verification; report the proxy as still broken |
| Both endpoints cannot start a task container | Report the three-database matrix blocked; do not substitute host DBs |
| Runner source hash differs from host | Stop trusting its results; refresh task-local overlay and recheck hashes before rerun |
| MySQL/PostgreSQL DSN is absent or a subtest skips | Report the engine unverified, even if the overall Go command exits zero |

### 5. Good / Base / Bad Cases

- Good: a raw-socket probe starts, isolated Go/MySQL/PostgreSQL containers run,
  host/runner source hashes match, and real engine tests report their versions.
- Base: the normal proxy starts every container; use it without a fallback.
- Bad: claim `docker info` proves the matrix passed, run tests against a stale
  mount, prune shared images to unstick startup, or silently fall back to a
  pre-existing host database.

### 6. Tests Required

- In the task network, confirm both databases accept connections and query
  `SELECT VERSION()` / `SHOW server_version`, then run the relevant SQLite,
  MySQL and PostgreSQL integration subtests from the containerized Go runner.
- Check that the tests actually ran (not skipped). For migration changes,
  verify fresh migration, representative released-schema upgrade and repeat
  migration; explicitly report missing upgrade or minimum-version coverage.
- Compare host and runner source hashes after the final edit and before the
  final test. A Go overlay's replacement files must match the committed or
  staged source, not a previous copy.

### 7. Wrong vs Correct

```sh
# Wrong: a healthy metadata API and a stale bind mount do not verify behavior.
docker info && docker start task-db && go test ./model

# Correct when the Desktop proxy stalls but the raw endpoint works:
RAW="$HOME/Library/Containers/com.docker.docker/Data/docker.raw.sock"
docker -H "unix://$RAW" start task-db
# Verify host/runner SHA-256 equality first; use a verified Go overlay if needed.
docker -H "unix://$RAW" exec task-go go test -overlay=/tmp/task-overlay.json ./model -run 'TestRelevantDatabaseIntegration' -v
```

## Scenario: audit log migration across separate log databases

### 1. Scope / Trigger
- Changing `model.AuditLog`, `RecordAuditLog`, `MigrateAuditLogs`, or the independent `LOG_SQL_DSN` migration path.

### 2. Signatures
- `RecordAuditLog(c *gin.Context, entry AuditLog)` writes through `LOG_DB`; `MigrateAuditLogs() error` creates `audit_logs` in the configured log store. `UserAccessToken` lives in the main DB.

### 3. Contracts
- SQLite/MySQL/PostgreSQL use GORM's naming strategy for `AuditLog` and `UserAccessToken` (including a configured table prefix); do not hardcode a `TableName()` just to reproduce the default name. ClickHouse uses an explicit `audit_logs` MergeTree table and a JSON-encoded `other` insert; it does **not** enforce `event_id` uniqueness. Do not rely on ClickHouse to reject duplicate audit writes or call that table database-deduplicated.
- Audit records are not subject to usage-log TTL. Test a separately configured log store rather than assuming `LOG_DB == DB`.

### 4. Validation & Error Matrix
| Condition | Required result |
| --- | --- |
| Main/log databases have a GORM table prefix | Migrate and write to the corresponding prefixed tables; no missing-table errors |
| ClickHouse receives the same `event_id` twice | Both rows may remain; prevent duplicate events at the producer if uniqueness is required |
| Log DB is unavailable | Log the write failure without recording sensitive bearer credentials |

### 5. Good / Base / Bad Cases
- Good: migrate a representative previous-release main and independent log DB twice on each supported engine, then read existing audit rows and check new records.
- Base: fresh migrations work with default table names.
- Bad: test only the main DB, assume ClickHouse enforces `uniqueIndex`, or hardcode `audit_logs` for a prefixed relational log DB.

### 6. Tests Required
- In task-isolated Docker containers, verify fresh and previous-release upgrades plus repeat migration for SQLite, MySQL and PostgreSQL main/log stores; assert preserved data, indexes and uniqueness. For ClickHouse, verify fresh/upgrade audit read-write and repeat migration, and document its duplicate `event_id` behavior. Record actual engine versions and untested older versions/production backup separately.

### 7. Wrong vs Correct
```go
// Wrong: bypasses the relational log database's naming strategy.
LOG_DB.Table("audit_logs").Create(&entry)
// Correct: relational log store; use its configured GORM schema.
LOG_DB.Create(&entry)
// ClickHouse's explicit table and JSON binding remain a separate dialect branch.
```

## Common Mistakes

- Do not call `GetDBTimestamp()` (which queries the global `DB`) inside a GORM transaction. SQLite test setups may have one available connection, so the nested query waits on the transaction's own connection indefinitely. Use `getDBTimestampOn(tx)` for transaction-local database time; `CreateUserSubscriptionFromPlanTx` is an example. This also keeps transactional reads on the same connection across dialects.
- Avoid a redundant fixed `TableName()` when GORM's default already names the production table correctly. `Checkin` naturally maps to `checkins`; its former override bypassed `schema.NamingStrategy{TablePrefix: ...}` in MySQL/PostgreSQL migration tests, causing test setup and cleanup to touch an unscoped table. Verify the default table name before removing any override, then test normal startup and prefixed isolated migrations on SQLite, MySQL and PostgreSQL.

## Scenario: Redemption code entitlement migration and grant

### 1. Scope / Trigger

Adding a redemption entitlement or changing subscription grant semantics touches the `redemptions` schema, wallet quota, subscription creation and the `/api/user/topup` response. Preserve existing wallet codes and their public numeric response; verify all three supported database engines.

### 2. Signatures

- `Redemption.PlanId int` (`plan_id`, default `0`); `Redemption.Quota int` keeps its historical `default:100` database tag.
- `Redemption.Type string` is optional request-only (`gorm:"-:all"`), not a persisted discriminator; infer stored entitlement from `plan_id`.
- `model.Redeem(key, userId) (data any, err error)` is called by `POST /api/user/topup`.
- Admin routes: `POST /api/redemption/`, `PUT /api/redemption/` (`?status_only=...`), existing list/search/delete routes.

### 3. Contracts

- `plan_id = 0`, positive validated `quota`: wallet code. `plan_id > 0`, `quota = 0`: subscription code. Existing rows migrate to `plan_id = 0` with no balance changes. The optional `type` request value, if supplied, must match the entitlement.
- On a wallet-code success, `/api/user/topup` still returns `data: <integer quota>`. Only subscription-code success returns `data: {"type":"subscription","plan_id":<int>,"plan_title":<string>}`. A client supporting subscription codes must branch on this shape; never send a code key back or log a raw submitted key.
- Subscription grants use the **current** enabled plan in the same transaction as the enabled→used CAS; `CreateUserSubscriptionFromPlanTx` applies duration, reset, group and `MaxPurchasePerUser`. A disabled plan does not consume its unredeemed code. A code can never be re-enabled after use.
- The old `quota default:100` tag must remain for cross-dialect migration stability. GORM substitutes a zero-valued struct field with this default during INSERT; for subscription codes, explicitly write `quota=0` in the **same** transaction before commit.

### 4. Validation & Error Matrix

| Condition | Behavior |
| --- | --- |
| Wallet code quota non-positive or above wallet bound; subscription code with quota nonzero; invalid `type`/`plan_id` pairing | Reject admin insert/update on server |
| Plan missing/disabled on issuance or plan change | Reject, without creating a new code |
| Existing code whose unchanged plan was later disabled | Allow metadata/status edit; reject redemption until plan is re-enabled |
| Code expired, disabled, used or concurrently consumed | Reject redemption; do not grant wallet quota or subscription |
| Grant fails (plan deleted, purchase limit, DB error) | Roll back both code status and entitlement; do not create a paid order |

### 5. Good / Base / Bad Cases

- Base: pre-upgrade quota code is still a quota code and returns the same integer after redemption.
- Good: issue a plan code with zero quota, disable its plan, observe a rejected redeem and unchanged code; re-enable, redeem once and observe the current plan's subscription entitlement.
- Bad: create a subscription code in a separate table, drop the quota default during `AutoMigrate`, read the plan through a stale cache inside the redeem transaction, or call `GetDBTimestamp()` on global `DB` while that transaction holds a lock.

### 6. Tests Required

- Extend `model/redemption_test.go`: single-use wallet and subscription grants, disabled/re-enabled plan, plan edits, purchase limits, concurrent CAS, rollback and user balance preservation.
- On isolated SQLite, MySQL and PostgreSQL, repeat fresh `AutoMigrate`; upgrade a representative schema created by the latest release twice and assert legacy ID/data, `quota` default, key uniqueness and `plan_id=0` remain. Run real transaction tests on each engine. Record versions and commands; a unit test or SQLite alone is not the matrix.
- Exercise the admin form and wallet result shape in frontend interaction tests, plus all supported i18n locales.

### 7. Wrong vs Correct

```go
// Wrong: `key` is reserved in MySQL and this predicate is not portable.
db.Where("key = ?", key).First(&code)
// Correct: GORM quotes the column for the active dialect.
db.Where(map[string]any{"key": key}).First(&code)
```
