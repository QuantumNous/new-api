# Scheduled Group IQ Tests

## 1. Scope / Trigger

Maintain this contract for IQ configuration, latest artwork, routing, scheduling,
and authenticated result APIs. IQ is a feature label, not a numeric benchmark.
The controller owns orchestration to avoid a service/controller import cycle.

## 2. Signatures

- Models: `IQConfig`, `IQBatch`, `IQAttempt`, `IQResult` in `model/iq_test_config.go`.
- `EnqueueIQBatch(scheduled bool, now time.Time)` snapshots configuration and
  deduplicates using `SystemTask.ActiveKey = "group_iq_test"`.
- `StartIQAttempt(taskID, pairID, runner, now)` durably claims before sending;
  `CompleteIQAttempt` verifies the lease and replaces the latest row.
- `NextIQRun(config, now, anchor)` calculates a strictly future UTC Unix second.
- Viewer: `GET /api/iq-tests/results`, `GET /api/iq-tests/results/:id`.
- Admin: `GET|PUT /api/iq-tests/config`, `GET /api/iq-tests/targets`,
  `POST /api/iq-tests/run`; use channel read/write/operate RBAC and PAT scopes.
- `testChannelWithIQ(..., options)` extends existing health-test conversion;
  `ExtractIQArtifact(text)` and `IQVisibleText(body, stream)` own extraction.

## 3. Contracts

- Default disabled/targetless. Exact prompt content, maximum 64 KiB UTF-8;
  maximum 100 concrete group/model pairs. Reject `auto` and incompatible targets.
- Complete config PUT includes the last `version`, prompt, targets, enabled,
  schedule_mode, interval_hours, daily_time and timezone. Calendar is explicitly
  Asia/Shanghai, never server-local time. Save recomputes the next slot;
  a manual run preserves recurring cadence. Skip backlog and overlapping slots.
- A batch has two workers, a three-minute pair deadline, a 16,384-token wire
  limit, one retry=0 group selector, and at most one non-replayable outbound POST
  per pair. Never enumerate channels, fail over, retry or replay started work.
- Propagate the deadline to the final HTTP request, clear `GetBody` and
  idempotency keys, and retain upstream redirects rather than following them.
- Set `ContextKeyUsingGroup` before relay-info generation. Use the root/system
  test identity and resource logs; never debit the viewing user's quota or
  modify channel health/test-time state. Do not log artifact bodies/credentials.
- Response limit 2 MiB; normalized artifact limit 1 MiB. Recognize complete
  direct/fenced HTML or SVG; prefer the whole HTML scene over nested SVG.
  Preserve inline scripts, not thinking/tool-only/file-link outputs. Extraction
  never fetches URLs or executes tools and is not a host-DOM script sanitizer.
- Latest results are keyed by SHA-256(group + NUL + model). Terminal failures
  also replace/remove old artwork. Cleanup touches only IQ artwork, not generic
  tasks/audits. Private snapshots/checkpoints retain operational metadata, not
  user-facing artwork history. Use MySQL MEDIUMTEXT, SQLite/PostgreSQL TEXT.
- Every data read requires authentication and current usable-group membership;
  administrators see configured groups. Protect direct artifact IDs identically.
  Return private/no-store JSON, never executable same-origin HTML. List/task
  payloads omit artifact bodies; timestamps are seconds except duration_ms.
- Eligible adapters are deliberately limited to known single-HTTP families.
  Codex may reject the enforced output cap; fail once, never relax it and retry.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Stale config version | 409, no write |
| Invalid prompt/targets/schedule | 400 |
| Anonymous / ordinary member admin action | 401 / 403 |
| Hidden, removed or unsuccessful artifact ID | Indistinguishable 404 |
| Duplicate manual enqueue | Existing active task, created=false |
| Provider failure / timeout / incomplete markup | Sanitized truthful terminal status |
| Lease loss / crashed started request | interrupted, never resend |
| Viewer reads results | No upstream call, quota change or channel mutation |

## 5. Good / Base / Bad Cases

- Good: three backing channels for one selected pair produce one IQ request.
- Base: old dated artwork stays visible until its replacement terminates.
- Bad: putting HTML in SystemTask.Result, exposing a public HTML URL, or using
  the public relay retry controller to implement a supposedly single attempt.

## 6. Tests Required

- `model/iq_config_test.go`: deterministic calendar/bounds, optimistic edits,
  duplicate enqueue/checkpoints, latest replacement, lease recovery and cadence.
- `controller/iq_tests_test.go`: mocked call counts, exact prompt, group routing,
  viewer/artifact denial, quota and health non-mutation, native request bounds.
- `service/iq_artifact_test.go`: full/fenced markup and final native text,
  incomplete/oversized output, preservation of active self-contained content.
- `router/iq_router_test.go`: all six anonymous denials and admin/member scopes.
- `relay/channel/iq_request_test.go`: deadline propagation and no redirect replay.
- SQLite test users need distinct nonempty `AffCode` values; initialize dialect
  column names and explicit model prices before invoking real model helpers.
  Do not mistake missing test bootstrap for a production behavior defect.

## 7. Wrong vs Correct

```go
// Wrong: a recoverable process error resends ambiguous upstream work.
for _, pair := range snapshot.Targets { callProvider(pair) }

// Correct: sending requires a durable, lease-checked pending -> running claim.
claimed, err := model.StartIQAttempt(taskID, pairID, runner, now)
if err == nil && claimed { /* issue exactly one bounded request */ }
```

Live MySQL/PostgreSQL concurrency and live provider compatibility are not proven
by SQLite/mock checks. Production provider verification requires separate cost
approval; deployment must never enable the schedule by default.
