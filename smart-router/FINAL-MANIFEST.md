# Smart Router Final Manifest

## Status

`DONE_WITH_CONCERNS`

The standalone smart-router implementation is complete and verified on `main`.
The remaining concerns are limited to integrations that require external
systems or explicit opt-in.

## Scope

- Standalone Go router service and probe worker.
- Router-owned SQLite state with MySQL and PostgreSQL schema migrations.
- Strict provisional HTTP contracts using canonical opaque binding IDs.
- Deterministic routing, cooldown, signing, snapshot, and outcome behavior.
- Synthetic provider connectors, ModelTrace, ProtocolKit, and dry-run ZCode.
- No NewAPI runtime import or NewAPI private table access.

## Post-`da17ffc` Gap Closure

- API and persistence boundaries accept only `bnd_` plus 24 base64url
  characters. Provider names and URLs are rejected before persistence or HTTP
  serialization.
- The integration Mock Host uses an injectable clock/sleeper and completes the
  full `Retry-After` delay before attempting the next provider.

## Scoped Hardening

- Probe observations cannot overwrite breaker status, consecutive failures, or
  cooldown. Accepted 401, 429, and 5xx outcomes advance breaker state; only a
  newly accepted success outcome resets it.
- The Mock Host rejects signed route responses at the injected clock expiry
  boundary before every provider attempt, including after `Retry-After`.
- `retry_after_ms` is capped at 86,400,000 milliseconds. Negative, malformed,
  and over-limit values fail closed.
- Tracked `002_decision_nanoseconds.sql` migrations backfill
  `decided_at_ns = created_at_ms * 1000000`. Latest decisions order by
  nanoseconds and then request ID.
- ProtocolKit is locked to 36 approved model IDs crossed with `chat`,
  `responses`, and `messages`: 108 unique cells. Every cell executes its
  deterministic provider connector and unary, stream, tool, usage, and error
  adapter checks. Provider assignment does not alter the cell count.
- A targeted usage-fixture mutation preserves all 108 identities and causes
  exactly its selected cell to fail.

## Verification

| Check | Result |
| --- | --- |
| `gofmt` | PASS |
| `go test ./...` | PASS |
| Focused `go test -race` | PASS |
| `go vet ./...` | PASS |
| `go build ./...` | PASS |
| Provider name/URL persistence and response RED/GREEN tests | PASS |
| Mock Host `Retry-After` attempt-order RED/GREEN test | PASS |
| Probe breaker persistence RED/GREEN test | PASS (second 5xx = 60s backoff) |
| 36-model x 3-protocol matrix, run 1 | PASS (108/108) |
| 36-model x 3-protocol matrix, run 2 | PASS (108/108) |
| 36-model x 3-protocol matrix, run 3 | PASS (108/108) |
| Targeted conformance mutation | PASS (exactly 1 selected cell failed) |
| Legacy `decided_at_ns` backfill and repeat-open migration | PASS |
| SQLite migration matrix | PASS |
| MySQL migration matrix | BLOCKED (explicit opt-in not provided) |
| PostgreSQL migration matrix | BLOCKED (explicit opt-in not provided) |
| `github.com/QuantumNous/new-api` dependency/import audit | PASS (absent) |
| SQL table ownership audit | PASS (router-owned tables only) |

Focused race coverage:

```text
./api ./routing ./signing ./store ./internal/catalog ./protocolkit ./tests/...
```

## Integration Boundary

`integration-required.yaml` is the handoff contract for future Host
integration. Provider credentials, provider response bodies, opaque binding
resolution, and Host database ownership remain outside this repository.

## Artifact Integrity

`SHA256SUMS` contains sorted SHA-256 checksums for every deliverable file except
the checksum file itself. Runtime signing keys are not stored in this tree.

## Remaining Gaps

- MySQL migration execution requires `SMART_ROUTER_TEST_MYSQL=1` and an
  available local engine.
- PostgreSQL migration execution requires `SMART_ROUTER_TEST_POSTGRES=1` and an
  available local engine.
- Host hooks remain intentionally unimplemented and are listed in
  `integration-required.yaml`.
