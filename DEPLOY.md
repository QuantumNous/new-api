# Deploy

Target: `https://apijinn.ccwu.cc:8444` on `98.159.108.160`.

## TL;DR

```bash
# 1. locally — commit + push
git add -A && git commit -m "..." && git push farmer-data jinn-deploy:main

# 2. remote — one command
ssh root@98.159.108.160 '/opt/newapi/deploy.sh'
```

That's it. ~30s if Go cache is warm (no .go file changed), ~2min cold.

`deploy.sh` handles: `git pull` → `go build` → swap binary → `docker compose build new-api` → rolling restart → health check → auto-rollback on fail.

---

## What's on the server

```
/opt/newapi/                          deploy dir
├── docker-compose.prod.yml           caddy + new-api + postgres + redis
├── Caddyfile                         apijinn.ccwu.cc → new-api:3000 on :8444
├── .env                              PG_PASS, REDIS_PASS, SESSION_SECRET, CRYPTO_SECRET
├── Dockerfile.newapi                 FROM calciumion/new-api:latest + COPY bin/new-api
├── deploy.sh                         build-on-server (current path)
├── upgrade.sh                        upload-based (legacy fallback)
├── bin/new-api                       currently-deployed Go binary
├── bin/backups/<timestamp>/          rolling 10 prior binaries
├── caddy_data/, caddy_config/        Let's Encrypt state for apijinn.ccwu.cc
└── pgdata/                           postgres bind mount

/opt/newapi-src/                      git clone of farmer-data/new-api (tracks main)
└── web/{default,classic}/dist/       frontend bundles — gitignored, populated
                                       once via scp tarball. Re-scp if you change
                                       frontend code.

/usr/local/go/                        Go 1.25.5 (apt only has 1.22; we need ≥1.25.1)
```

---

## Build-time env (set by deploy.sh)

```bash
GOPROXY=https://goproxy.cn,https://proxy.golang.org,direct
GOSUMDB=off
```

The goproxy.cn mirror is for fast cold builds regardless of where the server is geographically.

---

## What deploy.sh does NOT do

- **Frontend rebuild.** Server has no `bun`. If you edit `web/default/src/...`, build the dist locally and ship it once:

  ```bash
  cd web/default && bun run build && cd ../..
  tar -czf /tmp/dist.tar.gz web/default/dist web/classic/dist
  scp /tmp/dist.tar.gz root@98.159.108.160:/tmp/
  ssh root@98.159.108.160 'cd /opt/newapi-src && tar -xzf /tmp/dist.tar.gz && rm /tmp/dist.tar.gz'
  # then trigger a redeploy to pick up the new dist:
  ssh root@98.159.108.160 '/opt/newapi/deploy.sh'
  ```

- **Schema migrations.** GORM AutoMigrate runs on container boot — most schema work is implicit. Watch `docker logs new-api -f` after deploy if you're adding tables/columns.

- **Secrets rotation.** `/opt/newapi/.env` is hand-managed; edits there require a `docker compose restart` for new-api (or full `docker compose up -d --force-recreate new-api`).

---

## Rollback

Auto: `deploy.sh` rolls back automatically when the health check fails after 60s.

Manual:

```bash
ssh root@98.159.108.160
cd /opt/newapi
ls bin/backups/                          # pick a timestamp
cp bin/backups/<timestamp>/new-api bin/
docker compose -f docker-compose.prod.yml build --no-cache new-api
docker compose -f docker-compose.prod.yml up -d --no-deps new-api
```

---

## Diagnosing failures

```bash
ssh root@98.159.108.160
docker logs new-api --tail 100             # app logs
docker logs caddy --tail 50                # TLS / proxy issues
docker exec postgres psql -U root -d new-api    # DB shell
docker ps                                  # container health
curl -sk --resolve apijinn.ccwu.cc:8444:127.0.0.1 https://apijinn.ccwu.cc:8444/api/status
```

---

## Why not just `docker compose --build`?

The upstream Dockerfile builds the frontend inside a docker container with `bun install`. On HK/CN-routed networks (laptop or server), bun's `npm` integrity check fails intermittently. The "patched image" pattern in `Dockerfile.newapi` sidesteps this: take the official `calciumion/new-api:latest` image (frontend already baked in) and just overwrite the Go binary.

Frontend code we author lives in this repo; the dist tarball we ship to the server overrides the upstream frontend at build time via `//go:embed`. So our local frontend always wins — but only when the dist tree is current on the server.

---

## Why not the old `scp` + `upgrade.sh` path?

Still works as a fallback. But the binary is ~70 MB and the upload takes 5–7 minutes on this network with frequent corruption (we hit that during initial setup — three retries to get one clean transfer). Building on the server side-steps the entire upload, because the server has a clean uplink. Net change: deploy time 7 min → 30 sec.

Keep `upgrade.sh` for cases where you need to deploy a binary built locally (e.g., a one-off debug build with extra logging, or rolling back to a previously-built binary not represented in git).
