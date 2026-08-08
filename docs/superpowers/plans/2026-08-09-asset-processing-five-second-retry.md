# Asset Processing Five-Second Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `upstream_processing` asset-readiness retries run every five seconds while preserving longer upstream `Retry-After` values and the existing progressive backoff for all other retryable errors.

**Architecture:** Keep the existing readiness worker, lease flow, attempt counter, generation window, and persistence transitions unchanged. Make the retry-delay selector aware of the materialization error class so only `AssetMaterializeErrorProcessing` selects the first five-second interval on every attempt; the existing schedule remains the default for every other class.

**Tech Stack:** Go, GORM-backed readiness worker tests, `testify/require`

---

### Task 1: Lock Processing Retry Timing With a Regression Test

**Files:**
- Modify: `service/asset_model_worker_test.go`

- [ ] **Step 1: Write the failing integration test**

Add this test next to the existing retry-schedule test:

```go
func TestAssetModelWorkerRetriesUpstreamProcessingEveryFiveSeconds(t *testing.T) {
	newAssetModelWorkerTestDB(t)
	installAssetServiceTestDeps(t)
	materializer := &scriptedAssetModelMaterializer{create: []scriptedAssetModelCreate{
		{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorProcessing}},
		{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorProcessing}},
		{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorProcessing, RetryAfter: 45 * time.Second}},
		{err: &AssetMaterializeFailure{Class: AssetMaterializeErrorProcessing}},
		{result: AssetMaterializeResult{UpstreamAssetID: "upstream-active", Status: model.AssetStatusActive}},
	}}
	registerAssetMaterializerForTest(t, constant.ChannelTypeTechMobiVideo, materializer)
	asset, scope, target := seedAssetModelWorkerReadiness(t, "ast_worker_processing_retry", "techmobi-key-a")

	for _, step := range []struct {
		now      int64
		wantNext int64
	}{
		{now: 100, wantNext: 105},
		{now: 105, wantNext: 110},
		{now: 110, wantNext: 155},
		{now: 155, wantNext: 160},
	} {
		processed, err := runAssetModelReadinessBatchAt(t, "node-a", step.now)
		require.NoError(t, err)
		require.Equal(t, 1, processed)

		row := requireAssetModelReadinessRow(t, asset.Id, scope, target.ModelName)
		require.Equal(t, model.AssetModelReadinessStatusRetryWaiting, row.Status)
		require.Equal(t, AssetMaterializeErrorProcessing, row.ErrorClass)
		require.Equal(t, step.wantNext, row.NextRetryAt)
	}

	processed, err := runAssetModelReadinessBatchAt(t, "node-a", 160)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	row := requireAssetModelReadinessRow(t, asset.Id, scope, target.ModelName)
	require.Equal(t, model.AssetModelReadinessStatusActive, row.Status)
	require.EqualValues(t, 5, atomic.LoadInt64(&materializer.createCalls))
}
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
go test ./service -run '^TestAssetModelWorkerRetriesUpstreamProcessingEveryFiveSeconds$' -count=1
```

Expected: FAIL on the second retry because the current progressive schedule writes `NextRetryAt == 120` instead of `110`.

- [ ] **Step 3: Commit the failing regression test**

Stage `service/asset_model_worker_test.go` and commit with the repository's Lore trailers, recording that the test was observed failing for the expected `120 != 110` reason.

### Task 2: Select a Fixed Delay for Processing Only

**Files:**
- Modify: `service/asset_model_worker.go:592-663`

- [ ] **Step 1: Pass the error class into delay selection**

Update the scheduler call:

```go
delay := assetModelRetryDelay(class, row.AttemptCount, retryAfter)
```

- [ ] **Step 2: Implement the minimal class-aware delay selector**

Replace the helper with:

```go
func assetModelRetryDelay(class string, attemptCount int, retryAfter time.Duration) time.Duration {
	delay := assetModelRetrySchedule[0]
	if class != AssetMaterializeErrorProcessing {
		if attemptCount <= 0 {
			attemptCount = 1
		}
		index := attemptCount - 1
		if index >= len(assetModelRetrySchedule) {
			index = len(assetModelRetrySchedule) - 1
		}
		delay = assetModelRetrySchedule[index]
	}
	if retryAfter > delay {
		return retryAfter
	}
	return delay
}
```

- [ ] **Step 3: Run the new test and verify GREEN**

Run:

```powershell
go test ./service -run '^TestAssetModelWorkerRetriesUpstreamProcessingEveryFiveSeconds$' -count=1
```

Expected: PASS. The stored `next_retry_at` values are `105`, `110`, `155`, and `160`, proving both the fixed interval and the longer `Retry-After` override.

- [ ] **Step 4: Run neighboring retry regressions**

Run:

```powershell
go test ./service -run 'TestAssetModelWorkerRetriesTransientScheduleAndPublishesActiveOnlyWhenExact|TestAssetModelRetryAfterOverridesScheduleAndPreservesAttemptAcrossBatches|TestAssetModelWorkerRetriesUpstreamProcessingEveryFiveSeconds' -count=1
```

Expected: PASS. Non-processing errors still use `5s`, `15s`, `30s`, and longer upstream retry instructions still win.

- [ ] **Step 5: Commit the implementation**

Stage `service/asset_model_worker.go` and commit with Lore trailers describing the narrow behavior change and the focused tests run.

### Task 3: Verify the Worker Change

**Files:**
- Verify: `service/asset_model_worker.go`
- Verify: `service/asset_model_worker_test.go`

- [ ] **Step 1: Format changed Go files**

Run:

```powershell
gofmt -w service/asset_model_worker.go service/asset_model_worker_test.go
```

- [ ] **Step 2: Run all asset-model worker tests**

Run:

```powershell
go test ./service -run 'TestAssetModel' -count=1
```

Expected: PASS.

- [ ] **Step 3: Run the service package tests**

Run:

```powershell
go test ./service -count=1
```

Expected: PASS.

- [ ] **Step 4: Run build and static checks**

Run:

```powershell
go build ./...
go vet ./service
git diff --check
```

Expected: all commands exit successfully with no diff whitespace errors.

- [ ] **Step 5: Review the final diff and repository state**

Run:

```powershell
git diff origin/main...HEAD -- service/asset_model_worker.go service/asset_model_worker_test.go
git status --short --branch
```

Expected: only the planned retry selection and regression coverage are present; no database schema or migration files changed.
