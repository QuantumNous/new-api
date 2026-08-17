# Deploy new-api to llm.mrdnd.dev (fresh install)

## 0. Prereqs on the VPS

- Docker + compose plugin installed
- Existing Traefik instance (TLS is handled there — no extra proxy needed)
- DNS: `llm.mrdnd.dev` A record → VPS IP
- `docker login registry.mrdnd.dev` done

## 1. Copy files

```bash
scp -r deploy/llm.mrdnd.dev vps:/opt/new-api
```

## 2. Create .env

```bash
cd /opt/new-api
cp .env.example .env
# generate secrets:
openssl rand -hex 32   # -> SESSION_SECRET
openssl rand -hex 32   # -> CRYPTO_SECRET
# and set strong POSTGRES_PASSWORD / REDIS_PASSWORD
nano .env
```

Also check the Traefik values at the bottom of `.env` — they must match your
existing Traefik setup:

- `TRAEFIK_NETWORK` — the external docker network your Traefik watches
  (create once if missing: `docker network create traefik`)
- `TRAEFIK_ENTRYPOINT` — your HTTPS entrypoint name (commonly `websecure`)
- `TRAEFIK_CERTRESOLVER` — your ACME resolver name (commonly `letsencrypt`)

## 3. Start

```bash
docker compose --env-file .env up -d
docker compose --env-file .env logs -f new-api
```

Traefik picks up the container automatically from its labels and provisions
the certificate for `llm.mrdnd.dev`. The app container itself publishes no
host port — traffic enters only through Traefik.

## 4. First-run configuration (web UI)

1. Open https://llm.mrdnd.dev → login `root` / `123456`, **change password immediately**
2. Settings → General → **Server Address**: `https://llm.mrdnd.dev`
3. Mezon Developer Portal → update OAuth redirect URI to:
   `https://llm.mrdnd.dev/oauth/mezon`
4. Settings → OAuth → Mezon provider: verify client_id/secret still valid
5. Turn registration/password-register on/off as desired

## 5. Updates

```bash
# after building & pushing a new image from the fork:
docker compose --env-file .env pull
docker compose --env-file .env up -d
```

## Backup

All state lives in the named volumes `postgres-data` and `new-api-data`.
Snapshot with `docker run --rm -v new-api_postgres-data:/data -v $PWD:/backup alpine tar czf /backup/pg.tgz -C /data .` (and likewise for `new-api-data`), or use `pg_dump` inside the postgres container.
