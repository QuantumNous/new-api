# Asset Model Coverage Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make public asset `Active` mean that every reusable-asset-capable model available to the authenticated API key has a verified current route that can consume the asset during later task creation.

**Architecture:** Keep `assets.status` as source lifecycle state, then project public status from per-scope/per-model readiness rows. A database-backed coverage target selects one channel, mapped model, and credential namespace for each effective key scope and public model; all assets converge on that target, while leases, retry timestamps, and target generations prevent duplicate provider writes and stale activation across router nodes. Task routing resolves the same target, pins its credential, and returns retryable preparation work to `preparing_assets` until every referenced asset is ready on one route.

**Tech Stack:** Go, Gin, GORM, SQLite/MySQL/PostgreSQL-compatible migrations and CAS queries, testify, existing channel/asset materializer registries.

---

## File structure and responsibilities

- `model/asset_model_readiness.go`: coverage-target/readiness rows, uniqueness, leases, retry scheduling, and generation-fenced CAS transitions.
- `model/asset_model_readiness_test.go`: database invariants, concurrent inserts, lease ownership, due scheduling, and stale-generation rejection.
- `service/asset_model_scope.go`: authenticated token-scope derivation, stable scope hashing, reusable-model filtering, and current candidate enumeration.
- `service/asset_model_scope_test.go`: group, `auto`, allowlist, blacklist, asset-capable endpoint, and specific-channel coverage tests.
- `service/asset_model_target.go`: deterministic target selection, live eligibility checks, credential-index resolution, and rotation.
- `service/asset_model_target_test.go`: common-target convergence, credential/mapping invalidation, and candidate exhaustion tests.
- `service/asset_model_status.go`: idempotent enrollment plus source/readiness public-status projection.
- `service/asset_model_status_test.go`: `Creating`/`Processing`/`Active`/`Failed`/`Expired` aggregation tests and provider-neutral response checks.
- `service/asset_materialize_error.go`: private upstream error metadata and retryability classification.
- `service/asset_materialize_error_test.go`: 429, `Retry-After`, timeout, 5xx, processing, and definitive 4xx classification tests.
- `service/asset_model_worker.go`: database-backed readiness preparation, retry, rotation, and bounded reconciliation loop.
- `service/asset_model_worker_test.go`: retry schedule, five-minute generation window, target rotation, and multi-node binding de-duplication tests.
- `scripts/asset_model_coverage_probe.ps1`: secret-safe end-to-end timing probe for two fresh assets and one video task.
- Existing files listed in the tasks below retain HTTP wiring, source upload, materialization, channel selection, and task lifecycle ownership.

### Task 1: Add the database model and generation fences

**Files:**
- Create: `model/asset_model_readiness.go`
- Create: `model/asset_model_readiness_test.go`
- Modify: `model/main.go:266-365`
- Modify: `model/main.go:430-490`
- Modify: `model/asset.go:425-468`
- Test: `model/asset_test.go`

- [ ] **Step 1: Write failing schema and uniqueness tests**

Add tests that migrate the two rows, insert the same logical key twice with `clause.OnConflict{DoNothing: true}`, and assert only one target and one readiness row exist:

```go
func TestAssetModelCoverageRowsAreUniqueByLogicalKey(t *testing.T) {
	db := initAssetModelReadinessTestDB(t)
	now := int64(100)
	target := AssetModelCoverageTarget{
		ScopeKey: "scope-a", ModelName: "seedance-2.0-fast",
		RoutingGroups: `["default"]`, ChannelId: 120,
		MappedModel: "seedance-2.0-fast", BindingScope: "scope-upstream-a",
		CredentialIndex: 0, CandidateIndex: 0, Generation: 1,
		Status: AssetModelTargetStatusActive, CreatedAt: now, UpdatedAt: now,
	}
	require.NoError(t, db.Clauses(clause.OnConflict{DoNothing: true}).Create(&target).Error)
	target.Id = 0
	require.NoError(t, db.Clauses(clause.OnConflict{DoNothing: true}).Create(&target).Error)

	readiness := AssetModelReadiness{
		AssetId: 7, ScopeKey: "scope-a", ModelName: "seedance-2.0-fast",
		TargetGeneration: 1, ChannelId: 120, BindingScope: "scope-upstream-a",
		Status: AssetModelReadinessStatusPending, CreatedAt: now, UpdatedAt: now,
	}
	require.NoError(t, db.Clauses(clause.OnConflict{DoNothing: true}).Create(&readiness).Error)
	readiness.Id = 0
	require.NoError(t, db.Clauses(clause.OnConflict{DoNothing: true}).Create(&readiness).Error)

	var targetCount, readinessCount int64
	require.NoError(t, db.Model(&AssetModelCoverageTarget{}).Count(&targetCount).Error)
	require.NoError(t, db.Model(&AssetModelReadiness{}).Count(&readinessCount).Error)
	require.Equal(t, int64(1), targetCount)
	require.Equal(t, int64(1), readinessCount)
}
```

- [ ] **Step 2: Run the model test and verify it fails**

Run: `go test ./model/... -run 'TestAssetModelCoverageRowsAreUniqueByLogicalKey' -count=1`

Expected: FAIL because `AssetModelCoverageTarget`, `AssetModelReadiness`, and their constants do not exist.

- [ ] **Step 3: Define the rows and migration contract**

Create the following types and constants in `model/asset_model_readiness.go`; keep routing fields private in JSON:

```go
const (
	AssetModelTargetStatusSelecting   = "Selecting"
	AssetModelTargetStatusActive      = "Active"
	AssetModelTargetStatusRotating    = "Rotating"
	AssetModelTargetStatusUnavailable = "Unavailable"

	AssetModelReadinessStatusPending      = "Pending"
	AssetModelReadinessStatusProcessing   = "Processing"
	AssetModelReadinessStatusRetryWaiting = "RetryWaiting"
	AssetModelReadinessStatusActive       = "Active"
	AssetModelReadinessStatusFailed       = "Failed"
)

type AssetModelCoverageTarget struct {
	Id                 int64  `json:"-" gorm:"primaryKey"`
	ScopeKey           string `json:"-" gorm:"type:varchar(64);uniqueIndex:idx_asset_model_target_scope_model"`
	ModelName          string `json:"-" gorm:"type:varchar(191);uniqueIndex:idx_asset_model_target_scope_model"`
	RoutingGroups      string `json:"-" gorm:"type:text"`
	SpecificChannelId  int    `json:"-" gorm:"index"`
	ChannelId          int    `json:"-" gorm:"index"`
	MappedModel        string `json:"-" gorm:"type:varchar(191)"`
	BindingScope       string `json:"-" gorm:"type:varchar(80)"`
	CredentialIndex    int    `json:"-"`
	CandidateIndex     int    `json:"-"`
	Generation         int64  `json:"-"`
	Status             string `json:"-" gorm:"type:varchar(24);index"`
	LeaseOwner         string `json:"-" gorm:"type:varchar(64);index"`
	LeaseExpiresAt     int64  `json:"-" gorm:"index"`
	CreatedAt          int64  `json:"-"`
	UpdatedAt          int64  `json:"-"`
}

type AssetModelReadiness struct {
	Id                 int64  `json:"-" gorm:"primaryKey"`
	AssetId            int64  `json:"-" gorm:"uniqueIndex:idx_asset_model_readiness_identity;index"`
	ScopeKey           string `json:"-" gorm:"type:varchar(64);uniqueIndex:idx_asset_model_readiness_identity"`
	ModelName          string `json:"-" gorm:"type:varchar(191);uniqueIndex:idx_asset_model_readiness_identity"`
	TargetGeneration   int64  `json:"-" gorm:"index"`
	ChannelId          int    `json:"-" gorm:"index"`
	BindingScope       string `json:"-" gorm:"type:varchar(80)"`
	Status             string `json:"-" gorm:"type:varchar(24);index"`
	ErrorClass         string `json:"-" gorm:"type:varchar(48);index"`
	AttemptCount       int    `json:"-"`
	AttemptStartedAt   int64  `json:"-" gorm:"index"`
	NextRetryAt        int64  `json:"-" gorm:"index"`
	LeaseOwner         string `json:"-" gorm:"type:varchar(64);index"`
	LeaseExpiresAt     int64  `json:"-" gorm:"index"`
	CreatedAt          int64  `json:"-"`
	UpdatedAt          int64  `json:"-"`
}
```

Add both models to the normal and parallel `AutoMigrate` lists in `model/main.go`.

- [ ] **Step 4: Write failing CAS and due-scheduling tests**

Add tests with these exact calls and assertions:

```go
won, err := ActivateAssetModelReadinessCAS(AssetModelReadinessTransition{
	AssetId: 7, ScopeKey: "scope-a", ModelName: "seedance-2.0-fast",
	TargetGeneration: 1, ChannelId: 120, BindingScope: "scope-upstream-a",
	LeaseOwner: "node-a", Now: 130,
})
require.NoError(t, err)
require.True(t, won)

stale, err := ActivateAssetModelReadinessCAS(AssetModelReadinessTransition{
	AssetId: 7, ScopeKey: "scope-a", ModelName: "seedance-2.0-fast",
	TargetGeneration: 0, ChannelId: 120, BindingScope: "scope-upstream-a",
	LeaseOwner: "node-b", Now: 131,
})
require.NoError(t, err)
require.False(t, stale)

due, err := ListDueAssetModelReadiness(200, 50)
require.NoError(t, err)
require.Len(t, due, 1)
```

- [ ] **Step 5: Implement idempotent insert, leases, retries, and fenced transitions**

Implement these APIs in `model/asset_model_readiness.go` with `WHERE` clauses covering logical key, lease owner, target generation, channel, and binding scope:

```go
type AssetModelReadinessTransition struct {
	AssetId, TargetGeneration, Now int64
	ScopeKey, ModelName, BindingScope, LeaseOwner string
	ChannelId int
}

func EnsureAssetModelReadiness(assetID int64, scopeKey string, modelNames []string, now int64) error
func GetAssetModelCoverageTarget(scopeKey, modelName string) (*AssetModelCoverageTarget, error)
func ListAssetModelReadiness(assetID int64, scopeKey string, modelNames []string) ([]AssetModelReadiness, error)
func ListDueAssetModelReadiness(now int64, limit int) ([]AssetModelReadiness, error)
func ClaimAssetModelReadinessLease(id int64, owner string, now, leaseExpiresAt int64) (bool, error)
func ResetAssetModelReadinessForTargetCAS(id int64, owner string, target AssetModelCoverageTarget, now int64) (bool, error)
func ScheduleAssetModelReadinessRetryCAS(transition AssetModelReadinessTransition, errorClass string, nextRetryAt int64) (bool, error)
func ActivateAssetModelReadinessCAS(transition AssetModelReadinessTransition) (bool, error)
func FailAssetModelReadinessCAS(transition AssetModelReadinessTransition, errorClass string) (bool, error)
func ClaimAssetModelTargetLease(scopeKey, modelName, owner string, now, leaseExpiresAt int64) (bool, error)
func PublishAssetModelTargetCAS(scopeKey, modelName, owner string, candidate AssetModelCoverageTarget, now int64) (bool, error)
func RotateAssetModelTargetCAS(scopeKey, modelName string, expectedGeneration int64, errorClass string, now int64) (bool, error)
```

`PublishAssetModelTargetCAS` increments `generation` with `gorm.Expr("generation + ?", 1)`. `ActivateAssetModelReadinessCAS` accepts only a current lease and exact target snapshot. `ListDueAssetModelReadiness` includes `Pending`, due `RetryWaiting`, and expired `Processing` rows ordered by `next_retry_at`, `updated_at`, and `id`.

- [ ] **Step 6: Stop provider binding activation from rewriting source lifecycle state**

Remove the transaction update that changes `assets.status` inside `ActivateAssetBindingWithAssetCAS`. Add a regression test asserting a source `Processing` row stays `Processing` when a binding becomes active; public aggregation will be added in Task 3.

- [ ] **Step 7: Run model tests and commit**

Run: `go test ./model/... -run 'AssetModel|ActivateAssetBindingWithAssetCAS' -count=1`

Expected: PASS.

Commit:

```text
Make asset readiness transitions safe across router nodes

Constraint: Readiness is shared by multiple processes and target generations.
Rejected: In-memory locks | they do not fence stale workers on other nodes
Confidence: high
Scope-risk: moderate
Directive: Preserve logical uniqueness and generation checks on every readiness publish.
Tested: go test ./model/... -run 'AssetModel|ActivateAssetBindingWithAssetCAS' -count=1
Not-tested: provider integration
```

### Task 2: Derive the effective reusable-model scope and deterministic candidates

**Files:**
- Create: `service/asset_model_scope.go`
- Create: `service/asset_model_scope_test.go`
- Create: `service/asset_model_target.go`
- Create: `service/asset_model_target_test.go`
- Modify: `service/model_access.go:104-120`
- Modify: `service/model_access.go:317-340`
- Modify: `service/asset_reference.go:581-592`

- [ ] **Step 1: Write failing scope tests**

Create table-driven tests whose fixture contains `default`, `vip`, and `auto` abilities for `seedance-2.0-fast`, `seedance-2.0`, and a chat-only model. Assert:

```go
scope, err := ResolveAssetModelScope(AssetModelScopeInput{
	IdentityGroup: "default", TokenGroup: "auto", AcceptUnpriced: true,
	ModelLimitsEnabled: true,
	ModelLimits: map[string]bool{"seedance-2.0-fast": true, "seedance-2.0": true},
	ModelBlacklistEnabled: true,
	ModelBlacklist: map[string]bool{"seedance-2.0": true},
})
require.NoError(t, err)
require.Equal(t, []string{"default", "vip"}, scope.Groups)
require.Equal(t, []string{"seedance-2.0-fast"}, scope.ModelNames)
require.Len(t, scope.ScopeKey, 64)
```

Add separate assertions that a specific channel removes models it cannot serve, a chat-only endpoint is ignored, and an advertised video model with no registered materializer remains in `ModelNames` but has zero candidates so it can become terminal `Failed` rather than disappear.

- [ ] **Step 2: Run the scope test and verify it fails**

Run: `go test ./service/... -run 'TestResolveAssetModelScope' -count=1`

Expected: FAIL because `AssetModelScopeInput` and `ResolveAssetModelScope` do not exist.

- [ ] **Step 3: Export the existing group resolver and define the scope contract**

Rename `resolveTokenAccessGroups` to `ResolveTokenAccessGroups` and update `ResolveTokenModelAccess` to call it. Define:

```go
type AssetModelScopeInput struct {
	IdentityGroup string
	TokenGroup string
	AcceptUnpriced bool
	ModelLimitsEnabled bool
	ModelLimits map[string]bool
	ModelBlacklistEnabled bool
	ModelBlacklist map[string]bool
	SpecificChannelID int
}

type AssetModelScope struct {
	ScopeKey string
	Groups []string
	ModelNames []string
	SpecificChannelID int
}
```

`ResolveAssetModelScope` calls `ResolveTokenModelAccess`, keeps models whose `SupportedEndpointTypes` contain `constant.EndpointTypeVideo` or `constant.EndpointTypeOpenAIVideo`, sorts groups/models, and hashes this canonical payload:

```go
payload := struct {
	Version int `json:"version"`
	Groups []string `json:"groups"`
	Models []string `json:"models"`
	SpecificChannelID int `json:"specific_channel_id"`
}{Version: 1, Groups: groups, Models: modelNames, SpecificChannelID: input.SpecificChannelID}
```

Use SHA-256 hex for `ScopeKey`; never hash or persist the Flatkey API key itself.

- [ ] **Step 4: Write failing target-candidate tests**

Add a fixture with channels 106 and 120, two enabled TechMobi credentials on 120, and different model mappings. Assert stable ordering and exact credential namespaces:

```go
candidates, err := AssetModelTargetCandidates(scope, "seedance-2.0-fast")
require.NoError(t, err)
require.Len(t, candidates, 3)
require.Equal(t, 106, candidates[0].ChannelID)
require.Equal(t, 120, candidates[1].ChannelID)
require.Equal(t, 0, candidates[1].CredentialIndex)
require.Equal(t, 1, candidates[2].CredentialIndex)
require.NotEqual(t, candidates[1].BindingScope, candidates[2].BindingScope)
```

- [ ] **Step 5: Implement deterministic candidate enumeration and live target validation**

Define the private candidate value:

```go
type AssetModelTargetCandidate struct {
	ChannelID int
	ChannelType int
	Priority int64
	Weight int
	MappedModel string
	BindingScope string
	CredentialIndex int
}
```

For each scope group, call `model.GetChannelCandidatesWithFilter` for successive priority retries until it returns no rows. De-duplicate by `(channel_id, mapped_model, binding_scope)`. Keep only enabled channels with a registered materializer and image/video support. For TechMobi, expand every enabled key returned by `enabledAssetMaterializeKeys`, use `assetReferenceMappedModel`, and compute `assetBindingScope`; other registered providers use credential index `-1` and the provider's normal binding scope. Sort by priority descending, weight descending, channel ID ascending, then credential index ascending.

Implement:

```go
func AssetModelTargetCandidates(scope AssetModelScope, modelName string) ([]AssetModelTargetCandidate, error)
func EnsureAssetModelCoverageTarget(scope AssetModelScope, modelName string, owner string, now time.Time) (*model.AssetModelCoverageTarget, error)
func AssetModelTargetIsEligible(scope AssetModelScope, target model.AssetModelCoverageTarget) (bool, error)
func ResolveAssetModelTargetOptions(target model.AssetModelCoverageTarget, channel *model.Channel) (AssetMaterializeOptions, int, error)
```

`EnsureAssetModelCoverageTarget` reuses any still-eligible target even when candidate ordering changes. When selecting, it stores canonical `RoutingGroups`, exact mapped model, credential index, binding scope, and candidate index. `ResolveAssetModelTargetOptions` loads the current enabled credential at the stored index and recomputes the binding scope before returning it.

- [ ] **Step 6: Run scope/target tests and commit**

Run: `go test ./service/... -run 'AssetModelScope|AssetModelTarget' -count=1`

Expected: PASS.

Commit:

```text
Derive asset coverage from the authenticated routing scope

Constraint: Clients cannot choose the upload model or provider route.
Rejected: Persist the user-supplied asset model | it diverges from generation routing and becomes stale
Confidence: high
Scope-risk: moderate
Directive: Keep scope hashes provider-neutral and candidate order deterministic.
Tested: go test ./service/... -run 'AssetModelScope|AssetModelTarget' -count=1
Not-tested: production group configuration
```

### Task 3: Project public status from all required model rows

**Files:**
- Create: `service/asset_model_status.go`
- Create: `service/asset_model_status_test.go`
- Modify: `service/asset.go:397-450`
- Modify: `controller/asset.go:20-160`
- Modify: `controller/asset_test.go`
- Modify: `dto/asset.go`

- [ ] **Step 1: Write failing aggregation tests**

Create an available source with required models `seedance-2.0-fast` and `seedance-2.0`. Cover these exact projections:

```go
require.Equal(t, model.AssetStatusProcessing, ProjectAssetStatusForScope(asset, scope, rows, targets))

rows[0].Status = model.AssetModelReadinessStatusActive
rows[1].Status = model.AssetModelReadinessStatusActive
require.Equal(t, model.AssetStatusActive, ProjectAssetStatusForScope(asset, scope, rows, targets))

rows[1].TargetGeneration--
require.Equal(t, model.AssetStatusProcessing, ProjectAssetStatusForScope(asset, scope, rows, targets))

scope.ModelNames = nil
require.Equal(t, model.AssetStatusFailed, ProjectAssetStatusForScope(asset, scope, nil, nil))
```

Add source-first cases: incomplete source is `Creating`, unavailable source is `Failed`, expired unrecoverable source is `Expired`. Add a JSON response assertion that channel ID, binding scope, credential index, target generation, and upstream asset ID are absent.

- [ ] **Step 2: Run aggregation tests and verify they fail**

Run: `go test ./service/... -run 'ProjectAssetStatusForScope|ReconcileAssetForScope' -count=1`

Expected: FAIL because strict enrollment and projection are absent.

- [ ] **Step 3: Implement enrollment and projection**

Define:

```go
func ReconcileAssetForScope(ctx context.Context, userID int, publicID string, scope AssetModelScope) (*AssetResult, error)
func ProjectAssetStatusForScope(asset model.Asset, scope AssetModelScope, rows []model.AssetModelReadiness, targets map[string]model.AssetModelCoverageTarget) string
```

`ReconcileAssetForScope` verifies ownership, returns source lifecycle immediately when the source is not available, inserts one readiness row per required model, ensures or validates each target, reloads rows, and projects. Missing/stale/retrying rows are `Processing`; all exact current rows with matching active `asset_bindings` are `Active`; a terminal row is `Failed`; an empty model set is `Failed`. Do not write the aggregate status back to `assets.status`.

- [ ] **Step 4: Write failing controller compatibility tests**

Add tests for JSON, multipart, upload-session, completion, and GET paths. Supply an optional blocked `model` and assert it is accepted but ignored:

```go
request := httptest.NewRequest(http.MethodPost, "/v1/assets", strings.NewReader(`{
	"asset_type":"Image",
	"url":"https://example.com/source.png",
	"model":"client-value-must-not-select-readiness"
}`))
request.Header.Set("Content-Type", "application/json")
recorder := httptest.NewRecorder()
router.ServeHTTP(recorder, request)
require.Equal(t, http.StatusOK, recorder.Code)
require.Equal(t, 1, reconcileCalls)
require.Equal(t, []string{"seedance-2.0-fast", "seedance-2.0"}, reconciledScope.ModelNames)
```

- [ ] **Step 5: Derive scope only from authenticated context**

Implement `ResolveAssetModelScopeForContext(c, userID)` in `service/asset_model_scope.go`. It reads user group, token group, model limit/blacklist maps, and the parsed specific-channel ID from typed context keys; it loads the user only to compute `UserAcceptsUnpricedModels`. Remove `assetTokenAllowsModel` and every asset-controller rejection based on request/form `model`.

After successful source creation/upload/completion and on every GET, call `ReconcileAssetForScope`. Keep upload-session response status `pending` until completion. Preserve optional DTO `Model` fields so old clients still decode.

- [ ] **Step 6: Add the rollout switch**

Define:

```go
var AssetModelCoverageStrictEnabled = common.GetEnvOrDefaultBool("ASSET_MODEL_COVERAGE_STRICT_ENABLED", false)
```

When false, preserve the legacy source-only projection while still enrolling rows and running preparation. When true, return the strict projection. Tests save and restore this variable and run strict assertions with it enabled.

- [ ] **Step 7: Run controller/service tests and commit**

Run: `go test ./service/... ./controller/... -run 'Asset.*(Model|Scope|Status|Upload|Get)' -count=1`

Expected: PASS.

Commit:

```text
Make public asset status reflect complete model coverage

Constraint: Existing clients may still send an optional asset model field.
Rejected: Expose per-channel readiness | provider and credential details are private
Confidence: high
Scope-risk: broad
Directive: Never persist one key scope's aggregate status into the shared source row.
Tested: go test ./service/... ./controller/... -run 'Asset.*(Model|Scope|Status|Upload|Get)' -count=1
Not-tested: strict projection in staging
```

### Task 4: Preserve upstream error evidence and retry transient writes

**Files:**
- Create: `service/asset_materialize_error.go`
- Create: `service/asset_materialize_error_test.go`
- Modify: `service/techmobi_asset.go`
- Modify: `service/techmobi_asset_test.go`
- Modify: `service/asset_binding.go:300-355`
- Modify: `model/asset.go:470-520`
- Test: `service/asset_binding_test.go`

- [ ] **Step 1: Write failing 429 and 502 preservation tests**

For a TechMobi test server, return:

```go
w.Header().Set("Retry-After", "15")
w.Header().Set("X-Request-Id", "req-rate-limit")
w.WriteHeader(http.StatusTooManyRequests)
_, _ = w.Write([]byte(`{"error":{"code":"QuotaWriteQPMExceeded","message":"write quota exceeded"}}`))
```

Assert the returned error is retryable, has class `throttled`, status 429, code `QuotaWriteQPMExceeded`, retry-after 15 seconds, and public `Error()` text contains none of the upstream message, URL, request ID, or authorization value. Add the same assertion for 502 with class `upstream_5xx`.

- [ ] **Step 2: Run classification tests and verify they fail**

Run: `go test ./service/... -run 'TechMobi.*(429|502)|AssetMaterializeError' -count=1`

Expected: FAIL because TechMobi currently collapses status and body to `asset upload failed`.

- [ ] **Step 3: Implement the private typed failure**

Define:

```go
const (
	AssetMaterializeErrorThrottled = "throttled"
	AssetMaterializeErrorTimeout = "timeout"
	AssetMaterializeErrorUpstream5xx = "upstream_5xx"
	AssetMaterializeErrorProcessing = "upstream_processing"
	AssetMaterializeErrorDefinitive = "definitive"
	AssetMaterializeErrorInternal = "internal"
)

type AssetMaterializeFailure struct {
	Class string
	HTTPStatus int
	UpstreamCode string
	RetryAfter time.Duration
	RequestID string
	cause error
}

func (e *AssetMaterializeFailure) Error() string { return "asset upstream request failed" }
func (e *AssetMaterializeFailure) Unwrap() error { return e.cause }
func IsRetryableAssetMaterializeError(err error) bool
func AssetMaterializeErrorClass(err error) string
```

Classify 429, timeouts, context deadline, 5xx, and upstream `Processing` as retryable. Classify other 4xx as definitive unless the stable code is `QuotaWriteQPMExceeded`. Parse both integer and HTTP-date `Retry-After` values.

- [ ] **Step 4: Preserve TechMobi status/body without leaking it publicly**

Read at most `techMobiAssetResponseMaxSize`, parse `error.code`, `code`, `request_id`, and response headers, and return `AssetMaterializeFailure`. Continue returning the existing provider-neutral `errAssetUploadFailed` for local malformed request construction and source-fetch failures.

- [ ] **Step 5: Keep retryable bindings claimable**

Add:

```go
func ReleaseAssetBindingForRetryCAS(assetID int64, channelID int, bindingScope, leaseOwner, errorCode string, now int64) (bool, error)
```

It changes an exact leased binding back to `PENDING`, clears lease fields, keeps the sanitized error class, and never stores upstream message/body/request ID. In `createLeasedAssetBinding`, use this transition for retryable errors and retain `FailAssetBindingForScopeCAS` for definitive failures. Update `AssetBindingAPIError` so retryable materialization errors map to provider-neutral `asset_not_ready` rather than `asset_channel_unavailable`.

- [ ] **Step 6: Run materialization tests and commit**

Run: `go test ./service/... ./model/... -run 'TechMobiAsset|AssetMaterialize|AssetBinding' -count=1`

Expected: PASS.

Commit:

```text
Keep transient provider writes in asset preparation

Constraint: Upstream throttling and 5xx responses are operational evidence, not terminal client errors.
Rejected: Return the upstream response body | it leaks provider identity and request metadata
Confidence: high
Scope-risk: moderate
Directive: Persist only sanitized error classes; retain status, code, retry-after, and request ID in restricted logs.
Tested: go test ./service/... ./model/... -run 'TechMobiAsset|AssetMaterialize|AssetBinding' -count=1
Not-tested: real upstream retry-after behavior
```

### Task 5: Prepare readiness rows, back off, and rotate exhausted targets

**Files:**
- Create: `service/asset_model_worker.go`
- Create: `service/asset_model_worker_test.go`
- Modify: `main.go:150-175`
- Modify: `service/asset_model_status.go`

- [ ] **Step 1: Write failing retry and rotation tests**

Use a fake materializer that returns 429 twice, 502 once, then Active. Advance a fake clock and assert due times are 5, 15, and 30 seconds and public status remains `Processing`. Add a second test whose first target remains retryable for five minutes and whose second target succeeds; assert target generation increments and both old and new provider bindings remain stored.

```go
require.Equal(t, []int64{105, 120, 150}, observedRetryTimes)
require.Equal(t, int64(2), finalTarget.Generation)
require.Equal(t, model.AssetModelReadinessStatusActive, finalReadiness.Status)
require.Equal(t, 2, bindingCount)
```

- [ ] **Step 2: Run worker tests and verify they fail**

Run: `go test ./service/... -run 'AssetModelWorker|AssetModelRetry|AssetModelRotation' -count=1`

Expected: FAIL because no readiness worker or rotation loop exists.

- [ ] **Step 3: Implement the database-backed worker**

Define:

```go
const (
	assetModelWorkerBatchSize = 50
	assetModelWorkerPollInterval = time.Second
	assetModelReadinessLeaseTTL = 30 * time.Second
	assetModelTargetLeaseTTL = 15 * time.Second
	assetModelGenerationWindow = 5 * time.Minute
)

var assetModelRetrySchedule = []time.Duration{
	5 * time.Second, 15 * time.Second, 30 * time.Second, 60 * time.Second,
}

func StartAssetModelReadinessWorker()
func RunAssetModelReadinessBatch(ctx context.Context, owner string, now time.Time) (int, error)
func PrepareAssetModelReadiness(ctx context.Context, row model.AssetModelReadiness, owner string, now time.Time) error
```

For each due row: claim its lease; load the owned asset and scope descriptor; ensure/revalidate the target; reset the row to the current generation; load the current channel and credential by stored index; reuse or materialize the exact binding; activate only when binding, generation, channel, and binding scope match. Use the schedule entry at `min(attempt_count-1, 3)`, while honoring a longer upstream `Retry-After`.

- [ ] **Step 4: Implement definitive failure and rotation rules**

Within one generation, retry transient results until `attempt_started_at + 5 minutes`. Then rotate to the next deterministic candidate if it exists. Mark the target `Unavailable` and the model readiness `Failed` only after every candidate has returned a definitive error or exhausted its retry window. A later status read that sees changed candidates calls `RotateAssetModelTargetCAS`, reopens readiness as `Pending`, and returns `Processing`.

- [ ] **Step 5: Add restricted observability**

Emit structured log fields for Flatkey asset ID, public model, target generation, channel ID, error class, attempt, retry delay, and elapsed preparation time. Do not log API keys, binding scopes, signed source URLs, upstream response bodies, request authorization, or upstream asset IDs. Add counters through the existing metrics/logging facility for target selection, rotation, binding cache hit/write, throttling retry, window exhaustion, and activation latency.

- [ ] **Step 6: Start the worker and run tests**

Call `controller.StartAssetTaskWorker()` and `service.StartAssetModelReadinessWorker()` independently from `main.go`; one worker failing must not stop the other.

Run: `go test ./service/... -run 'AssetModelWorker|AssetModelRetry|AssetModelRotation|AssetModelMultiNode' -count=1`

Expected: PASS, including a two-goroutine test that records one provider `CreateAsset` call for one exact binding scope.

- [ ] **Step 7: Commit**

```text
Prepare model coverage with durable retries and rotation

Constraint: Provider writes may be throttled while several router nodes process the same asset.
Rejected: Process-local timers | retries and leases must survive restart and coordinate across nodes
Confidence: high
Scope-risk: broad
Directive: Do not publish readiness without the target-generation fence.
Tested: go test ./service/... -run 'AssetModelWorker|AssetModelRetry|AssetModelRotation|AssetModelMultiNode' -count=1
Not-tested: production provider latency distribution
```

### Task 6: Pin video creation to the verified common target

**Files:**
- Modify: `service/asset_reference.go`
- Modify: `service/asset_reference_test.go`
- Modify: `service/channel_select.go`
- Modify: `service/asset_binding.go`
- Modify: `middleware/distributor.go:240-265`
- Modify: `middleware/distributor.go:455-520`
- Modify: `middleware/distributor_byteplus_asset_test.go`
- Modify: `controller/asset_task_worker.go:145-220`
- Modify: `controller/asset_task_worker.go:430-525`
- Modify: `controller/asset_task_worker_test.go`
- Modify: `model/task.go:154-167`

- [ ] **Step 1: Write failing common-target routing tests**

Create two independently active assets with bindings on different channels plus readiness rows that identify one common current target. Assert the target outranks ordinary `AllBound` bindings and both references rewrite with the target scope:

```go
readiness, eligible := refs.ReadinessForChannel(targetChannel, "seedance-2.0-fast")
require.True(t, eligible)
require.Equal(t, AssetReadinessVerifiedTarget, readiness)

rewrite := refs.RewriteMapForSelectedChannel(targetChannel, "seedance-2.0-fast", targetKey)
require.Equal(t, "asset://upstream-a-target", rewrite["asset://ast_asset_a"])
require.Equal(t, "asset://upstream-b-target", rewrite["asset://ast_asset_b"])
```

Add a stale-generation case that returns target-channel `Recoverable` and makes other channels ineligible, causing preparation rather than submission through an unrelated binding.

- [ ] **Step 2: Run routing tests and verify they fail**

Run: `go test ./service/... ./middleware/... -run 'VerifiedTarget|CommonTarget|Stale.*Readiness' -count=1`

Expected: FAIL because the reference set does not carry coverage snapshots.

- [ ] **Step 3: Attach a private target snapshot to the reference set**

Extend `AssetReferenceSet` with unexported scope, target, and per-asset readiness fields. Add `AssetReadinessVerifiedTarget` before `AssetReadinessAllBound` in sort order while keeping `AssetReadinessIneligible` excluded by the boolean return. During `ResolveAssetReferences`, derive the authenticated scope, enroll all referenced assets for `req.Model`, ensure the model target, and load readiness rows.

When strict coverage is enabled, `ChannelReadiness` returns eligible only for the current target channel and binding namespace: `VerifiedTarget` when every row is exact Active, otherwise `Recoverable`. Legacy behavior remains under the rollout switch.

- [ ] **Step 4: Pin the selected credential and mapped model**

Before `ResolveAssetMaterializeOptions` chooses a key by binding score, ask the reference set for its current target. If present, call `ResolveAssetModelTargetOptions`, replace the selected channel key/index, and verify the recomputed binding scope equals the target. `MaterializeAssetBindingsForChannel` then reuses or creates every binding under that exact namespace.

- [ ] **Step 5: Preserve token restrictions in queued task context**

Add the internal field:

```go
SpecificChannelId int `json:"specific_channel_id,omitempty"`
```

to `model.TaskPrivateData`. When queueing, parse `ContextKeyTokenSpecificChannelId` and persist it. In `rebuildAssetTaskContext`, reload the token and restore all of these keys before resolving references:

```go
common.SetContextKey(c, constant.ContextKeyTokenGroup, token.Group)
common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, token.ModelLimitsEnabled)
common.SetContextKey(c, constant.ContextKeyTokenModelLimit, token.GetModelLimitsMap())
common.SetContextKey(c, constant.ContextKeyTokenModelBlacklistEnabled, token.ModelBlacklistEnabled)
common.SetContextKey(c, constant.ContextKeyTokenModelBlacklist, token.GetModelBlacklistMap())
if task.PrivateData.SpecificChannelId > 0 {
	common.SetContextKey(c, constant.ContextKeyTokenSpecificChannelId, strconv.Itoa(task.PrivateData.SpecificChannelId))
}
```

Use the token's current group/rules so a permission change invalidates old scope readiness instead of submitting with a stale snapshot.

- [ ] **Step 6: Requeue transient target work and submit immediately after activation**

Make `assetTaskShouldWaitForAssets` accept `asset_not_ready` and errors for which `IsRetryableAssetMaterializeError` is true. Keep the existing five-minute task preparation deadline and refund path. On the next worker pass, reference resolution reloads current readiness; once every row is Active, channel ranking picks the verified target, materialization becomes binding-cache-only, and task submission follows immediately.

- [ ] **Step 7: Run task-routing tests and commit**

Run: `go test ./service/... ./middleware/... ./controller/... -run 'Asset.*(Target|Route|Task|Preparing|SpecificChannel|ModelLimit)' -count=1`

Expected: PASS.

Commit:

```text
Route asset tasks through the readiness target they observed

Constraint: Two public Active assets must share one usable provider namespace for a task.
Rejected: Let normal weighted routing choose after status | it breaks the Active guarantee
Confidence: high
Scope-risk: broad
Directive: Revalidate target eligibility before provider submission and retain local preparing_assets on transient drift.
Tested: go test ./service/... ./middleware/... ./controller/... -run 'Asset.*(Target|Route|Task|Preparing|SpecificChannel|ModelLimit)' -count=1
Not-tested: live dual-asset video acceptance
```

### Task 7: Document the contract and add a reproducible timing probe

**Files:**
- Create: `scripts/asset_model_coverage_probe.ps1`
- Modify: `docs/api/byteplus-asset-api.md`
- Modify: `docs/openapi/relay.json`
- Modify: `.env.example`

- [ ] **Step 1: Update API documentation and OpenAPI descriptions**

Document that `model` is optional compatibility input and does not select readiness. Define public states exactly: source incomplete `Creating`; missing/retrying model coverage `Processing`; complete current coverage `Active`; exhausted coverage `Failed`; unrecoverable source `Expired`. Add `ASSET_MODEL_COVERAGE_STRICT_ENABLED=false` to `.env.example` and the staged enablement sequence.

- [ ] **Step 2: Add the secret-safe probe script**

The script must require `FLATKEY_BASE_URL`, `FLATKEY_TEST_API_KEY`, `FAST_MODEL`, and `PRO_MODEL` from the environment, accept two image paths, and never print the API key. It records UTC timestamps and elapsed milliseconds for:

1. each upload request;
2. polling until public `Active` or terminal `Failed`;
3. video task creation immediately after `Active`;
4. polling until task success/failure.

Its final JSON shape is:

```json
{
  "model": "seedance-2.0-fast",
  "assets": [
    {"id":"ast_redacted","bytes":2097152,"upload_ms":0,"active_ms":0}
  ],
  "task": {"create_ms":0,"accepted":true,"terminal_ms":0,"status":"submitted"}
}
```

Use `Invoke-WebRequest -Form` for uploads, `Invoke-RestMethod` for queries, a one-second polling interval, and a ten-minute hard deadline. Print only public IDs, statuses, sizes, and durations; exclude response headers and error bodies because they may contain internal request metadata.

- [ ] **Step 3: Validate docs and script syntax**

Run: `Get-Content -Path scripts\asset_model_coverage_probe.ps1 -Raw | [scriptblock]::Create($input) | Out-Null`

Expected: command exits 0.

Run: `go test ./controller/... -run 'Asset.*Model.*Compatibility' -count=1`

Expected: PASS.

- [ ] **Step 4: Commit**

```text
Make asset readiness measurable without exposing credentials

Constraint: Production probes use customer-like keys and must not leak them to logs or commits.
Rejected: Embed a test API key | secrets must remain environment-only and rotatable
Confidence: high
Scope-risk: narrow
Directive: Keep probe output limited to public IDs, statuses, byte counts, and timing.
Tested: PowerShell syntax validation; controller compatibility tests
Not-tested: production probe execution
```

### Task 8: Verify behavior, migration safety, and live readiness timing

**Files:**
- Review: all files changed in Tasks 1-7
- Review: `docs/superpowers/specs/2026-08-07-asset-model-coverage-readiness-design.md`

- [ ] **Step 1: Run focused packages**

Run: `go test ./model/... ./service/... ./controller/... ./middleware/... -count=1`

Expected: PASS with no race, stale-generation, projection, routing, or task-worker failures.

- [ ] **Step 2: Run repository-wide verification**

Run: `go test ./... -count=1`

Expected: PASS.

Run: `go build ./...`

Expected: PASS.

- [ ] **Step 3: Review migration and privacy evidence**

Run: `rg -n 'api[_-]?key|authorization|binding_scope|upstream_asset|request_id' service/asset_model_*.go controller/asset.go scripts/asset_model_coverage_probe.ps1`

Expected: matches are limited to private fields, explicit redaction, credential resolution, and negative tests; no literal key beginning with `sk-` appears.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 4: Run fresh two-asset probes after staging enablement**

Set the required environment variables in the shell without echoing their values. Run the probe once for `seedance-2.0-fast` through the 120-capable group and once for `seedance-2.0` through the 106-capable group, using two fresh approximately 2 MiB images for each run.

Success criteria:

- each asset remains `Processing` through 429, 5xx, or upstream processing periods;
- `Active` appears only after the model target and exact bindings are verified;
- task creation after `Active` is accepted through the same target without `asset_channel_unavailable`;
- a live 429 records retry delay and later progress rather than terminal failure;
- a live 502 stays retryable until the target window expires, then rotates or becomes `Failed` only after all candidates are exhausted;
- the output contains upload latency, Active latency, task-create latency, and terminal task latency for both assets and models.

- [ ] **Step 5: Review acceptance criteria and rotate the exposed test credential**

Check all ten acceptance criteria in the approved design against test names and probe output. Rotate the production-like API key previously shared in chat after the final probe because it must be treated as exposed; do not place it in commits, plan files, test fixtures, shell history, or final reports.

- [ ] **Step 6: Commit final verification adjustments if the verification run changed files**

```text
Close asset readiness gaps found by end-to-end verification

Constraint: Public Active must remain sufficient for unchanged-routing task creation.
Rejected: Waive failing provider scenarios | 429 and 5xx handling define the feature's correctness
Confidence: high
Scope-risk: moderate
Directive: Keep the live probe reproducible and credential-free in repository history.
Tested: go test ./... -count=1; go build ./...; dual-asset staging probes
Not-tested: long-duration provider outage beyond the configured retry windows
```
