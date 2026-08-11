# Mao Async Same-Channel Retry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a mao async video task fails upstream, resubmit the same payload on the same channel up to 3 failures; show `retrying n/3`; skip retry for audit/balance errors; refund only on terminal failure.

**Architecture:** Persist upstream request JSON in `TaskPrivateData`; optional `TaskAsyncFailureResubmitter` type-assert in `updateVideoSingleTask` before refund; mao implements resubmit HTTP + non-retryable keyword checks.

**Tech Stack:** Go 1.22+, existing task polling (`service/task_polling.go`), `relay/channel/task/mao`, `model.TaskPrivateData`, `common.Marshal`/`Unmarshal`.

**Spec:** `docs/superpowers/specs/2026-08-11-mao-async-retry-design.md`

---

### Task 1: PrivateData fields + non-retryable helpers (TDD)

**Files:**
- Modify: `model/task.go` — extend `TaskPrivateData`
- Create: `relay/channel/task/mao/retry.go`
- Create: `relay/channel/task/mao/retry_test.go`

**Step 1: Extend TaskPrivateData**

```go
type TaskPrivateData struct {
	// ... existing fields ...
	RequestBody string `json:"request_body,omitempty"` // upstream create JSON for async resubmit
	RetryCount  int    `json:"retry_count,omitempty"`  // async failure count (0..3)
}
```

Constant in mao:

```go
const MaxAsyncRetries = 3
```

**Step 2: Write failing tests for `isNonRetryableFailReason`**

```go
func TestIsNonRetryableFailReason_Audit(t *testing.T) {
	if !isNonRetryableFailReason("content audit rejected") {
		t.Fatal("expected non-retryable")
	}
	if !isNonRetryableFailReason("审核不通过") {
		t.Fatal("expected non-retryable")
	}
}

func TestIsNonRetryableFailReason_Balance(t *testing.T) {
	if !isNonRetryableFailReason("余额不足") {
		t.Fatal("expected non-retryable")
	}
	if !isNonRetryableFailReason("insufficient quota") {
		t.Fatal("expected non-retryable")
	}
}

func TestIsNonRetryableFailReason_Retryable(t *testing.T) {
	if isNonRetryableFailReason("internal server error") {
		t.Fatal("should be retryable")
	}
}

func TestRetryProgressLabel(t *testing.T) {
	// after 1st failure, about to run attempt 2 → retrying 2/3
	if got := retryProgressLabel(1); got != "retrying 2/3" {
		t.Fatalf("got=%q", got)
	}
	if got := retryProgressLabel(2); got != "retrying 3/3" {
		t.Fatalf("got=%q", got)
	}
}

func TestShouldAttemptResubmit(t *testing.T) {
	if shouldAttemptResubmit("", 0, "oops") {
		t.Fatal("empty body")
	}
	if shouldAttemptResubmit(`{}`, 3, "oops") {
		t.Fatal("max retries")
	}
	if shouldAttemptResubmit(`{}`, 0, "audit failed") {
		t.Fatal("audit")
	}
	if !shouldAttemptResubmit(`{}`, 0, "timeout") {
		t.Fatal("should retry")
	}
}
```

**Step 3: Implement helpers in `retry.go`**

- Keyword lists per design §6 (no bare `billing`)
- `retryProgressLabel(failCount int) string` → `fmt.Sprintf("retrying %d/%d", failCount+1, MaxAsyncRetries)`
- `shouldAttemptResubmit(body string, retryCount int, reason string) bool` — body non-empty, retryCount < MaxAsyncRetries, !nonRetryable

**Step 4:** `go test ./relay/channel/task/mao/ -count=1 -run 'NonRetryable|RetryProgress|ShouldAttempt'`

**Step 5: Commit**

```bash
git add model/task.go relay/channel/task/mao/retry.go relay/channel/task/mao/retry_test.go
git commit -m "feat: mao async retry helpers and TaskPrivateData fields"
```

---

### Task 2: Persist upstream request body on create

**Files:**
- Modify: `relay/channel/task/mao/adaptor.go` — set gin context after building body
- Modify: `relay/relay_task.go` — optional: plumb body via result OR rely on context
- Modify: `controller/relay.go` — copy into `task.PrivateData.RequestBody` on insert

**Preferred plumbing (minimal):**

1. In mao `BuildRequestBody`, after `common.Marshal(payload)`:

```go
c.Set("task_upstream_request_body", string(data))
```

2. In `controller/relay.go` success insert block (~639):

```go
if v, ok := c.Get("task_upstream_request_body"); ok {
    if s, ok := v.(string); ok && s != "" {
        task.PrivateData.RequestBody = s
    }
}
```

Use a shared string constant key in `relay/common` or `taskcommon` to avoid magic strings, e.g. `taskcommon.GinKeyUpstreamRequestBody = "task_upstream_request_body"`.

**Verify:** unit test optional; manual: create task and check DB `private_data` contains `request_body`.

**Commit:**

```bash
git add relay/channel/task/mao/adaptor.go controller/relay.go relay/channel/task/taskcommon/
git commit -m "feat: persist mao upstream request body for async retry"
```

---

### Task 3: mao `TryResubmitOnFailure` implementation (TDD)

**Files:**
- Create/Modify: `relay/channel/task/mao/resubmit.go`
- Create: `relay/channel/task/mao/resubmit_test.go`
- Modify: `relay/channel/task/mao/adaptor.go` — method on `*TaskAdaptor`

**Method signature (must match service interface duck-typing):**

```go
func (a *TaskAdaptor) TryResubmitOnFailure(ctx context.Context, ch *model.Channel, task *model.Task, failReason string) (resubmitted bool, progress string, err error)
```

**Logic:**
1. If `!shouldAttemptResubmit(task.PrivateData.RequestBody, task.PrivateData.RetryCount, failReason)` → `(false, "", nil)`
2. `task.PrivateData.RetryCount++`
3. POST `apiOrigin(ch.GetBaseURL()) + createPath` with body `RequestBody`, `Authorization: Bearer` + key (`PrivateData.Key` if set else `ch.Key`), proxy from channel setting
4. On HTTP/parse failure: if `RetryCount >= MaxAsyncRetries` → `(false, "", nil)` (terminal); else could leave count bumped and return false — **per design: HTTP failure counts; if count < 3 still could try again next poll only if we leave status failure...** Simpler rule: if resubmit HTTP fails, return `(false, "", err)` OR `(false,"",nil)` so polling marks terminal failure **only if** RetryCount >= 3; if RetryCount < 3 after failed HTTP, still return false and let terminal fail — design says "重提 HTTP 失败也计一次失败；若因此达到 3 次则真失败". So: always increment first; if POST fails and RetryCount < 3, still return false → **would terminal-fail early**. 

**Clarify implementation to match design intent:**
- On POST failure with RetryCount < MaxAsyncRetries: keep task in progress with progress label, **do not** change UpstreamTaskID, return `(true, progress, nil)` so next poll retries again? That's odd without new id.
- Better: on POST failure, return `(false, "", nil)` always (terminal this round). Count already incremented. If count < 3, next... wait, task would be FAILURE and stop polling.

**Resolved rule for this plan:**
- Successful POST + new task_id → `(true, retryProgressLabel(RetryCount), nil)`; set Status=Queued, clear FailReason, FinishTime=0, update UpstreamTaskID
- Failed POST → `(false, "", nil)` → terminal FAILURE (count already includes this attempt). Accept slightly fewer than 3 upstream generation attempts if resubmit HTTP itself fails. Document in code comment.

**Tests:** use `httptest` for create endpoint returning `{"task_id":"new1"}`; assert UpstreamTaskID and RetryCount; audit reason returns false without HTTP.

**Commit:**

```bash
git add relay/channel/task/mao/
git commit -m "feat: mao TryResubmitOnFailure same-channel resubmit"
```

---

### Task 4: Wire polling short-circuit (no refund on resubmit)

**Files:**
- Modify: `service/task_polling.go`

**Step 1: Add interface near TaskPollingAdaptor**

```go
type TaskAsyncFailureResubmitter interface {
	TryResubmitOnFailure(ctx context.Context, ch *model.Channel, task *model.Task, failReason string) (resubmitted bool, progress string, err error)
}
```

**Step 2: In `updateVideoSingleTask`, `case model.TaskStatusFailure:`**

Before setting terminal failure / shouldRefund:

```go
case model.TaskStatusFailure:
    if r, ok := adaptor.(TaskAsyncFailureResubmitter); ok {
        okResubmit, progress, resubmitErr := r.TryResubmitOnFailure(ctx, ch, task, taskResult.Reason)
        if resubmitErr != nil {
            logger.LogError(ctx, fmt.Sprintf("Task %s resubmit error: %s", task.TaskID, resubmitErr.Error()))
        }
        if okResubmit {
            task.Status = model.TaskStatusQueued
            if progress != "" {
                task.Progress = progress
            } else {
                task.Progress = taskcommon.ProgressQueued
            }
            task.FailReason = ""
            task.FinishTime = 0
            // persist via UpdateWithStatus below; shouldRefund stays false
            break
        }
    }
    // existing failure handling...
```

Ensure `shouldRefund` is not set when resubmitted. Ensure CAS update still runs for non-terminal status change (`!snap.Equal`).

**Step 3:** Add focused unit test if existing polling tests exist; otherwise a small test with mock adaptor implementing the interface.

**Commit:**

```bash
git add service/task_polling.go
git commit -m "feat: short-circuit video poll refund when async resubmit succeeds"
```

---

### Task 5: Final verify

```bash
go test ./relay/channel/task/mao/ ./service/ ./model/ -count=1
go build -o NUL .
```

Manual (with key): force a transient upstream fail if possible; confirm progress `retrying 2/3` and same public task id.

**Commit** only if fixes needed.

---

## Execution notes

- Do not enable for other channels.
- Keep `common.Marshal`/`Unmarshal` for JSON.
- Do not log API keys or full prompt payloads in production logs beyond necessary IDs.
- Also keep prior open fix in mind if touching mao adaptor: prefer `UpstreamModelName` for logic model when model_mapping is used (optional small fix in same PR if touching BuildRequestBody — ask user if out of scope; default: include one-line prefer UpstreamModelName when non-empty, else OriginModelName, matching 7tai).

**Include UpstreamModelName preference fix in Task 2** (when editing adaptor.go BuildRequestBody):

```go
logic := strings.TrimSpace(info.UpstreamModelName)
if logic == "" {
    logic = strings.TrimSpace(info.OriginModelName)
}
```

So UI model mapping `doubao-seedance-2.0` → `guanzhuan-seedance2.0` works.
