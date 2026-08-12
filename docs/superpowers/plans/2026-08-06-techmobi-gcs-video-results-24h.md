# TechMobi GCS Video Results 24h Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Archive every newly successful TechMobi generated video to a private Google Cloud Storage result bucket, serve it through a short-lived V4 signed `302` for exactly 24 hours, and delete the object with an age-one-day lifecycle rule.

**Architecture:** Add result metadata to `TaskPrivateData`, a focused `service/video_result_storage.go` boundary for streaming upstream bytes into GCS with create-only generation preconditions, and a controller redirect path that signs an immutable generation. The task poller archives before the success CAS and billing settlement; failures leave the task pollable so a later round retries. Terraform owns the two private buckets and IAM, while GitHub deployment workflows own live Cloud Run environment variables.

**Tech Stack:** Go 1.22+, Gin, GORM JSON fields, Google Cloud Storage Go client, IAM Credentials V4 signing, Terraform Google provider, GitHub Actions, package-local fakes and `httptest`.

---

## File structure

- Create `service/video_result_storage.go`: configuration, object-key generation, streaming archive, create-only GCS writer, metadata verification, and V4 download signing.
- Create `service/video_result_storage_test.go`: configuration, size/MIME limits, idempotency, signing TTL, generation pinning, expiry, and error semantics.
- Modify `model/task.go`: add the private `VideoResult` JSON payload without a database migration.
- Modify `model/task_cas_test.go`: prove JSON round-trip, snapshots, and CAS preserve result metadata.
- Modify `service/task_polling.go`: archive TechMobi results before success persistence/settlement and remove URLs from new persisted/logged response data.
- Create `service/task_polling_video_result_test.go`: prove archive-before-success, retry-on-error, and no duplicate settlement.
- Modify `controller/video_proxy.go`: redirect archived TechMobi results and retain the existing proxy fallback for historical tasks.
- Create `controller/video_proxy_video_result_test.go`: prove 302/410/502/503 behavior and legacy fallback selection.
- Create `pkg/perf_metrics/video_result.go` and `pkg/perf_metrics/video_result_test.go`: bounded fixed-label counters/histograms for archive and redirect outcomes.
- Modify `pkg/perf_metrics/prometheus.go`: include video-result series in scrape budgeting/output.
- Create `deploy/gcp/envs/prod/video_result_storage.tf`: production/staging result buckets and least-privilege object IAM.
- Modify `deploy/gcp/envs/prod/main.tf`, `deploy/gcp/envs/prod/staging.tf`, `deploy/gcp/envs/prod/outputs.tf`, `deploy/gcp/modules/cloud-run/main.tf`, and `deploy/gcp/modules/cloud-run/variables.tf`: seed result-bucket configuration for new services.
- Modify `.github/workflows/gcp-deploy.yml` and `.github/workflows/gcp-deploy-staging.yml`: preserve result configuration in every live console/router/staging deployment.

### Task 1: Private task metadata and configuration contract

**Files:**
- Modify: `model/task.go:150-159`
- Modify: `model/task_cas_test.go`
- Create: `service/video_result_storage.go`
- Create: `service/video_result_storage_test.go`

- [ ] **Step 1: Write failing model and configuration tests**

Add tests that express the exact private JSON shape and environment bounds:

```go
func TestTaskPrivateDataVideoResultJSONRoundTrip(t *testing.T) {
    original := TaskPrivateData{VideoResult: &VideoResult{
        Bucket: "results", Object: "video-results/20260806/task_public.mp4",
        Generation: 17, ContentType: "video/mp4", Size: 123,
        StoredAt: 1000, ExpiresAt: 87400,
    }}
    value, err := original.Value()
    require.NoError(t, err)
    var decoded TaskPrivateData
    require.NoError(t, decoded.Scan(value))
    require.Equal(t, original.VideoResult, decoded.VideoResult)
}

func TestVideoResultStorageConfigDefaultsAndBounds(t *testing.T) {
    t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "result-bucket")
    cfg := CurrentVideoResultStorageConfig()
    require.Equal(t, "result-bucket", cfg.Bucket)
    require.Equal(t, 15*time.Minute, cfg.SignedURLTTL)
    require.Equal(t, 24*time.Hour, cfg.Retention)
    require.Equal(t, 30*time.Minute, cfg.FetchTimeout)
    require.Equal(t, int64(500<<20), cfg.MaxBytes)

    t.Setenv("VIDEO_RESULT_SIGNED_URL_TTL_SECONDS", "7200")
    t.Setenv("VIDEO_RESULT_FETCH_TIMEOUT_SECONDS", "7200")
    require.Equal(t, time.Hour, CurrentVideoResultStorageConfig().SignedURLTTL)
    require.Equal(t, 30*time.Minute, CurrentVideoResultStorageConfig().FetchTimeout)
}
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
$env:GOCACHE="$PWD\.tmp-gocache"; go test -p 1 ./model ./service -run 'TestTaskPrivateDataVideoResultJSONRoundTrip|TestVideoResultStorageConfigDefaultsAndBounds' -count=1
```

Expected: compile failure because `VideoResult` and `CurrentVideoResultStorageConfig` do not exist.

- [ ] **Step 3: Add the minimal private model and configuration**

Add the model type and field:

```go
type VideoResult struct {
    Bucket      string `json:"bucket"`
    Object      string `json:"object"`
    Generation  int64  `json:"generation"`
    ContentType string `json:"content_type"`
    Size        int64  `json:"size"`
    StoredAt    int64  `json:"stored_at"`
    ExpiresAt   int64  `json:"expires_at"`
}

type TaskPrivateData struct {
    // existing fields...
    VideoResult *VideoResult `json:"video_result,omitempty"`
}
```

In the new service file add constants and clamped configuration:

```go
type VideoResultStorageConfig struct {
    Bucket, ServiceAccountEmail string
    SignedURLTTL, Retention, FetchTimeout time.Duration
    MaxBytes int64
}

func CurrentVideoResultStorageConfig() VideoResultStorageConfig {
    // VIDEO_RESULT_STORAGE_BUCKET
    // VIDEO_RESULT_SIGNED_URL_TTL_SECONDS: default 900, clamp to 3600
    // VIDEO_RESULT_RETENTION_SECONDS: default/fallback 86400
    // VIDEO_RESULT_FETCH_TIMEOUT_SECONDS: default/fallback/clamp 1800
    // VIDEO_RESULT_MAX_BYTES: default/fallback/clamp 500 MiB
}
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit the contract**

Commit with Lore trailers:

```text
Persist generated-video archive ownership with each task

Constraint: Archive metadata must not add a database column or enter public DTOs.
Confidence: high
Scope-risk: narrow
Tested: focused model JSON and storage configuration tests
```

### Task 2: Streaming, bounded, idempotent GCS archive service

**Files:**
- Modify: `service/video_result_storage.go`
- Modify: `service/video_result_storage_test.go`

- [ ] **Step 1: Write failing archive tests with an `httptest.Server` and fake object store**

Define the wished-for store boundary and behaviors:

```go
type VideoResultObjectStore interface {
    Create(context.Context, string, string, io.Reader, VideoResultCreateOptions) (VideoResultObjectAttrs, error)
    Attrs(context.Context, string, string) (VideoResultObjectAttrs, error)
    SignURL(context.Context, string, string, AssetSignedURLRequest) (string, error)
}

func TestArchiveVideoResultStreamsAndReturnsMetadata(t *testing.T) {
    upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
        w.Header().Set("Content-Type", "video/mp4")
        _, _ = w.Write([]byte("video-bytes"))
    }))
    defer upstream.Close()
    store := newFakeVideoResultStore()
    withVideoResultTestDeps(t, store, time.Date(2026, 8, 6, 12, 0, 0, 0, time.UTC))
    t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "results")

    got, err := ArchiveVideoResult(context.Background(), "task_public123", upstream.URL, "")

    require.NoError(t, err)
    require.Equal(t, "results", got.Bucket)
    require.Equal(t, "video-results/20260806/task_public123.mp4", got.Object)
    require.Equal(t, int64(17), got.Generation)
    require.Equal(t, int64(len("video-bytes")), got.Size)
    require.Equal(t, got.StoredAt+86400, got.ExpiresAt)
    require.Equal(t, []byte("video-bytes"), store.createdBody)
    require.True(t, store.createOptions.DoesNotExist)
}
```

Add separate concrete table cases with these exact inputs and assertions:

| Test | Input | Required assertion |
| --- | --- | --- |
| `TestArchiveVideoResultRejectsNonVideoContent` | upstream `Content-Type: text/plain` | `errors.Is(err, ErrVideoResultInvalidContent)` and fake store `Create` call count is zero |
| `TestArchiveVideoResultStopsAboveMaxBytes` | config `MaxBytes=4`, upstream body `12345` | `errors.Is(err, ErrVideoResultTooLarge)` and fake store marks the attempted write unfinalized |
| `TestArchiveVideoResultReusesValidCreateConflict` | `Create` returns `ErrVideoResultAlreadyExists`, `Attrs` returns generation 23, size 9, `video/mp4` | success metadata reuses generation 23 and exactly one `Attrs` call |
| `TestArchiveVideoResultRejectsInvalidExistingObject` | conflict attrs have size zero or `text/plain` | `errors.Is(err, ErrVideoResultUnavailable)` |
| `TestVideoResultObjectKeyRejectsInvalidTaskID` | `../escape`, `video`, and `task_/slash` | each returns `ErrVideoResultInvalidTaskID`; `task_Abc123` produces the exact dated `.mp4` key |

- [ ] **Step 2: Run archive tests and verify RED**

Run:

```powershell
$env:GOCACHE="$PWD\.tmp-gocache"; go test -p 1 ./service -run 'TestArchiveVideoResult|TestVideoResultObjectKey' -count=1
```

Expected: compile failure for the missing archive API and store types.

- [ ] **Step 3: Implement minimal streaming archive behavior**

Implement:

```go
func ArchiveVideoResult(ctx context.Context, publicTaskID, upstreamURL, proxy string) (*model.VideoResult, error)
```

The function must:

```go
startedAt := videoResultNow().UTC()
objectKey, err := videoResultObjectKey(publicTaskID, startedAt)
// Validate upstreamURL with system_setting.GetFetchSetting() before network I/O.
// Use GetHttpClientWithProxy(proxy), a FetchTimeout context, and accept only 2xx.
// Require a parsed video/* Content-Type.
// Wrap resp.Body in a reader that returns ErrVideoResultTooLarge after MaxBytes.
attrs, err := videoResultStore.Create(ctx, cfg.Bucket, objectKey, bounded, VideoResultCreateOptions{
    ContentType: contentType,
    CacheControl: "private, max-age=0, no-store",
    ContentDisposition: fmt.Sprintf(`attachment; filename="%s.mp4"`, publicTaskID),
    DoesNotExist: true,
})
// On ErrVideoResultAlreadyExists, read Attrs and reuse only a non-zero video object.
storedAt := attrs.Created.UTC()
return &model.VideoResult{Bucket: cfg.Bucket, Object: objectKey, Generation: attrs.Generation,
    ContentType: attrs.ContentType, Size: attrs.Size, StoredAt: storedAt.Unix(),
    ExpiresAt: storedAt.Add(cfg.Retention).Unix()}, nil
```

The GCS implementation must set `storage.Conditions{DoesNotExist: true}` before `NewWriter`, call `CloseWithError` after any copy error, translate HTTP 412 to `ErrVideoResultAlreadyExists`, and return writer/object attributes including creation time and generation.

- [ ] **Step 4: Run archive tests and verify GREEN**

Run the Step 2 command. Expected: PASS with no network access outside `httptest`.

- [ ] **Step 5: Commit the archive service**

```text
Guarantee a usable private copy before accepting video success

Constraint: Multiple Cloud Run instances may archive the same task concurrently.
Rejected: Process-local locks | They do not coordinate across instances.
Confidence: high
Scope-risk: moderate
Tested: bounded streaming, MIME validation, create conflict reuse, and object-key tests
```

### Task 3: Gate TechMobi success on archive completion

**Files:**
- Modify: `service/task_polling.go:349-513`
- Create: `service/task_polling_video_result_test.go`

- [ ] **Step 1: Write failing poller tests**

Use a package-level injected function variable so tests can prove ordering without GCS:

```go
var archiveTechMobiVideoResult = ArchiveVideoResult

func TestRedactTechMobiResponseRemovesUpstreamURL(t *testing.T) {
    input := []byte(`{"id":"upstream","status":"succeeded","content":[{"type":"video_url","video_url":{"url":"https://secret.example/video.mp4"}}],"usage":{"completion_tokens":7}}`)
    got := redactTechMobiVideoResponseBody(input)
    require.NotContains(t, string(got), "secret.example")
    require.Contains(t, string(got), `"status":"succeeded"`)
    require.Contains(t, string(got), `"completion_tokens":7`)
}
```

Add poller database/fake-adaptor cases with these exact assertions:

| Test | Archive behavior | Required assertion |
| --- | --- | --- |
| `TestUpdateVideoSingleTaskArchivesTechMobiBeforeSuccessCAS` | returns a complete `model.VideoResult` | reloaded task is success and contains identical metadata; settlement hook runs once after the winning CAS |
| `TestUpdateVideoSingleTaskArchiveFailureLeavesTaskRetryable` | returns `errFakeVideoResultStore` | function returns an archive error; reloaded task keeps its prior status; no settlement/refund hook runs |
| `TestUpdateVideoSingleTaskExistingArchiveDoesNotDownloadAgain` | fake fails the test if called | existing metadata remains unchanged and the normal success CAS/settlement completes once |

- [ ] **Step 2: Run poller tests and verify RED**

Run:

```powershell
$env:GOCACHE="$PWD\.tmp-gocache"; go test -p 1 ./service -run 'TestUpdateVideoSingleTask.*Archive|TestRedactTechMobiResponse' -count=1
```

Expected: tests fail because successful tasks currently transition before archiving.

- [ ] **Step 3: Insert the TechMobi-only archive gate**

Before assigning the final success state, implement the equivalent of:

```go
if taskResult.Status == model.TaskStatusSuccess && ch.Type == constant.ChannelTypeTechMobiVideo && task.PrivateData.VideoResult == nil {
    result, archiveErr := archiveTechMobiVideoResult(ctx, task.TaskID, taskResult.Url, proxy)
    if archiveErr != nil {
        perfmetrics.RecordVideoResultArchive("techmobi", "retry", 0, time.Since(archiveStarted))
        return fmt.Errorf("archive TechMobi result for task %s: %w", task.TaskID, archiveErr)
    }
    task.PrivateData.VideoResult = result
    task.Data = redactTechMobiVideoResponseBody(task.Data)
}
```

Do not change status, finish time, CAS, settlement, or refund before this block returns successfully. Avoid logging the raw TechMobi response or `taskResult.Url`; logs may include only public task ID, channel, phase, status, bytes, and elapsed time.

- [ ] **Step 4: Run poller and billing tests and verify GREEN**

Run:

```powershell
$env:GOCACHE="$PWD\.tmp-gocache"; go test -p 1 ./service -run 'TestUpdateVideoSingleTask.*Archive|TestRedactTechMobiResponse|Test.*Task.*Billing|Test.*CAS' -count=1
```

Expected: PASS; archive failure cannot settle the task.

- [ ] **Step 5: Commit the polling integration**

```text
Keep TechMobi tasks retryable until their download copy is durable

Constraint: Billing settlement must remain guarded by the existing success CAS.
Confidence: high
Scope-risk: moderate
Directive: Do not broaden this archive gate to other video channels without channel-specific validation.
Tested: archive ordering, retry behavior, redaction, and billing/CAS-focused tests
```

### Task 4: Redirect archived downloads and preserve legacy fallback

**Files:**
- Modify: `service/video_result_storage.go`
- Modify: `service/video_result_storage_test.go`
- Modify: `controller/video_proxy.go:39-218`
- Create: `controller/video_proxy_video_result_test.go`

- [ ] **Step 1: Write failing signer and controller decision tests**

```go
func TestSignVideoResultDownloadUsesMinimumRemainingTTLAndGeneration(t *testing.T) {
    now := time.Unix(1_000, 0).UTC()
    store := newFakeVideoResultStore()
    store.attrs = VideoResultObjectAttrs{Generation: 17, Size: 12, ContentType: "video/mp4", Created: now.Add(-time.Hour)}
    withVideoResultTestDeps(t, store, now)
    result := &model.VideoResult{Bucket: "results", Object: "video-results/20260806/task_public.mp4", Generation: 17, Size: 12, ContentType: "video/mp4", ExpiresAt: now.Add(5 * time.Minute).Unix()}

    got, err := SignVideoResultDownload(context.Background(), "task_public", result)

    require.NoError(t, err)
    require.Equal(t, "https://signed.example/video", got)
    require.Equal(t, 5*time.Minute, store.signedRequest.TTL)
    require.Equal(t, "17", store.signedRequest.QueryParameters.Get("generation"))
}
```

Add separate cases with exact mappings:

| Test | Store/time condition | Required assertion |
| --- | --- | --- |
| `TestSignVideoResultDownloadExpired` | `now == ExpiresAt` | `errors.Is(err, ErrVideoResultExpired)` and no attrs/sign calls |
| `TestSignVideoResultDownloadMissingObject` | attrs returns object-not-found | `errors.Is(err, ErrVideoResultUnavailable)` |
| `TestSignVideoResultDownloadSignerFailure` | valid attrs, signer returns error | `errors.Is(err, ErrVideoResultSigning)` |
| `TestArchivedTechMobiVideoProxyRedirects` | signer hook returns `https://signed.example/video` | status 302, exact `Location`, `Cache-Control: no-store`, empty body |
| `TestArchivedTechMobiVideoProxyMapsErrors` | table of expired/unavailable/signing sentinels | statuses 410/502/503 and signed URL absent from every body |
| `TestLegacyTechMobiVideoProxyStillUsesPersistedUpstreamData` | `VideoResult=nil`, task data points to local `httptest` video | existing path streams status 200 and exact bytes |

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
$env:GOCACHE="$PWD\.tmp-gocache"; go test -p 1 ./service ./controller -run 'TestSignVideoResultDownload|TestArchivedTechMobiVideoProxy|TestLegacyTechMobiVideoProxy' -count=1
```

Expected: compile/test failure because no archived redirect path exists.

- [ ] **Step 3: Implement immutable generation signing and controller mapping**

Implement:

```go
func SignVideoResultDownload(ctx context.Context, taskID string, result *model.VideoResult) (string, error)
```

It must check `now < expires_at`, fetch attrs, verify generation/size/video MIME, compute `min(configuredTTL, oneHour, remaining)`, and sign a V4 GET using `generation=<stored generation>` plus a safe attachment filename. In `VideoProxy`, immediately after channel lookup and before creating the upstream proxy request:

```go
if channel.Type == constant.ChannelTypeTechMobiVideo && task.PrivateData.VideoResult != nil {
    signedURL, err := service.SignVideoResultDownload(c.Request.Context(), task.TaskID, task.PrivateData.VideoResult)
    switch {
    case errors.Is(err, service.ErrVideoResultExpired): videoProxyError(c, http.StatusGone, "video_expired", "Video result has expired")
    case errors.Is(err, service.ErrVideoResultUnavailable): videoProxyError(c, http.StatusBadGateway, "storage_error", "Video result is temporarily unavailable")
    case err != nil: videoProxyError(c, http.StatusServiceUnavailable, "signing_error", "Video download is temporarily unavailable")
    default:
        c.Header("Cache-Control", "no-store")
        c.Redirect(http.StatusFound, signedURL)
    }
    return
}
```

Never log the signed URL. Leave the existing `ExtractUpstreamVideoURL(task.Data)` branch untouched for records without `VideoResult`.

- [ ] **Step 4: Run signer/controller tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit download delivery**

```text
Move archived video bytes off Cloud Run without widening access

Constraint: Public API URLs remain stable and the result bucket remains private.
Rejected: Permanent public object URLs | They bypass the 24-hour access contract.
Confidence: high
Scope-risk: moderate
Tested: TTL/generation signing, HTTP error mapping, redirect headers, and legacy fallback
```

### Task 5: Bounded Prometheus observability

**Files:**
- Create: `pkg/perf_metrics/video_result.go`
- Create: `pkg/perf_metrics/video_result_test.go`
- Modify: `pkg/perf_metrics/prometheus.go`
- Modify: `service/video_result_storage.go`
- Modify: `service/task_polling.go`
- Modify: `controller/video_proxy.go`

- [ ] **Step 1: Write failing metric export tests**

Use fixed labels only (`channel=techmobi`; enumerated outcomes/reasons):

```go
func TestVideoResultMetricsExportFixedSeries(t *testing.T) {
    resetVideoResultMetricsForTest()
    RecordVideoResultArchive("techmobi", "success", 123, 2*time.Second)
    RecordVideoResultRedirect("techmobi", "success")
    text, err := BuildPrometheusText(context.Background())
    require.NoError(t, err)
    require.Contains(t, text, `newapi_video_result_archive_total{channel="techmobi",outcome="success"} 1`)
    require.Contains(t, text, `newapi_video_result_archive_bytes_total{channel="techmobi"} 123`)
    require.Contains(t, text, `newapi_video_result_redirect_total{channel="techmobi",outcome="success"} 1`)
}
```

- [ ] **Step 2: Run metric tests and verify RED**

Run:

```powershell
$env:GOCACHE="$PWD\.tmp-gocache"; go test -p 1 ./pkg/perf_metrics -run TestVideoResultMetrics -count=1
```

Expected: compile failure for missing recorders.

- [ ] **Step 3: Implement atomic fixed-cardinality metrics**

Follow `byteplus_real_person.go`: atomic arrays, fixed-label index validation, snapshot/reset helpers, series budgeting, and text export for:

- `newapi_video_result_archive_total{channel,outcome}`
- `newapi_video_result_archive_bytes_total{channel}`
- `newapi_video_result_archive_duration_seconds_{bucket,sum,count}{channel}`
- `newapi_video_result_redirect_total{channel,outcome}`
- `newapi_video_result_archive_retry_total{channel,reason}`

Call recorders at archive success/failure/reuse, polling retry, and redirect outcomes. Never use task IDs, URLs, bucket names, or object names as labels.

- [ ] **Step 4: Run metric and caller tests and verify GREEN**

```powershell
$env:GOCACHE="$PWD\.tmp-gocache"; go test -p 1 ./pkg/perf_metrics ./service ./controller -run 'TestVideoResultMetrics|TestArchiveVideoResult|TestArchivedTechMobiVideoProxy' -count=1
```

- [ ] **Step 5: Commit observability**

```text
Make temporary-video delivery failures visible without cardinality risk

Constraint: Prometheus labels must remain fixed and must never contain storage identifiers.
Confidence: high
Scope-risk: narrow
Tested: metric recording, scrape output, and series accounting
```

### Task 6: Provision isolated 24-hour buckets and deploy configuration

**Files:**
- Create: `deploy/gcp/envs/prod/video_result_storage.tf`
- Modify: `deploy/gcp/envs/prod/main.tf`
- Modify: `deploy/gcp/envs/prod/staging.tf`
- Modify: `deploy/gcp/envs/prod/outputs.tf`
- Modify: `deploy/gcp/modules/cloud-run/main.tf`
- Modify: `deploy/gcp/modules/cloud-run/variables.tf`
- Modify: `.github/workflows/gcp-deploy.yml`
- Modify: `.github/workflows/gcp-deploy-staging.yml`

- [ ] **Step 1: Add static checks before infrastructure changes**

Create a small repository test or PowerShell verification block that fails until both bucket resources contain all invariants:

```powershell
rg -n 'vocai-gemini-prod-video-results(-staging)?' deploy/gcp/envs/prod/video_result_storage.tf
rg -n 'retention_duration_seconds\s*=\s*0|age\s*=\s*1|public_access_prevention\s*=\s*"enforced"|enabled\s*=\s*false' deploy/gcp/envs/prod/video_result_storage.tf
rg -n 'VIDEO_RESULT_STORAGE_BUCKET|VIDEO_RESULT_RETENTION_SECONDS|VIDEO_RESULT_SIGNED_URL_TTL_SECONDS|VIDEO_RESULT_FETCH_TIMEOUT_SECONDS|VIDEO_RESULT_MAX_BYTES' .github/workflows/gcp-deploy.yml .github/workflows/gcp-deploy-staging.yml
```

Expected initially: no matches for the result resources/configuration.

- [ ] **Step 2: Add buckets and least-privilege IAM**

Create production and conditional staging buckets in `var.region` with:

```hcl
uniform_bucket_level_access = true
public_access_prevention    = "enforced"
force_destroy               = false
versioning { enabled = false }
soft_delete_policy { retention_duration_seconds = 0 }
lifecycle_rule {
  action { type = "Delete" }
  condition { age = 1 }
}
```

Use names `vocai-gemini-prod-video-results` and `vocai-gemini-prod-video-results-staging`, labels `app=newapi`, the proper environment, and `data_class=generated-video-results`. Grant only `roles/storage.objectUser` to the production runtime SA and conditional staging runtime SA. Reuse existing self `roles/iam.serviceAccountTokenCreator`; do not add public IAM or static keys.

- [ ] **Step 3: Seed Terraform module variables and CI-owned live env**

Add `video_result_storage_bucket` to the Cloud Run module and render `VIDEO_RESULT_STORAGE_BUCKET` when non-empty. Pass it to legacy, router, and console modules and add the staging service env. In both workflows set:

```yaml
VIDEO_RESULT_STORAGE_BUCKET: vocai-gemini-prod-video-results # staging uses -staging
VIDEO_RESULT_RETENTION_SECONDS: '86400'
VIDEO_RESULT_SIGNED_URL_TTL_SECONDS: '900'
VIDEO_RESULT_FETCH_TIMEOUT_SECONDS: '1800'
VIDEO_RESULT_MAX_BYTES: '524288000'
```

Include all five names in every `env_vars` loop/list for production console, production router, and staging. Keep Cloud Run `ignore_changes` behavior unchanged.

- [ ] **Step 4: Format and validate Terraform without applying**

Run:

```powershell
terraform -chdir=deploy/gcp fmt -check -recursive
terraform -chdir=deploy/gcp/envs/prod init -backend=false
terraform -chdir=deploy/gcp/envs/prod validate
terraform -chdir=deploy/gcp/envs/prod plan -refresh=false -lock=false -input=false -out="$env:TEMP\techmobi-video-results.tfplan"
```

Expected: format and validate pass. Plan must show only the two result buckets, their bucket IAM, outputs, and initial env references; no Cloud Run image/traffic/VPC drift. If credentials/state prevent plan, record the exact gap and keep fmt/validate evidence. Do not run `terraform apply`.

- [ ] **Step 5: Commit infrastructure and deployment wiring**

```text
Limit generated-video storage to the promised download window

Constraint: Live Cloud Run env is deployment-workflow owned and production apply requires separate approval.
Rejected: Reusing the source-asset bucket | Its versioning and soft-delete policy retain generated bytes longer.
Confidence: high
Scope-risk: moderate
Directive: Review the production Terraform plan before apply; never enable public bucket access.
Tested: Terraform fmt/validate/plan and workflow configuration searches
Not-tested: Production apply and live staging video generation
```

### Task 7: Full verification, review, and branch completion

**Files:**
- Review all files changed by Tasks 1-6

- [ ] **Step 1: Run focused and package verification with an isolated cache**

```powershell
$env:GOCACHE="$PWD\.tmp-gocache"
go test -p 1 ./service -run 'Test.*VideoResult|TestUpdateVideoSingleTask' -count=1
go test -p 1 ./controller -run 'Test.*VideoProxy|TestArchivedTechMobi' -count=1
go test -p 1 ./model ./relay/channel/task/techmobi ./pkg/perf_metrics -count=1
go test -p 1 ./service ./controller ./relay/channel/task/techmobi ./model -count=1
go vet ./service ./controller ./relay/channel/task/techmobi ./model ./pkg/perf_metrics
```

All commands must pass. If a broad command exceeds the environment timeout, retain successful focused evidence and rerun affected packages separately.

- [ ] **Step 2: Verify security and scope invariants**

```powershell
rg -n 'storage\.googleapis\.com|X-Goog-Signature|upstreamURL|taskResult\.Url' service controller
rg -n 'allUsers|roles/storage\.admin|force_destroy\s*=\s*true' deploy/gcp/envs/prod/video_result_storage.tf
git diff --check origin/main...HEAD
git status --short
```

Review matches to confirm URLs are not logged and forbidden IAM/destruction patterns are absent.

- [ ] **Step 3: Request spec-compliance and code-quality reviews**

Use `superpowers:requesting-code-review`. Fix all Important/Critical findings, rerun the relevant tests, and re-review until approved.

- [ ] **Step 4: Commit final review fixes if needed**

Use a Lore message describing the reason, affected invariant, and fresh test evidence.

- [ ] **Step 5: Clean local build artifacts and report deployment gates**

Remove only the verified worktree-local `.tmp-gocache`. Do not delete the feature worktree or apply/deploy production. Report:

- commits and changed files;
- fresh Go/Terraform evidence;
- staging validation still required before production;
- production `terraform apply` and deployments intentionally not executed;
- temporary public speed-test bucket `vocai-gemini-prod-cn-download-test-1786005990219` remains an external cleanup item unless separately deleted with authorized credentials.
