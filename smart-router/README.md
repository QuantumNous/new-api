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
- `tests/hostfixture`: bounded, synthetic executable for real NewAPI host
  interoperability; not an operator service or production bootstrap.

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

[`integration-required.yaml`](integration-required.yaml) records locally
verified NewAPI hooks. `main.go` installs `service.ConfigureSmartRouter`;
`service/channel_select.go` selects the opaque binding, `controller/relay.go`
tracks attempts and one-shot outcomes, and `relay/channel/api_request.go`
revalidates authority and expiry immediately before sending upstream.

Host configuration is disabled by default:

| Variable | Default | Enabled-mode bound |
| --- | --- | --- |
| `NEWAPI_SMART_ROUTER_ENABLED` | `false` | Exact `true` enables; empty or `false` disables |
| `NEWAPI_SMART_ROUTER_SCOPE` | `all` | Empty or `all` admits supported tuples; `registry` admits exact registered tuples |
| `NEWAPI_SMART_ROUTER_URL` | required | `http://127.0.0.1:PORT` or `http://[::1]:PORT`; port 1-65535 |
| `NEWAPI_SMART_ROUTER_SIGNING_KEY` | required | At least 32 bytes; same key as sidecar |
| `NEWAPI_SMART_ROUTER_BINDINGS` | required | Strict JSON array, at most 1 MiB, 1-256 entries |
| `NEWAPI_SMART_ROUTER_TIMEOUT` | `2s` | Greater than zero and at most `10s` |
| `NEWAPI_SMART_ROUTER_ATTEMPT_LIMIT` | `2` | 1-5 attempts per logical request |

Only literal-loopback HTTP is supported by the host, with no proxy or
redirects. URLs cannot contain credentials, query, fragment or a path beyond
`/`. A container sidecar must share the host's loopback namespace or be
published to its literal loopback; the router's non-loopback listen opt-in
does not relax host validation.

This synthetic two-binding registry is a configuration example, not authority:

```json
[
  {"binding_id":"bnd_AAAAAAAAAAAAAAAAAAAAAAAA","channel_id":7301,"group":"default","model":"gpt-3.5-turbo","protocol":"chat","protocol_plugin":"chat-v1"},
  {"binding_id":"bnd_BBBBBBBBBBBBBBBBBBBBBBBB","channel_id":7302,"group":"default","model":"gpt-3.5-turbo","protocol":"chat","protocol_plugin":"chat-v1"}
]
```

Each binding ID is globally unique, channel IDs are positive, and at most five
bindings may share an exact group/model/protocol tuple. Supported pairs are
`chat`/`chat-v1`, `responses`/`responses-v1`, and `messages`/`messages-v1`.
Groups and models are nonempty and bounded to 128 and 256 bytes respectively.
The host still authenticates the token and checks its allowed group/model,
channel status, abilities, provider adaptor and effective model at route and
send boundaries. The registry cannot grant access or override those checks.
Credentials, upstream addresses and provider bodies remain host-only.

Use `NEWAPI_SMART_ROUTER_SCOPE=registry` for scoped initial enablement. Exact
group/model/client-protocol membership is decided before channel filtering.
An absent tuple remains permanently on the original production selector for
that request, including retries. A registered but unavailable tuple stays
admitted and fails closed without fallback. Invalid scope fails enabled
startup; disabled startup reads no other router setting.

Registry scope also preserves the original production selector and
source-diverse retries when any currently eligible channel is attached to a
managed route, including an eligible channel absent from the registry. Failed
ownership reads fail closed for admitted traffic. Once a signed plan exists,
it cannot transfer ownership or reorder its bindings. Immediately before the
actual provider call, disabled channels, lost group/model eligibility, newly
attached managed ownership or uncertain ownership are terminal. Runtime and
request configuration remain immutable; a later reload cannot change an
existing request's signed plan.

Provision and enable in this order:

1. Create host channels and their exact group/model abilities with normal host
   authority. Allocate canonical binding IDs and keep credentials in the host.
2. Independently provision the sidecar's private database through
   `store.OpenSQLite`, `UpsertSource`, `UpsertBinding`, and `SetObservation`.
   Supply matching group/model/protocol/plugin records and prices. `routerd`
   does not create a usable catalog from host tables or the host registry.
3. Start `cmd/routerd` with its private database and runtime signing key.
   Check liveness and signed snapshot readiness before allowing traffic.
4. Set the host variables above with `NEWAPI_SMART_ROUTER_SCOPE=registry`,
   the matching registry and key, then
   start the host with `NEWAPI_SMART_ROUTER_ENABLED=true`. Invalid enabled
   configuration fails startup; do not silently fall back to legacy routing.

Local E2E verification builds the independent fixture and injects it into the
real host tests. Run these commands from the repository root:

```bash
(cd smart-router && GOWORK=off go build -o /tmp/newapi-smart-router-hostfixture ./tests/hostfixture)
NEWAPI_SMART_ROUTER_TEST_FIXTURE=/tmp/newapi-smart-router-hostfixture \
  go test -count=1 ./router -run '^TestSmartRouterRealSidecarEndToEnd$'
```

The test-only key and all six A/B bindings are synthetic. The executable uses a
dynamic `127.0.0.1` port, private SQLite and bounded shutdown/reap; it must not
be deployed. Missing binary may skip a developer run, but acceptance requires
the compiled binary and zero skips. Verified cases include three healthy
protocols, persisted A429/B success and next-request cooldown, terminal 401,
fully-read POST disconnect, expiry before invocation, and rejected or unknown
report writes after successful settlement without duplicate provider calls,
charges or refunds. These are interoperability controls, not fabricated
behavioral RED/GREEN claims.

Channel pins, selected affinity, strict sessions, `auto` groups, App/task/plugin
requests, recovery workers and eligible recovery parents, WebSocket, compact
and nonstandard POST paths remain permanently outside this routing path.
Ordinary streaming is not categorically excluded; its completion and
commitment guards are covered by the inherited host regressions, while this
real-sidecar E2E uses unary synthetic providers. There is no
production deployment, real-provider verification or crash-durable
exactly-once claim. ModelTrace's independent runtime is separate from routing;
its operator provisioning, service plane and deployment remain pending.
