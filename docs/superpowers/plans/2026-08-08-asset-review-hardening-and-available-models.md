# Asset Review Hardening And Available Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return the exact currently usable model subset for each asset and close the confirmed correctness gaps from PR #670 review.

**Architecture:** Keep aggregate asset status and public routing privacy unchanged. Derive `available_models` from the same scope/target/readiness/binding invariants used by strict readiness, and harden external provider writes with fresh DB time, full lease fences, stable idempotency keys, bounded retries, and deterministic terminal rotation.

**Tech Stack:** Go 1.x, Gin, GORM, SQLite/MySQL/PostgreSQL-compatible SQL, PowerShell 5.1+, OpenAPI JSON.

---

### Task 1: Public partial model availability

**Files:**
- Modify: `service/asset.go`
- Modify: `service/asset_model_status.go`
- Modify: `service/asset_model_status_test.go`
- Modify: `dto/asset.go`
- Modify: `controller/asset.go`
- Modify: `controller/asset_test.go`
- Modify: `docs/openapi/relay.json`

- [ ] **Step 1: Write failing service tests**

Add tests that seed two in-scope models, make only one readiness row and exact binding Active, call `ReconcileAssetForScope`, and assert:

```go
require.Equal(t, model.AssetStatusProcessing, result.Status)
require.Equal(t, []string{"seedance-2.0-fast"}, result.AvailableModels)
```

Also assert stale generation, wrong channel, wrong binding scope, blank upstream ID, source-terminal status, and duplicate model names do not enter the list.

- [ ] **Step 2: Run RED service test**

Run:

```powershell
go test ./service -run 'TestReconcileAssetForScope.*AvailableModels' -count=1
```

Expected: compile failure because `AssetResult.AvailableModels` does not exist.

- [ ] **Step 3: Implement exact availability projection**

Add `AvailableModels []string` to `AssetResult`. In `ReconcileAssetForScope`, compute the list while rows and targets are already loaded. Include a model only when its readiness row is Active, its target is eligible/current, all target fields match, and `assetHasActiveBindingForTargetStrict` returns true. Normalize and sort through the existing `normalizedStrings` helper.

- [ ] **Step 4: Run GREEN service test**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Write failing controller/OpenAPI tests**

Assert canonical asset JSON always contains:

```json
"available_models": []
```

and preserves a supplied non-empty list. Assert the OpenAPI `Asset` schema declares an array of strings named `available_models` and marks it required.

- [ ] **Step 6: Run RED controller tests**

Run:

```powershell
go test ./controller -run 'Test.*Asset.*AvailableModels|TestAssetResponse' -count=1
```

Expected: FAIL because the DTO and mapper omit the field.

- [ ] **Step 7: Implement DTO, mapper, and schema**

Add:

```go
AvailableModels []string `json:"available_models"`
```

to `dto.AssetResponse`, clone an empty slice instead of emitting null, map it in `assetResponseFromResult`, and document it in the canonical OpenAPI `Asset` schema.

- [ ] **Step 8: Run GREEN controller tests and commit**

Run the Step 6 command plus the service test, then commit with Lore trailers.

### Task 2: Preserve a reachable public asset when reconciliation fails

**Files:**
- Modify: `controller/asset.go`
- Modify: `controller/asset_test.go`

- [ ] **Step 1: Write failing controller tests**

Cover direct URL upload, multipart upload, signed-upload completion, and GET. Assert scope resolution happens before direct durable creation. When post-persistence reconciliation returns an internal error, assert the controller returns the known public ID with `status: "Processing"` and `available_models: []`, rather than a 500 that hides the created asset.

- [ ] **Step 2: Run RED tests**

Run:

```powershell
go test ./controller -run 'Test(CreateAsset|UploadAsset|CompleteAssetUpload).*Reconcile' -count=1
```

Expected: FAIL because creation currently precedes scope resolution and reconciliation errors replace the successful asset response.

- [ ] **Step 3: Implement pre-resolution and fail-safe response**

Resolve scope before `createAssetFromURL` and `uploadAsset`, pass the resolved scope to a helper, and avoid resolving it twice. If reconciliation fails after a result exists, return a copied result with `Status = model.AssetStatusProcessing` and an empty `AvailableModels`; preserve source-terminal statuses unchanged. GET continues to reconcile because it owns configuration-drift enrollment.

- [ ] **Step 4: Run GREEN tests and commit**

Run the Step 2 command and all `./controller` asset tests, then commit with Lore trailers.

### Task 3: Retry classification, TechMobi Processing, and probe exit status

**Files:**
- Modify: `service/asset_materialize_error.go`
- Modify: `service/asset_materialize_error_test.go`
- Modify: `service/techmobi_asset.go`
- Modify: `service/techmobi_asset_test.go`
- Modify: `scripts/asset_model_coverage_probe.ps1`

- [ ] **Step 1: Write failing retry tests**

Assert HTTP 408 maps to `AssetMaterializeErrorTimeout`. Assert numeric Retry-After values larger than the business cap return the cap and never overflow negative; assert a far-future HTTP date is capped identically.

- [ ] **Step 2: Run RED retry tests**

Run:

```powershell
go test ./service -run 'TestAssetMaterialize.*(RequestTimeout|RetryAfter)' -count=1
```

Expected: FAIL on 408 classification and extreme delay.

- [ ] **Step 3: Implement bounded retry parsing**

Introduce a package constant such as `assetMaterializeMaxRetryAfter = 24 * time.Hour`, classify 408 before generic 4xx, cap parsed seconds before multiplying by `time.Second`, and cap HTTP-date delay before returning it.

- [ ] **Step 4: Write and run RED TechMobi test**

Return a 2xx body containing `{"status":"Processing","assetUrl":"asset://upstream-processing"}` and assert `CreateAsset` returns a Processing `AssetMaterializeResult` with the URL and no error. Run:

```powershell
go test ./service -run 'TestTechMobi.*Processing.*AssetURL' -count=1
```

Expected: FAIL because the URL is currently discarded.

- [ ] **Step 5: Implement Processing result and run GREEN tests**

Validate `assetUrl` first when status is Processing, then return it with `Status: model.AssetStatusProcessing`; keep a missing/invalid URL retryable.

- [ ] **Step 6: Add probe failure assertion and implementation**

After `Wait-TaskTerminal`, emit JSON and exit 4 unless the task status is one of `SUCCESS`, `completed`, or `succeeded`. Validate with a local HttpListener mock returning `failed` and assert `$LASTEXITCODE -eq 4`.

- [ ] **Step 7: Run parser, focused tests, and commit**

Run Go tests above and:

```powershell
$errors=$null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path scripts/asset_model_coverage_probe.ps1),[ref]$null,[ref]$errors) | Out-Null; if($errors.Count){throw ($errors | Out-String)}
```

Expected: no parser errors. Commit with Lore trailers.

### Task 4: Fresh worker time and terminal candidate rotation

**Files:**
- Modify: `service/asset_model_worker.go`
- Modify: `service/asset_model_worker_test.go`

- [ ] **Step 1: Write failing stale-batch-time test**

Seed two due readiness rows. Block the first provider call past the second row's original readiness lease, advance the mocked DB timestamp, then release it. Assert the second claim/lease uses the new DB time and cannot be immediately reclaimed by another owner.

- [ ] **Step 2: Run RED stale-time test**

Run:

```powershell
go test ./service -run 'TestAssetModelWorkerRefreshesDBTimeForEveryBatchRow' -count=1
```

Expected: FAIL because the batch reuses `nowUnix`.

- [ ] **Step 3: Implement per-row DB time**

Keep the supplied time only for `ListDueAssetModelReadiness`. Before each row claim call `model.GetDBTimestampWithContext(ctx)`, compute that row's readiness lease from it, and pass `time.Unix(currentNowUnix, 0)` to `PrepareAssetModelReadiness`.

- [ ] **Step 4: Write failing final-candidate test**

Seed one candidate with a retryable failure whose attempt window is exhausted. Assert the target becomes Unavailable, the readiness row becomes Failed, and generation is not republished indefinitely.

- [ ] **Step 5: Run RED final-candidate test**

Run:

```powershell
go test ./service -run 'TestAssetModelRetryWindowFailsAfterFinalCandidate' -count=1
```

Expected: FAIL because the current code rotates the last candidate to itself.

- [ ] **Step 6: Implement terminal rotation and run GREEN tests**

Remove the branch that resets `nextIndex` to `target.CandidateIndex`. When no next candidate exists, call `markAssetModelTargetUnavailable` and finish readiness Failed for both retry-window exhaustion and definitive exhaustion.

- [ ] **Step 7: Run worker suite and commit**

Run:

```powershell
go test ./service -run 'TestAssetModel(Worker|Rotation|Retry|Definitive|MultiNode)' -count=1
```

Expected: PASS. Commit with Lore trailers.

### Task 5: Concurrent target initialization

**Files:**
- Modify: `model/asset_model_readiness.go`
- Modify: `service/asset_model_target.go`
- Modify: `service/asset_model_target_test.go`

- [ ] **Step 1: Write failing race regression test**

Pause an initializer after its first eligibility read. Let another initializer publish generation 1, resume the paused initializer, and assert the final target remains generation 1 with the published eligible candidate.

- [ ] **Step 2: Run RED test**

Run:

```powershell
go test ./service -run 'TestEnsureAssetModelCoverageTargetDoesNotRepublishConcurrentEligibleTarget' -count=1
```

Expected: FAIL with generation 2.

- [ ] **Step 3: Implement post-claim eligibility check and lease release**

After a successful claim, reload the current target and call `AssetModelTargetIsEligible`. If eligible, release only the current owner's exact lease through a new model CAS helper and return the current target. Otherwise publish using the current generation and exact lease expiry.

- [ ] **Step 4: Run GREEN tests and commit**

Run all `TestEnsureAssetModelCoverageTarget` tests and focused model target CAS tests. Commit with Lore trailers.

### Task 6: Provider result idempotency and complete binding fences

**Files:**
- Modify: `model/asset.go`
- Modify: `model/asset_test.go`
- Modify: `service/asset_binding.go`
- Modify: `service/asset_binding_test.go`
- Modify: `service/asset_model_worker.go`
- Modify: `service/asset_model_worker_test.go`
- Modify: `service/techmobi_asset.go`
- Modify: `service/techmobi_asset_test.go`

- [ ] **Step 1: Write failing activation-fence tests**

Assert an activation with a lease owner but no expected expiry is rejected. Assert the synchronous materialization path passes the exact claimed expiry and an old expiry cannot activate after takeover.

- [ ] **Step 2: Run RED activation tests**

Run:

```powershell
go test ./model ./service -run 'Test.*AssetBinding.*(ExpectedLease|Stale|Takeover)' -count=1
```

Expected: FAIL because the synchronous path omits the expiry and the model helper treats it as optional.

- [ ] **Step 3: Implement mandatory expiry fencing**

Make `ActivateAssetBindingWithAssetCAS` return false when `LeaseOwner` is set and `ExpectedLeaseExpiresAt <= 0`. Pass the exact claim expiry into `createLeasedAssetBinding` and all activation calls.

- [ ] **Step 4: Write failing idempotency/result-recovery tests**

Assert two retries for the same asset, target, content hash, and binding scope produce the same internal idempotency key. Assert TechMobi sends it as `Idempotency-Key`. Simulate provider success followed by a first activation CAS failure and assert a retry reuses an identical stored Processing/Active result without a second provider CreateAsset call.

- [ ] **Step 5: Run RED recovery tests**

Run:

```powershell
go test ./service -run 'Test.*Asset.*(IdempotencyKey|ActivationRecovery|ProviderResult)' -count=1
```

Expected: FAIL because materialization input has no stable key and CAS false discards the returned upstream ID.

- [ ] **Step 6: Implement stable key and recovery**

Derive a SHA-256 key from immutable source SHA, asset ID, channel ID, and binding scope. Add it to `AssetMaterializeInput`; TechMobi sends it in `Idempotency-Key`. Before returning on activation false/error, re-read the binding: accept only the same upstream ID/status, never overwrite a conflicting result, and keep the lease fenced so the next retry uses the same provider key. Retry transient activation writes within the provider context while the exact lease remains current.

- [ ] **Step 7: Run GREEN binding/worker tests and commit**

Run focused model, binding, worker, and TechMobi tests. Commit with Lore trailers.

### Task 7: Integration verification and PR update

**Files:**
- Verify all modified files
- Modify only if verification exposes a regression

- [ ] **Step 1: Run formatting and static diff checks**

Run `gofmt` on changed Go files, then `git diff --check` and parse `docs/openapi/relay.json` with `ConvertFrom-Json`.

- [ ] **Step 2: Run targeted suites**

Run focused controller, service, model, middleware, and router asset tests covering all changed behavior.

- [ ] **Step 3: Run build and vet**

Run:

```powershell
go build ./...
go vet ./controller ./service ./model ./middleware ./router
```

Expected: both exit zero.

- [ ] **Step 4: Run secret and public-contract scan**

Verify no literal API keys, Authorization values, upstream IDs, channel IDs, or binding scopes were added to public output or committed fixtures.

- [ ] **Step 5: Review the complete branch diff**

Review `origin/main..HEAD`, confirm every accepted review item has a regression test, and confirm rejected GORM/PowerShell comments produced no unnecessary changes.

- [ ] **Step 6: Commit final adjustments and push**

Use Lore commit trailers, push `feat/techmobi-asset-library`, and report the updated PR checks plus any unverified MySQL/PostgreSQL or live-provider gaps.
