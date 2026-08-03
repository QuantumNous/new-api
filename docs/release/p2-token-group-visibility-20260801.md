# P2 token-group visibility release runbook

Status: release candidate prepared; production release is not authorized.

Candidate branch: `codex/p2-on-p1-20260804`

Candidate commit: record the immutable SHA in the handoff entry immediately before
any review or release gate; this runbook is not itself the approval object.

Production base: `24fa0a872d4a3f2a67d6bf6e07e104c5c8063ef2`
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
- `token_group_visibility_targets`: normalized `(visibility_id, user_id)` pairs
  for targeted policies. Runtime authorization compares the immutable user ID;
  mutable usernames are not stored in this table.

The GORM model tags use the same `NOT NULL` and `DEFAULT 0` constraints as these
dialect-specific files. If a node is allowed to run `AutoMigrate`, verify the
resulting schema before accepting traffic; the release path still requires
`SKIP_DATABASE_MIGRATION=true` on every production node and the checked-in SQL
file as the single schema source.

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

The rollback drill removes only the disposable schema. A code rollback must use the
previous application image while retaining these two tables; dropping them in a
production incident is not part of the rollback procedure. If a disposable drill
does drop the tables, the binary must be rolled back together with that schema
change, otherwise `AutoMigrate` can recreate them on the next startup.

### Legacy username-target migration and rollback

The checked-in SQL files create the stable `user_id` schema and must not be run over
an existing username-target table with `IF NOT EXISTS` and assumed to be an upgrade.
Before any rollout, inspect a verified backup copy. If the copy still has a
`username` column, keep the flag off and perform a separately reviewed conversion:

1. Export the existing policy and target rows, then add a nullable `user_id` column
   to the backup copy. Backfill it by joining `users.username` to the target row
   (`UPDATE ... JOIN` on MySQL, `UPDATE ... FROM` on PostgreSQL, or a correlated
   `UPDATE` subquery on SQLite).
2. Abort if any username is missing, maps to more than one row, or produces a
   duplicate `(visibility_id, user_id)` pair. Record row counts and the export
   checksum before creating `idx_visibility_user`.
3. Verify every converted policy through the read path while the flag remains off,
   then switch the application to the stable-ID build. Only after acceptance may
   the legacy `username` column and old unique index be removed from the backup
   copy. The release SQL is intentionally fresh-schema-only so this destructive
   step cannot happen implicitly at startup.

Rollback for an incomplete conversion is restore-from-export/backup, not an
in-place drop or rename. For a code incident after conversion, keep the new tables,
set the flag off, and roll back the application image; do not restore the old
username-based binary against the new schema without first restoring the matching
backup copy. Admin GET is deliberately safe with the flag off and does not query
the optional tables, so schema-first order is: backup/DDL → read-only verification
→ code rollout with flag off → explicit flag enable.

## Release sequence (only after explicit authorization)

1. Close the current production observation window and record the baseline health.
2. Publish the same candidate image to the slave first, with the flag still off.
3. Run fresh-session acceptance for no-policy compatibility, public, targeted,
   hidden, time boundaries, forged create/edit requests, admin-as-user selection,
   existing hidden-token execution, login/price/public-model baseline, and the
   intersection with ordinary group permissions.

For a targeted policy whose start time is in the future, or whose end time has
passed, fail-closed behavior hides the group from every user outside the active
window. This is intentional and must be accepted as part of the product behavior;
it prevents a stale or malformed targeting window from widening access.
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

- Candidate commit and `git diff` against `24fa0a872d4a3f2a67d6bf6e07e104c5c8063ef2`.
- Output of `go test ./model ./service ./controller` and `go test ./middleware ./router`.
- Full Go test/build result, with any unrelated baseline failures identified.
- Successful `web/default` typecheck/build and `web/classic` build artifacts.
- Backup-copy migration and rollback logs for the selected dialect.
- Fresh-session acceptance screenshots/API responses and 15m/1h/24h observation notes.
- Explicit owner authorization, or a recorded block if any release gate is missing.
