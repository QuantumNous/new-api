# Async Task Cross-Channel Failover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** For all async video tasks, on submit failure or polling-time upstream failure, retry same-channel up to N times then failover to the next ordered channel while keeping the same client `task_id`; bill by OriginModelName; refund only on terminal failure.

**Architecture:** Central orchestrator in `service/task_failover.go` decides audit-terminal / force-cross-channel / same-channel / next-channel. Submit path snapshots candidate channel IDs + client body; polling path calls orchestrator before refund. Optional `TaskModelChannelOrder` overrides Priority selection.

**Tech Stack:** Go 1.22+, Gin, existing `RelayTask` / `task_polling`, `TaskPrivateData`, `common.Marshal`/`Unmarshal`, default frontend (React 19 + RHF + Zod).

**Spec:** `docs/superpowers/specs/2026-08-12-async-task-cross-channel-failover-design.md`

---

### Task 1: Fail-reason classification + PrivateData fields (TDD)

**Files:**
- Modify: `model/task.go` — extend `TaskPrivateData`
- Create: `service/task_fail_reason.go`
- Create: `service/task_fail_reason_test.go`
- Modify: `relay/channel/task/mao/retry.go` — thin wrappers or delete duplicated keyword lists; call `service` helpers (avoid import cycles: if mao cannot import service, keep keywords only in `service` and have mao tests move / re-export via service)

**Import-cycle rule:** Prefer putting classification in `service/`. If `relay/channel/task/mao` already cannot import `service`, put helpers in a small package such as `relay/channel/task/taskcommon/fail_reason.go` and have both `service` and `mao` use it. Prefer `taskcommon` if cycle risk is high.

**Step 1: Extend TaskPrivateData**

```go
ClientRequestBody     string `json:"client_request_body,omitempty"`
TriedChannelIDs       []int  `json:"tried_channel_ids,omitempty"`
FailoverChannelIDs    []int  `json:"failover_channel_ids,omitempty"`
SameChannelMaxRetries int    `json:"same_channel_max_retries,omitempty"`
// RetryCount remains; document: per-current-channel same-channel failure count
```

**Step 2: Write failing tests**

- `ClassifyFailReason("审核不通过")` → `FailReasonAudit`
- `ClassifyFailReason("余额不足")` → `FailReasonUpstreamBalance`
- `ClassifyFailReason("timeout")` → `FailReasonRetryable`
- Balance keywords must NOT be treated as terminal-no-retry

**Step 3: Implement** keyword lists per design §7 (audit vs upstream-balance split).

**Step 4:** `go test` on the package that owns classification.

**Step 5: Commit**

```bash
git add model/task.go service/task_fail_reason.go service/task_fail_reason_test.go
# plus taskcommon/mao adjustments if any
git commit -m "feat: classify async task fail reasons for failover"
```

---

### Task 2: Settings — same-channel N, cross-channel switch, model channel order

**Files:**
- Modify: `common/constants.go` (or `setting/operation_setting/`) — defaults
- Modify: `model/option.go` — `InitOptionMap` + `updateOptionMap` cases
- Create: `setting/operation_setting/task_failover_setting.go` (recommended) with getters:
  - `GetTaskSameChannelMaxRetries() int` default `2`
  - `IsTaskCrossChannelFailoverEnabled() bool` default `true`
  - `GetTaskModelChannelOrder() map[string][]int` parse JSON option `TaskModelChannelOrder`

**Step 1: Register options** mirroring `RetryTimes` pattern in `model/option.go`.

**Step 2: Unit test** JSON parse of `TaskModelChannelOrder` (invalid JSON → empty map).

**Step 3: Commit**

```bash
git commit -m "feat: add task failover system options"
```

---

### Task 3: Ordered candidate channel resolution

**Files:**
- Create: `service/task_channel_order.go`
- Create: `service/task_channel_order_test.go`
- Modify (minimal): `service/channel_select.go` and/or call sites in `controller/relay.go` for task path only

**API (sketch):**

```go
// ResolveTaskFailoverChannelIDs returns ordered enabled channel IDs for group+model.
// If TaskModelChannelOrder[model] non-empty: that order (filter missing/disabled).
// Else: expand Ability channels sorted by Priority desc; same priority keep stable/weight order as list (for snapshot), not random.
func ResolveTaskFailoverChannelIDs(group, model string) []int

// PickTaskChannelByRetryIndex picks channels[retry] with clamp / skip tried.
func PickNextFailoverChannel(ordered []int, tried map[int]bool, afterChannelID int) (*model.Channel, bool)
```

**Step 1: Tests** — ordered override vs priority fallback; skip disabled; skip tried.

**Step 2: Implement** using existing cache (`group2model2channels` / `CacheGetChannel`) without breaking chat relay selection.

**Step 3: Commit**

```bash
git commit -m "feat: resolve ordered channel candidates for task failover"
```

---

### Task 4: Persist client body + failover snapshot on successful submit

**Files:**
- Modify: `controller/relay.go` — after successful `RelayTaskSubmit`, when building `model.InitTask`:
  - Read client body via `common.GetBodyStorage` / `KeyRequestBody` → `PrivateData.ClientRequestBody`
  - Existing upstream body via `GinKeyUpstreamRequestBody` → `RequestBody`
  - `FailoverChannelIDs = ResolveTaskFailoverChannelIDs(...)`
  - `SameChannelMaxRetries = GetTaskSameChannelMaxRetries()`
  - `TriedChannelIDs = []int{channel.Id}` (or append after first success)
- Modify: task adaptors that set `GinKeyUpstreamRequestBody` only for some channels — ensure **all** video task adaptors used in failover set upstream body on create (at least mao already does; add helper in `relay_task.go` after `BuildRequestBody` if missing)

**Preferred:** In `relay/relay_task.go` after successful build, if adaptor did not set gin key, buffer the built upstream body string into gin context so all channels get `RequestBody` without per-adaptor edits.

**Step 1: Implement persistence fields on insert.**

**Step 2: Manual/unit check** — task row JSON contains `client_request_body` and `failover_channel_ids`.

**Step 3: Commit**

```bash
git commit -m "feat: snapshot client body and failover channel list on task create"
```

---

### Task 5: Submit-phase selection uses ordered list when configured

**Files:**
- Modify: `controller/relay.go` — `RelayTask` loop / `getChannel` for task
- Possibly: `service/channel_select.go` — task-only branch: if model has order list, pick by retry index from ordered IDs instead of Priority ladder

**Behavior:**
- Keep `shouldRetryTaskRelay` unchanged
- Respect `specific_channel_id` / channel affinity skip-retry (no forced cross-channel)
- When order list present, `retry` indexes into that list; still bounded by `common.RetryTimes` (document: admins should set `RetryTimes` >= list length − 1, or extend task loop to `max(RetryTimes, len(order)-1)` — **implement: for task path, allow retries up to `len(candidates)-1` when order/priority candidates exist, without changing chat relay**)

**Step 1: Implement task-path candidate picking.**

**Step 2: Commit**

```bash
git commit -m "feat: use ordered channels on async task submit retry"
```

---

### Task 6: Orchestrator skeleton + wire polling (same-channel first)

**Files:**
- Create: `service/task_failover.go`
- Create: `service/task_failover_test.go`
- Modify: `service/task_polling.go` — replace direct `TaskAsyncFailureResubmitter` short-circuit with `HandleAsyncTaskFailure`
- Modify: `relay/channel/task/mao/resubmit.go` / `retry.go` — keep `TryResubmitOnFailure` for same-channel HTTP; orchestrator calls it when classification says same-channel

**Orchestrator logic (unit-testable without HTTP):**

```
if affinity/skip-retry → handled=false
if audit → handled=false
if !crossChannelEnabled && !canSameChannel → handled=false
if upstreamBalance → try cross-channel (skip same)
else if canSameChannel (adaptor implements resubmit && retry_count < max && body!="") → call TryResubmitOnFailure; on success handled=true, progress=retrying
else → try cross-channel
if cross fails / no next → handled=false
```

**Step 1: Table-driven tests** for decision matrix (audit / balance / same / cross disabled).

**Step 2: Wire polling `FAILURE` branch** to orchestrator; on `handled` set Queued + progress, no refund (same as current mao path).

**Step 3: Ensure existing mao resubmit tests still pass** (adjust if retry_count semantics / max now from PrivateData).

**Step 4: Commit**

```bash
git commit -m "feat: orchestrate async failure same-channel retry via failover service"
```

---

### Task 7: Cross-channel recreate from client_request_body

**Files:**
- Create: `service/task_failover_recreate.go` (or functions in `task_failover.go`)
- Modify: adaptors / relay helpers as needed to submit without a live gin request — **hardest part**

**Approach (required):**

1. Pick next channel from `FailoverChannelIDs` excluding `TriedChannelIDs` (if snapshot empty, resolve live list).
2. Build a minimal gin context (or internal submit helper) with:
   - client body from `ClientRequestBody`
   - channel setup via `middleware.SetupContextForSelectedChannel`
   - OriginModelName from `BillingContext.OriginModelName`
3. Run Convert + model_mapping + BuildRequestBody + DoRequest + DoResponse for **new** channel adaptor (reuse `relay.RelayTaskSubmit` pieces if possible; do **not** PreConsume again — billing already exists on task).
4. On success: update `task.ChannelId`, `UpstreamTaskID`, refresh `RequestBody`, reset `RetryCount=0`, append old id to `TriedChannelIDs`, Progress=`switching i/n`, Status=Queued.
5. On create failure: append tried, try next candidate in same poll tick (bounded loop) or leave failure for next poll — **prefer same tick loop until success or exhausted** to reduce user wait.

**Billing:** never call PreConsume/Refund inside recreate; terminal failure only via existing polling refund path.

**Step 1: Implement recreate helper with tests** using fake adaptor or httptest**Step 2: Integrate into orchestrator cross-channel branch.**

**Step 3: Commit**

```bash
git commit -m "feat: recreate failed async tasks on next failover channel"
```

---

### Task 8: Mao keyword / max-retry alignment

**Files:**
- Modify: `relay/channel/task/mao/retry.go`, `resubmit.go`, tests
- Remove balance-from-non-retryable (balance now force-cross via orchestrator)
- Use `task.PrivateData.SameChannelMaxRetries` when >0, else setting default; stop hardcoding only `MaxAsyncRetries=3` for the decision (may keep constant as fallback)

**Step 1: Update tests** — balance reason should allow orchestrator cross-channel; mao same-channel alone should not terminal on balance if cross enabled (orchestrator owns that).

**Step 2: Commit**

```bash
git commit -m "refactor: align mao async retry with shared failover classification"
```

---

### Task 9: Default frontend — system behavior toggles

**Files:**
- Modify: `web/default/src/features/system-settings/general/system-behavior-section.tsx` — add fields:
  - `TaskSameChannelMaxRetries` (number 0–10)
  - `TaskCrossChannelFailoverEnabled` (switch)
- Modify: settings load/registry so options appear in section props (see `section-registry.tsx` / operations registry pattern)
- i18n: `bun run i18n:sync` or add keys per project i18n skill if needed

**Step 1: Wire form + save via `useUpdateOption`.**

**Step 2:** `bun run typecheck` in `web/default`.

**Step 3: Commit**

```bash
git commit -m "feat(web): task failover toggles in system behavior settings"
```

---

### Task 10: Default frontend — model channel order editor

**Files:**
- Create: `web/default/src/features/system-settings/.../task-model-channel-order-section.tsx` (or under models settings)
- API: load channels that support selected model; drag-and-drop order; save JSON to `TaskModelChannelOrder`
- Reuse existing dnd / sortable patterns if any in codebase; otherwise simple up/down buttons to avoid new deps

**Step 1: UI to edit per-model ordered channel IDs.**

**Step 2: typecheck + i18n.**

**Step 3: Commit**

```bash
git commit -m "feat(web): ordered channel list editor for task failover"
```

---

### Task 11: Integration smoke + docs status

**Files:**
- Modify: design doc status → `实现中` / `已实现` when done
- Manual checklist:
  - [ ] Two channels same model name + mapping; kill first on submit → second used
  - [ ] Create succeeds on A; simulate poll failure retryable → same-channel then B
  - [ ] Audit failure → no switch, refund
  - [ ] Upstream balance on A → switch to B without same-channel loop
  - [ ] `task_id` stable; progress strings visible
  - [ ] Mid-failover no double charge; terminal refund once

**Step 1: Run** `go test ./service/ ./relay/channel/task/mao/ ./controller/ -count=1` (narrow packages as needed).

**Step 2: Commit** any doc/test fixes.

```bash
git commit -m "test: cover async task cross-channel failover paths"
```

---

## Execution notes

- Prefer small commits per task; do not push unless asked.
- Use `common.Marshal` / `Unmarshal` for JSON (never raw `encoding/json` marshal in business code).
- Respect channel affinity / `specific_channel_id` / local 400 — no cross-channel.
- Multipart video uploads: `ClientRequestBody` may be insufficient; document limitation — JSON body tasks are primary; for multipart, store may need raw bytes or skip cross-channel if `ClientRequestBody` empty (same-channel only). Call this out in recreate: if `ClientRequestBody == ""`, cross-channel returns handled=false unless a future enhancement stores multipart.

## Risk order

Implement Tasks 1→6 before 7 (recreate is the riskiest). Ship same-channel orchestration + settings first if recreate needs a follow-up PR; design requires both, so Task 7 remains in scope for full feature.
