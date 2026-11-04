---
name: newapi-production-upgrade
description: >-
  Production upgrade, database migration, and web server transition manual for new-api
  on standalone production servers (e.g. your-domain.example.com). Covers safe
  PostgreSQL 17->18 migration, TimescaleDB hypertable conversion, GORM AutoMigrate
  constraint traps, Caddy with replace-response plugin replacing Nginx, and GitHub
  Actions automated deployment secrets configuration.
---

# new-api Production Upgrade & Infrastructure Migration Guide

This skill records the hard-won production upgrade procedures, database migration contracts, GORM pitfalls, and Caddy reverse proxy configurations for `new-api`. Use this skill whenever planning or executing upgrades on standalone production instances.

## 1. SSH Deployment Secrets Architecture

### Key Pair Roles (Client vs. Server)
In SSH automated deployments:
- **Client (GitHub Actions Runner)**: Initiates the connection; **MUST hold the Private Key** (`PROD_SERVER_SSH_KEY`) to generate cryptographic signatures.
- **Server (Production Host `your-server-ip`)**: Accepts the connection; **MUST hold the Public Key** in `~/.ssh/authorized_keys` to verify client signatures.
- *Caution*: Storing the public key in GitHub Secrets will fail with `Permission denied (publickey)` because the client cannot sign the challenge without the private key.

### GitHub Secrets Specification
Configure the following secrets in the repository under `Settings -> Secrets and variables -> Actions`:

| Secret Name | Required | Example | Description |
|---|---|---|---|
| `PROD_SERVER_HOST` | **Yes** | `your-server-ip` | Production server IP or resolvable hostname. |
| `PROD_SERVER_USER` | **Yes** | `root` | SSH login username. |
| `PROD_SERVER_SSH_KEY` | **Yes** | `-----BEGIN OPENSSH...` | Dedicated ED25519 private key (injected via pipe without displaying). |
| `PROD_SERVER_SSH_PORT` | No | `22` | SSH port (defaults to `22`). |
| `PROD_DEPLOY_PATH` | No | `/opt/new-api/deploy` | Path containing `podman-compose.yml` (defaults to `/opt/new-api/deploy`). |

*Important*: Never confuse these with `SERVERS_LIST_JSON`, which is reserved exclusively for unstable testing nodes and K3s cluster maintenance.

---

## 2. GORM AutoMigrate Critical Pitfalls

### The `prefill_groups` Constraint Crash (SQLSTATE 42704)
- **Root Cause**: Older production databases created `prefill_groups` with a unique constraint named `idx_prefill_groups_name UNIQUE (name)`. When the Go model was updated to support soft deletion (`uniqueIndex:uk_prefill_name,where:deleted_at IS NULL`), GORM's PostgreSQL migrator detects that `field.Unique` is false and attempts to drop the old unique constraint.
- **The Trap**: GORM hardcodes its default generated constraint name `uni_prefill_groups_name` without `IF EXISTS`. Because the actual constraint is named `idx_prefill_groups_name`, PostgreSQL throws:
  ```text
  ERROR: constraint "uni_prefill_groups_name" of relation "prefill_groups" does not exist (SQLSTATE 42704)
  ```
  This causes an immediate fatal crash on startup.
- **Contract Rule**: Any pre-existing unique constraint that diverges from GORM's naming convention must be dropped or reconciled **before** GORM `AutoMigrate` runs.
- **Implementation Anchor**: In `apps/api/internal/dbinfra/open_db.go`:
  ```go
  func migratePrefillGroupConstraint() error {
      if !common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
          return nil
      }
      var exists bool
      if err := dbx.DB.Raw("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'prefill_groups')").Scan(&exists).Error; err != nil {
          return err
      }
      if !exists {
          return nil
      }
      return dbx.DB.Exec("ALTER TABLE prefill_groups DROP CONSTRAINT IF EXISTS idx_prefill_groups_name").Error
  }
  ```

### The `logs` Partition Column NOT NULL Constraint (SQLSTATE TS101)
- **Root Cause**: TimescaleDB enforces that the time-partitioning column (`created_at`) is `NOT NULL`. Without an explicit `not null` tag on `Log.CreatedAt`, GORM `AutoMigrate` observes that the Go struct does not declare `not null` and emits:
  ```sql
  ALTER TABLE "logs" ALTER COLUMN "created_at" DROP NOT NULL;
  ```
  TimescaleDB rejects dropping `NOT NULL` on a partitioned column:
  ```text
  ERROR: cannot drop not-null constraint from a time-partitioned column (SQLSTATE TS101)
  ```
  This causes a crash on the second restart.
- **Contract Rule**: In `apps/api/internal/usage/store_log.go`, `CreatedAt` must include `gorm:"...;not null;..."`.

---

## 3. Database Migration: PostgreSQL 17 -> 18 + TimescaleDB

### Volume Mount Convention Change
- PostgreSQL 17: volume mounted to `/var/lib/postgresql/data`.
- PostgreSQL 18+: volume mounted to `/var/lib/postgresql` (the container creates `data/` as a subdirectory to allow `pg_upgrade --link`).
- Never reuse a PG17 volume path directly with a PG18 container.

### In-Place Hypertable Conversion Sequence
To convert an existing plain `logs` table into a TimescaleDB hypertable without data loss:
```sql
BEGIN;
-- 1. Ensure partition column is NOT NULL
ALTER TABLE logs ALTER COLUMN created_at SET NOT NULL;

-- 2. TimescaleDB requires the partition column in all unique indexes
ALTER TABLE logs DROP CONSTRAINT IF EXISTS logs_pkey;
ALTER TABLE logs ADD PRIMARY KEY (created_at, id);
CREATE INDEX IF NOT EXISTS idx_logs_id ON logs (id);

-- 3. Convert table and migrate existing rows into chunks
SELECT create_hypertable(
    'logs', 'created_at',
    chunk_time_interval => 86400::bigint,
    migrate_data => TRUE,
    if_not_exists => TRUE
);

-- 4. Register integer_now for the bigint Unix epoch column
CREATE OR REPLACE FUNCTION logs_created_at_now() RETURNS bigint
    LANGUAGE SQL STABLE AS $$ SELECT extract(epoch FROM now())::bigint $$;
PERFORM set_integer_now_func('logs', 'logs_created_at_now', replace_if_exists => TRUE);
COMMIT;
```

### Performance & Memory Budget
- **Dump time (`pg_dump -Fc`)**: ~0.6s for 125k rows.
- **Restore time (`pg_restore`)**: ~1.6s.
- **Conversion time (125k rows / 15 indexes)**: ~3.1s.
- **Peak memory during conversion**: ~216 MiB (PostgreSQL) + ~182 MiB (new-api).
- **Post-restore mandatory step**: Run `ANALYZE logs;` immediately to refresh query planner statistics.

---

## 4. Web Server Transition: Caddy Replacing Nginx

### Key Directives Mapping
| Feature | Nginx Implementation | Caddyfile Equivalent |
|---|---|---|
| Cloudflare Origin SSL | `ssl_certificate /etc/nginx/ssl/...` | `tls /etc/ssl/cert.crt /etc/ssl/cert.key` |
| Cloudflare Real-IP | `set_real_ip_from ...; real_ip_header ...` | `trusted_proxies static ...; client_ip_headers CF-Connecting-IP` |
| SSE Streaming (No Buffering) | `proxy_buffering off;` | `reverse_proxy { flush_interval -1 }` |
| Route Prefix Stripping | `rewrite ^/grok(/.*)$ $1 break; proxy_pass ...` | `handle_path /grok/* { reverse_proxy 127.0.0.1:18000 }` |
| Static Files | `try_files /robots.txt =404;` | `file_server` inside `handle @seo_static` |
| SPA SEO Tag Rewriting | `sub_filter '<title>...' '<title>...'` | `replace { '<title>...' '<title>...' }` via `replace-response` |

### Critical Caddyfile Rules
1. **Global Options Order**: Because `replace` is a third-party plugin, `order replace after encode` must be declared in the global block `{ ... }`.
2. **Directive Placement**: The `replace` block must be placed at the `handle` level alongside `reverse_proxy`, **never** nested inside `reverse_proxy`.
3. **Upstream Compression**: Add `header_up Accept-Encoding identity` to `reverse_proxy` so the backend does not gzip responses before `replace` can modify the body.
4. **Build Proxy Requirement**: When building custom Caddy images with `xcaddy`, always specify `ENV GOPROXY=https://goproxy.cn,direct` in Dockerfile to prevent timeouts on `proxy.golang.org`.

---

## 5. Rollback Playbook (Under 10 Seconds)

Never delete old containers (`docker rm`) during upgrades. Rename and freeze them:
```bash
# Freeze old PG container
docker rename newapi-postgres newapi-postgres-v17-bak
docker update --restart=no newapi-postgres-v17-bak
docker stop newapi-postgres-v17-bak

# Freeze old new-api container
docker rename new-api new-api-v17-bak
docker update --restart=no new-api-v17-bak
docker stop new-api-v17-bak
```

These snippets use shell variables instead of a hardcoded host, port or container name. Set them per target before running:
```bash
export PROD_HOST=<server-ip-or-hostname>      # e.g. 203.0.113.10 or newapi.example.com
export PROD_USER=<ssh-user>
export PROD_SSH_PORT=22
export PROD_DEPLOY_PATH=/opt/new-api/deploy
export HEALTH_PORT=<api-port>                 # PORT= in the target podman-compose.yml
export CADDY_CONTAINER=<caddy-container-name> # `docker ps --filter ancestor=caddy --format '{{.Names}}'`
```

### Instant Revert:
```bash
# 1. Revert Web Server
docker stop "${CADDY_CONTAINER}" && systemctl start nginx && systemctl enable nginx

# 2. Revert Application & Database
cd /opt/new-api/deploy
docker stop new-api newapi-postgres 2>/dev/null || true
docker update --restart=always newapi-postgres-v17-bak && docker start newapi-postgres-v17-bak && docker rename newapi-postgres-v17-bak newapi-postgres
cp docker-compose.yml.bak-v17 docker-compose.yml
docker update --restart=always new-api-v17-bak && docker start new-api-v17-bak && docker rename new-api-v17-bak new-api
```

---

## 6. Real Production Migration Lessons (2026-09-07)

### GORM AutoMigrate: Universal Legacy Constraint Cleaner
During a real production migration, GORM AutoMigrate crashed on **multiple** tables
with the same `SQLSTATE 42704` (constraint name mismatch). The affected tables were
not just `prefill_groups` but also `qq_bindings`, `qq_bind_codes`, `authz_roles`,
`casbin_rule`, and potentially any table whose model uses `uniqueIndex` with a
custom name.

**Root Cause Pattern**: Production databases created by older code versions use
different constraint naming conventions (`idx_`, `uk_`, `ux_`) than GORM's current
default (`uni_<table>_<field>`). When the model switches from `unique` to
`uniqueIndex`, GORM tries to drop the old constraint using its default name, which
doesn't exist → fatal crash.

**Universal Fix**: Instead of whack-a-mole per table, query `pg_constraint` and
drop ALL unique constraints that don't match GORM's `uni_` prefix before
AutoMigrate runs. See the `migratePrefillGroupConstraint()` in
`apps/api/internal/dbinfra/open_db.go` for the implementation.

**Lesson**: If migrating a long-running production database, ALWAYS run a
constraint-name audit first:
```sql
SELECT conrelid::regclass::text, conname
FROM pg_constraint
WHERE contype = 'u' AND connamespace = 'public'::regnamespace
  AND conname NOT LIKE 'uni_%' AND conname NOT LIKE '%_pkey';
```

### Data Deduplication Before Unique Index Creation
GORM AutoMigrate creates unique indexes. If the production data has duplicate
values in those columns (because the old code didn't enforce the constraint),
the index creation fails with `SQLSTATE 23505`.

**Fix**: Before AutoMigrate, deduplicate data based on the columns that the new
unique indexes will cover. The dedup pattern:
```sql
DELETE FROM <table> WHERE ctid NOT IN (
    SELECT MIN(ctid) FROM <table> GROUP BY <unique_columns>
);
```

**Affected tables during the 2026-09-07 production migration**: `auth_flows`, `casbin_rule`,
`authz_roles`, `channel_model_routes`, `gateway_config_outboxes`.

**Lesson**: After removing old constraints and before AutoMigrate, run a full
dedup pass on all tables that the new models define `uniqueIndex` tags for.

### Sequence Desync After COPY
When bulk-loading data via `COPY` (CSV or otherwise), PostgreSQL sequences are
NOT advanced. The next `INSERT` will fail with `SQLSTATE 23505` duplicate key.

**Fix**: After bulk loading, reset all sequences:
```sql
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS seq_name, t.relname AS tbl_name, a.attname AS col_name
    FROM pg_class c
    JOIN pg_depend d ON d.objid = c.oid AND d.classid = 'pg_class'::regclass
    JOIN pg_class t ON t.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
    WHERE c.relkind = 'S' AND t.relnamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('SELECT setval(%L, COALESCE((SELECT max(%I) FROM %I), 0) + 1, false)', r.seq_name, r.col_name, r.tbl_name);
  END LOOP;
END $$;
```

### Production Server Memory Constraints (4GB RAM)
On a 4GB RAM production server, `pg_restore -j 1` into PG18 + TimescaleDB can
exhaust memory when restoring a large `logs` table (130k+ rows with 15 indexes).
The TimescaleDB background workers consume additional memory during hypertable
conversion.

**Mitigation**:
1. Always use `-j 1` (single-threaded restore) on low-memory servers.
2. Consider using plain `postgres:18-alpine` first (without TimescaleDB), then
   install the extension after the restore completes and the application has started.
3. Monitor with `free -h` and `docker stats` during restore.

### Docker Deployment: Never Auto-Deploy on Merge
The `deploy-server.yml` workflow originally had a `workflow_run` trigger that
auto-deployed on every successful Docker image build. This caused an unintended
production deployment when PRs were merged.

**Fix**: Remove the `workflow_run` trigger. Production deploys MUST be
strictly manual (`workflow_dispatch` only). The deploy workflow must never
automatically touch the production server.

### Docker Image Version Mismatch
When merging a feature PR to main, the GHCR image is rebuilt automatically
(via `Publish Docker image (Multi-arch)` workflow). However, the server may
still have a cached older `:latest` image. Always run `docker pull` before
starting the new container to ensure you get the correct version.

**Verification**: Check the built image digest matches what's on the server:
```bash
docker images --format "{{.ID}} {{.CreatedAt}}" | grep new-api
```

### Port Conflict During Container Rename
`docker rename` does NOT change the container's port bindings. A renamed
container still tries to bind its original port. If the old and new containers
both bind `127.0.0.1:5432`, the rename+restart will fail.

**Fix**: The rename-freeze-restart sequence must account for port conflicts:
1. Stop old container (releases port)
2. Rename old container
3. Start new container (binds port)
