# ModelAPI Seedance 2.5 GCS Whitelabel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone ModelAPI Seedance 2.5 upstream channel while keeping all public result URLs on Flatkey and serving archived video bytes through short-lived Google Cloud Storage redirects.

**Architecture:** Reuse the provider-neutral Seedance request binder and add a focused `modelapiseedance` task adaptor for ModelAPI's `/v1/tasks` wire protocol. Generalize the existing video-result archive hooks to a fixed channel registry, archive before terminal success, persist only Flatkey's `/content` URL, and enforce GCS-only delivery for the new channel.

**Tech Stack:** Go 1.22+, Gin, existing task adaptor framework, GCS client and V4 signing, React/TypeScript console constants, Bun tests.

---

### Task 1: Lock channel registration and endpoint classification

**Files:**
- Modify: `constant/channel.go`
- Create: `constant/modelapi_seedance_channel_test.go`
- Modify: `common/endpoint_type.go`
- Modify: `common/endpoint_type_test.go`
- Modify: `relay/relay_adaptor.go`
- Modify: `relay/relay_adaptor_test.go`
- Modify: `relay/channel/task/taskcommon/helpers.go`
- Modify: `relay/channel/task/taskcommon/helpers_test.go`

- [ ] **Step 1: Write failing registration tests**

Add assertions for the exact type, name, Base URL, OpenAI Video endpoint, adaptor channel name, white-label membership, and brand scrubbing:

```go
func TestModelAPISeedanceChannelConstants(t *testing.T) {
    require.Equal(t, 111, constant.ChannelTypeModelAPISeedance)
    require.Equal(t, "ModelAPISeedance", constant.ChannelTypeNames[111])
    require.Equal(t, "https://api.modelapi.co", constant.ChannelBaseURLs[111])
}

func TestGetTaskAdaptor_ModelAPISeedance(t *testing.T) {
    adaptor := GetTaskAdaptor(constant.TaskPlatform("111"))
    require.NotNil(t, adaptor)
    require.Equal(t, "modelapi-seedance", adaptor.GetChannelName())
}
```

- [ ] **Step 2: Run tests and verify RED**

```powershell
$env:GOCACHE="$PWD\.tmp-gocache"
go test -p 1 ./constant ./common ./relay ./relay/channel/task/taskcommon -run 'ModelAPI|Whitelabel|Scrub' -count=1
```

Expected: failure because the new adaptor and/or complete registration does not exist.

- [ ] **Step 3: Implement the minimal registration**

Use `ChannelTypeModelAPISeedance = 111`, default URL `https://api.modelapi.co`, `EndpointTypeOpenAIVideo`, a `GetTaskAdaptor` factory branch, and fixed white-label/brand entries. Avoid unrelated formatting changes in `constant/channel.go`.

- [ ] **Step 4: Run the Step 2 command and verify GREEN**

- [ ] **Step 5: Commit with a Lore message**

```text
Give Seedance 2.5 traffic an isolated upstream protocol boundary

Constraint: Public video requests remain on the shared Seedance content contract.
Confidence: high
Scope-risk: narrow
Tested: channel constants, endpoint classification, adaptor registration, and white-label detection
```

### Task 2: Map Seedance requests to ModelAPI and parse task responses

**Files:**
- Create: `relay/channel/task/modelapiseedance/constants.go`
- Create: `relay/channel/task/modelapiseedance/types.go`
- Create: `relay/channel/task/modelapiseedance/adaptor.go`
- Create: `relay/channel/task/modelapiseedance/adaptor_test.go`

- [ ] **Step 1: Write failing mapping and validation tests**

Tests must call the pure mapping function and `ValidateRequestAndSetAction` for these cases:

```go
func TestBuildCreateRequestPreservesExplicitFalseAndZero(t *testing.T) {
    zero := int64(0)
    no := false
    req := dto.SeedanceVideoRequest{
        Model: "seedance-2.5",
        Content: []dto.SeedanceContent{{Type: "text", Text: "prompt"}},
        Seed: &zero,
        GenerateAudio: &no,
        Watermark: &no,
    }
    got, err := buildModelAPICreateRequest(&req)
    require.NoError(t, err)
    require.Equal(t, "doubao-seedance-2-5-260628", got.Model)
    require.NotNil(t, got.Params.Seed)
    require.Zero(t, *got.Params.Seed)
    require.NotNil(t, got.Params.GenerateAudio)
    require.False(t, *got.Params.GenerateAudio)
}
```

Add table tests for role mapping, duration 4–30, resolutions, aspect ratios, image/video/audio/total limits, single first/last frame, last-without-first rejection, and invalid roles.

- [ ] **Step 2: Run mapping tests and verify RED**

```powershell
$env:GOCACHE="$PWD\.tmp-gocache"
go test -p 1 ./relay/channel/task/modelapiseedance -run 'Build|Validate' -count=1
```

Expected: package or functions do not exist.

- [ ] **Step 3: Implement request types and pure mapping**

The outbound types use pointers for optional scalars:

```go
type createRequest struct {
    Model  string      `json:"model"`
    Input  createInput `json:"input"`
    Params createParams `json:"params"`
}

type createParams struct {
    Duration        *int     `json:"duration,omitempty"`
    Resolution      string   `json:"resolution,omitempty"`
    AspectRatio     string   `json:"aspect_ratio,omitempty"`
    Seed            *int64   `json:"seed,omitempty"`
    GenerateAudio   *bool    `json:"generate_audio,omitempty"`
    Watermark       *bool    `json:"watermark,omitempty"`
    ReturnLastFrame *bool    `json:"return_last_frame,omitempty"`
}
```

Use `taskcommon.BindSeedanceRequest`, `common.MarshalNoHTMLEscape`, and no direct `encoding/json` calls.

- [ ] **Step 4: Write failing submit/fetch/parse tests**

Use `httptest.Server` to assert:

- create path is `/v1/tasks`;
- poll path is `/v1/tasks/{upstream_task_id}`;
- `Authorization: Bearer <key>` is set;
- submit response returns the upstream task ID internally;
- statuses map to queued/in-progress/success/failure;
- success selects the asset whose `type` is `video`, even when it is not first;
- missing video asset returns an error;
- failure reason is scrubbed.

- [ ] **Step 5: Run response tests and verify RED**

```powershell
go test -p 1 ./relay/channel/task/modelapiseedance -run 'Request|Response|Fetch|Parse' -count=1
```

- [ ] **Step 6: Implement request, response, status, billing, and OpenAI-video conversion**

Embed `taskcommon.BaseBilling`. `ConvertToOpenAIVideo` must use `originTask.GetResultURL()` only. `ParseTaskResult` may expose the upstream asset URL only in the in-memory `relaycommon.TaskInfo.Url` field required by the archive stage.

- [ ] **Step 7: Run all package tests and verify GREEN**

```powershell
go test -p 1 ./relay/channel/task/modelapiseedance -count=1
```

- [ ] **Step 8: Commit with a Lore message**

```text
Translate the shared Seedance contract without leaking supplier semantics

Constraint: Explicit false and zero values must survive the upstream conversion.
Rejected: Provider-specific client input | It would break channel failover and the Seedance SOP.
Confidence: high
Scope-risk: moderate
Tested: request mapping, validation, authentication, submission, polling, and status conversion
```

### Task 3: Generalize video-result channel labels with fixed cardinality

**Files:**
- Create: `service/video_result_channels.go`
- Create: `service/video_result_channels_test.go`
- Modify: `service/video_result_storage.go`
- Modify: `service/video_result_storage_test.go`
- Modify: `pkg/perf_metrics/video_result.go`
- Modify: `pkg/perf_metrics/video_result_test.go`
- Modify: `controller/video_proxy.go`
- Modify: `controller/video_proxy_video_result_test.go`

- [ ] **Step 1: Write failing label and metric tests**

```go
func TestVideoResultChannelLabel(t *testing.T) {
    require.Equal(t, "techmobi", VideoResultChannelLabel(constant.ChannelTypeTechMobiVideo))
    require.Equal(t, "modelapi", VideoResultChannelLabel(constant.ChannelTypeModelAPISeedance))
    require.Empty(t, VideoResultChannelLabel(constant.ChannelTypeOpenAI))
}
```

Record one `modelapi` archive and redirect and assert the exact Prometheus series are exported.

- [ ] **Step 2: Run tests and verify RED**

```powershell
go test -p 1 ./service ./controller ./pkg/perf_metrics -run 'VideoResultChannel|ModelAPI.*Metric|ArchivedModelAPI' -count=1
```

- [ ] **Step 3: Implement the fixed registry and channel-aware archive wrapper**

Keep the compatibility wrapper:

```go
func ArchiveVideoResult(ctx context.Context, publicTaskID, upstreamURL, proxy string) (*model.VideoResult, error) {
    return ArchiveVideoResultForChannel(ctx, "techmobi", publicTaskID, upstreamURL, proxy)
}
```

The generic function accepts only the fixed label derived from the channel registry. Expand metric arrays from `techmobi` to `techmobi,modelapi`; reject/ignore unknown labels through existing index validation.

- [ ] **Step 4: Run the Step 2 command and verify GREEN**

- [ ] **Step 5: Commit with a Lore message**

```text
Reuse durable video delivery without creating unbounded telemetry

Constraint: Metrics labels are fixed and may never contain upstream or storage identifiers.
Confidence: high
Scope-risk: narrow
Tested: channel registry, archive compatibility wrapper, and fixed Prometheus series
```

### Task 4: Archive ModelAPI success before terminal CAS and redact stored polling data

**Files:**
- Modify: `service/task_polling.go`
- Modify: `service/task_polling_video_result_test.go`
- Modify: `relay/channel/task/modelapiseedance/adaptor.go`
- Modify: `relay/channel/task/modelapiseedance/adaptor_test.go`

- [ ] **Step 1: Write failing polling tests**

Add ModelAPI variants proving:

- archive hook receives the selected upstream URL and proxy;
- persisted `ResultURL` equals `/v1/videos/{public_task_id}/content`;
- `VideoResult` is present at the successful CAS;
- archive failure returns a polling error, leaves the task non-terminal, and does not settle;
- persisted `task.Data` does not contain `https://`, `modelapi`, the upstream host, or the selected asset URL;
- a second node losing the CAS does not settle twice.

- [ ] **Step 2: Run tests and verify RED**

```powershell
go test -p 1 ./service -run 'ModelAPI.*Archive|ModelAPI.*Redact|UpdateVideoSingleTask' -count=1
```

- [ ] **Step 3: Generalize the polling archive gate**

Replace the TechMobi-only condition with `VideoResultChannelLabel(channel.Type)`. For an upstream success:

```go
label := VideoResultChannelLabel(channel.Type)
if label != "" {
    archived, err := archiveVideoResultForChannel(ctx, label, task.TaskID, taskResult.Url, channel.GetProxy())
    if err != nil { return err }
    privateData.VideoResult = archived
    privateData.ResultURL = taskcommon.BuildVideoContentURL(task.TaskID)
}
```

Before assigning the polling body to `task.Data`, call a channel-owned sanitizer that recursively clears asset URLs. Do not log the raw response or URL.

- [ ] **Step 4: Run service and adaptor tests and verify GREEN**

```powershell
go test -p 1 ./service ./relay/channel/task/modelapiseedance -run 'ModelAPI|UpdateVideoSingleTask|ParseTaskResult' -count=1
```

- [ ] **Step 5: Commit with a Lore message**

```text
Do not report generated video success before a durable copy exists

Constraint: Terminal settlement remains guarded by the existing multi-node CAS.
Rejected: Persisting the upstream asset URL for later download | It leaks supplier data and expires independently.
Confidence: high
Scope-risk: moderate
Directive: New archive channels must register a fixed label and a response sanitizer.
Tested: archive ordering, retry behavior, redaction, and exactly-once settlement
```

### Task 5: Keep Flatkey URLs public and make ModelAPI downloads GCS-only

**Files:**
- Modify: `controller/video_proxy.go`
- Modify: `controller/video_proxy_video_result_test.go`

- [ ] **Step 1: Write failing controller tests**

```go
func TestArchivedModelAPIVideoRedirect(t *testing.T) {
    // channel 111 + archived metadata + signer hook
    // assert 302, exact Location, no-store, and empty response body
}

func TestModelAPIVideoWithoutArchiveDoesNotFallbackUpstream(t *testing.T) {
    // successful ModelAPI task with URL-shaped task.Data and nil VideoResult
    // assert safe 502 and assert the upstream httptest server received zero requests
}
```

Retain the existing TechMobi legacy fallback test unchanged.

- [ ] **Step 2: Run tests and verify RED**

```powershell
go test -p 1 ./controller -run 'ArchivedModelAPI|ModelAPI.*WithoutArchive|LegacyTechMobi' -count=1
```

- [ ] **Step 3: Implement strict ModelAPI content delivery**

Use the generic archived redirect helper for registered channels. Immediately after it returns false, detect `ChannelTypeModelAPISeedance` and return the safe unavailable response. Do not add a ModelAPI upstream extractor or fallback branch.

- [ ] **Step 4: Run controller tests and verify GREEN**

- [ ] **Step 5: Commit with a Lore message**

```text
Keep Flatkey as the only public video address while Google serves the bytes

Constraint: ModelAPI tasks may never fall back to an upstream source URL.
Confidence: high
Scope-risk: moderate
Tested: GCS redirect, expiry/storage/signing errors, strict no-archive failure, and TechMobi legacy compatibility
```

### Task 6: Add console channel metadata and complete verification

**Files:**
- Modify: `web/default/src/features/channels/constants.ts`
- Modify: `web/default/src/features/channels/constants.test.ts`
- Modify: `web/default/src/features/channels/lib/channel-type-config.ts`
- Modify: `web/default/src/features/channels/lib/channel-utils.ts`
- Modify: `web/classic/src/constants/channel.constants.js`

- [ ] **Step 1: Write failing console constant test**

```ts
test('ModelAPISeedance channel is selectable but not model-fetchable', () => {
  expect(CHANNEL_TYPES[111]).toBe('ModelAPISeedance')
  expect(MODEL_FETCH_CHANNEL_TYPES).not.toContain(111)
})
```

- [ ] **Step 2: Run the frontend test and verify RED**

```powershell
Push-Location web/default
bun test src/features/channels/constants.test.ts
Pop-Location
```

- [ ] **Step 3: Add channel labels, API-key hint, icon-family mapping, and classic option**

Reuse an existing Doubao/Seedance icon family; do not add a dependency or public marketing copy.

- [ ] **Step 4: Run frontend test and build**

```powershell
Push-Location web/default
bun test src/features/channels/constants.test.ts
bun run build
Pop-Location
```

- [ ] **Step 5: Run fresh backend verification**

```powershell
$env:GOCACHE="$PWD\.tmp-gocache"
go test -p 1 ./constant ./common ./relay/channel/task/taskcommon ./relay/channel/task/modelapiseedance ./service ./controller ./pkg/perf_metrics -count=1
go test -p 1 ./relay/... -count=1
go build ./...
go vet ./constant ./common ./relay/... ./service ./controller ./pkg/perf_metrics
git diff --check
rg -n 'encoding/json|api\.modelapi\.co|result\.assets|taskResult\.Url' relay/channel/task/modelapiseedance service controller
```

Review every search match: JSON calls must use `common.*`; supplier host and asset URLs may appear only in internal constants/parsers/tests, never client messages or logs.

- [ ] **Step 6: Request independent code review and fix every Critical/Important finding**

The review must explicitly report:

- `Router deploy: required`;
- `Console deploy: required`;
- `Other deploy targets: no website/Terraform/Cloudflare`;
- staging live-channel validation is required before production.

- [ ] **Step 7: Re-run the affected tests after review fixes and commit**

```text
Expose the new video supplier through existing Flatkey administration surfaces

Constraint: The supplier is configurable only as an internal channel and is not public marketing content.
Confidence: high
Scope-risk: moderate
Tested: console constants, frontend build, targeted Go tests, relay tests, full Go build, vet, and diff checks
Not-tested: Live upstream generation and production deployment
```
