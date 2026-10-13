# Standalone Smart Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an independent, buildable smart-router service and image that implements the provisional contracts and owns all routing state.

**Architecture:** Strict API types feed a catalog backed by an independent SQL store. A deterministic routing engine selects opaque bindings, signing authenticates snapshots, and isolated connectors update sanitized probe state.

**Tech Stack:** Go 1.23+, standard HTTP/JSON/crypto packages, `database/sql`, pure-Go SQLite, SQL migrations, Docker.

---

## File Map

- `api/`: provisional wire structs, strict decoding, validation, and handlers.
- `config/`: environment/flag-safe runtime configuration.
- `internal/catalog/`: persisted records to eligible routing candidates.
- `connectors/`, `fingerprint/`: isolated synthetic provider normalization.
- `metrics/`: in-process counters and Prometheus text rendering.
- `routing/`: deterministic ranking, hysteresis, retry, and cooldown policy.
- `signing/`: canonical HMAC signatures and verification.
- `store/`, `migrations/`: independent state persistence and SQL ownership.
- `modeltrace/`: isolated trace state machine.
- `protocolkit/`: generated 36x3 conformance matrix.
- `zcode/`: dry-run-only manifest generation.
- `cmd/routerd`, `cmd/probeworker`: runnable binaries.
- `tests/contract`, `tests/integration`, `tests/fault`: external behavior tests.

### Task 1: Bootstrap And Contract Types

**Files:**
- Create: `go.mod`
- Create: `api/types_test.go`
- Create: `api/types.go`
- Create: `api/validate.go`

- [ ] Write tests that construct every provisional message and reject invalid protocol, bounds, and missing required values.
- [ ] Run `go test ./api`; expect RED because the API package does not exist.
- [ ] Add the smallest wire structs, constants, and validators that satisfy the tests.
- [ ] Run `go test ./api`; expect PASS.
- [ ] Refactor common validation without changing assertions.

### Task 2: Signing And Routing Policy

**Files:**
- Create: `signing/signing_test.go`
- Create: `signing/signing.go`
- Create: `routing/routing_test.go`
- Create: `routing/routing.go`
- Create: `tests/fault/policy_test.go`

- [ ] Write tests for deterministic signatures, tamper rejection, eligibility, cost ordering, five-binding bounds, hysteresis, all outcomes, and cooldown duration.
- [ ] Run `go test ./signing ./routing ./tests/fault`; expect RED for missing implementations.
- [ ] Implement canonical HMAC signing and the minimum deterministic policy.
- [ ] Run the focused tests; expect PASS, then refactor comparators and policy tables.

### Task 3: Independent Store And Migrations

**Files:**
- Create: `migrations/migrations.go`
- Create: `migrations/sqlite/001_init.sql`
- Create: `migrations/mysql/001_init.sql`
- Create: `migrations/postgres/001_init.sql`
- Create: `store/store_test.go`
- Create: `store/store.go`
- Create: `store/sqlite.go`
- Create: `tests/integration/db_matrix.sh`

- [ ] Write SQLite tests proving migration tables, owned state, opaque binding lookup, decisions, cooldowns, snapshots, and idempotent/conflicting outcomes.
- [ ] Run `go test ./store`; expect RED.
- [ ] Add embedded migrations and the minimal SQLite implementation.
- [ ] Run store tests; expect PASS and a real SQLite database.
- [ ] Add dialect-specific SQL and a runner that prints `BLOCKED` when MySQL/Postgres clients or DSNs are absent.

### Task 4: Catalog, Connectors, And Fingerprints

**Files:**
- Create: `internal/catalog/catalog_test.go`
- Create: `internal/catalog/catalog.go`
- Create: `connectors/connectors_test.go`
- Create: `connectors/connectors.go`
- Create: `connectors/fixtures.go`
- Create: `fingerprint/fingerprint_test.go`
- Create: `fingerprint/fingerprint.go`

- [ ] Write tests for catalog eligibility and per-provider fixture normalization/drift isolation.
- [ ] Run focused tests; expect RED.
- [ ] Implement typed observations, provider-local normalization, and body-free deterministic fingerprints.
- [ ] Run focused tests; expect PASS and refactor duplicated fixture validation.

### Task 5: ModelTrace, ProtocolKit, And ZCode

**Files:**
- Create: `modeltrace/modeltrace_test.go`
- Create: `modeltrace/modeltrace.go`
- Create: `protocolkit/protocolkit_test.go`
- Create: `protocolkit/protocolkit.go`
- Create: `zcode/zcode_test.go`
- Create: `zcode/zcode.go`

- [ ] Write tests for legal trace transitions, exactly 36 scenarios and 108 provider cells, stable repetitions, and dry-run-only hashed manifests.
- [ ] Run focused tests; expect RED.
- [ ] Implement the minimum state machine, matrix generator/evaluator, and manifest builder.
- [ ] Run focused tests; expect PASS, including three in-test matrix repetitions.

### Task 6: HTTP Service, Commands, Mocks, And Metrics

**Files:**
- Create: `metrics/metrics_test.go`
- Create: `metrics/metrics.go`
- Create: `api/server_test.go`
- Create: `api/server.go`
- Create: `config/config_test.go`
- Create: `config/config.go`
- Create: `cmd/routerd/main.go`
- Create: `cmd/probeworker/main.go`
- Create: `tests/integration/mocks/mocks.go`
- Create: `tests/integration/http_test.go`

- [ ] Write tests for strict HTTP contracts, signed routes/snapshots, outcomes, metrics, safe configuration, and Mock Host/Provider flow.
- [ ] Run focused tests; expect RED.
- [ ] Implement handlers and commands using only opaque bindings and sanitized probe state.
- [ ] Run focused and full tests; expect PASS, then refactor handler error mapping.

### Task 7: Delivery Artifacts And Verification

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `README.md`
- Create: `integration-required.yaml`
- Create: `FINAL-MANIFEST.md`
- Create: `SHA256SUMS`

- [ ] Document operation, API, data ownership, security boundaries, migrations, and the future Host hooks only.
- [ ] Run the generated 108-cell matrix three separate times and record exact results.
- [ ] Run `go test ./...`, high-risk `go test -race`, `go vet ./...`, and builds for both commands.
- [ ] Run `tests/integration/db_matrix.sh`; record SQLite PASS and real MySQL/Postgres PASS or `BLOCKED`.
- [ ] Self-review contract coverage, secret absence, generated artifacts, and `git diff`.
- [ ] Generate deterministic checksums, commit all work on `main`, and verify the committed tree.
