# ModelAPI Seedance 2.5 URL-Native Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let ModelAPI Seedance 2.5 consume Flatkey `asset://` references through fresh, per-submission GCS V4 HTTPS URLs without creating upstream asset bindings.

**Architecture:** Keep the normal model-to-channel binding and coverage-target flow, but classify `ChannelTypeModelAPISeedance` as a URL-native asset target with deterministic scope `source-url:modelapi`. Readiness is activated from recoverable Flatkey source state, and the selected-channel middleware re-queries every referenced asset before signing any URL. Binding/materializer channels retain their existing path.

**Tech Stack:** Go 1.22+, Gin, GORM, SQLite test databases, existing `AssetObjectStore` fake, `httptest`, GCS V4 signing abstraction.

---

### Task 1: Declare Seedance 2.5 and ModelAPI URL-native target capability

**Files:**
- Modify: `service/asset_model_scope.go`
- Modify: `service/asset_model_target.go`
- Modify: `service/asset_reference.go`
- Test: `service/asset_model_target_test.go`
- Test: `service/asset_model_scope_test.go`

- [ ] **Step 1: Write failing capability and target tests**

Add table cases proving all three spellings are reusable and a ModelAPI channel remains target-eligible without a materializer:

```go
for _, modelName := range []string{
    "doubao-seedance-2.5-260628",
    "doubao-seedance-2-5-260628",
    "doubao-seedance-2_5-260628",
} {
    require.True(t, assetModelHasReusableAssetCapability(modelName))
}

channel := &model.Channel{
    Id: 925,
    Type: constant.ChannelTypeModelAPISeedance,
    Status: common.ChannelStatusEnabled,
    Models: "doubao-seedance-2-5-260628",
}
require.True(t, assetModelChannelEligible(scope, channel))
candidates := assetModelCandidatesForChannel(channel, "doubao-seedance-2-5-260628")
require.Len(t, candidates, 1)
require.Equal(t, "source-url:modelapi", candidates[0].BindingScope)
require.Equal(t, -1, candidates[0].CredentialIndex)
```

- [ ] **Step 2: Run the RED tests**

Run:

```powershell
$env:GOCACHE='E:\go-cache\build'
$env:GOTMPDIR='E:\go-cache\tmp'
go test -vet=off -p 1 ./service -run 'AssetModelHasReusableAssetCapability|ModelAPI.*Target|ResolveAssetModelScope.*Seedance25' -count=1
```

Expected: FAIL because 2.5 spellings are excluded and ModelAPI has no materializer.

- [ ] **Step 3: Implement the minimal capability helpers**

Use one deterministic scope and one channel-type predicate:

```go
const assetModelSourceURLScopeModelAPI = "source-url:modelapi"

func AssetModelChannelUsesSourceURL(channelType int) bool {
    return channelType == constant.ChannelTypeModelAPISeedance
}

func assetModelTargetUsesSourceURL(target model.AssetModelCoverageTarget) bool {
    return strings.TrimSpace(target.BindingScope) == assetModelSourceURLScopeModelAPI
}
```

Extend `assetModelHasReusableAssetCapability` with `2.5`, `2-5`, and `2_5`. In `assetModelChannelEligible`, permit ModelAPI before the materializer check. In `assetModelCandidatesForChannel`, emit `source-url:modelapi` without calling `assetBindingScope`. Add ModelAPI to `channelCanConsumeAssetType` for Image, Video, and Audio.

- [ ] **Step 4: Run the GREEN tests**

Run the same command. Expected: PASS.

### Task 2: Activate URL-native readiness without `AssetBinding`

**Files:**
- Modify: `service/asset_model_worker.go`
- Test: `service/asset_model_worker_test.go`

- [ ] **Step 1: Write a failing worker test**

Seed an active ModelAPI target with `BindingScope: "source-url:modelapi"`, a recoverable GCS asset, and a claimed readiness row. Run `PrepareAssetModelReadiness` and assert:

```go
require.Equal(t, model.AssetModelReadinessStatusActive, row.Status)
require.Equal(t, int64(0), countRows(t, &model.AssetBinding{}))
require.Equal(t, 0, materializerCreateCalls)
require.Equal(t, 0, signerCalls)
```

- [ ] **Step 2: Run the RED test**

```powershell
go test -vet=off -p 1 ./service -run 'TestAssetModelWorkerModelAPI.*WithoutBinding' -count=1
```

Expected: FAIL because the worker resolves target options and calls `prepareAssetModelBinding`.

- [ ] **Step 3: Add the URL-native worker branch**

After loading and re-validating the selected target/channel, finish readiness directly for the URL-native target:

```go
if assetModelTargetUsesSourceURL(*target) {
    if !AssetModelChannelUsesSourceURL(channel.Type) {
        return finishAssetModelReadinessFailed(row, owner, nowUnix, "target_unavailable")
    }
    return finishAssetModelReadinessActive(row, owner, nowUnix)
}
```

Keep the existing `ResolveAssetModelTargetOptions` and binding path unchanged for every other target.

- [ ] **Step 4: Run the GREEN test and binding-channel regressions**

```powershell
go test -vet=off -p 1 ./service -run 'TestAssetModelWorker(ModelAPI|TechMobi|BytePlus|ActivationRecovery)' -count=1
```

Expected: PASS.

### Task 3: Project URL-native status and available models without a binding

**Files:**
- Modify: `service/asset_model_status.go`
- Modify: `service/asset_reference.go`
- Test: `service/asset_model_status_test.go`
- Test: `service/asset_reference_test.go`

- [ ] **Step 1: Write failing status and channel-ranking tests**

Cover both sides of the lifecycle boundary:

```go
// Recoverable source + active matching readiness + no AssetBinding.
require.Equal(t, model.AssetStatusActive, result.Status)
require.Equal(t, []string{"doubao-seedance-2-5-260628"}, result.AvailableModels)

// Same rows, but SourceExpiresAt <= now.
require.NotEqual(t, model.AssetStatusActive, expired.Status)
require.Empty(t, expired.AvailableModels)
```

Also assert `AssetReferenceSet.ReadinessForChannel` returns `AssetReadinessVerifiedTarget` only while the current source is recoverable.

- [ ] **Step 2: Run the RED tests**

```powershell
go test -vet=off -p 1 ./service -run 'Test.*ModelAPI.*(Status|Available|Readiness|SourceExpires)' -count=1
```

Expected: FAIL because active binding keys are mandatory and stale source time is not checked for URL-native targets.

- [ ] **Step 3: Centralize target satisfaction**

Use a single helper in both status projection functions:

```go
func assetModelTargetReadyForAsset(asset model.Asset, target model.AssetModelCoverageTarget, bindings activeAssetBindingKeySet) bool {
    if assetModelTargetUsesSourceURL(target) {
        return assetModelSourceRecoverableAt(asset, assetNow())
    }
    return bindings.has(target)
}
```

Thread `asset` into `availableAssetModelsForScope`. In `targetReadinessForChannel`, require `assetReferenceSourceRecoverable` instead of a binding for URL-native targets. Do not change binding requirements for BytePlus, TechMobi, or other materializer channels.

- [ ] **Step 4: Run GREEN and compatibility tests**

```powershell
go test -vet=off -p 1 ./service -run 'AssetModelStatus|AssetReference.*Readiness|TechMobi|BytePlus' -count=1
```

Expected: PASS.

### Task 4: Resolve and sign fresh HTTPS source URLs in two phases

**Files:**
- Create: `service/asset_source_url.go`
- Create: `service/asset_source_url_test.go`

- [ ] **Step 1: Write failing resolver tests**

Create tests for fresh signing, no persistence, and all-or-nothing validation:

```go
first, err := ResolveAssetSourceURLRewriteMap(ctx, userID, references, channel, modelName)
require.NoError(t, err)
second, err := ResolveAssetSourceURLRewriteMap(ctx, userID, references, channel, modelName)
require.NoError(t, err)
require.NotEqual(t, first[assetURI], second[assetURI])
require.Equal(t, 2, signer.calls)

var bindingCount int64
require.NoError(t, model.DB.Model(&model.AssetBinding{}).Count(&bindingCount).Error)
require.Zero(t, bindingCount)
requireDatabaseContainsNoString(t, "signed.example")
```

For a set containing one valid and one expired asset, assert the resolver returns an error and `signer.calls == 0`. Add ownership, type mismatch, unsupported backend, missing object metadata, and non-HTTPS signer result cases.

- [ ] **Step 2: Run the RED tests**

```powershell
go test -vet=off -p 1 ./service -run 'TestResolveAssetSourceURLRewriteMap' -count=1
```

Expected: FAIL to compile because the resolver does not exist.

- [ ] **Step 3: Implement two-phase resolution**

Expose one service entry point:

```go
func ResolveAssetSourceURLRewriteMap(
    ctx context.Context,
    userID int,
    references AssetReferenceSet,
    channel *model.Channel,
    originModel string,
) (map[string]string, error)
```

Phase one re-queries all public IDs with `model.GetAssetsWithBindingsByPublicIDsForUser(userID, ids)` and validates every item, the selected active target, selected channel, mapped model, type, lifecycle, GCS source metadata, and `SourceExpiresAt > now`. Phase two calls `SignAssetSourceURL(ctx, asset, CurrentAssetStorageConfig())` once per distinct asset and rejects any result whose parsed scheme is not exactly `https`. No signed value is assigned to a model or written with GORM.

- [ ] **Step 4: Run GREEN**

Run the same command. Expected: PASS with only fake signer calls.

### Task 5: Route selected ModelAPI channels through the URL-native resolver

**Files:**
- Modify: `middleware/distributor.go`
- Test: `middleware/distributor_byteplus_asset_test.go`
- Test: `controller/asset_task_worker_test.go`

- [ ] **Step 1: Write failing immediate and queued-path tests**

For the immediate path, call `RefreshAssetRewriteMapForSelectedChannel` with a ModelAPI channel and assert the context receives a fresh HTTPS map. For the queued worker, reuse the specific-channel restoration test and capture the rewrite map immediately before `PrepareTaskAttempt`:

```go
rewriteMap, ok := common.GetContextKeyType[map[string]string](c, constant.ContextKeyAssetRewriteMap)
require.True(t, ok)
require.Equal(t, "https", mustParseURL(t, rewriteMap[assetURI]).Scheme)
```

Use fake object storage and a fake task adaptor; no request may leave the process.

- [ ] **Step 2: Run the RED tests**

```powershell
go test -vet=off -p 1 ./middleware ./controller -run 'TestModelAPISeedance(Immediate|Queued).*Rewrite' -count=1
```

Expected: FAIL because middleware enters the binding/materializer path.

- [ ] **Step 3: Add the middleware branch before materialization**

```go
if service.AssetModelChannelUsesSourceURL(channel.Type) {
    rewriteMap, err := service.ResolveAssetSourceURLRewriteMap(ctx, userID, references, channel, originModel)
    if err != nil {
        clearAssetRewriteMap(c)
        return service.AssetBindingAPIError(err)
    }
    setAssetRewriteMaps(c, rewriteMap)
    return nil
}
```

Retain the existing binding/materialize code byte-for-byte after this branch. Both call sites continue to use the same middleware function, so queued signing occurs after context restoration and channel selection.

- [ ] **Step 4: Run GREEN**

Run the same command. Expected: PASS.

### Task 6: Rewrite before ModelAPI validation and require HTTPS

**Files:**
- Modify: `relay/channel/task/modelapiseedance/adaptor.go`
- Modify: `relay/channel/task/modelapiseedance/adaptor_test.go`
- Create: `relay/channel/task/modelapiseedance/main_test.go`

- [ ] **Step 1: Write failing adaptor tests**

Add tests proving the real call order succeeds and unsafe input fails:

```go
require.Nil(t, adaptor.ValidateRequestAfterModelMapping(c, info))
body, err := adaptor.BuildRequestBody(c, info)
require.NoError(t, err)
require.NotContains(t, readBody(t, body), `"url":"asset://`)

// Rewrite value uses http://.
_, err = adaptor.BuildRequestBody(httpRewriteContext, info)
require.ErrorContains(t, err, "invalid asset reference")
```

Cover missing rewrite, empty rewrite, residual `asset://`, malformed asset URI, and plain prompt text containing `asset://` that must remain text.

- [ ] **Step 2: Run the RED tests**

```powershell
go test -vet=off -p 1 ./relay/channel/task/modelapiseedance -run 'BuildRequestBody|ValidateRequestAfterModelMapping|HTTPS|AssetReference' -count=1
```

Expected: FAIL because validation currently runs before rewrite and remote HTTP URLs are accepted.

- [ ] **Step 3: Implement validation-phase rewrite and HTTPS-only validation**

Create a helper that binds the reusable body, applies `ContextKeyAssetRewriteMap`, validates, and updates the cached request. Call it from `ValidateRequestAfterModelMapping`; keep `BuildRequestBody` defensive by applying the same rewrite and validation again. In `validateModelAPIMediaURL`, parse the URL after the shared SSRF-safe validation and require `strings.EqualFold(parsed.Scheme, "https")`.

Remove the production `flag` import, `flag.Lookup("test.v")`, and `rejectLiveModelAPIRequestDuringTests` call sites. Put test-only network safety in `main_test.go`:

```go
func TestMain(m *testing.M) {
    _ = os.Setenv("HTTP_PROXY", "http://127.0.0.1:1")
    _ = os.Setenv("HTTPS_PROXY", "http://127.0.0.1:1")
    _ = os.Setenv("ALL_PROXY", "http://127.0.0.1:1")
    _ = os.Setenv("NO_PROXY", "127.0.0.1,localhost,::1")
    os.Exit(m.Run())
}
```

- [ ] **Step 4: Run GREEN**

Run the same command. Expected: PASS without network traffic.

### Task 7: Preserve the existing archive lease and redirect-hardening fixes

**Files:**
- Verify existing changes: `model/task.go`
- Verify existing changes: `model/task_cas_test.go`
- Verify existing changes: `service/task_polling.go`
- Verify existing changes: `service/task_polling_video_result_test.go`
- Verify existing changes: `service/video_result_storage.go`
- Verify existing changes: `service/video_result_storage_test.go`

- [ ] **Step 1: Run the focused existing tests offline**

```powershell
go test -vet=off -p 1 ./model -run 'TaskVideoResultArchiveLease' -count=1
go test -vet=off -p 1 ./service -run 'UpdateVideoSingleTaskModelAPIArchive|ModelAPICASLoser|VideoResult.*Redirect' -count=1
```

Expected: PASS. Do not weaken owner/expiry/task-ID fences or redirect-by-redirect SSRF validation while implementing URL-native assets.

### Task 8: Verify, review, and prepare the PR update

**Files:**
- Review all files changed since `main`

- [ ] **Step 1: Run affected-package verification with network blocked**

```powershell
$env:HTTP_PROXY='http://127.0.0.1:1'
$env:HTTPS_PROXY='http://127.0.0.1:1'
$env:ALL_PROXY='http://127.0.0.1:1'
$env:NO_PROXY='127.0.0.1,localhost,::1'
$env:GOCACHE='E:\go-cache\build'
$env:GOTMPDIR='E:\go-cache\tmp'
go test -vet=off -p 1 ./model ./service ./middleware ./controller ./relay/channel/task/modelapiseedance -count=1
go vet ./model ./service ./middleware ./controller ./relay/channel/task/modelapiseedance
go build ./...
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 2: Run spec-compliance review, then code-quality review**

Review against `docs/superpowers/specs/2026-08-11-modelapi-seedance-25-url-native-assets-design.md`. Fix every important finding, re-run the relevant target tests, and request re-review.

- [ ] **Step 3: Commit with Lore trailers and update PR #683**

Stage only intended files. The commit message must record the URL-native boundary, no-live-network constraint, tests run, and remaining full-suite gaps. Push `feature/modelapi-seedance-25`, then reply to the actionable comment on `SolveaCX/new-api#683` with the fixing commit and verification evidence.
