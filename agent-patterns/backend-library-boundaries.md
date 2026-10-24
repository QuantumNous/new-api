# Backend library boundaries

- Scope: backend handlers, database transactions and locks, Redis batching, passkeys, and Go tests
- Dependency refs: Gin `v1.9.1`, GORM `v1.25.2`, go-redis `v8.11.5`, WebAuthn `v0.14.0`, Testify `v1.11.1`
- Project evidence: `router/`, `controller/`, `model/`, `common/redis.go`, `pkg/cachex/`, `controller/passkey.go`, `service/passkey/`, and the backend test rules in `AGENTS.md`
- Upstream implementation: `repos/gin/context.go`, `repos/gorm/finisher_api.go`, `repos/gorm/clause/locking.go`, `repos/go-redis/pipeline.go`, `repos/webauthn/webauthn/registration.go`, `repos/webauthn/webauthn/login.go`, `repos/testify/assert/assertions.go`, `repos/testify/require/require.go`
- Upstream tests/examples: `repos/gin/context_test.go`, `repos/gin/binding/binding_test.go`, `repos/gorm/tests/transaction_test.go`, `repos/gorm/clause/locking_test.go`, `repos/go-redis/commands_test.go`, `repos/webauthn/webauthn/registration_test.go`, `repos/webauthn/webauthn/login_test.go`, `repos/testify/assert/assertions_test.go`, `repos/testify/require/requirements_test.go`

## Observed patterns

- Gin's `ShouldBind*` methods return validation/decoding errors without committing an HTTP response. `Bind*` delegates to `MustBindWith`, which aborts and writes status 400. Project handlers that own the API error envelope should use the non-writing path, handle the error once, and return immediately.
- GORM's callback-style `Transaction` commits only when the callback returns `nil`; callback errors and panics trigger rollback. Database work that must be atomic stays on the provided `tx`, and every operation's `.Error` remains part of the callback result.
- GORM expresses row locks with `clause.Locking`, and its clause tests verify emitted SQL. In this project the stable boundary is `model.lockForUpdate(tx)`, which adds that clause only on supported dialects. Callers must not reproduce the upstream clause directly because SQLite does not accept `FOR UPDATE`.
- go-redis pipelines queue commands and return the first command error from `Exec`. The upstream implementation explicitly distinguishes `Pipeline` from a transaction and warns that retries may execute a non-transactional batch more than once. Use context-aware calls, and choose transactional behavior only when the business invariant requires it.
- WebAuthn registration and login are two-phase flows. `Begin*` creates challenge-bound `SessionData`; `Finish*` validates the client response against that saved data and the user. Preserve the session between requests, enforce expiry, and do not reconstruct trusted challenge state from client input.
- Testify `require` is for setup or preconditions that make continuation invalid; `assert` is for independent value checks. This matches the project's backend testing rule and keeps failures readable without hiding additional useful comparisons.

## Project adaptation

- Project JSON decoding must continue through `common.*` wrappers even when upstream examples import `encoding/json` directly.
- GORM patterns must preserve SQLite, MySQL, and PostgreSQL behavior. Project dialect helpers and compatibility rules take precedence over upstream single-dialect examples.
- Redis and authentication failures must use existing project error/logging boundaries; do not expose raw upstream errors or credentials.
- Tests should assert the observable HTTP, persistence, cache, or authentication contract with deterministic inputs. Upstream tests are behavioral evidence, not fixtures to copy wholesale.

## Avoid

- Mixing `Bind*`'s automatic response with a second project error response.
- Starting a transaction and then accidentally querying through the global DB handle.
- Treating a Redis pipeline as exactly-once or atomic.
- Calling a WebAuthn finish method without server-stored session data from its matching begin call.
- Copying upstream JSON or SQL shortcuts that violate project wrappers or cross-database requirements.

## Verification

Run the narrow package tests for the changed boundary first, for example `go test ./controller/...`, `go test ./model/...`, `go test ./service/passkey/...`, or `go test ./pkg/cachex/...`, then widen to the affected backend packages. Database changes also require coverage of every supported dialect path or deterministic SQL-generation assertions where live databases are not part of the fixture.
