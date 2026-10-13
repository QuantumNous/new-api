# Standalone Smart Router Design

## Scope

Build a standalone Go service and image with no NewAPI runtime, database, or
secret dependency. The only Host-facing values are provisional contract
messages and opaque binding IDs. The router owns source, group, model, price,
health, cooldown, fingerprint, decision, snapshot, and outcome state in its own
database.

## Architecture

`routerd` exposes strict JSON endpoints for route requests, attempt outcomes,
and signed snapshots. `probeworker` runs independent, fixture-driven connector
probes and writes sanitized health and fingerprint observations. The `store`
package is the persistence boundary; SQLite is executable, while MySQL and
Postgres are represented by explicit migrations and an honest local matrix
runner.

The `api` package owns the provisional wire types and validation. `catalog`
maps persisted state into routing candidates. `routing` applies eligibility,
cooldown, deterministic price-first ordering, bounded incumbent hysteresis,
five-binding limits, and retry/stop policy. `signing` signs canonical JSON with
HMAC-SHA256. Raw provider bodies and credentials never enter these boundaries.

## Routing Semantics

A candidate is eligible only when it is enabled, matches group/model/protocol,
is healthy enough to route, and has no active cooldown. Eligible candidates
are sorted by cost, health penalty, and opaque binding ID. An eligible prior
binding remains first only when its cost is within the configured hysteresis
window of the cheapest candidate. At most the request attempt limit and five
bindings are returned.

Attempt outcomes are idempotent by event ID. Reusing an event ID with different
content is a conflict. `auth_401`, `client_4xx`, `write_unknown`, and
`response_committed` stop. `rate_limited_429` retries only when attempts remain
and honors a valid `retry_after_ms` no greater than 24 hours; invalid values
fail closed. `upstream_5xx` and `transport_pre_write` retry only when attempts
remain. Cooldowns are persisted for 401, 429, and 5xx outcomes. A probe with no
cooldown cannot clear an active cooldown; only an accepted, idempotently
recorded success outcome resets failure and cooldown state.

Consumers verify signed route expiry against their injected clock before every
provider attempt, including attempts after a retry delay. Decision timestamps
retain millisecond compatibility while adding a nanosecond ordering column.
Existing rows are backfilled from milliseconds, and latest-decision selection
orders by nanoseconds and then request ID for deterministic ties.

## Isolation Boundaries

EBond, Hualong, and Leyi implement the same connector interface but normalize
their own typed synthetic fixture observations. A connector emits only status,
capabilities, latency, and a deterministic fingerprint. Connector drift is
reported per provider and cannot alter another provider's parser.

ModelTrace is an isolated state machine with explicit legal transitions and no
provider payload storage. ProtocolKit owns one immutable allowlist of exactly
36 approved model IDs and crosses it with exactly `chat`, `responses`, and
`messages`, producing 108 unique cells. Each cell is assigned one provider
deterministically; provider assignment is metadata and never adds or removes a
cell. Every cell executes its assigned connector and real protocol adapter,
including unary, stream, tool, usage, and error checks. A targeted fixture
mutation must make its selected cell fail while preserving all 108 identities.
ZCode emits only a dry-run manifest containing hashes and opaque route
metadata.

## API And Errors

The service implements the provisional `route_request`, `route_response`,
`signed_snapshot`, `attempt_outcome`, and `error` contracts with strict unknown
field rejection and field bounds. Contract errors use the provisional error
codes and stable HTTP mappings. Snapshot and route signatures are URL-safe
base64 without padding and cover canonical JSON with the signature omitted.

## Testing And Delivery

Every behavior starts with a failing test and an observed RED run before its
minimal implementation. Contract tests cover strict wire behavior. Integration
tests execute SQLite, HTTP Mock Host/Provider flows, snapshot signing, and
three repeated 108-cell matrices. Fault tests cover retry stops, cooldown,
expiry, Retry-After bounds, hysteresis, signature tampering, mutation
sensitivity, and outcome conflicts. Final verification includes full tests,
focused race tests, vet, builds, Dockerfile validation, database matrix
reporting, manifests, checksums, and a clean commit on `main`.
