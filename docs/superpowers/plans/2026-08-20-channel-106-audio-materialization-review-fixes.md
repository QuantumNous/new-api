# Channel 106 Audio Materialization Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TokenSpace Audio assets follow the existing Flatkey materialization and Seedance rewrite flow while restoring legacy TechMobi processing rematerialization on malformed explicit settings.

**Architecture:** Extend the existing `tokenspace_material` descriptor capability without changing public schemas or binding storage. Reuse the shared resolver/readiness/lease/CAS pipeline, add Audio to the Doubao exact-media rewrite loop, and repair the TechMobi fallback decision at its existing configuration boundary.

**Tech Stack:** Go 1.22+, Gin, GORM, `httptest`, existing Flatkey asset bindings and Seedance request DTOs.

## Global Constraints

- Base branch is the latest `origin/main` at worktree creation.
- Work only in `E:\workspace\.codex-worktrees\new-api-fix-channel-106-audio` on branch `fix/channel-106-audio-materialization`.
- Follow red-green TDD: every production change must be preceded by a focused test that fails for the intended missing behavior.
- `tokenspace_material` accepts Image, Video, and Audio; `seedance_proxy` remains Image/Video-only.
- Keep the public `/v1/assets` contract, database schema, group lifecycle, binding scope, and customer-visible asset identity unchanged.
- Reuse database leases, uniqueness, CAS transitions, and retries; do not add process-local coordination.
- Use `common.*` JSON helpers and preserve ordinary HTTPS media passthrough.
- Do not add production credentials, group IDs, signed URLs, upstream IDs, or live response bodies to source, tests, commits, or PR text.
- Do not add production ability-table repair or a Seedance proxy scope migration to this PR.
- Commits follow the repository Lore Commit Protocol.

---

### Task 1: Enable TokenSpace Audio materialization

**Files:**
- Modify: `service/tokenspace_material_asset_test.go`
- Modify: `service/tokenspace_material_asset.go`
- Modify: `service/asset_reference_test.go`
- Modify: `service/asset_reference.go`
- Modify: `service/asset_model_worker_test.go`

**Interfaces:**
- Consumes: `tokenSpaceMaterialNormalizeType`, `channelCanConsumeAssetType`, `PrepareAssetModelReadiness`, existing materializer descriptor and binding lifecycle.
- Produces: provider-specific Audio eligibility and an upstream `CreateAsset` request whose `AssetType` is exactly `Audio`.

- [ ] **Step 1: Change the provider contract test to require Audio HTTP materialization**

Replace the current rejection-oriented test with a table that sends Image, Video, and Audio through the real `httptest` handler. The handler records each decoded `tokenSpaceMaterialCreateRequest`; assert the literal upstream types are `Image`, `Video`, and `Audio` and the request count is three.

The production mutation this test catches is removing the `Audio` branch from `tokenSpaceMaterialNormalizeType`.

- [ ] **Step 2: Run the provider test and verify red**

Run:

```powershell
go test ./service -run '^TestTokenSpaceMaterialAssetNormalizesImageVideoAndAudioBeforeHTTP$' -count=1
```

Expected: FAIL because Audio returns a definitive local error and the handler sees only two requests.

- [ ] **Step 3: Add provider-specific capability tests**

Add assertions using literal channel settings:

```go
require.True(t, channelCanConsumeAssetType(tokenSpaceChannel, "Image"))
require.True(t, channelCanConsumeAssetType(tokenSpaceChannel, "Video"))
require.True(t, channelCanConsumeAssetType(tokenSpaceChannel, "Audio"))
require.False(t, channelCanConsumeAssetType(seedanceProxyChannel, "Audio"))
```

Add one worker regression showing an Audio asset with a valid TokenSpace target reaches the materializer write seam rather than `assetModelBindingDefinitiveError`. Reuse the existing database-backed worker fixture and fake only the external provider call.

The production mutation these tests catch is collapsing both explicit providers into the old Image/Video-only branch.

- [ ] **Step 4: Run capability/worker tests and verify red**

Run:

```powershell
go test ./service -run 'Test(TokenSpaceMaterial.*Audio|PrepareAssetModelBinding.*TokenSpaceAudio|SeedanceProxyCapabilityRejectsAudio)' -count=1
```

Expected: TokenSpace Audio assertions fail before any production edit; Seedance proxy remains green.

- [ ] **Step 5: Implement the minimal provider-specific branches**

In `tokenSpaceMaterialNormalizeType`, accept case-insensitive `Audio` and return the canonical literal `Audio`.

In `channelCanConsumeAssetType`, split the explicit provider branch:

```go
switch config.Provider {
case assetMaterializationProviderSeedanceProxy:
    return assetType == "Image" || assetType == "Video"
case assetMaterializationProviderTokenSpaceMaterial:
    return assetType == "Image" || assetType == "Video" || assetType == "Audio"
default:
    return false
}
```

Do not change legacy BytePlus, ModelAPI, TechMobi, source-URL, or unknown-provider behavior.

- [ ] **Step 6: Run Task 1 green verification**

```powershell
go test ./service -run 'Test(TokenSpaceMaterial|PrepareAssetModelBinding.*TokenSpaceAudio|SeedanceProxyCapabilityRejectsAudio|AssetModelTarget.*TokenSpace)' -count=1 -timeout=5m
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1 with Lore trailers**

Stage only the five Task 1 files and commit the provider-specific capability change with its focused test evidence.

### Task 2: Rewrite exact Audio asset references in the Doubao adaptor

**Files:**
- Modify: `relay/channel/task/doubao/adaptor_test.go`
- Modify: `relay/channel/task/doubao/adaptor.go`

**Interfaces:**
- Consumes: `constant.ContextKeyAssetRewriteMap`, `service.IsStrictBytePlusAssetURI`, `dto.SeedanceContentItem.AudioURL`.
- Produces: exact Audio URL rewriting with the same validation rules as Image and Video.

- [ ] **Step 1: Extend the existing exact-rewrite test with an Audio asset**

Add a content item containing a strict Flatkey Audio URI and a literal rewrite-map result. Assert:

```go
require.Equal(t, "asset://audio-upstream-opaque", body.Content[audioIndex].AudioURL.URL)
```

Keep the text item containing an asset-looking substring and assert it is unchanged.

- [ ] **Step 2: Add Audio missing-map and HTTPS passthrough cases**

Add one test where a strict Audio asset URI has no rewrite entry and returns `invalid asset reference`. Keep the existing HTTPS Audio passthrough test and make its unchanged URL assertion explicit.

The production mutation these tests catch is omitting `item.AudioURL` from the media traversal.

- [ ] **Step 3: Run Doubao tests and verify red**

```powershell
go test ./relay/channel/task/doubao -run 'TestBuildRequestBody_(RewritesExactAssetUrlsAndPreservesText|RejectsMissingRewriteMapForExactAudioAssetRef|AudioPassthroughAndOptionalsOmitted)' -count=1
```

Expected: the exact Audio rewrite test fails because the current loop visits only Image and Video; the missing-map Audio test incorrectly succeeds.

- [ ] **Step 4: Implement the minimal rewrite-loop change**

Change only the media slice:

```go
for _, media := range []*dto.SeedanceURLObject{
    item.ImageURL,
    item.VideoURL,
    item.AudioURL,
} {
```

Keep strict-URI validation, missing-map handling, text preservation, and ordinary URL passthrough unchanged.

- [ ] **Step 5: Run Task 2 green verification**

```powershell
go test ./relay/channel/task/doubao/... -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2 with Lore trailers**

Stage only `adaptor.go` and `adaptor_test.go`; record that router deployment is required because the relay request body changes.

### Task 3: Restore malformed-config TechMobi rematerialization

**Files:**
- Modify: `service/asset_binding_test.go`
- Modify: `service/asset_binding.go`

**Interfaces:**
- Consumes: `assetBindingRequiresRematerializationFromProcessing`, `handleProcessingAssetBinding`, legacy TechMobi binding recovery.
- Produces: rematerialization for legacy TechMobi when explicit provider parsing fails, while valid explicit providers continue `GetAsset` refresh.

- [ ] **Step 1: Add a database-backed malformed-config processing test**

Clone the existing historical TechMobi processing fixture, then set malformed explicit settings such as a TokenSpace provider with a non-HTTPS gateway. Seed a processing binding with an opaque historical upstream ID. Assert the real binding flow:

- never calls `GetAsset` for the opaque ID;
- signs the recoverable Flatkey source;
- calls `CreateAsset` once;
- activates the replacement binding.

The production mutation this test catches is returning `false` when `assetMaterializationConfigForChannel` returns an error.

- [ ] **Step 2: Run the focused test and verify red**

```powershell
go test ./service -run '^TestTechMobiAssetBindingMalformedExplicitConfigRematerializesProcessingBinding$' -count=1
```

Expected: FAIL because the current code enters the refresh path and invokes `GetAsset`.

- [ ] **Step 3: Implement the minimal fallback decision**

```go
_, explicit, err := assetMaterializationConfigForChannel(channel)
if err != nil {
    return true
}
return !explicit
```

Keep the `nil` and non-TechMobi branches unchanged.

- [ ] **Step 4: Run Task 3 green and regression verification**

```powershell
go test ./service -run 'Test(TechMobiAssetBinding|TokenSpaceMaterialTechMobiProcessingBinding|SeedanceProxy.*Processing)' -count=1 -timeout=5m
```

Expected: PASS, including the existing valid explicit-provider refresh test.

- [ ] **Step 5: Commit Task 3 with Lore trailers**

Stage only `service/asset_binding.go` and `service/asset_binding_test.go`; document the restored legacy fallback and valid-provider regression coverage.

### Task 4: Verify, review, and create the PR

**Files:**
- Modify: review-comment resolution on GitHub only after commits exist.

**Interfaces:**
- Consumes: all three implementation commits and this plan.
- Produces: fresh verification evidence, independent code review, pushed branch, and a PR against `main`.

- [ ] **Step 1: Run focused and package regression tests**

```powershell
go test ./service -run 'Test(TokenSpaceMaterial|TechMobiAssetBinding|PrepareAssetModelBinding.*TokenSpaceAudio|SeedanceProxyCapabilityRejectsAudio|AssetModelTarget.*TokenSpace)' -count=1 -timeout=5m
go test ./relay/channel/task/doubao/... -count=1
```

- [ ] **Step 2: Run wider integration checks**

```powershell
go test ./service ./relay/channel/task/doubao ./relay/channel/task/techmobi ./relay/channel/task/byteplus -count=1 -timeout=10m
go build ./...
git diff --check origin/main...HEAD
```

If an unchanged package has a documented environment failure, record it separately; no changed-test failure may be ignored.

- [ ] **Step 3: Run mutation checks**

Temporarily remove each new production branch one at a time and prove the matching focused test fails, then restore the branch and rerun green:

1. Remove TokenSpace `Audio` normalization.
2. Remove `item.AudioURL` from the Doubao loop.
3. Restore the old `err == nil && !explicit` TechMobi condition.

Do not commit mutations.

- [ ] **Step 4: Run secret and change-scope checks**

```powershell
git diff origin/main...HEAD | rg -n 's[k]-|X-Goo[g]-|X-To[s]-|Beare[r] [A-Za-z0-9]|authorizatio[n]\s*[:=]|passwor[d]\s*[:=]|api[_-]?ke[y]\s*[:=]'
git status --short
```

Expected: no live secrets or unrelated files.

- [ ] **Step 5: Request independent code review**

Dispatch a read-only `code-reviewer` against `origin/main..HEAD` with this design and plan. Fix all Critical and Important findings through fresh red-green cycles; document technical pushback for inapplicable feedback.

- [ ] **Step 6: Re-run final verification after review fixes**

Repeat Steps 1, 2, and 4 on the final tree. Use the verification-before-completion gate before reporting success.

- [ ] **Step 7: Push and create the PR**

Push `fix/channel-106-audio-materialization` to `SolveaCX/new-api` and open a PR against `main`. The PR body must preserve:

- production symptom and live evidence;
- review-comment disposition;
- root cause and selected scope;
- multi-node impact;
- tests and known operational gap (`channel_id=0` ability state);
- deployment advice: router required, console required, no web/infra migration.

- [ ] **Step 8: Reply to PR #753's top-level review comment**

Add a factual top-level comment on PR #753 linking the new PR, quoting the actionable Audio and TechMobi findings, and stating what changed and how it was verified. Do not reply to unrelated Prompt Gallery findings as though this branch changed them.

## Self-review

- Spec coverage: Tasks 1-3 map exactly to TokenSpace Audio, Doubao Audio rewrite, and malformed-config TechMobi fallback; Task 4 covers review, verification, GitHub traceability, and deployment guidance.
- Placeholder scan: no placeholder markers or unspecified implementation step remains.
- Type consistency: the plan uses the existing provider descriptor, asset result, readiness worker, rewrite map, and Seedance DTO contracts without new public types.
- Scope check: production ability repair and deployment remain explicit operational follow-ups, not hidden code changes.
