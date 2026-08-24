# Flatkey GCS Asset Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace provider-pinned asset creation with a Flatkey-owned GCS source library, channel-specific bindings, and queued asset preparation for generation tasks.

**Architecture:** `assets` owns the public `ast_...` identity and durable GCS source, while `asset_bindings` owns one provider materialization per Flatkey channel. Asset creation never selects a provider; generation requests containing Flatkey asset URIs are persisted as local queued tasks, claimed with database leases, routed by binding readiness, rewritten in memory, and pinned only after an upstream task is accepted. Requests without Flatkey assets retain the existing synchronous relay path.

**Tech Stack:** Go 1.22+, Gin, GORM v2, SQLite/MySQL/PostgreSQL, Google Cloud Storage Go SDK, IAM Credentials signed URLs, Terraform Google provider.

---

### Task 1: Add provider-neutral asset and preparation schemas

**Files:**
- Create: `model/asset.go`
- Create: `model/asset_test.go`
- Modify: `model/task.go`
- Modify: `model/task_cas_test.go`
- Modify: `model/main.go`

- [ ] **Step 1: Write failing model tests**

Cover unique public asset IDs, unique `(asset_id, channel_id)` bindings, upload-session ownership, binding lease takeover, task preparation lease takeover, and a guarded `QUEUED -> SUBMITTED/FAILURE` transition. Use in-memory SQLite and GORM only so the same model definitions remain portable to MySQL and PostgreSQL.

- [ ] **Step 2: Run RED**

Run: `go test ./model -run 'Test(Asset|AssetBinding|AssetUpload|TaskPreparation)' -count=1`

Expected: compile failure because `Asset`, `AssetBinding`, `AssetUpload`, and task preparation fields/functions do not exist.

- [ ] **Step 3: Implement the schema and CAS/lease functions**

Define:

```go
type Asset struct {
    Id              int64  `gorm:"primaryKey"`
    PublicId        string `gorm:"type:varchar(64);uniqueIndex"`
    UserId          int    `gorm:"index:idx_asset_user_public"`
    AssetType       string `gorm:"type:varchar(16);index"`
    Status          string `gorm:"type:varchar(24);index"`
    SourceStatus    string `gorm:"type:varchar(24);index"`
    StorageBackend  string `gorm:"type:varchar(16)"`
    StorageBucket   string `gorm:"type:varchar(255)"`
    ObjectKey       string `gorm:"type:varchar(512)"`
    ContentType     string `gorm:"type:varchar(128)"`
    SizeBytes       int64
    SHA256          string `gorm:"type:varchar(64)"`
    LastUsedAt      int64  `gorm:"index"`
    SourceExpiresAt int64  `gorm:"index"`
    CreatedAt       int64
    UpdatedAt       int64
}

type AssetBinding struct {
    Id                int64 `gorm:"primaryKey"`
    AssetId           int64 `gorm:"uniqueIndex:idx_asset_binding_asset_channel"`
    ChannelId         int   `gorm:"uniqueIndex:idx_asset_binding_asset_channel;index"`
    UpstreamGroupId   string `gorm:"type:varchar(191)"`
    UpstreamAssetId   string `gorm:"type:varchar(191)"`
    Status            string `gorm:"type:varchar(24);index"`
    ErrorCode         string `gorm:"type:varchar(64)"`
    AttemptCount      int
    LeaseOwner        string `gorm:"type:varchar(64);index"`
    LeaseExpiresAt    int64  `gorm:"index"`
    CreatedAt         int64
    UpdatedAt         int64
}
```

Add `AssetUpload` with unique `upload_id`, owner, asset/object metadata, expiry, and status. Extend `Task` with hidden preparation stage, request payload, lease owner/expiry, and attempt count; make `task_id` unique. Implement all claims with `INSERT ... ON CONFLICT DO NOTHING` or guarded GORM `UPDATE` statements, never process-local locks.

- [ ] **Step 4: Register migrations and run GREEN**

Register all three new models in both normal and fast migration lists. Run the Step 2 command and `go test ./model -run 'TestTask.*CAS' -count=1`.

### Task 2: Migrate legacy BytePlus assets without inventing a source

**Files:**
- Modify: `model/asset.go`
- Modify: `model/asset_test.go`
- Modify: `model/main.go`
- Modify: `service/byteplus_asset_reference.go`

- [ ] **Step 1: Write a failing migration test**

Insert legacy `BytePlusAsset` rows, run `MigrateLegacyBytePlusAssets`, and assert that each public ID is preserved in `assets`, `source_status=Unavailable`, and exactly one binding preserves channel, group, upstream ID, status, and timestamps. Run the migration twice and assert stable counts.

- [ ] **Step 2: Run RED**

Run: `go test ./model -run '^TestMigrateLegacyBytePlusAssets' -count=1`

- [ ] **Step 3: Implement idempotent dual-read migration**

Use paged GORM reads and `clause.OnConflict{DoNothing:true}` inserts. Invoke the migration after generalized tables exist. Keep legacy reads as a fallback only when no generalized asset exists during rollout.

- [ ] **Step 4: Run GREEN**

Run the Step 2 command plus `go test ./service -run 'BytePlusAssetReference' -count=1`.

### Task 3: Build reusable GCS asset storage and source ingestion

**Files:**
- Create: `service/asset_storage.go`
- Create: `service/asset_storage_test.go`
- Create: `service/asset.go`
- Create: `service/asset_test.go`
- Modify: `service/temp_media.go`

- [ ] **Step 1: Write failing storage and ingestion tests**

Mock object put/read/attrs/delete/sign operations. Cover opaque object keys, one-hour GET signatures, bounded PUT signatures, image/video/audio MIME validation, 20/500/100 MiB limits, SHA-256 persistence, redirect revalidation, private-address rejection, over-limit streaming, and cleanup idempotency.

- [ ] **Step 2: Run RED**

Run: `go test ./service -run 'Test(AssetStorage|CreateAssetFromURL|UploadAsset|CompleteAssetUpload|CleanupExpiredAsset)' -count=1`

- [ ] **Step 3: Implement the storage boundary**

Extract the existing IAM `SignBlob` logic into an internal GCS store used by both temp media and assets. `CurrentAssetStorageConfig` reads `ASSET_STORAGE_BUCKET`, staging fallback, `ASSET_SOURCE_RETENTION_DAYS`, media limits, compatibility upload cap, and one-hour signed URL TTL. URL ingestion validates every redirect with `common.ValidateURLWithFetchSetting`, streams once through MIME detection and SHA-256 hashing, and never persists a signed URL.

- [ ] **Step 4: Implement direct upload completion and cleanup**

Create an asset row plus `AssetUpload`, issue a signed PUT, then on completion stream the object to verify actual bytes/MIME/SHA-256 before activation. Cleanup claims expired sources with a DB lease, deletes idempotently, and changes public status to expired only when no active binding remains.

- [ ] **Step 5: Run GREEN**

Run the Step 2 command and `go test ./service -run 'TempMedia' -count=1`.

### Task 4: Expose the canonical Flatkey asset API

**Files:**
- Create: `dto/asset.go`
- Create: `dto/asset_test.go`
- Create: `controller/asset.go`
- Create: `controller/asset_test.go`
- Modify: `router/asset-router.go`
- Modify: `router/asset_router_test.go`

- [ ] **Step 1: Write failing route/controller tests**

Cover `POST /v1/assets`, multipart `POST /v1/assets/upload`, `POST /v1/assets/uploads`, completion, and owned `GET /v1/assets/:asset_id`. Assert OpenAI-compatible stable errors, no provider fields, compatibility cap enforcement, upload rate limiting, optional model allow-list validation, and the provider-neutral response fields.

- [ ] **Step 2: Run RED**

Run: `go test ./dto ./controller ./router -run 'Asset' -count=1`

- [ ] **Step 3: Implement handlers and DTOs**

The public response is:

```go
type AssetResponse struct {
    ID              string `json:"id"`
    Object          string `json:"object"`
    AssetType       string `json:"asset_type"`
    Status          string `json:"status"`
    AssetURL        string `json:"asset_url"`
    CreatedAt       int64  `json:"created_at"`
    SourceExpiresAt int64  `json:"source_expires_at,omitempty"`
}
```

Keep `SetBytePlusAssetRouter` as the bootstrap function for compatibility, but route new writes to the canonical controller and add upload-rate middleware to upload endpoints. Provider names, channel IDs, upstream IDs, buckets, object keys, and signed URLs must not appear in public responses.

- [ ] **Step 4: Run GREEN**

Run the Step 2 command.

### Task 5: Resolve public references and rank channels by binding readiness

**Files:**
- Create: `service/asset_reference.go`
- Create: `service/asset_reference_test.go`
- Modify: `service/channel_select.go`
- Modify: `service/channel_select_test.go`
- Modify: `middleware/distributor.go`
- Modify: `middleware/distributor_byteplus_asset_test.go`
- Modify: `constant/context_key.go`

- [ ] **Step 1: Write failing reference and routing tests**

Cover ownership, malformed IDs, type mismatch, expired sources, legacy binding pinning, all-active preference, partial binding preference, no-binding fallback, multiple assets on one channel, disabled channels, and exclusion of channels that cannot consume every asset type.

- [ ] **Step 2: Run RED**

Run: `go test ./service ./middleware -run 'TestAsset|Test.*Binding' -count=1`

- [ ] **Step 3: Implement generalized resolution and ranking**

Parse strict `asset://ast_[A-Za-z0-9]{32}` values into a request-scoped `AssetReferenceSet`. Add an optional channel ranker to `RetryParam`; when present, gather eligible priority buckets and rank readiness class before the existing priority, weight, load, cooldown, and affinity decisions. A channel is eligible only when every asset has an active binding or recoverable GCS source.

- [ ] **Step 4: Preserve legacy behavior and run GREEN**

Legacy source-unavailable assets expose only their active original binding. Store only the selected-channel rewrite map in context. Run the Step 2 command.

### Task 6: Materialize BytePlus bindings with distributed leases

**Files:**
- Create: `service/asset_binding.go`
- Create: `service/asset_binding_test.go`
- Modify: `service/byteplus_asset.go`
- Modify: `service/byteplus_asset_client.go`
- Modify: `relay/channel/task/byteplus/adaptor.go`
- Modify: `relay/channel/task/byteplus/adaptor_test.go`

- [ ] **Step 1: Write failing binding tests**

Race two claimers for one `(asset, channel)`, verify one provider create call, stale lease recovery, active-binding reuse, bounded polling, signed GET generation only at create time, sanitized failures, and exact public-to-upstream URI rewriting.

- [ ] **Step 2: Run RED**

Run: `go test ./service ./relay/channel/task/byteplus -run 'Test(AssetBinding|BytePlus.*Asset)' -count=1`

- [ ] **Step 3: Implement provider materialization**

Define a provider-neutral binding materializer registry keyed by channel type. Implement BytePlus by reusing its credential parser, per-user/channel asset group, `CreateAsset`, and `GetAsset`; feed it a one-hour GCS signed GET URL and store only the upstream ID/group/status. Waiting workers observe the shared binding row rather than issuing duplicate creates.

- [ ] **Step 4: Rewrite in memory and run GREEN**

Have the BytePlus task adaptor consume the generalized rewrite-map context key, validate every Flatkey asset URI has a selected binding, and marshal with `common.Marshal`. Run the Step 2 command.

### Task 7: Queue asset-bearing generation requests before upstream submission

**Files:**
- Create: `controller/asset_task_worker.go`
- Create: `controller/asset_task_worker_test.go`
- Modify: `controller/relay.go`
- Modify: `controller/relay_byteplus_asset_test.go`
- Modify: `relay/relay_task.go`
- Modify: `relay/relay_task_submit_error_test.go`
- Modify: `model/task.go`
- Modify: `service/task_billing.go`
- Modify: `service/task_billing_test.go`
- Modify: `main.go`

- [ ] **Step 1: Write failing queue and billing tests**

Assert an asset-bearing request validates and reserves billing once, persists `QUEUED/preparing_assets` before any provider call, returns its Flatkey task ID immediately, survives worker restart, falls back before acceptance, pins after acceptance, and refunds exactly once after a CAS-protected failure. Assert non-asset requests still use the synchronous path.

- [ ] **Step 2: Run RED**

Run: `go test ./controller ./relay ./service ./model -run 'TestAssetTask|Test.*Preparation|Test.*Refund.*Once' -count=1`

- [ ] **Step 3: Split relay preflight from upstream execution**

Refactor task submission so validation, pricing, ratio estimation, public task-ID allocation, and billing reservation can complete without calling the provider. Persist the normalized request payload and billing snapshot, settle the reservation for the queued task, and return `{id, task_id, object, model, status:"queued", progress:0, created_at}`.

- [ ] **Step 4: Implement the multi-node preparation worker**

Start it with the existing `gopool` startup pattern. Claim queued tasks by DB lease, rebuild an internal Gin context without persisted credentials, choose/rank a channel, create missing bindings, install the rewrite map, and execute the prepared relay. On acceptance, CAS the task to submitted with channel/upstream ID/data and extend asset retention. On terminal preparation failure, CAS to failure before invoking `RefundTaskQuota`.

- [ ] **Step 5: Run GREEN**

Run the Step 2 command plus `go test ./service -run 'TaskBilling' -count=1`.

### Task 8: Provision dedicated buckets and verify the complete feature

**Files:**
- Create: `deploy/gcp/modules/asset-storage/main.tf`
- Create: `deploy/gcp/modules/asset-storage/variables.tf`
- Create: `deploy/gcp/modules/asset-storage/outputs.tf`
- Modify: `deploy/gcp/envs/prod/main.tf`
- Modify: `deploy/gcp/envs/prod/staging.tf`
- Modify: `deploy/gcp/envs/prod/outputs.tf`
- Modify: `deploy/gcp/docs/INFRASTRUCTURE.md`
- Modify: `docs/superpowers/specs/2026-08-04-flatkey-gcs-asset-routing-design.md`

- [ ] **Step 1: Add private bucket/IAM configuration**

Create production and staging buckets with uniform access, public access prevention, lifecycle/soft-delete policy, and least-privilege object plus signing permissions for the existing router/console service accounts. Wire `ASSET_STORAGE_BUCKET` into both runtime environments without changing CI-owned Cloud Run image fields. Do not run `terraform apply`.

- [ ] **Step 2: Format and validate Terraform**

Run `terraform fmt -check -recursive deploy/gcp`. If initialized provider state is available, run `terraform -chdir=deploy/gcp/envs/prod validate`; otherwise record the missing initialization as a validation gap.

- [ ] **Step 3: Run backend verification**

Run:
- `go test ./model ./service ./controller ./router ./middleware ./relay/channel/task/byteplus ./relay -count=1`
- `go test ./... -count=1`
- `go vet ./...`
- `go build ./...`
- `git diff --check`

Expected: all targeted checks pass; the repository-wide test may be reported as a timeout only with its captured duration and no hidden success claim.

- [ ] **Step 4: Review invariants**

Search the diff and persisted payloads for `storage.googleapis.com`, signed query parameters, upstream asset IDs, provider credentials, and provider names in public responses. Confirm every billing refund follows a winning status CAS, every provider create follows a binding lease claim, and every accepted task is pinned to one channel.

- [ ] **Step 5: Commit with Lore trailers**

Use small commits per task. The final integration commit must include:

```text
Keep reusable assets portable until provider submission

Constraint: Production is multi-node and new source media must remain private in GCS.
Rejected: Pinning assets during upload | It prevents later channel routing and duplicates customer-visible identities.
Confidence: high
Scope-risk: broad
Directive: Never persist signed GCS URLs or expose provider binding identifiers through the public asset/task contracts.
Tested: Targeted Go tests, build, vet, Terraform formatting/validation, and diff checks.
Not-tested: Terraform apply and live provider/GCS staging calls.
```
