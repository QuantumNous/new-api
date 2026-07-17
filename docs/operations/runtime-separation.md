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

## Split Deployment

1. Run one `RUN_MODE=migrate` job before updating application instances.
2. Run at least one `RUN_MODE=scheduler` process with `NODE_TYPE=master`.
3. Run at least one `RUN_MODE=worker` process with `NODE_TYPE=master`.
4. Run Relay instances with `RUN_MODE=serve`, `APP_PLANE=relay`.
5. Run management instances with `RUN_MODE=serve`, `APP_PLANE=management`.

Relay and management instances may use `NODE_TYPE=slave` after the migration job succeeds. Worker and scheduler processes must not use `NODE_TYPE=slave` because task execution is master-only.

Rollback is configuration-only: restore both variables to `all` and start the previous single process. Database migrations add compatible columns/indexes and do not require destructive rollback.

## Metrics

Set `METRICS_ENABLED=true` to expose `/metrics`. Set `METRICS_TOKEN` and scrape with `Authorization: Bearer <token>`. If no token is configured, restrict the endpoint at the network layer.
