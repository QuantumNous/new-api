# Smart Router Scoped Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden cooldown, expiry, Retry-After, decision ordering, and protocol conformance without changing the locked 36-model x 3-protocol = 108-cell contract.

**Architecture:** Keep policy at existing boundaries: API validation and routing own Retry-After, the store owns cooldown and migration behavior, the Mock Host enforces signed route expiry with its injected clock, and ProtocolKit owns a fixed model/protocol matrix that runs real connector and protocol adapter code. Provider assignment is deterministic metadata on a cell, not a matrix dimension.

**Tech Stack:** Go 1.23+, `database/sql`, embedded SQLite/MySQL/PostgreSQL migrations, strict JSON fixtures, synthetic HTTP providers.

---

## Task 1: Cooldown, Expiry, And Retry-After Policy

**Files:**

- Modify: `api/types.go`
- Modify: `api/types_test.go`
- Modify: `api/validate.go`
- Modify: `routing/routing.go`
- Modify: `routing/routing_test.go`
- Modify: `store/sqlite.go`
- Modify: `store/store_test.go`
- Modify: `tests/integration/http_test.go`
- Modify: `tests/integration/mocks/mocks.go`

- [ ] Add tests proving a zero-cooldown probe preserves an active cooldown and an accepted success clears it.
- [ ] Run `go test ./store -run 'TestZeroCooldownProbePreservesActiveCooldownUntilAcceptedSuccess' -count=1`; expect the probe assertion to fail.
- [ ] Change the cooldown upsert so zero preserves the current value; retain success-outcome reset in the transactional outcome path.
- [ ] Add API and routing tests for exact 24-hour acceptance and negative/over-limit fail-closed behavior.
- [ ] Run `go test ./api ./routing -run 'RetryAfter' -count=1`; expect over-limit cases to fail.
- [ ] Add `MaximumRetryAfterMS`, enforce it in validation and routing, and reject malformed provider headers.
- [ ] Add an integration test whose injected clock is exactly at route expiry and assert zero provider calls.
- [ ] Run `go test ./tests/integration -run 'Expiry|RetryAfter' -count=1`; expect expiry to fail before the Host check is implemented.
- [ ] Check expiry after signature verification and before provider invocation, using only `Clock.Now`.
- [ ] Run `go test ./api ./routing ./store ./tests/integration -count=1`; expect PASS.

## Task 2: Nanosecond Decision Migration And Ordering

**Files:**

- Modify: `migrations/sqlite/001_init.sql`
- Modify: `migrations/mysql/001_init.sql`
- Modify: `migrations/postgres/001_init.sql`
- Create: `migrations/sqlite/002_decision_nanoseconds.sql`
- Create: `migrations/mysql/002_decision_nanoseconds.sql`
- Create: `migrations/postgres/002_decision_nanoseconds.sql`
- Modify: `store/sqlite.go`
- Modify: `store/store_test.go`
- Modify: `tests/integration/db_matrix.sh`

- [ ] Add a legacy-SQLite test that opens an old millisecond-only schema, then asserts `decided_at_ns = created_at_ms * 1000000`.
- [ ] Add ordering tests for distinct nanoseconds within one millisecond and an exact-nanosecond request-ID tie.
- [ ] Run `go test ./store -run 'Decision.*Nanosecond|LegacyDecision' -count=1`; expect missing-column/order failures.
- [ ] Add tracked embedded migrations, dialect-specific backfill SQL, and the nanosecond/request-ID index.
- [ ] Persist `CreatedAt.UnixNano()` and order by `decided_at_ns DESC, request_id DESC`.
- [ ] Run `go test ./store -count=1` and `./tests/integration/db_matrix.sh`; expect SQLite PASS and opt-in databases PASS or explicit BLOCKED.

## Task 3: Locked 108-Cell Real-Adapter Conformance

**Files:**

- Modify: `protocolkit/protocolkit.go`
- Modify: `protocolkit/protocolkit_test.go`
- Create: `protocolkit/adapters.go`

- [ ] Replace the old phase/mode generator tests with assertions for exactly 36 distinct approved model IDs, exactly three protocols, and 108 unique model/protocol identities.
- [ ] Require every cell to execute one deterministic provider connector plus unary, stream, tool, usage, and error checks through its protocol adapter.
- [ ] Add a targeted usage-fixture mutation test that keeps 108 cells and makes exactly its selected cell fail.
- [ ] Run `go test ./protocolkit -count=1`; expect the old 4-protocol scenario model to fail the new assertions.
- [ ] Implement protocol-specific JSON/SSE adapters and deterministic provider fixture assignment.
- [ ] Run `go test ./protocolkit -count=1`, then `go test ./protocolkit -run TestConformanceMatrix -count=3`; expect 108/108 in every normal run and one deliberate failure in the mutation-sensitivity assertion.

## Task 4: Delivery Verification And Commit

**Files:**

- Modify: `README.md`
- Modify: `integration-required.yaml`
- Modify: `FINAL-MANIFEST.md`
- Modify: `SHA256SUMS`

- [ ] Document the cooldown reset authority, expiry check, 24-hour Retry-After bound, migration, exact matrix identity, and mutation proof.
- [ ] Run `gofmt` on changed Go files.
- [ ] Run `go test ./... -count=1`.
- [ ] Run `go test -race ./api ./routing ./signing ./store ./internal/catalog ./protocolkit ./tests/... -count=1`.
- [ ] Run `go vet ./...` and `go build ./...`.
- [ ] Run `./tests/integration/db_matrix.sh`.
- [ ] Run the 108-cell normal matrix three separate times and the mutation test once.
- [ ] Regenerate sorted SHA-256 checksums for every deliverable except `SHA256SUMS`, then verify with `shasum -a 256 -c SHA256SUMS`.
- [ ] Review `git diff --check`, `git status`, and the full diff.
- [ ] Commit the scoped hardening on `main` and verify the committed tree is clean.
