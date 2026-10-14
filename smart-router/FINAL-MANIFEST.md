# Smart Router Final Manifest

## Status

`DONE_WITH_CONCERNS`

The feature branch contains the standalone router and locally verified NewAPI
host interoperability. Task3 independent SPEC and QUALITY passed at
`7a29b11ae11b55158bb68a75c2a5affa4ad2f80c`. Task A2 merges pinned production
and adds scoped admission; its merged candidate requires fresh verification
and independent root SPEC then QUALITY acceptance. It is not a production
deployment or a full NewAPI executable build.

## Task A2 Scoped Admission

An ordinary merge retains the accepted feature and pinned production
`aafdd8f89c6f04cf8727f0832457a2733b009129` ancestries and content.
`NEWAPI_SMART_ROUTER_SCOPE=registry` admits exact group/model/client-protocol
tuples before filtering. Absent tuples remain permanently on the original
production selector through retries; registered unavailable tuples fail
closed without fallback. Empty/`all` preserves enabled-all admission, invalid
scope fails enabled startup, and disabled startup reads no other router
setting.

Registry scope preserves production managed ownership and source-diverse
retries whenever any eligible channel has an attached managed route, including
eligible channels outside the registry. Uncertain admitted ownership fails
closed. Signed plans cannot transfer ownership or reorder bindings. The actual
Do boundary rechecks enabled status, group/model eligibility and managed
ownership; changed or uncertain authority terminates without invocation or
retry. Runtime and request configuration remain immutable.

Developmental behavioral evidence is retained separately under
`/Users/bytedance/.local/share/modeltrace-evidence-20261014/host-integration/task-a2`.
The coherent compiled assertions against the unmodified merge implementations
produced 17 pass / 34 fail / 0 skip; minimal implementation produced
51 pass / 0 fail / 0 skip. Passing RED identities remain first-GREEN controls.
Earlier fixture setup failures are not behavioral RED. These runs had dirty
source and are not clean-candidate acceptance. The external
`modeltrace-evidence-host-integration-20261014/task-a2-implementation.md` report
identifies the final clean SHA, rebuilt fixture, fresh results and limitations.
No pre-merge counts below substitute for Task A2 acceptance.

## Scope

- Standalone Go router service and probe worker.
- Router-owned SQLite state with MySQL and PostgreSQL schema migrations.
- Strict provisional HTTP contracts using canonical opaque binding IDs.
- Deterministic routing, cooldown, signing, snapshot, and outcome behavior.
- Synthetic provider connectors, ModelTrace, ProtocolKit, and dry-run ZCode.
- No NewAPI runtime import or NewAPI private table access.
- Test-only independent `tests/hostfixture` executable and real Gin
  token/user/channel/provider E2E tests in `router/relay_smart_router_test.go`.

## Task3 Interoperability

The fixture constructs the existing API, catalog runtime and private SQLite
store. Six globally unique bindings cover chat, responses and messages with
matching plugins, one exact authorized group/model, and A/B prices 10/20.
The host verifies the actual signed snapshot. Healthy route and outcome paths
delegate to the production sidecar runtime; bounded read-only SQL inspection
checks persisted decisions, immutable outcome payload hashes and cooldowns.

Three healthy and three A429/B-success flows check real host billing and
next-request B selection while A cools down. Additional cases check terminal
401, a fully read POST followed by provider disconnect without a backup call,
expiry before invocation, and report failures after successful settlement.
Rejected, unknown-before-persistence and unknown-after-persistence outcomes
are distinct; only the latter delegates persistence before losing its
acknowledgement. Each report is one-shot, with no duplicate provider call,
charge or refund. Mutation gateways and clock offsets are fixture-only.

The process uses a dynamic literal-loopback listener, bounded bodies,
startup/lifetime/shutdown/reap and private database cleanup. The final test
must inject the task-owned compiled executable with zero skips.

Developmental E2E reached 13 pass / 0 fail / 0 skip. Earlier compiled failures
were fixture initialization and test `int`/`int64` equality errors, not host
behavior defects. They are not claimed as behavioral RED. The new cases are
first-GREEN interoperability controls after those test corrections.

Evidence is retained under
`/Users/bytedance/.local/share/modeltrace-evidence-20261014/host-integration/task3`.
Each run records exact argv/cwd/controlled environment, head, exit code,
raw-log SHA-256, fixture binary hash and before/after source hashes.

## Task3 Verification

The following pre-commit developmental runs used pinned offline Go 1.26.5,
`GOMAXPROCS=2`, `-p 2`, and `-count=1`. All reported unchanged source and
worktree hashes, but `clean_candidate=false` while Task3 files were uncommitted.
Counts include parent tests and subtests. Root fixed-candidate fresh-cache
acceptance remains a separate step after the six-file commit.

| Evidence directory | Command scope | Result |
| --- | --- | --- |
| `fixture-build` | Independent `./tests/hostfixture` build, fresh cache | exit 0 |
| `e2e-billing-type-corrected` | Actual injected fixture E2E | 13/0/0 |
| `host-regressions` | Full `go test ./router`, actual fixture | 907/0/0 |
| `affected-host-race` | SmartRouter and actual-model-pricing tests; router/client/service/helper/OpenAI, race | 557/0/0 |
| `sidecar-suite` | Independent `go test ./...` | 344/0/0 |
| `sidecar-race` | Independent `go test -race ./...` | 344/0/0 |
| `sidecar-vet` | Independent `go vet ./...` | exit 0 |
| `sidecar-build` | Independent `go build ./...` | exit 0 |

The sidecar tests use a one-literal Go overlay to relocate the inherited
ModelTrace `ownedTestRoot` into Task3-owned evidence temporary storage.
`overlay-provenance.json` records original, overlay and overlay-map SHA-256;
all assertions and the tracked original remain unchanged. Real Python bridge
parity tests execute with the existing pinned Python 3.14.7.

The task-owned fixture binary SHA-256 is
`697e36632d83cc5e24377e13fcb86d5696a2188dcef40d844c464bd24fa27db6`.
Final post-commit E2E and checksum audit records are retained as
`fixed-e2e/result.json` and `root-verification/task3-fixed-integrity/result.json`
in the same evidence root. These records, not this pre-commit table, identify
the exact frozen commit and cleanliness. No full NewAPI binary build is claimed.

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

## Inherited Verification

The following results describe the earlier standalone delivery, not Task3
fixed-candidate acceptance.

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

`integration-required.yaml` names implemented host hooks and the
`host-integrated-local-verified` scope. Provider credentials, provider bodies,
opaque binding resolution and channel authority stay in NewAPI; the sidecar
never reads host tables. README records actual host environment names/bounds,
synthetic registry and independent provisioning before host enablement.

## Artifact Integrity

`SHA256SUMS` contains sorted SHA-256 checksums for every deliverable file except
the checksum file itself. Runtime signing keys are not stored in this tree.

## Remaining Gaps

- MySQL migration execution requires `SMART_ROUTER_TEST_MYSQL=1` and an
  available local engine.
- PostgreSQL migration execution requires `SMART_ROUTER_TEST_POSTGRES=1` and an
  available local engine.
- Production deployment, real-provider verification and crash-durable
  exactly-once guarantees are not claimed.
- ModelTrace operator provisioning and independently deployed service plane
  remain pending; routing interoperability is not ModelTrace enablement.
- Pins, selected affinity, strict sessions, auto groups, App/task/plugin
  requests, recovery workers and eligible recovery parents, WebSocket,
  compact and nonstandard POST paths remain permanently excluded. Ordinary
  streaming has inherited guards; Task3 real-sidecar providers are unary.
- The pre-existing missing `web/dist/index.html` blocks a full NewAPI binary
  build; no generated frontend assets were fabricated for this task.
- Six inherited typed-nil reverse-stream panic cases and previously observed
  broad-suite SQLite contention are outside Task3's six-file write boundary.
  Existing tests and production sources are not changed to hide them.
