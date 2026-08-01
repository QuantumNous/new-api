# BytePlus Seedance Token Billing Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the misleading fixed-per-call Seedance regression contract with token-settled coverage, restore the three production models to `ModelRatio`, and publish a corrective PR without changing generic runtime billing behavior.

**Architecture:** Keep PR #618's BytePlus public-model scenario table and `EstimateBilling` override. NewAPI's existing task path already selects `ModelRatio` when no `ModelPrice` exists and settles successful tasks from `total_tokens`; this change locks that behavior with submission and settlement tests, then corrects production settings in a preserve-all-other-entries sequence. No schema, billing-expression, or production Go logic change is required.

**Tech Stack:** Go 1.22+, Gin, GORM/SQLite test harness, NewAPI option APIs, Cloud Run read-only inspection, Git/GitHub CLI.

---

## File Structure

- Modify `relay/relay_task_billing_test.go`: replace the fixed-`ModelPrice` contract with a three-model `ModelRatio` submission/pre-consumption contract.
- Modify `service/task_billing_test.go`: add an end-to-end task-settlement regression proving `total_tokens`, `ModelRatio`, `GroupRatio`, and BytePlus `video_input` ratio are multiplied.
- Keep `relay/channel/task/byteplus/adaptor.go`, `relay/channel/task/byteplus/constants.go`, `relay/relay_task.go`, and `service/task_billing.go` unchanged; they already implement the approved behavior.
- Use production `ModelPrice` and `ModelRatio` option values only as runtime configuration; do not add Seedance defaults to repository code.

Because no production source behavior is being added, the new tests are characterization/contract corrections and are expected to pass against the existing generic token-settlement implementation. Do not manufacture a Seedance-specific runtime branch merely to create a red/green cycle; the TDD constraint remains satisfied because no production code is written without a failing test.

### Task 1: Correct the Relay Submission Billing Contract

**Files:**
- Modify: `relay/relay_task_billing_test.go:16-105`
- Test: `relay/relay_task_billing_test.go`

- [ ] **Step 1: Capture the incorrect baseline contract**

Run:

```powershell
go test ./relay -run TestBytePlusFixedModelPricesApplyTierRatios -count=1 -v
```

Expected: PASS, demonstrating that the merged regression test currently encodes `ModelPrice` and `UsePrice=true`.

- [ ] **Step 2: Replace the fixed-price test with the token-ratio contract**

Replace the existing test function with:

```go
func TestBytePlusModelRatiosApplyTierRatios(t *testing.T) {
	originalPrices := ratio_setting.ModelPrice2JSONString()
	originalRatios := ratio_setting.ModelRatio2JSONString()
	originalGroups := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() {
		if err := ratio_setting.UpdateModelPriceByJSONString(originalPrices); err != nil {
			t.Errorf("restore model prices: %v", err)
		}
		if err := ratio_setting.UpdateModelRatioByJSONString(originalRatios); err != nil {
			t.Errorf("restore model ratios: %v", err)
		}
		if err := ratio_setting.UpdateGroupRatioByJSONString(originalGroups); err != nil {
			t.Errorf("restore group ratios: %v", err)
		}
	})

	if err := ratio_setting.UpdateModelPriceByJSONString(`{}`); err != nil {
		t.Fatalf("clear model prices: %v", err)
	}
	if err := ratio_setting.UpdateModelRatioByJSONString(`{
		"seedance-2.0": 0.391,
		"seedance-2.0-fast": 0.3145,
		"seedance-2.0-mini": 0.1955
	}`); err != nil {
		t.Fatalf("configure model ratios: %v", err)
	}
	if err := ratio_setting.UpdateGroupRatioByJSONString(`{"default":1}`); err != nil {
		t.Fatalf("configure group ratio: %v", err)
	}

	tests := []struct {
		model         string
		modelRatio    float64
		wantBaseQuota int
		wantTierQuota int
	}{
		{model: "seedance-2.0", modelRatio: 0.391, wantBaseQuota: 97750, wantTierQuota: 59500},
		{model: "seedance-2.0-fast", modelRatio: 0.3145, wantBaseQuota: 78625, wantTierQuota: 46750},
		{model: "seedance-2.0-mini", modelRatio: 0.1955, wantBaseQuota: 48875, wantTierQuota: 29750},
	}

	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(
				`{"model":"`+tt.model+`","resolution":"720p","content":[`+
					`{"type":"text","text":"hello"},`+
					`{"type":"video_url","video_url":{"url":"https://example.com/input.mp4"}}]}`,
			))
			c.Request.Header.Set("Content-Type", "application/json")

			info := &relaycommon.RelayInfo{
				OriginModelName: tt.model,
				UserGroup:       "default",
				UsingGroup:      "default",
				ChannelMeta: &relaycommon.ChannelMeta{
					UpstreamModelName: "ep-private-endpoint",
				},
				TaskRelayInfo: &relaycommon.TaskRelayInfo{},
			}
			adaptor := &byteplus.TaskAdaptor{}
			if taskErr := adaptor.ValidateRequestAndSetAction(c, info); taskErr != nil {
				t.Fatalf("validate request: %+v", taskErr)
			}

			priceData, err := helper.ModelPriceHelperPerCall(c, info)
			if err != nil {
				t.Fatalf("calculate token model ratio: %v", err)
			}
			if priceData.UsePrice {
				t.Fatal("UsePrice = true, want token-based billing")
			}
			if priceData.ModelPrice != -1 {
				t.Fatalf("model price = %v, want -1", priceData.ModelPrice)
			}
			if priceData.ModelRatio != tt.modelRatio {
				t.Fatalf("model ratio = %v, want %v", priceData.ModelRatio, tt.modelRatio)
			}
			if priceData.Quota != tt.wantBaseQuota {
				t.Fatalf("base quota = %d, want %d", priceData.Quota, tt.wantBaseQuota)
			}

			for name, ratio := range adaptor.EstimateBilling(c, info) {
				priceData.AddOtherRatio(name, ratio)
			}
			applyTaskOtherRatios(&priceData)
			if priceData.Quota != tt.wantTierQuota {
				t.Fatalf("tier quota = %d, want %d", priceData.Quota, tt.wantTierQuota)
			}
		})
	}
}
```

- [ ] **Step 3: Format and run the corrected contract test**

Run:

```powershell
gofmt -w relay/relay_task_billing_test.go
go test ./relay -run TestBytePlusModelRatiosApplyTierRatios -count=1 -v
```

Expected: PASS for all three subtests, with `UsePrice=false` and the exact base/tier quotas shown above.

- [ ] **Step 4: Commit the relay contract correction**

```powershell
git add -- relay/relay_task_billing_test.go
git commit -m "Keep Seedance submission on token-ratio billing" -m "Constraint: Seedance must use ModelRatio so completion can reconcile total_tokens
Rejected: Fixed ModelPrice regression coverage | it encodes the configuration that bypasses token settlement
Confidence: high
Scope-risk: narrow
Directive: Do not add the three public Seedance models to ModelPrice
Tested: go test ./relay -run TestBytePlusModelRatiosApplyTierRatios -count=1 -v
Not-tested: production settings"
```

### Task 2: Lock the Completion Settlement Formula

**Files:**
- Modify: `service/task_billing_test.go` after `TestSettle_PerCallBilling_SkipsTotalTokens`
- Test: `service/task_billing_test.go`

- [ ] **Step 1: Add a non-per-call Seedance settlement regression**

Add this test:

```go
func TestSettle_NonPerCallSeedance_UsesTotalTokensAndScenarioRatio(t *testing.T) {
	truncate(t)
	restoreRatioSettings(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 33, 33, 33
	const initQuota, preConsumed = 10000, 100
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-seedance-token-settle", tokenRemain)
	seedChannel(t, channelID)

	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"seedance-2.0":0.391}`))

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.Properties.OriginModelName = "seedance-2.0"
	task.PrivateData.BillingContext = &model.TaskBillingContext{
		ModelPrice:      -1,
		ModelRatio:      0.391,
		GroupRatio:      1,
		OtherRatios:     map[string]float64{"video_input": 28.0 / 46.0},
		OriginModelName: "seedance-2.0",
		PerCallBilling:  false,
	}

	adaptor := &mockAdaptor{adjustReturn: 0}
	taskResult := &relaycommon.TaskInfo{
		Status:      model.TaskStatusSuccess,
		TotalTokens: 1000,
	}

	settleTaskBillingOnComplete(ctx, adaptor, task, taskResult)

	const actualQuota = 238
	const quotaDelta = actualQuota - preConsumed
	assert.Equal(t, actualQuota, task.Quota)
	assert.Equal(t, initQuota-quotaDelta, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain-quotaDelta, getTokenRemainQuota(t, tokenID))

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeConsume, log.Type)
	assert.Equal(t, quotaDelta, log.Quota)
}
```

- [ ] **Step 2: Format and run the settlement regression**

Run:

```powershell
gofmt -w service/task_billing_test.go
go test ./service -run TestSettle_NonPerCallSeedance_UsesTotalTokensAndScenarioRatio -count=1 -v
```

Expected: PASS with `actualQuota=238`, which is `1000 * 0.391 * 1 * (28/46)` after integer conversion.

- [ ] **Step 3: Run the paired per-call/non-per-call boundary tests**

Run:

```powershell
go test ./service -run 'TestSettle_(PerCallBilling_SkipsTotalTokens|NonPerCallSeedance_UsesTotalTokensAndScenarioRatio)' -count=1 -v
```

Expected: both tests PASS, proving the billing mode flag is the boundary that controls `total_tokens` settlement.

- [ ] **Step 4: Commit the settlement regression**

```powershell
git add -- service/task_billing_test.go
git commit -m "Prove Seedance completion settles reported tokens" -m "Constraint: Final Seedance quota must multiply total_tokens by model, group, and scenario ratios
Rejected: Pre-consumption-only coverage | it cannot prove completion difference settlement
Confidence: high
Scope-risk: narrow
Directive: Keep PerCallBilling false for ModelRatio-configured Seedance tasks
Tested: targeted per-call and non-per-call settlement tests
Not-tested: live upstream task completion"
```

### Task 3: Verify and Review the Branch

**Files:**
- Verify: `relay/relay_task_billing_test.go`
- Verify: `service/task_billing_test.go`
- Verify: `docs/superpowers/specs/2026-07-31-byteplus-seedance-tiered-billing-design.md`

- [ ] **Step 1: Run targeted affected-package tests**

```powershell
go test ./relay/channel/task/byteplus ./relay/channel/task/doubao -count=1
go test ./relay -run TestBytePlusModelRatiosApplyTierRatios -count=1
go test ./service -run 'TestSettle_(PerCallBilling_SkipsTotalTokens|NonPerCallSeedance_UsesTotalTokensAndScenarioRatio)' -count=1
```

Expected: all commands exit 0.

- [ ] **Step 2: Run repository-required package and build checks**

```powershell
go test ./relay/...
go test ./service/...
go build ./...
```

Expected: all commands exit 0 with no compile errors.

- [ ] **Step 3: Run formatting and diff hygiene checks**

```powershell
$unformatted = gofmt -l relay/relay_task_billing_test.go service/task_billing_test.go
if ($unformatted) { throw "unformatted Go files: $unformatted" }
git diff --check origin/main...HEAD
git status --short --branch
git diff --stat origin/main...HEAD
```

Expected: no unformatted files, no whitespace errors, and only the approved design/plan/test files differ from `origin/main`.

- [ ] **Step 4: Obtain two independent reviews**

Dispatch a fresh code-reviewer subagent with:

```text
Review origin/main...HEAD for the approved BytePlus Seedance correction. Confirm there is no production behavior change, the three ModelRatio values and quota expectations are correct, the settlement test proves total_tokens * ModelRatio * GroupRatio * video_input, unrelated settings remain out of repository defaults, and provide the required production deployment recommendation.
```

Then run OCR when the configured CLI is available:

```powershell
if (Get-Command ocr -ErrorAction SilentlyContinue) {
  ocr llm test
  if ($LASTEXITCODE -eq 0) {
    ocr review --audience agent --background "Correct BytePlus Seedance billing from accidental fixed ModelPrice per-call semantics back to existing total_tokens times ModelRatio, GroupRatio, and scenario-ratio settlement. The branch intentionally changes tests/docs only and must preserve all generic runtime behavior." --from origin/main --to HEAD
  }
}
```

Expected: no Critical/High/Important findings. Fix valid findings on the feature branch, rerun affected checks, and commit with Lore trailers before proceeding.

### Task 4: Run the Production Per-Call Preflight

**Files:**
- Read only: Cloud Run services `newapi-console` and `newapi-router`
- Reference: `deploy/gcp/docs/OPERATIONS.md`

- [ ] **Step 1: Confirm current GCP CLI identity and project without changing state**

```powershell
gcloud auth list --filter=status:ACTIVE --format='value(account)'
gcloud config get-value project
```

Expected: an active authorized account; the explicit commands below still pin project `vocai-gemini-prod` regardless of local default.

- [ ] **Step 2: Check only `TASK_PRICE_PATCH` on both production Go services**

```powershell
$targets = @('seedance-2.0', 'seedance-2.0-fast', 'seedance-2.0-mini')
$services = @('newapi-console', 'newapi-router')
foreach ($serviceName in $services) {
  $service = gcloud run services describe $serviceName `
    --project=vocai-gemini-prod `
    --region=us-west1 `
    --format=json | ConvertFrom-Json
  $entry = @($service.spec.template.spec.containers[0].env) |
    Where-Object { $_.name -eq 'TASK_PRICE_PATCH' }
  $configured = @()
  if ($entry -and $entry.value) {
    $configured = @($entry.value -split ',' | ForEach-Object { $_.Trim() })
  }
  $matches = @($targets | Where-Object { $configured -contains $_ })
  [pscustomobject]@{
    Service = $serviceName
    SeedanceTaskPricePatchMatches = ($matches -join ',')
  }
}
```

Expected: an empty `SeedanceTaskPricePatchMatches` value for both services. If either service reports a match, stop before changing price maps; environment mutation requires a separate production change and revision/traffic verification.

### Task 5: Restore Production ModelRatio Configuration

**Files:**
- Update: production options `ModelRatio` and `ModelPrice` through the authenticated `console.flatkey.ai` admin session
- Preserve: every unrelated entry and all `GroupRatio` values

- [ ] **Step 1: Read and validate the current maps before mutation**

Use the authenticated console page and its same-origin option API. Require the current exact `ModelPrice` values to be either the known accidental values or already absent:

```json
{
  "seedance-2.0": 0.782,
  "seedance-2.0-fast": 0.629,
  "seedance-2.0-mini": 0.391
}
```

Abort on any other current value. Record the complete original `ModelPrice`,
`ModelRatio`, and `GroupRatio` strings in tab-scoped session storage for
rollback/readback verification; do not print unrelated production prices into
logs.

- [ ] **Step 2: Apply the safe two-write transition**

From the authenticated `console.flatkey.ai` page, execute this same-origin script. It adds the ratios first, verifies preservation, then removes the fixed prices. Any error restores both original maps.

```javascript
(async () => {
  const names = ['seedance-2.0', 'seedance-2.0-fast', 'seedance-2.0-mini']
  const desiredRatio = {
    'seedance-2.0': 0.391,
    'seedance-2.0-fast': 0.3145,
    'seedance-2.0-mini': 0.1955,
  }
  const accidentalPrice = {
    'seedance-2.0': 0.782,
    'seedance-2.0-fast': 0.629,
    'seedance-2.0-mini': 0.391,
  }
  const headers = {
    'Content-Type': 'application/json',
    'New-Api-User': window.localStorage.getItem('uid'),
  }
  const loadOptions = async () => {
    const response = await fetch('/api/option/', { credentials: 'include', headers })
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.message || `GET options failed: ${response.status}`)
    return Object.fromEntries(payload.data.map((item) => [item.key, item.value]))
  }
  const putOption = async (key, value) => {
    const response = await fetch('/api/option/', {
      method: 'PUT',
      credentials: 'include',
      headers,
      body: JSON.stringify({ key, value }),
    })
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.message || `PUT ${key} failed: ${response.status}`)
  }
  const stripTargets = (source) => Object.fromEntries(
    Object.entries(source).filter(([key]) => !names.includes(key)).sort(([a], [b]) => a.localeCompare(b)),
  )
  const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right)

  const before = await loadOptions()
  const backup = {
    ModelPrice: before.ModelPrice,
    ModelRatio: before.ModelRatio,
    GroupRatio: before.GroupRatio,
  }
  sessionStorage.setItem('codex.seedance.billing.backup', JSON.stringify(backup))
  const beforePrice = JSON.parse(before.ModelPrice || '{}')
  const beforeRatio = JSON.parse(before.ModelRatio || '{}')

  for (const name of names) {
    if (name in beforePrice && Number(beforePrice[name]) !== accidentalPrice[name]) {
      throw new Error(`unexpected ModelPrice for ${name}: ${beforePrice[name]}`)
    }
    if (name in beforeRatio && Number(beforeRatio[name]) !== desiredRatio[name]) {
      throw new Error(`unexpected ModelRatio for ${name}: ${beforeRatio[name]}`)
    }
  }

  try {
    const nextRatio = { ...beforeRatio, ...desiredRatio }
    await putOption('ModelRatio', JSON.stringify(nextRatio))
    const middle = await loadOptions()
    const middleRatio = JSON.parse(middle.ModelRatio || '{}')
    if (!equal(stripTargets(beforeRatio), stripTargets(middleRatio))) {
      throw new Error('unrelated ModelRatio entries changed')
    }
    for (const name of names) {
      if (Number(middleRatio[name]) !== desiredRatio[name]) throw new Error(`ModelRatio write failed for ${name}`)
    }

    const nextPrice = { ...beforePrice }
    for (const name of names) delete nextPrice[name]
    await putOption('ModelPrice', JSON.stringify(nextPrice))

    const after = await loadOptions()
    const afterPrice = JSON.parse(after.ModelPrice || '{}')
    const afterRatio = JSON.parse(after.ModelRatio || '{}')
    if (!equal(stripTargets(beforePrice), stripTargets(afterPrice))) {
      throw new Error('unrelated ModelPrice entries changed')
    }
    if (!equal(stripTargets(beforeRatio), stripTargets(afterRatio))) {
      throw new Error('unrelated ModelRatio entries changed')
    }
    if (after.GroupRatio !== before.GroupRatio) {
      throw new Error('GroupRatio changed')
    }
    for (const name of names) {
      if (name in afterPrice) throw new Error(`ModelPrice still present for ${name}`)
      if (Number(afterRatio[name]) !== desiredRatio[name]) throw new Error(`ModelRatio readback failed for ${name}`)
    }

    return {
      success: true,
      modelPriceTargets: Object.fromEntries(names.map((name) => [name, afterPrice[name] ?? null])),
      modelRatioTargets: Object.fromEntries(names.map((name) => [name, afterRatio[name]])),
      unrelatedModelPricePreserved: true,
      unrelatedModelRatioPreserved: true,
      groupRatioPreserved: true,
    }
  } catch (error) {
    await putOption('ModelPrice', backup.ModelPrice)
    await putOption('ModelRatio', backup.ModelRatio)
    throw error
  }
})()
```

Expected result:

```json
{
  "success": true,
  "modelPriceTargets": {
    "seedance-2.0": null,
    "seedance-2.0-fast": null,
    "seedance-2.0-mini": null
  },
  "modelRatioTargets": {
    "seedance-2.0": 0.391,
    "seedance-2.0-fast": 0.3145,
    "seedance-2.0-mini": 0.1955
  },
  "unrelatedModelPricePreserved": true,
  "unrelatedModelRatioPreserved": true,
  "groupRatioPreserved": true
}
```

- [ ] **Step 3: Refresh and independently read back the settings**

Reload the settings page, fetch `/api/option/` again, and verify:

- the three exact names are absent from `ModelPrice`;
- the three raw `ModelRatio` values are `0.391`, `0.3145`, and `0.1955`;
- the visual editor displays `$0.782`, `$0.629`, and `$0.391` per 1M tokens;
- `GroupRatio` is byte-for-byte unchanged;
- unrelated `ModelPrice`/`ModelRatio` entries are unchanged.

Allow up to the documented 60-second polling fallback for router replicas if Pub/Sub invalidation is delayed. Do not issue a new billable video generation solely for smoke testing; verify the next already-authorized Seedance task's billing log when one is available.

### Task 6: Publish the Corrective PR

**Files:**
- Push branch: `fix/byteplus-seedance-token-billing`
- Create PR against: `main`

- [ ] **Step 1: Confirm the final commit range and clean worktree**

```powershell
git status --short --branch
git log --oneline origin/main..HEAD
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
```

Expected: clean worktree; only the design, plan, and two test files are in scope.

- [ ] **Step 2: Push the feature branch**

```powershell
git push -u origin fix/byteplus-seedance-token-billing
```

Expected: remote branch updated successfully. Do not push or merge `main`.

- [ ] **Step 3: Create the main-targeted PR with the reasoning trail**

```powershell
@'
## Problem

PR #618's final commit accidentally changed the documented/configured Seedance contract from token settlement to fixed `ModelPrice` billing. A matching `ModelPrice` sets `PerCallBilling`, so task completion skips the upstream `total_tokens` reconciliation.

## Evidence and root cause

- `ModelPriceHelperPerCall` gives `ModelPrice` precedence over `ModelRatio`.
- `PerCallBilling` causes task completion to skip token difference settlement.
- The earlier Seedance design and existing generic task billing path use `total_tokens * ModelRatio * GroupRatio * OtherRatios`.

## Scope

- Restore the design to `ModelRatio` semantics.
- Replace the fixed-price relay regression with all three token ratios.
- Add a completion-settlement regression for the `28/46` video-input tier.
- Keep the BytePlus scenario table and production runtime logic unchanged.

## Production impact

The repository diff is tests/docs only, so neither `newapi-router` nor `newapi-console` needs a deployment for this PR. Production settings are corrected separately by deleting the three exact `ModelPrice` keys and adding raw `ModelRatio` values `0.391`, `0.3145`, and `0.1955`, after confirming the models are absent from `TASK_PRICE_PATCH`.

## Validation

- Targeted BytePlus relay tests
- Per-call and non-per-call task settlement tests
- `go test ./relay/...`
- `go test ./service/...`
- `go build ./...`
- Formatting and diff checks
- Independent code review and OCR when available

## Risk

Narrow. No production Go behavior, schema, default pricing, or group ratio changes. The main operational risk is overwriting unrelated pricing entries, mitigated by preserve-all-other-entries readback checks and rollback data.
'@ | gh pr create --repo SolveaCX/new-api --base main --head fix/byteplus-seedance-token-billing --title "Restore Seedance token-settled tier pricing" --body-file -
```

Expected: a new PR URL targeting `main`. Do not merge the PR.

- [ ] **Step 4: Report completion evidence**

Report the PR URL, commit list, test/build results, production configuration readback, `TASK_PRICE_PATCH` preflight on both services, and deployment recommendation:

```text
Router deploy: not required
Reason: the correction changes tests and documentation only; existing router runtime already supports ModelRatio plus total_tokens settlement.
Other deploy targets: newapi-console not required; newapi-web, staging, Terraform, and Cloudflare not involved.
Risk / validation: production settings changed in place with full-map preservation checks; verify the next authorized Seedance task log shows non-per-call token settlement.
```
