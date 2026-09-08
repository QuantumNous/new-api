# cxm migration tool

This is a one-time, PostgreSQL-only migration tool for the local Docker
acceptance environment. It never writes to the source database. Keep the
bundle, database backup, DSNs, private keys, tokens and redemption keys out of
Git and out of terminal logs.

The supported commands are:

```text
cxm_migration export --source-dsn <read-only-tunnel-dsn> --agent-id 315 --bundle <new-file>
cxm_migration validate --bundle <file> --target-dsn <local-dsn>
cxm_migration import --bundle <file> --target-dsn <local-dsn>
cxm_migration report --bundle <file> --target-dsn <local-dsn>
cxm_migration in-place --dry-run --target-dsn <target-dsn>
cxm_migration in-place --target-dsn <target-dsn>
cxm_migration rollback-project --target-dsn <target-dsn> --cutover-at <unix> --run-id <id>
cxm_migration restore-current --target-dsn <target-dsn> --run-id <id>
```

Run `export` only through a local SSH tunnel to the source PostgreSQL. Run
`import` inside the custom backend container so the target DSN remains on the
Docker network. The tool refuses to overwrite an existing bundle and refuses
to import when user, plan, offer, redemption, or token conflicts are found.

`in-place` is for a target database that already contains the legacy tables
(`packages`, `offers`, `user_packages`, `quota_grants`, `agent_credits`, and
`agent_credit_logs_legacy`) after a full database restore. It converts legacy
subscription, agent account, order, redemption, and credit-ledger data into
the current tables in one transaction. Run the dry run first; the write mode
requires all current destination tables to be empty. Legacy source tables are
retained for rollback and audit. It intentionally enables only the validated
`pro`, `max`, and `Ultra` plans; historical plans remain available but
disabled until their fulfillment semantics are reviewed.

## Legacy rollback rehearsal

Run `rollback-project` only after a full target PostgreSQL backup and while the
current schema is still active. It records a run marker, copies post-cutover
current credit logs into `agent_credit_logs_legacy`, projects new
`user_subscriptions` into `user_packages` and `quota_grants`, updates the
legacy agent balance, maps current redemption types to the legacy values, and
then swaps the ledger table and user timestamp columns for the legacy image.
The current orders, subscriptions, redemptions, and current ledger table are
retained under their current names for restoration.

```bash
cxm_migration rollback-project \
  --target-dsn "$TARGET_DSN" \
  --cutover-at "$CUTOVER_EPOCH" \
  --run-id "cutover_20260723"
```

Stop the legacy application before running `restore-current`. Restoration is
strict: it checks user fields, redemption state, agent balances, table counts,
and all projection rows. If the legacy application made a business write, the
command exits non-zero with `legacy business writes detected` and leaves the
database untouched. This is intentional; a separate incremental replay must
translate legacy writes before a safe forward cutover.

```bash
cxm_migration restore-current \
  --target-dsn "$TARGET_DSN" \
  --run-id "cutover_20260723"
```

The metadata tables are retained for audit. Do not run either command against
production without a tested backup and an approved write-freeze window.
