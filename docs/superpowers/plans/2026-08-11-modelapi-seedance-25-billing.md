# ModelAPI Seedance 2.5 Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `doubao-seedance-2-5-260628` reserve and settle the documented upstream price while preserving Flatkey's existing group, wallet, and subscription accounting.

**Architecture:** Keep the existing fixed-price asynchronous-task pipeline. The adaptor converts either request fields or the upstream `usage.estimated_usd` task snapshot into one `billable_units` multiplier over a `$0.14` base price; the relay layer remains responsible for group ratio, precharge, submit delta settlement, wallet funding, and subscription weighting.

**Tech Stack:** Go, Gin reusable request bodies, existing `TaskAdaptor` billing hooks, Go `testing`, GitNexus.

---

## File structure

- Create `relay/channel/task/modelapiseedance/billing_test.go` for reservation, validation, usage normalization, and correction behavior.
- Modify `relay/channel/task/modelapiseedance/constants.go` for provider prices and the single billing-unit key.
- Modify `relay/channel/task/modelapiseedance/adaptor.go` for the billing hooks and private submit snapshot.
- Create `setting/ratio_setting/modelapi_seedance_price_test.go` for the default-price regression.
- Modify `setting/ratio_setting/model_ratio.go` for the `$0.14` calculation base.
- Modify `relay/relay_task_billing_test.go` for group-ratio-preserving submit recalculation.

### Task 1: Implement adaptor reservation and submit correction

**Files:**
- Create: `relay/channel/task/modelapiseedance/billing_test.go`
- Modify: `relay/channel/task/modelapiseedance/constants.go`
- Modify: `relay/channel/task/modelapiseedance/adaptor.go`

- [ ] **Step 1: Write failing request-time reservation tests**

Use the existing `newModelAPITestContext` helper, call `ValidateRequestAndSetAction`, set `types.PriceData{UsePrice: true, ModelPrice: 0.14}`, and assert that `EstimateBilling` returns exactly one ratio named `billingUnitsKey`.

```go
tests := []struct {
	name      string
	body      string
	wantUnits float64
}{
	{"default 5s 720p", `{"model":"doubao-seedance-2-5-260628","content":[{"type":"text","text":"hello"}]}`, 0.314 * 5 / 0.14},
	{"text 480p", `{"model":"doubao-seedance-2-5-260628","content":[{"type":"text","text":"hello"}],"duration":8,"resolution":"480p"}`, 8},
	{"text 720p", `{"model":"doubao-seedance-2-5-260628","content":[{"type":"text","text":"hello"}],"duration":8,"resolution":"720p"}`, 0.314 * 8 / 0.14},
	{"video 480p fallback", `{"model":"doubao-seedance-2-5-260628","content":[{"type":"video_url","video_url":{"url":"https://example.com/input.mp4"}}],"resolution":"480p"}`, 0.084 * 30 / 0.14},
	{"video 720p fallback", `{"model":"doubao-seedance-2-5-260628","content":[{"type":"video_url","video_url":{"url":"https://example.com/input.mp4"}}],"resolution":"720p"}`, 0.188 * 30 / 0.14},
}
```

- [ ] **Step 2: Verify the reservation test is RED**

Run `go test ./relay/channel/task/modelapiseedance -run TestEstimateBillingUsesOfficialSeedanceRates -count=1`.

Expected: compile failure because `billingUnitsKey` and custom request billing do not exist.

- [ ] **Step 3: Write failing fixed-price validation tests**

Assert one valid fixed price passes. Assert `UsePrice=false`, zero, negative, `math.NaN()`, and `math.Inf(1)` each return `model_price_error` with HTTP 400.

```go
valid := &relaycommon.RelayInfo{PriceData: types.PriceData{UsePrice: true, ModelPrice: 0.14}}
if taskErr := (&TaskAdaptor{}).ValidateTaskPriceData(valid); taskErr != nil {
	t.Fatalf("valid price rejected: %+v", taskErr)
}
```

- [ ] **Step 4: Write failing response-snapshot tests**

Submit a response with `"usage":{"estimated_usd":1.57}`. Assert `DoResponse` succeeds, the public response contains neither `estimated_usd` nor the upstream task id, and `AdjustBillingOnSubmit` returns `1.57 / 0.14` billable units.

Table-test missing usage, `usage:null`, estimate `null`, zero, negative, string `"NaN"`, and overflowing `1e999`. Each must keep the task successful and return no submit adjustment. Also assert malformed private task data and invalid price data return no adjustment.

- [ ] **Step 5: Verify all new billing tests are RED**

Run `go test ./relay/channel/task/modelapiseedance -run 'TestEstimateBilling|TestValidateTaskPriceData|TestDoResponse.*Estimate|TestAdjustBillingOnSubmit' -count=1`.

Expected: compile failure for missing channel-specific billing methods and types.

- [ ] **Step 6: Add the exact provider constants**

```go
const (
	modelAPIBasePriceUSD             = 0.14
	modelAPINoVideo480PPerSecondUSD = 0.140
	modelAPINoVideo720PPerSecondUSD = 0.314
	modelAPIVideo480PPerSecondUSD   = 0.084
	modelAPIVideo720PPerSecondUSD   = 0.188
	modelAPIDefaultDurationSeconds  = 5
	modelAPIMaxDurationSeconds      = 30
	billingUnitsKey                 = "billable_units"
)
```

- [ ] **Step 7: Implement the minimal request-time hooks**

```go
func (a *TaskAdaptor) ValidateTaskPriceData(info *relaycommon.RelayInfo) *dto.TaskError {
	if info == nil || !info.PriceData.UsePrice || !isPositiveFinite(info.PriceData.ModelPrice) {
		return taskError(errors.New("a positive fixed model price is required"), "model_price_error", http.StatusBadRequest)
	}
	return nil
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	if info == nil || !info.PriceData.UsePrice || !isPositiveFinite(info.PriceData.ModelPrice) {
		return nil
	}
	req, err := taskcommon.GetSeedanceRequest(c)
	if err != nil {
		return nil
	}
	resolution := req.Resolution
	if resolution == "" {
		resolution = "720p"
	}
	estimatedUSD, ok := estimateModelAPIUSD(req, resolution)
	if !ok {
		return nil
	}
	return billingUnits(estimatedUSD, info.PriceData.ModelPrice)
}
```

`estimateModelAPIUSD` uses duration 5 when absent, uses the explicit request duration for no-video requests, and uses 30 seconds for both video-input fallbacks. Unsupported resolutions return `(0, false)`.

- [ ] **Step 8: Implement tolerant usage parsing and correction**

Use `json.RawMessage` in the upstream usage type so an optional string or overflowing number does not reject an otherwise valid task.

```go
type modelAPIUsage struct {
	EstimatedUSD json.RawMessage `json:"estimated_usd"`
}

type modelAPISubmitTaskData struct {
	Status       string   `json:"status,omitempty"`
	EstimatedUSD *float64 `json:"estimated_usd,omitempty"`
}

func normalizeEstimatedUSD(raw json.RawMessage) *float64 {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var value float64
	if err := common.Unmarshal(raw, &value); err != nil || !isPositiveFinite(value) {
		return nil
	}
	return &value
}

func billingUnits(estimatedUSD, modelPrice float64) map[string]float64 {
	if !isPositiveFinite(estimatedUSD) || !isPositiveFinite(modelPrice) {
		return nil
	}
	units := estimatedUSD / modelPrice
	if !isPositiveFinite(units) {
		return nil
	}
	return map[string]float64{billingUnitsKey: units}
}

func (a *TaskAdaptor) AdjustBillingOnSubmit(info *relaycommon.RelayInfo, taskData []byte) map[string]float64 {
	if info == nil || !info.PriceData.UsePrice || !isPositiveFinite(info.PriceData.ModelPrice) {
		return nil
	}
	var snapshot modelAPISubmitTaskData
	if err := common.Unmarshal(taskData, &snapshot); err != nil || snapshot.EstimatedUSD == nil {
		return nil
	}
	return billingUnits(*snapshot.EstimatedUSD, info.PriceData.ModelPrice)
}
```

Change `DoResponse` to marshal only `modelAPISubmitTaskData{Status: submit.Status, EstimatedUSD: normalized}` into private task data. Keep the public `OpenAIVideo` response unchanged.

- [ ] **Step 9: Verify Task 1 is GREEN**

Run:

```powershell
gofmt -w relay/channel/task/modelapiseedance/constants.go relay/channel/task/modelapiseedance/adaptor.go relay/channel/task/modelapiseedance/billing_test.go
go test ./relay/channel/task/modelapiseedance -count=1
```

Expected: all ModelAPI Seedance adaptor tests pass.

- [ ] **Step 10: Commit Task 1**

Use a Lore commit whose intent is `Make Seedance 2.5 reservations follow the upstream task snapshot`, recording the 30-second video fallback, rejection of media probing, focused test command, and live-API validation gap.

### Task 2: Register the base price and guard generic settlement

**Files:**
- Create: `setting/ratio_setting/modelapi_seedance_price_test.go`
- Modify: `setting/ratio_setting/model_ratio.go`
- Modify: `relay/relay_task_billing_test.go`

- [ ] **Step 1: Add and run the failing default-price test**

```go
func TestModelAPISeedanceDefaultPrice(t *testing.T) {
	if got := GetDefaultModelPriceMap()["doubao-seedance-2-5-260628"]; got != 0.14 {
		t.Fatalf("doubao-seedance-2-5-260628 default price = %v, want 0.14", got)
	}
}
```

Run `go test ./setting/ratio_setting -run TestModelAPISeedanceDefaultPrice -count=1`.

Expected: failure because the map lookup returns zero.

- [ ] **Step 2: Add the fixed-price calculation base**

Add this entry near the other video models in `defaultModelPrice`:

```go
// ModelAPI Seedance 2.5 calculation base; the adaptor converts each
// request/task snapshot into a complete billable_units multiplier.
"doubao-seedance-2-5-260628": 0.14,
```

- [ ] **Step 3: Add the group-ratio replacement regression test**

```go
func TestModelAPISeedanceSubmitAdjustmentPreservesGroupRatio(t *testing.T) {
	const modelPrice, groupRatio, reservedUSD, actualUSD = 0.14, 0.8, 0.314 * 5, 1.25
	reservedUnits := reservedUSD / modelPrice
	info := &relaycommon.RelayInfo{PriceData: types.PriceData{
		ModelPrice: modelPrice, UsePrice: true,
		Quota: int(modelPrice * common.QuotaPerUnit * groupRatio * reservedUnits),
		OtherRatios: map[string]float64{"billable_units": reservedUnits},
		GroupRatioInfo: types.GroupRatioInfo{GroupRatio: groupRatio},
	}}
	got := recalcQuotaFromRatios(info, map[string]float64{"billable_units": actualUSD / modelPrice})
	want := int(actualUSD * common.QuotaPerUnit * groupRatio)
	if got != want {
		t.Fatalf("recalcQuotaFromRatios() = %d, want %d", got, want)
	}
}
```

- [ ] **Step 4: Verify Task 2 is GREEN and existing funding paths remain authoritative**

Run:

```powershell
gofmt -w setting/ratio_setting/model_ratio.go setting/ratio_setting/modelapi_seedance_price_test.go relay/relay_task_billing_test.go
go test ./setting/ratio_setting -count=1
go test ./relay -run 'ModelAPISeedance|Billing' -count=1
go test ./controller -run 'TestAssetTaskWorkerAcceptedWinnerSettlesAndLogsOnce|TestAssetTaskWorkerAcceptedSubscriptionUsesSnapshotForSettlement' -count=1
```

Expected: the default-price and group-ratio tests pass; the existing wallet delta and subscription-weighted settlement guards also pass.

- [ ] **Step 5: Commit Task 2**

Use a Lore commit whose intent is `Give Seedance 2.5 a stable fixed-price billing base`, recording that synthetic model aliases were rejected, `$0.14` remains only the calculation base, and production balances were not exercised.

### Task 3: Review, verify, and publish

**Files:**
- Verify all Task 1 and Task 2 files.
- Remove the temporary untracked `.gitnexusignore`.

- [ ] **Step 1: Run a spec-compliance review, then a code-quality review, for each task commit**

Compare actual code against this plan and `docs/superpowers/specs/2026-08-11-modelapi-seedance-25-billing-design.md`. Resolve every Critical or Important finding and repeat the relevant review.

- [ ] **Step 2: Run full release verification**

```powershell
go test ./relay/channel/task/modelapiseedance -count=1
go test ./setting/ratio_setting -count=1
go test ./relay -run 'ModelAPISeedance|Billing' -count=1
go test ./controller -run 'TestAssetTaskWorkerAcceptedWinnerSettlesAndLogsOnce|TestAssetTaskWorkerAcceptedSubscriptionUsesSnapshotForSettlement' -count=1
go build ./...
git diff --check
```

Expected: every command exits zero and `git diff --check` prints nothing.

- [ ] **Step 3: Remove `.gitnexusignore` with `apply_patch` and run GitNexus**

```powershell
$node='C:\Users\11247\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$env:PATH='C:\Users\11247\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;'+$env:PATH
& $node 'C:\nvm4w\nodejs\node_modules\npm\bin\npx-cli.js' -y 'gitnexus@1.6.9' detect-changes --repo new-api-modelapi-seedance-worktree --scope compare --base-ref origin/main
```

Expected: the billing delta introduces no new critical dependency impact.

- [ ] **Step 4: Request final whole-feature review**

Review `origin/main..HEAD` for pricing correctness, optional JSON tolerance, privacy, duplicate settlement, quota rounding, and fixed-price failure behavior. Resolve every Critical or Important issue and re-review.

- [ ] **Step 5: Push and create the requested PR**

Push `feature/modelapi-seedance-25` and create a PR with `--base main`. The PR body must include the official documentation URL, all four price formulas, fallback rationale, private `estimated_usd` correction, existing Google-backed download behavior, deployment scope, verification evidence, and the live-environment gap.
