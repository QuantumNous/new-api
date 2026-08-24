# Grok Subscription Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add paid Grok Subscription image generation/editing and asynchronous video generate/edit/extend behind Flatkey's existing OpenAI-compatible image and video endpoints, while preserving OAuth, billing, retry, whitelabel, and multi-node safety invariants.

**Architecture:** Keep channel type `113` as the single account identity, but split transport by workload: the existing synchronous adaptor owns text and images, while a new `channel.TaskAdaptor` owns video. A shared Grok media preflight loads/refreshes the current OAuth credential, obtains a monotonic versioned paid-billing snapshot under the existing DB lease, and gates every media POST. Images are translated synchronously to fixed `api.x.ai` endpoints; videos enter the existing preconsume/task/poll/CAS/proxy lifecycle and never persist OAuth credentials or expose upstream IDs/URLs.

**Tech Stack:** Go 1.x, Gin, GORM, existing NewAPI relay/task/billing abstractions, SQLite/MySQL/PostgreSQL-compatible conditional updates, JSON OpenAPI documents, Go `httptest`.

## Global Constraints

- Work only in `E:\workspace\new-api-worktrees\grok-subscription-media` on `feature/grok-subscription-media`; never copy the stale root worktree or the old experimental image commit wholesale.
- Public creation endpoints remain `/v1/images/generations`, `/v1/images/edits`, and one `POST /v1/videos`; do not add public xAI-specific create routes.
- Media destinations are fixed `https://api.x.ai` allowlisted hosts and use OAuth Bearer only. Never send CLI identity headers, cookies, channel Header Override, custom BaseURL, or `{api_key}` substitutions to media hosts.
- Every media write requires fresh positive billing evidence (maximum age 24 hours). Reads and downloads remain available after eligibility expires.
- Never retry or switch channels after a media POST may have reached upstream. Idempotent GETs may refresh OAuth and retry once.
- Type `113` tasks store the current channel ID and upstream request ID, but never copy `Channel.Key`, access tokens, refresh tokens, raw upstream response bodies, or temporary URLs into public DTOs/logs.
- Upstream `cost_in_usd_ticks` is audit-only. Flatkey sale price comes from the frozen image ModelPrice or video second-billing snapshot.
- Use `common.Marshal`/`common.Unmarshal`; upstream optional scalar fields are pointers plus `omitempty`; preserve explicit zero values until validation rejects them.
- Follow TDD for each task: add a focused failing test, run it and confirm the expected failure, implement the smallest behavior, rerun the focused test, then run the containing package.
- Before each implementation commit, run `git diff --check` and the task's focused tests. GitNexus impact/detect tools are not installed in this worktree; compensate with `rg`, package tests, and the final repository-wide suite.
- Every commit follows the repository Lore trailers (`Constraint`, `Rejected`, `Confidence`, `Scope-risk`, `Directive`, `Tested`, `Not-tested`).

## File and Responsibility Map

| Area | Files | Responsibility |
| --- | --- | --- |
| Versioned billing state | `model/grok_channel_state.go`, `model/grok_channel_state_test.go`, `model/main.go` | Add `billing_observed_at`; monotonic lease-owner-guarded snapshot write; preserve fields during auth updates; migration through existing AutoMigrate path. |
| Billing protocol/preflight | `relay/channel/groksubscription/billing.go`, `billing_test.go`, `media_preflight.go`, `media_preflight_test.go`, `refresh.go` | Parse billing endpoints into v1 snapshot, decide eligibility, refresh expiring credentials, serialize per-channel probe with DB lease, expose current media Bearer without leaking secrets. |
| Ability projection | `model/ability.go`, `model/ability_test.go`, `controller/grok_auth.go`, `controller/grok_auth_test.go` | Add/remove exactly three media models after successful probe while preserving text/unrelated models; invoke after OAuth/import/refresh; do not corrupt auth state on probe failures. |
| Image public DTO/binding | `dto/openai_image.go`, `relay/helper/valid_request.go`, `relay/helper/valid_request_test.go` | Add `aspect_ratio`/`resolution`; bind multipart options without losing field presence; preserve existing image clients. |
| Image adaptor | `relay/channel/groksubscription/image.go`, `image_test.go`, `adaptor.go`, `adaptor_test.go`, `constants.go`, `relay/image_handler.go`, `relay/image_handler_test.go`, `relay/channel/api_request.go`, `relay/channel/api_request_test.go` | Validate/map generation and JSON/multipart edits; fixed media URL/Bearer-only headers; force conversion despite pass-through; sanitize errors and reuse OpenAI image response handling. |
| Image model pricing | `setting/ratio_setting/model_ratio.go`, `setting/ratio_setting/model_ratio_test.go` | Add configurable default ModelPrice for `grok-imagine-image-2.0`; existing `n` multiplication remains authoritative. |
| Unified video contract | `relay/channel/task/groksubscription/request.go`, `request_test.go`, `constants.go` | Decode `action`, media references, voice refs; enforce complete action/model/field matrix; synthesize `relaycommon.TaskSubmitReq` for shared billing/model plumbing. |
| Video task adaptor/billing | `relay/channel/task/groksubscription/adaptor.go`, `adaptor_test.go`, `billing.go`, `billing_test.go`, `relay/relay_adaptor.go`, `setting/billing_setting/video_price.go`, `setting/billing_setting/video_price_test.go` | Submit to internal xAI action path, normalize 202, isolate public/upstream IDs, poll strict states, convert public DTO, freeze per-second dimensions and ignore upstream cost as sale price. |
| No-replay/task credentials | `controller/relay.go`, `controller/relay_task_test.go`, `controller/asset_task_worker.go`, `controller/asset_task_worker_test.go`, `service/task_polling.go`, `service/task_polling_test.go`, `model/task.go`, `model/task_key_test.go` | Stop retries on uncertain writes; suppress saved polling key for type `113`; pass `channel_id` to polling and load current OAuth credential for each GET. |
| Video content proxy | `controller/video_proxy.go`, `controller/video_proxy_grok_subscription.go`, `controller/video_proxy_grok_subscription_test.go`, `model/task.go`, `model/task_cas_test.go` | Resolve private temporary URL, retry content once after 401/403/404/410 by polling with current credential, SSRF-check both URLs, CAS-update private result metadata, never expose upstream details. |
| Endpoint/model metadata and docs | `common/endpoint_type.go`, `common/endpoint_type_test.go`, `service/channel_select.go`, `service/channel_select_test.go`, `docs/api/video-api.md`, `docs/openapi/relay.json` | Advertise image/video endpoint capabilities only when models are present, keep one public video contract, document fields/action matrix. |

---

### Task 1: Persist a monotonic versioned paid-billing observation

**Files:**

- Modify: `model/grok_channel_state.go`
- Modify: `model/main.go`
- Test: `model/grok_channel_state_test.go`

- [ ] Add failing model tests for the new column and conditional update.

  Cover: inserting `BillingObservedAt`; a matching lease owner can write a newer snapshot; an older timestamp cannot overwrite; the wrong owner cannot overwrite; failed conditional writes preserve `QuotaSnapshot`, `BillingPlan`, `TierRaw`, and observed time; auth-state upserts preserve the new field.

  The production API should have an explicit result:

  ```go
  type GrokBillingObservation struct {
      ObservedAt    int64
      BillingPlan  string
      TierRaw       string
      QuotaSnapshot string
  }

  func SaveGrokBillingObservation(channelID int, leaseOwner string, observation GrokBillingObservation) (bool, error)
  ```

- [ ] Run the focused tests and confirm failure because the field/method does not exist.

  ```powershell
  go test ./model -run 'TestGrokBillingObservation|TestGrokAuthState.*BillingObservedAt' -count=1
  ```

- [ ] Add `BillingObservedAt int64` to `GrokChannelState`, include it in the non-secret admin projection only if the console needs freshness display, and preserve it in controller auth-state copies. Use one conditional GORM update:

  ```go
  res := DB.Model(&GrokChannelState{}).
      Where("channel_id = ? AND refresh_lease_owner = ? AND billing_observed_at < ?", channelID, owner, observedAt).
      Updates(map[string]any{
          "quota_snapshot": snapshot,
          "billing_plan": plan,
          "tier_raw": tier,
          "billing_observed_at": observedAt,
          "updated_at": observedAt,
      })
  ```

  Keep the insert/bootstrap path explicit so a missing state row can acquire the existing lease before this method runs. Do not replace the conditional write with read-modify-write.

- [ ] Run focused and package tests.

  ```powershell
  go test ./model -run 'TestGrok' -count=1
  go test ./model -count=1
  git diff --check
  ```

- [ ] Commit.

  ```text
  Keep Grok media eligibility observations monotonic

  Constraint: Multi-node probes share a channel-scoped database lease and older workers must not overwrite newer evidence.
  Rejected: Read-modify-write snapshot updates | stale workers can win after lease expiry.
  Confidence: high
  Scope-risk: narrow
  Directive: Keep billing_observed_at as the only freshness clock for media eligibility.
  Tested: go test ./model -count=1
  Not-tested: Live MySQL and PostgreSQL engines; SQL shape is covered through GORM-compatible predicates.
  ```

### Task 2: Parse billing probes and enforce media eligibility

**Files:**

- Create: `relay/channel/groksubscription/billing.go`
- Create: `relay/channel/groksubscription/billing_test.go`
- Modify: `relay/channel/groksubscription/constants.go`

- [ ] Write table-driven failing tests for strict snapshot JSON and eligibility.

  Cover snapshot version `1`, unknown/missing version, paid plan aliases, explicit `free`/`0`/`x_basic`, positive monthly limit, authoritative usage fields, partial window success, any window `401/403`, exact 24-hour boundary, stale evidence, and excessive future skew.

  Use these core types:

  ```go
  type BillingWindowSnapshot struct {
      StatusCode        int      `json:"status_code"`
      UsagePercent      *float64 `json:"usage_percent,omitempty"`
      UsedPercent       *float64 `json:"used_percent,omitempty"`
      MonthlyLimitCents *int64   `json:"monthly_limit_cents,omitempty"`
  }

  type BillingProbeSnapshot struct {
      Version int                   `json:"version"`
      Plan    string                `json:"plan,omitempty"`
      Tier    string                `json:"tier,omitempty"`
      Monthly BillingWindowSnapshot `json:"monthly"`
      Weekly  BillingWindowSnapshot `json:"weekly"`
  }

  func EvaluateMediaEligibility(snapshotJSON string, observedAt, now int64) error
  ```

- [ ] Run focused tests and confirm they fail.

  ```powershell
  go test ./relay/channel/groksubscription -run 'TestBilling|TestEvaluateMediaEligibility' -count=1
  ```

- [ ] Implement strict parsing with `json.Decoder.DisallowUnknownFields`, constants for `/billing` and `/billing?format=credits`, a 24-hour maximum age, bounded future skew, and stable sentinel errors (`ErrMediaSubscriptionRequired`, `ErrBillingSnapshotInvalid`, `ErrBillingSnapshotStale`). Parse both upstream documents into a sanitized v1 snapshot; never retain raw bodies.

- [ ] Add `ProbeBilling(ctx, doer, Credential) (BillingProbeSnapshot, error)` using CLI proxy URL, Bearer + CLI identity headers, bounded response reads, and independent monthly/weekly status capture. Treat transport/malformed responses as probe failure, but preserve explicit successful free-tier observations.

- [ ] Run tests and commit.

  ```powershell
  go test ./relay/channel/groksubscription -run 'TestBilling|TestEvaluateMediaEligibility|TestProbeBilling' -count=1
  go test ./relay/channel/groksubscription -count=1
  git diff --check
  ```

### Task 3: Add shared credential refresh, JIT probe, and exact media Ability sync

**Files:**

- Create: `relay/channel/groksubscription/media_preflight.go`
- Create: `relay/channel/groksubscription/media_preflight_test.go`
- Modify: `relay/channel/groksubscription/refresh.go`
- Modify: `model/ability.go`
- Test: `model/ability_test.go`
- Modify: `controller/grok_auth.go`
- Test: `controller/grok_auth_test.go`

- [ ] Write failing tests for `EnsureMediaCredential` and `SyncGrokMediaAbilities`.

  Required behaviors: parse the current channel key; refresh before POST when expiry is within the safety window; serialize refresh/probe with `AcquireGrokRefreshLease`; losing workers wait briefly then reload; a successful newer probe saves and updates abilities; probe failure preserves the previous snapshot and auth status; paid→free removes exactly the three media models; free→paid adds them without deleting text or unrelated configured models.

- [ ] Run focused tests and confirm failure.

  ```powershell
  go test ./relay/channel/groksubscription -run 'TestEnsureMediaCredential|TestMediaPreflight' -count=1
  go test ./model -run 'TestSyncGrokMediaAbilities' -count=1
  go test ./controller -run 'TestGrok.*Billing|TestGrok.*Ability' -count=1
  ```

- [ ] Implement one reusable orchestration entry point that adapters can call before a POST or idempotent GET:

  ```go
  type MediaCredential struct {
      ChannelID   int
      AccessToken string
  }

  func EnsureMediaCredential(ctx context.Context, channelID int, requirePaid bool) (MediaCredential, error)
  ```

  The helper must read DB time, reload `Channel.Key`, refresh only before a write or for a GET retry, probe only when paid evidence is missing/stale, release its owner-scoped lease, and return only the access token. Structure HTTP/time/store dependencies behind package-level interfaces or injectable functions so tests never call xAI.

- [ ] Implement `model.SyncGrokMediaAbilities(channelID int, eligible bool) error` transactionally. Build desired rows from the channel's group/priority/weight/tag/status, delete only the three Grok media model rows when ineligible, and insert/update only those rows when eligible. Trigger the same cache/config invalidation used by normal ability rebuilds.

- [ ] Call a post-auth billing refresh from PKCE completion, refresh-token import, and manual refresh only after credential persistence succeeds. Probe failure must leave OAuth active and return a response that reports billing unavailable without rolling back valid credentials. Preserve `BillingObservedAt` in `upsertGrokAuthStatus`.

- [ ] Run package tests and commit.

  ```powershell
  go test ./relay/channel/groksubscription -count=1
  go test ./model -run 'TestGrok|TestSyncGrokMediaAbilities' -count=1
  go test ./controller -run 'TestGrok' -count=1
  git diff --check
  ```

### Task 4: Bind and convert Grok image generation and edits

**Files:**

- Modify: `dto/openai_image.go`
- Modify: `relay/helper/valid_request.go`
- Test: `relay/helper/valid_request_test.go`
- Create: `relay/channel/groksubscription/image.go`
- Create: `relay/channel/groksubscription/image_test.go`
- Modify: `relay/channel/groksubscription/adaptor.go`
- Modify: `relay/channel/groksubscription/adaptor_test.go`
- Modify: `relay/channel/groksubscription/constants.go`

- [ ] Add failing DTO/binder tests for JSON and multipart `aspect_ratio`, `resolution`, `quality`, `response_format`, `n`, repeated `image`/`image[]`/`image[N]`, and presence of rejected fields (`mask`, `user`, `file_id`, `storage_options`).

- [ ] Add failing pure converter tests for all allowed generation values; URL and b64 response format; JSON single/multi image edit; multipart JPEG/PNG conversion to data URI; 3-image maximum; rejection of the fourth image, HTTP URL, unsupported MIME, empty prompt, unsupported model, mask/file/storage/user, and single-image explicit aspect ratio.

  Keep upstream DTOs private and pointer-based:

  ```go
  type xAIImageRequest struct {
      Model          string          `json:"model"`
      Prompt         string          `json:"prompt"`
      N              *uint           `json:"n,omitempty"`
      ResponseFormat *string         `json:"response_format,omitempty"`
      AspectRatio    *string         `json:"aspect_ratio,omitempty"`
      Resolution     *string         `json:"resolution,omitempty"`
      Quality        *string         `json:"quality,omitempty"`
      Image          *xAIMediaInput  `json:"image,omitempty"`
      Images         []xAIMediaInput `json:"images,omitempty"`
  }
  ```

- [ ] Run focused tests and confirm expected failures.

  ```powershell
  go test ./relay/helper -run 'TestGetAndValidOpenAIImageRequest.*Multipart' -count=1
  go test ./relay/channel/groksubscription -run 'TestConvertGrokImage|TestCollectGrokEditImages' -count=1
  ```

- [ ] Add explicit `AspectRatio string` and `Resolution string` fields to `dto.ImageRequest`; extend multipart binding; collect file headers deterministically without changing other adapters. Validate source media via existing body-size and SSRF helpers, but never prefetch arbitrary HTTPS input solely to inspect dimensions.

- [ ] Branch `GetRequestURL`, `SetupRequestHeader`, `ConvertImageRequest`, and `DoResponse` on image relay modes. Use fixed `https://api.x.ai/v1/images/{generations|edits}`, invoke `EnsureMediaCredential(..., true)` before building the POST, emit only `Authorization`, `Accept`, and correct content type, and delegate successful response normalization to the existing OpenAI image handler. Map local validation to skip-retry `400` and paid gate to `403 media_subscription_required`.

- [ ] Run tests and commit.

  ```powershell
  go test ./relay/helper -run 'ImageRequest' -count=1
  go test ./relay/channel/groksubscription -run 'Image' -count=1
  go test ./relay/channel/groksubscription -count=1
  git diff --check
  ```

### Task 5: Enforce image pass-through/header isolation and price registration

**Files:**

- Modify: `relay/image_handler.go`
- Test: `relay/image_handler_test.go`
- Modify: `relay/channel/api_request.go`
- Test: `relay/channel/api_request_test.go`
- Modify: `setting/ratio_setting/model_ratio.go`
- Test: `setting/ratio_setting/model_ratio_test.go`
- Modify: `relay/channel/groksubscription/constants.go`

- [ ] Write failing integration-style tests proving type `113` still calls `ConvertImageRequest` when global or channel pass-through is enabled, and proving a configured Header Override cannot replace Authorization or add CLI/custom headers to a Grok media request.

- [ ] Write a failing price/model-list test proving the image model has a positive default `ModelPrice`, is in the adaptor's known list, and existing image `n` handling multiplies quota once.

- [ ] Implement a named `forceImageConversion` decision for Codex and Grok Subscription. Mark Grok conversion errors as local skip-retry, and suppress header overrides for type `113` media calls. Prefer a request-scoped `DisableHeaderOverride` flag on `RelayInfo` set by the media branch; if that would spread wider than necessary, exclude API type `42` entirely and add a text regression test documenting the hardened behavior.

- [ ] Add the image model to default model/ratio configuration without changing the two existing video rates. Do not add quality/resolution multipliers.

- [ ] Run tests and commit.

  ```powershell
  go test ./relay -run 'TestImageHelper.*Grok|TestGrok.*HeaderOverride|TestGrok.*PassThrough' -count=1
  go test ./setting/ratio_setting -run 'Test.*GrokImagineImage' -count=1
  go test ./relay/... -count=1
  git diff --check
  ```

### Task 6: Define and validate the unified Grok video request

**Files:**

- Create: `relay/channel/task/groksubscription/constants.go`
- Create: `relay/channel/task/groksubscription/request.go`
- Create: `relay/channel/task/groksubscription/request_test.go`

- [ ] Write table-driven failing tests for the complete public matrix: default/generate action, text/image/reference image/reference voice/mixed references, edit, extend, both models, duration boundaries, every aspect ratio, 480p/720p/1080p constraints, 7-image/3-voice maxima, mutual exclusions, and rejection of `file_id`, `user`, `storage_options`, HTTP URLs, empty inputs, and inferred actions.

- [ ] Define a private request DTO that preserves field presence:

  ```go
  type MediaReference struct { URL string `json:"url"` }
  type VoiceReference struct { VoiceID string `json:"voice_id"` }
  type VideoRequest struct {
      Model           string           `json:"model"`
      Action          string           `json:"action,omitempty"`
      Prompt          string           `json:"prompt"`
      Duration        *int             `json:"duration,omitempty"`
      AspectRatio     *string          `json:"aspect_ratio,omitempty"`
      Resolution      *string          `json:"resolution,omitempty"`
      Image           *MediaReference  `json:"image,omitempty"`
      Video           *MediaReference  `json:"video,omitempty"`
      ReferenceImages []MediaReference `json:"reference_images,omitempty"`
      ReferenceAudios []VoiceReference `json:"reference_audios,omitempty"`
  }
  ```

  Add strict unknown-field detection for security-sensitive unsupported fields while retaining compatibility with the shared video routes. Store the full validated request under a provider-specific Gin context key, and call `relaycommon.StoreTaskRequest` with a synthesized generic request for common model mapping and billing.

- [ ] Implement pure `validateVideoRequest` and `buildUpstreamVideoRequest`; default action to generate and extend duration to 6; never infer action from media fields.

- [ ] Run tests and commit.

  ```powershell
  go test ./relay/channel/task/groksubscription -run 'TestValidateVideoRequest|TestBuildUpstreamVideoRequest' -count=1
  go test ./relay/channel/task/groksubscription -count=1
  git diff --check
  ```

### Task 7: Implement the Grok Subscription video TaskAdaptor and frozen second billing

**Files:**

- Create: `relay/channel/task/groksubscription/adaptor.go`
- Create: `relay/channel/task/groksubscription/adaptor_test.go`
- Create: `relay/channel/task/groksubscription/billing.go`
- Create: `relay/channel/task/groksubscription/billing_test.go`
- Modify: `relay/relay_adaptor.go`
- Modify: `setting/billing_setting/video_price.go`
- Test: `setting/billing_setting/video_price_test.go`

- [ ] Add failing adaptor tests for fixed paths, Bearer-only headers, current media preflight, 200/202 submit, public/upstream ID isolation, no raw response in public output, pending/done/failed/expired mapping, unknown-state retryable parse error, whitelabel result URL, and sanitized errors.

- [ ] Add failing billing tests for generate duration, edit source-video dimension, extend default/explicit duration, resolution dimensions, configured-rule snapshot capture, missing/unpriceable rule fail-closed, and proof that upstream cost ticks never change `ActualTaskQuota`.

- [ ] Implement `channel.TaskAdaptor`, embedding `taskcommon.BaseBilling`. Required shape:

  ```go
  func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
      return apiBase + actionPath(a.request.Action), nil
  }

  func (a *TaskAdaptor) DoRequest(...) (*http.Response, error) {
      resp, err := channel.DoTaskApiRequest(a, c, info, body)
      if resp != nil && resp.StatusCode == http.StatusAccepted { resp.StatusCode = http.StatusOK }
      return resp, err
  }
  ```

  `DoResponse` returns upstream `request_id` privately while responding with `info.PublicTaskID`. `ParseTaskResult` accepts only documented states; on success extract temporary URL/usage into private task metadata and return the Flatkey content proxy URL. `ConvertToOpenAIVideo` always uses the public task ID and proxy URL.

- [ ] Register channel type `113` in `GetTaskAdaptor`. Add explicit default video pricing rules only if they are missing; retain the existing public ModelPrice defaults as Flatkey rates and snapshot rule tables through `SecondBillingRatios`.

- [ ] Run tests and commit.

  ```powershell
  go test ./relay/channel/task/groksubscription -count=1
  go test ./setting/billing_setting -run 'Test.*GrokSubscription' -count=1
  go test ./relay -run 'TestGetTaskAdaptor.*Grok' -count=1
  git diff --check
  ```

### Task 8: Prevent uncertain-write replay and keep OAuth out of tasks

**Files:**

- Modify: `controller/relay.go`
- Test: `controller/relay_task_test.go`
- Modify: `controller/asset_task_worker.go`
- Test: `controller/asset_task_worker_test.go`
- Modify: `service/task_polling.go`
- Test: `service/task_polling_test.go`
- Modify: `model/task.go`
- Test: `model/task_key_test.go`

- [ ] Write failing controller tests proving no retry occurs when `TaskSubmitResult.OutcomeMayBeUnknown` is true for timeout, 429, 401, or 5xx after a POST, while a definite pre-send local paid-gate failure can select the next channel. Preserve existing retry behavior for other channel types where the outcome is definite.

- [ ] Change `RelayTask` to retain the result on error and stop before `shouldRetryTaskRelay` when `OutcomeMayBeUnknown`. Do not overload status codes to infer send state:

  ```go
  if result != nil && result.OutcomeMayBeUnknown {
      break
  }
  ```

- [ ] Write failing task persistence/poll tests proving type `113` stores an empty `PrivateData.Key`, polling passes `channel_id`, and the adaptor reloads/refreshed the current channel credential. Keep stored keys for providers whose polling contract still requires them.

- [ ] Add one explicit `taskPollingKey`/task-init policy for Grok Subscription rather than blanking keys globally. Pass `channel_id` through polling bodies; idempotent `FetchTask` uses `EnsureMediaCredential(ctx, channelID, false)` and retries once after a 401 with a forced refresh. Never query the request ID through a different channel.

- [ ] Run tests and commit.

  ```powershell
  go test ./controller -run 'TestRelayTask.*OutcomeUnknown|Test.*Grok.*PollingKey' -count=1
  go test ./service -run 'Test.*Grok.*Polling' -count=1
  go test ./model -run 'Test.*TaskKey.*Grok' -count=1
  git diff --check
  ```

### Task 9: Add temporary video URL refresh to the content proxy

**Files:**

- Create: `controller/video_proxy_grok_subscription.go`
- Create: `controller/video_proxy_grok_subscription_test.go`
- Modify: `controller/video_proxy.go`
- Modify: `model/task.go`
- Test: `model/task_cas_test.go`

- [ ] Write failing tests for successful proxying, blocked private/invalid URLs, removal of cookie/provider headers, and exactly one refresh/retry after 401/403/404/410. Verify refresh uses the origin channel's current credential and same upstream request ID; verify second failure is generic and contains no host/URL/request ID.

- [ ] Add a narrow CAS helper that updates only the type `113` task's private result URL/metadata when the task public ID, upstream ID, and prior private snapshot still match. Test concurrent stale refresh cannot overwrite a newer URL or unrelated billing metadata.

- [ ] Implement a type `113` resolver used by `VideoProxy`: load the private URL, SSRF-validate, fetch once; on refreshable status poll `GET /v1/videos/{request_id}` with current credential, extract a same-task URL, validate again, CAS-save, and fetch once more. Disable redirect following or revalidate each redirect target. Forward only the existing safe response header allowlist.

- [ ] Run tests and commit.

  ```powershell
  go test ./controller -run 'TestGrokSubscriptionVideoProxy' -count=1
  go test ./model -run 'Test.*Grok.*ResultURL' -count=1
  go test ./controller -run 'VideoProxy' -count=1
  git diff --check
  ```

### Task 10: Wire endpoint capabilities, docs, and regression coverage

**Files:**

- Modify: `common/endpoint_type.go`
- Test: `common/endpoint_type_test.go`
- Modify: `service/channel_select.go`
- Test: `service/channel_select_test.go`
- Modify: `docs/api/video-api.md`
- Modify: `docs/openapi/relay.json`

- [ ] Add failing endpoint-selection tests proving the three Grok media models advertise image/video endpoint types on channel `113`, while `grok-4.6` retains OpenAI Responses/Compact behavior. Verify stale/removed media abilities cannot be selected and text remains selectable.

- [ ] Implement the smallest endpoint metadata changes. Do not make every channel `113` request look like video; determine media endpoint from model plus request route/action.

- [ ] Document `action`, all action/model matrices, media reference objects, image aspect/resolution fields, public ID/proxy behavior, and local error codes. Keep OAuth hosts, billing URLs, credentials, and temporary upstream URLs out of public API examples.

- [ ] Validate JSON and run focused tests.

  ```powershell
  Get-Content docs\openapi\relay.json | ConvertFrom-Json | Out-Null
  go test ./common -run 'Test.*Grok.*Endpoint' -count=1
  go test ./service -run 'Test.*Grok.*Endpoint|Test.*Grok.*ChannelSelect' -count=1
  git diff --check
  ```

- [ ] Commit.

### Task 11: Full verification, local smoke, review, and PR handoff

**Files:**

- Review all changed files from Tasks 1–10.
- Add only narrowly necessary regression tests discovered during verification.

- [ ] Run format/static validation.

  ```powershell
  $changedGo = git diff --name-only origin/main -- '*.go'
  if ($changedGo) { gofmt -w $changedGo }
  git diff --check
  go vet ./relay/channel/groksubscription/... ./relay/channel/task/groksubscription/... ./controller/... ./service/... ./model/...
  ```

- [ ] Run targeted suites, then the repository suite and build.

  ```powershell
  go test ./relay/channel/groksubscription/... -count=1
  go test ./relay/channel/task/groksubscription/... -count=1
  go test ./relay/... -count=1
  go test ./controller/... -count=1
  go test ./service/... -count=1
  go test ./model/... -count=1
  go test ./... -count=1
  go build ./...
  ```

- [ ] Start the affected Go service locally with non-production configuration and exercise route-level requests for image generation, image edit, video submit, task fetch, and content proxy. Use a local fake upstream/credential dependency; verify request mapping and public responses without incurring xAI cost. Record exact command, local URL, status, and observed response shape.

- [ ] Use `superpowers:requesting-code-review`; address every correctness/security finding with a failing test first. Re-run impacted tests and the full suite.

- [ ] Use `superpowers:verification-before-completion` and inspect:

  ```powershell
  git status --short --branch
  git diff --stat origin/main...HEAD
  git log --oneline --decorate origin/main..HEAD
  git diff --check origin/main...HEAD
  ```

- [ ] Push `feature/grok-subscription-media` and create a PR against current `main` with design/plan links, deployment targets (`router`, `newapi-console`), migration note, verification evidence, and explicit note that live channel-27 cost smoke is pending.

- [ ] After staging deploy and explicit confirmation of test token/prompt/budget boundary, execute the 13 channel-27 cases from the design. Record only Flatkey request/task IDs, HTTP status, duration, and billing reconciliation; never record OAuth tokens, upstream IDs, or temporary URLs. Do not run this paid external-write step before that budget confirmation.

## Final Acceptance Checklist

- [ ] `grok-imagine-image-2.0` generation and 1–3 image edits work through existing Flatkey image routes.
- [ ] `grok-imagine-video-1.5` generate and `grok-imagine-video` generate/edit/extend work through one `POST /v1/videos`.
- [ ] Fresh positive paid evidence gates every media POST; failure preserves text routing and old observations.
- [ ] Media requests use fixed API host + Bearer only; no override/CLI header/cookie leakage.
- [ ] No uncertain media write is replayed across accounts; idempotent reads refresh/retry at most once.
- [ ] Public DTOs/logs never contain OAuth credentials, upstream request IDs, raw responses, or temporary URLs.
- [ ] Billing uses frozen Flatkey image/video configuration; upstream cost ticks are audit-only; terminal CAS settles/refunds once.
- [ ] Temporary video URLs refresh once through the origin channel and remain behind the Flatkey content proxy.
- [ ] Targeted tests, `go test ./...`, `go vet` on affected packages, `go build ./...`, local route smoke, code review, and clean diff all pass.
- [ ] PR is based on current `main`, contains no stale worktree/old experiment changes, and declares router + console + DB rollout impact.
