# Runtime Separation

The default remains a single compatible process:

```text
RUN_MODE=all
APP_PLANE=all
```

`RUN_MODE` controls process responsibility:

| Mode | HTTP | Claims tasks | Creates scheduled tasks | Exits after migration |
|---|---:|---:|---:|---:|
| `all` | yes | yes | yes | no |
| `serve` | yes | no | no | no |
| `worker` | no | yes | no | no |
| `scheduler` | no | no | yes | no |
| `migrate` | no | no | no | yes |

`APP_PLANE` controls the routes exposed by an HTTP process:

| Plane | Routes |
|---|---|
| `all` | Relay, management API and web UI |
| `relay` | Relay/video routes and `/healthz` only |
| `management` | Management API, dashboard and web UI |

## Frontend delivery (`FRONTEND_MODE`)

Independent of `RUN_MODE` / `APP_PLANE`, the HTTP process can deliver the console in four modes:

| Mode | Behavior |
|---|---|
| `auto` (default) | Compatible legacy behavior: slave nodes with `FRONTEND_BASE_URL` redirect; master embeds assets when available |
| `embedded` | Always register embedded dual-theme static assets (fails fast if the binary was built with `frontend_external`) |
| `redirect` | Always 301 non-API pages to `FRONTEND_BASE_URL` (including master). URL must be an absolute HTTP(S) origin without credentials, path, query, or fragment |
| `disabled` | Pure API process: no web `NoRoute`, unknown paths return Gin 404 |

Build tags:

| Tag | Result |
|---|---|
| *(default / no tag)* | `frontend_assets_embedded.go` embeds `web/default/dist` and `web/classic/dist` |
| `frontend_external` | `frontend_assets_external.go` returns empty assets; pair with `FRONTEND_MODE=disabled` or `redirect` |

Recommended same-origin split (frontend Nginx proxies backend):

```text
browser --> frontend container (:8080)
              |-- SPA + /assets
              +-- /api /v1 /v1beta /mj /:mode/mj /pg /suno /kling /jimeng
                  /healthz /livez /readyz --> backend (:3000, FRONTEND_MODE=disabled)
```

See `deploy/separated/README.md` and ADR `docs/adr/0001-frontend-backend-delivery-seam.md`.

## Split Deployment (process roles)

1. Run one `RUN_MODE=migrate` job before updating application instances.
2. Run at least one `RUN_MODE=scheduler` process with `NODE_TYPE=master`.
3. Run at least one `RUN_MODE=worker` process with `NODE_TYPE=master`.
4. Run Relay instances with `RUN_MODE=serve`, `APP_PLANE=relay`.
5. Run management instances with `RUN_MODE=serve`, `APP_PLANE=management`.

Relay and management instances may use `NODE_TYPE=slave` after the migration job succeeds. Worker and scheduler processes must not use `NODE_TYPE=slave` because task execution is master-only.

When management HTTP is pure backend (`FRONTEND_MODE=disabled`), put the SPA on a same-origin reverse proxy rather than expanding public CORS unless a multi-origin layout is intentionally accepted.

## Metrics

Set `METRICS_ENABLED=true` to expose `/metrics`. Set `METRICS_TOKEN` and scrape with `Authorization: Bearer <token>`. If no token is configured, restrict the endpoint at the network layer. The separated frontend edge deliberately returns 404 for `/metrics` so metrics stay off the public console origin.

## Rollback

- Process roles: restore `RUN_MODE=all` and `APP_PLANE=all` and start the previous single process.
- Frontend delivery: restore the integrated image/binary (default embed build) and leave `FRONTEND_MODE` unset/`auto`.
- Database migrations add compatible columns/indexes and do not require destructive rollback.
