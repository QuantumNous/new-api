# Separated frontend/backend delivery

This directory packages the recommended same-origin split:

1. **Backend image** (`Dockerfile.backend` at repo root) — Go binary built with `-tags frontend_external`, no Bun, no embedded `web/*/dist`.
2. **Frontend image** (`Dockerfile.frontend` here) — builds only `web/default`, serves static files on non-root port 8080, reverse-proxies API/Relay/SSE/WebSocket to the backend.

The monorepo and the default embedded Docker image remain fully supported.

## Why same-origin

Prefer:

```text
browser  -->  frontend Nginx (:8080)
                 |-- /assets, SPA
                 +-- /api /v1 /v1beta /mj /pg /suno /kling /jimeng /healthz /livez /readyz  --> backend (:3000)
```

Benefits:

- Session cookies stay first-party (no extra CORS credential surface).
- CSRF and OAuth callback hosts stay on a single public origin.
- SSE and WebSocket upgrade stay on the same host the SPA already uses.

Cross-origin `FRONTEND_MODE=redirect` is supported by the backend for multi-host layouts, but expands Cookie/CORS/OAuth risk and is not the default recommendation.

## Build

From the authoritative repository root (`D:\newapi\src`, never `_qn_tmp`):

```bash
# Pure backend (no frontend dist required)
docker build -f Dockerfile.backend -t new-api-backend:local .

# Default SPA frontend + Nginx proxy
docker build -f deploy/separated/Dockerfile.frontend -t new-api-frontend:local .

# Or compose
docker compose -f deploy/separated/docker-compose.yml build
```

Local Go equivalent:

```bash
go build -trimpath -buildvcs=true -tags frontend_external -o new-api-backend .
FRONTEND_MODE=disabled ./new-api-backend
```

## Runtime configuration

| Variable | Component | Notes |
|---|---|---|
| `FRONTEND_MODE` | backend | `disabled` (pure API) or `redirect` (jump unknown pages to another origin). Backend image defaults to `disabled`. |
| `FRONTEND_BASE_URL` | backend | Required for `redirect`; must be an absolute HTTP(S) origin with no path/query/userinfo. |
| `BACKEND_UPSTREAM` | frontend | Nginx upstream host:port, default `backend:3000`. Resolved at request time. |
| `DNS_RESOLVER` | frontend | Resolver for deferred upstream DNS; default Docker DNS `127.0.0.11`. |
| `NGINX_PORT` | frontend | Listen port inside container, default `8080`. |
| `TRUSTED_PROXY_CIDRS` | backend | Must include the frontend/proxy network so client IPs from `X-Forwarded-For` are trusted. |
| `SESSION_COOKIE_SECURE` / `SESSION_COOKIE_TRUSTED_URL` | backend | Configure for HTTPS production entries. |

Do **not** publish `/metrics` on the public frontend edge. Scrape metrics on the backend network with `METRICS_TOKEN`.

## Nginx coverage

Proxied with original path + query preserved:

- `/api`, `/v1`, `/v1beta`, `/mj`, `/:mode/mj`, `/pg`, `/suno`, `/kling`, `/jimeng`
- `/healthz`, `/livez`, `/readyz`
- `/v1/realtime` WebSocket (`Upgrade` / `Connection`)
- Streaming endpoints (`proxy_buffering off`, long read/send timeouts)

Local SPA health: `GET /frontend-healthz`.

SPA rules:

- `try_files` → `index.html`
- `/assets/*` long-cache immutable
- `index.html` `Cache-Control: no-cache`

## Validate Nginx config

Inside a running frontend container (or a one-shot build):

```bash
docker run --rm --entrypoint /bin/sh new-api-frontend:local -c 'nginx -t -c /etc/nginx/nginx.conf'
# or after entrypoint substitution during start
```

The entrypoint always runs `nginx -t` before `daemon off`.

Quality CI pulls `nginxinc/nginx-unprivileged:1.27-alpine`, resolves its registry digest, and builds with
`--build-arg NGINX_IMAGE=<repo@sha256:...>`. Local builds may still use the tag default; prefer the CI-resolved
digest when freezing a production frontend image.

## Makefile shortcuts

From repository root:

```bash
make build-backend      # go build -tags frontend_external
make docker-backend     # Dockerfile.backend
make docker-frontend    # deploy/separated/Dockerfile.frontend
make docker-separated   # backend + frontend images
```

## Compose smoke checklist

Automated:

```bash
# bash
FRONTEND_BASE=http://127.0.0.1:8080 ./deploy/separated/smoke.sh

# Windows PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\separated\smoke.ps1
```

Manual extras:

1. Confirm SSE is not buffered (chat stream).
2. Confirm WebSocket upgrade works for `/v1/realtime`.
3. Confirm `/metrics` remains 404 on the public edge.

## Rollback

- Configuration-only: point traffic back to the monolithic image (`Dockerfile`) or a single binary with default embedded assets and unset/override `FRONTEND_MODE`.
- Image-only: redeploy the previous integrated `new-api` image; database migrations remain additive.

See also:

- `docs/operations/runtime-separation.md`
- `docs/operations/build-and-release.md`
- `docs/adr/0001-frontend-backend-delivery-seam.md`
