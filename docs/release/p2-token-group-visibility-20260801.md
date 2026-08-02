# P2 token-group visibility release runbook

Status: release candidate prepared; production release is not authorized.

Candidate branch: `codex/p2-release-candidate-20260801`

Production base: `19be7b44f4cacda68a5c45690e8c2af659d29473`
Scope: P2 token-group visibility only, layered on the already-reviewed P1 candidate.

## Safety boundary

This runbook is for a local/backup-copy drill. No production database, API, node,
container, channel, model mapping, price, balance, customer token, or credential may
be accessed or changed by this task. A responsible owner must separately authorize
any production release.

`TOKEN_GROUP_VISIBILITY_ENABLED` defaults to `false`. Deploying the code with the
flag off preserves legacy selection behavior. Do not enable it until the schema,
slave-first rollout, fresh-session UI checks, and API checks below have passed.

## Schema and migration order

The application includes the two models in `AutoMigrate`, but production master nodes
run with `SKIP_DATABASE_MIGRATION=true`. Therefore the release must use the
dialect-specific SQL files in `bin/` on a verified database backup copy first:

- `migration_token_group_visibility_sqlite.sql`
- `migration_token_group_visibility_mysql.sql`
- `migration_token_group_visibility_postgres.sql`

The tables are intentionally independent (no foreign-key DDL) to match the GORM
models and to keep SQLite/MySQL/PostgreSQL behavior equivalent:

- `token_group_visibilities`: one row per configured group, with `public`,
  `targeted`, or `hidden` visibility and optional `[start_time, end_time)` bounds.
- `token_group_visibility_targets`: normalized `(visibility_id, username)` pairs
  for targeted policies.

## Backup-copy migration drill

1. Record the candidate commit and confirm the copy is not a production endpoint.
2. Export/backup the copy and record its restore identifier.
3. Check that the database account can create tables and indexes; do not infer this
   from application startup logs.
4. Run exactly one dialect-specific migration file. Do not run the rollback file
   in the same transaction as the migration.
5. Verify both tables, the unique group index, the target composite unique index,
   and the default values for `start_time`/`end_time`.
6. Start the candidate against the copy with `SKIP_DATABASE_MIGRATION=true` and
   `TOKEN_GROUP_VISIBILITY_ENABLED=false`; run the Go tests and both frontend builds.
7. Insert a disposable targeted row, verify the read path, then export it and run
   the matching rollback file. Confirm both tables are gone and the copy restores
   cleanly. Never run these destructive rollback files against production data.

## Release sequence (only after explicit authorization)

1. Close the current production observation window and record the baseline health.
2. Publish the same candidate image to the slave first, with the flag still off.
3. Run fresh-session acceptance for no-policy compatibility, public, targeted,
   hidden, time boundaries, forged create/edit requests, admin-as-user selection,
   existing hidden-token execution, login/price/public-model baseline, and the
   intersection with ordinary group permissions.
4. Publish the master only after the slave is healthy. Keep the flag off while
   observing the code/schema rollout.
5. Enable the flag only for the explicitly approved target scope, then observe for
   15 minutes, 1 hour, and 24 hours. Confirm every node reads policy changes from
   the database and that no stale process-local cache is involved.

## Rollback and stop conditions

Code rollback is to the previous production image with the two new tables retained;
retaining empty/unused tables avoids data loss and is compatible with the flag-off
behavior. Do not drop production tables as part of an incident rollback. The SQL
rollback files are for the disposable backup-copy drill only.

Stop the rollout if any node cannot read the schema, if a non-target user can see or
select a targeted/hidden group, if a forged create/edit request succeeds, if an
existing token stops running, if ordinary entitlement/group permissions are widened,
or if any login, balance, price, or public-model regression appears.

## Evidence to attach before handoff

- Candidate commit and `git diff` against `19be7b44`.
- Output of `go test ./model ./service ./controller` and `go test ./middleware ./router`.
- Full Go test/build result, with any unrelated baseline failures identified.
- Successful `web/default` typecheck/build and `web/classic` build artifacts.
- Backup-copy migration and rollback logs for the selected dialect.
- Fresh-session acceptance screenshots/API responses and 15m/1h/24h observation notes.
- Explicit owner authorization, or a recorded block if any release gate is missing.
