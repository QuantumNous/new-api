# Production PostgreSQL Snapshot Workflow

This workflow downloads the latest server PostgreSQL snapshot into a local
Docker PostgreSQL database for affiliate development smoke tests.

Do not put production DSNs, passwords, dumps, or runtime output in git. Keep
all dump files under `runtime/prod-pg-snapshots/`.

## 1. Fetch the Server Dump

Set these variables in your shell without printing them:

```bash
export AFFILIATE_SSH_TARGET='<ssh-alias-or-user-at-host>'
export AFFILIATE_REMOTE_COMPOSE_DIR='<remote-new-api-compose-dir>'
export AFFILIATE_PG_SERVICE='<postgres-compose-service-name>'
```

Then fetch a custom-format dump:

```bash
ops/prod-snapshot/fetch-remote-pg-dump.sh
```

The remote script runs `pg_dump --format=custom --no-owner --no-privileges`
inside the PostgreSQL container. It reads database name and user from the
container environment (`POSTGRES_DB` / `POSTGRES_USER`, or `PGDATABASE` /
`PGUSER`) and streams the dump to a local runtime file.

## 2. Restore to Local Docker PostgreSQL

Set a local-only password for the isolated PostgreSQL container:

```bash
export AFFILIATE_LOCAL_PG_PASSWORD='<local-only-password>'
```

Optional local settings:

```bash
export AFFILIATE_LOCAL_PG_CONTAINER='new-api-affiliate-pg'
export AFFILIATE_LOCAL_PG_DATABASE='new_api_affiliate_snapshot'
export AFFILIATE_LOCAL_PG_USER='postgres'
export AFFILIATE_LOCAL_PG_PORT='55432'
```

Restore:

```bash
ops/prod-snapshot/restore-local-docker-pg.sh runtime/prod-pg-snapshots/<dump>.dump
```

The script prints a redacted local database URL. Use the real local-only
password only in environment variables.

## 3. Collect Baseline Counts

```bash
export AFFILIATE_LOCAL_DATABASE_URL='<local-isolated-postgres-url>'
ops/prod-snapshot/collect-core-row-counts.sh
```

Record the output in a local note or runtime artifact only. It should include
`users`, `channels`, `abilities`, `options`, `logs`, `top_ups`, and any
existing `affiliate_*` tables.

## Current Known Blocker

As of 2026-06-02, Docker Desktop is running on the Windows side, but Docker CLI
inside WSL times out when talking to `/var/run/docker.sock`. The `desktop-linux`
context also crashes the Linux Docker CLI. Re-run `docker version`, `docker
info`, and `docker ps` after Docker Desktop WSL integration is repaired.
