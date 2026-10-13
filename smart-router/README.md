# Standalone Smart Router

`smart-router` is an independent Go service for deterministic, price-first
routing. It has its own database and never reads NewAPI tables. Its HTTP
contract exposes opaque binding IDs, not provider endpoints or credentials.

## Components

- `cmd/routerd`: strict HTTP API, signed routes and snapshots, SQLite state.
- `cmd/probeworker`: typed, synthetic EBond/Hualong/Leyi probe fixtures.
- `api`: provisional request, response, outcome, snapshot, and error contracts.
- `routing`: eligibility, price ordering, hysteresis, retry, and cooldown rules.
- `store`: router-owned state and executable SQLite persistence.
- `connectors`, `fingerprint`, `modeltrace`: isolated provider observations.
- `protocolkit`: deterministic 36-approved-model by 3-protocol conformance
  matrix with real connector and protocol adapter paths.
- `zcode`: dry-run manifest generation only.

## Run

Go 1.23 or newer is required.

```bash
export SMART_ROUTER_SIGNING_KEY="$(openssl rand -base64 32)"
go run ./cmd/routerd
```

The default listener is `127.0.0.1:8080` and the default database is
`smart-router.db`. The signing key is required, must contain at least 32 bytes,
is held only in memory, and is excluded from public configuration hashes.

Configuration:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SMART_ROUTER_SIGNING_KEY` | required | HMAC-SHA256 signing key |
| `SMART_ROUTER_LISTEN` | `127.0.0.1:8080` | HTTP listener |
| `SMART_ROUTER_DATABASE` | `smart-router.db` | Router-owned SQLite file |
| `SMART_ROUTER_SNAPSHOT_TTL` | `5m` | Signed snapshot lifetime |
| `SMART_ROUTER_HYSTERESIS_MICROUNITS` | `0` | Incumbent cost window |
| `SMART_ROUTER_ALLOW_NON_LOOPBACK` | `false` | Explicit container listen opt-in |

The image sets the non-loopback opt-in because container port publishing
requires `0.0.0.0:8080`. Supply the signing key at runtime:

```bash
docker build -t standalone-smart-router .
docker run --rm -p 127.0.0.1:8080:8080 \
  -e SMART_ROUTER_SIGNING_KEY \
  -v smart-router-data:/data \
  standalone-smart-router
```

## HTTP API

- `POST /v1/route`: accepts `route_request`, returns a signed `route_response`.
- `POST /v1/outcomes`: records an idempotent `attempt_outcome`; returns `204`.
- `GET /v1/snapshot`: returns the current `signed_snapshot`.
- `GET /healthz`: liveness response.
- `GET /metrics`: Prometheus text counters.

JSON decoding rejects unknown fields and multiple values. Request bodies are
limited to 1 MiB. Route selection excludes disabled, unhealthy, or cooling
bindings, sorts by cost then health then opaque ID, applies bounded incumbent
hysteresis, and returns no more than five bindings.

Canonical binding IDs are `bnd_` followed by exactly 24 base64url characters.
API and persistence boundaries reject provider names, endpoints, and every
other noncanonical binding ID.

Outcome policy:

- `auth_401`, `client_4xx`, `write_unknown`, and `response_committed` stop.
- `rate_limited_429` retries only within the attempt budget and honors
  a valid `retry_after_ms` up to and including 24 hours. Negative, malformed,
  and over-limit values fail closed.
- `upstream_5xx` and `transport_pre_write` retry only within the attempt budget.
- 401, 429, and 5xx breaker state is persisted. Probe observations cannot
  overwrite status, consecutive failures, or cooldown. Only a newly accepted
  success outcome resets them.

Hosts verify the signed route response and reject it when the injected clock is
at or beyond `expires_at` before every provider attempt, including after a
`Retry-After` delay.

## State And Provisioning

The router owns `sources`, `route_groups`, `models`, `bindings`, `prices`,
`health_state`, `cooldowns`, `fingerprints`, `decisions`, `outcomes`, and
`snapshots`. Bootstrap tooling must use the `store` package to provision source
and binding records before serving traffic. No NewAPI schema is imported or
queried.

Migrations are tracked by filename. Migration `002_decision_nanoseconds.sql`
adds `decided_at_ns`, backfills legacy rows from `created_at_ms`, and orders
latest decisions by `decided_at_ns DESC, request_id DESC`.

`probeworker` updates an existing opaque binding with a sanitized synthetic
observation:

```bash
go run ./cmd/probeworker \
  -database smart-router.db \
  -binding bnd_AAAAAAAAAAAAAAAAAAAAAAAA \
  -provider ebond
```

The connector API accepts typed fixtures only. It does not accept browser
sessions, provider credentials, prompts, or provider response bodies.

## Verification

```bash
go test ./...
go test -race ./api ./routing ./signing ./store ./internal/catalog ./tests/...
go vet ./...
go build ./cmd/routerd ./cmd/probeworker
go test ./protocolkit -run 'TestConformanceMatrixIsExactlyThirtySixModelsByThreeProtocols|TestConformanceMatrixIsStableAcrossThreeRuns' -count=3
go test ./protocolkit -run TestConformanceMutationCausesSelectedCellFailure -count=1
./tests/integration/db_matrix.sh
```

The normal matrix is always exactly 36 approved model IDs crossed with
`chat`, `responses`, and `messages`: 108 unique cells. EBond, Hualong, and Leyi
are assigned deterministically and do not change the count. Every cell runs
unary, stream, tool, usage, and error checks; the mutation test proves a
corrupted fixture fails its selected cell.

The database runner always executes SQLite. MySQL and PostgreSQL are attempted
only with explicit `SMART_ROUTER_TEST_MYSQL=1` or
`SMART_ROUTER_TEST_POSTGRES=1`; unavailable local engines are reported as
`BLOCKED`, never as passing.

## Integration Boundary

[`integration-required.yaml`](integration-required.yaml) describes future Host
hooks. The Host remains responsible for resolving opaque binding IDs to its own
credential material and for enforcing terminal retry outcomes. The router does
not connect to the Host database or return upstream connection details.
