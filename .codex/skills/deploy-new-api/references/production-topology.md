# Production topology

This is a last-known snapshot from 2026-07-21. Verify every mutable value on the host before using it.

## Service map

| Role | Last-known value | Required behavior |
| --- | --- | --- |
| SSH alias | `aliyun` | Use the configured local SSH host alias. |
| Public site | `https://alltokenapi.com` | Verify status and the changed user route after local health passes. |
| Deploy directory | `/opt/new-api` | Preserve `.env`, `data`, and `logs`. |
| App container/service | `new-api` | Recreate only this service. |
| App image tag | `new-api:local` | Retag the current image before switching. |
| App port | `127.0.0.1:3000` | Check `/api/status` locally. |
| Compose file | `docker-compose.1panel.yml` | It should define only the app and reuse external services. |
| Runtime env | `.env`, mode `600` | Never display or replace secret values. |
| Docker network | `1panel-network` | Reuse it; do not create a second database network. |
| PostgreSQL | `1Panel-postgresql-2LOJ` | Must be healthy before switching the app. |
| Redis | `1Panel-redis-pDR8` | Must be running before switching the app. |

The host has roughly 1.8 GiB RAM plus swap. Do not build the frontend, Go binary, or Docker multi-stage image there.

## Last successful release record

These values are historical evidence, not defaults for the next release:

- Branch: `feature/initial-alltokenapi-ui`
- Commit and deployment marker: `8180dddf27e925d69cf365caae6f8cccc72eeef9`
- Release marker: `8180dddf-v1`
- Runtime image ID: `sha256:855daccd5ad8a3ae5ec22bf794b4dc0b4102957c601d26ecb2e778e4d9030ae9`
- Preserved rollback image ID: `sha256:cf03f277a1c13ad27ad33b971ef3ba31e1aff3f6ce3f4fbec472eae60e9bea7c`
- Runtime `/new-api` SHA-256: `f8228896cacb4616046485b6a50a03cdee8883bc04eeee5bf845d90155336c04`

## Read-only baseline

Run these before a deployment without expanding `.env`:

```bash
cd /opt/new-api
printf 'commit='; cat .deploy-commit 2>/dev/null || true
printf 'release='; cat .deploy-release 2>/dev/null || true
docker ps --filter name='^/new-api$' --format '{{.Names}} {{.Status}} {{.Image}}'
docker inspect new-api --format 'image={{.Image}} status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} restarts={{.RestartCount}}'
docker inspect 1Panel-postgresql-2LOJ --format 'status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}'
docker inspect 1Panel-redis-pDR8 --format 'status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}'
docker image inspect new-api:local --format 'id={{.Id}} revision={{index .Config.Labels "org.opencontainers.image.revision"}}'
curl -fsS http://127.0.0.1:3000/api/status
```

Do not use `docker compose down`. Do not restart Docker as part of a normal release.
