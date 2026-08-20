# Intelligent Routing Policy Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver durable intelligent-routing policy versions, deterministic administrator rollouts, publication and rollback, root-only management APIs, and request-path rollout resolution.

**Architecture:** GORM repositories persist immutable published policies and a revisioned singleton rollout. A service layer validates policy documents, performs transactional publication and rollback, and exposes an atomic local runtime snapshot; the request path resolves group targeting and stable traffic buckets without database access.

**Tech Stack:** Go 1.22+, Gin, GORM v2, testify, existing `common` JSON wrappers, SQLite/MySQL/PostgreSQL-compatible schema.

**Spec:** `docs/superpowers/specs/2026-08-20-multi-instance-admin-intelligent-routing-design.md`

## Global Constraints

- Preserve SQLite, MySQL 5.7.8+, and PostgreSQL 9.6+ compatibility.
- Use `common.Marshal`, `common.Unmarshal`, `common.UnmarshalJsonStr`, or `common.DecodeJson`; do not call `encoding/json` marshal/unmarshal functions.
- Use `lockForUpdate(tx)` for standard GORM row locks.
- Published policies are immutable; rollback creates a new published version.
- All mutation endpoints require root authorization, optimistic concurrency where applicable, and operation audit.
- Do not place user IDs, token IDs, session IDs, prompts, credentials, or arbitrary errors into metric dimensions.
- Keep `relaykit/` independently buildable with `GOWORK=off`.
- Follow TDD: observe each focused test fail before implementing its production behavior.

## File Structure

- Create `model/intelligent_routing_policy.go`: durable policy and rollout models plus transaction-safe repository operations.
- Create `model/intelligent_routing_policy_test.go`: SQLite-backed repository contract tests.
- Modify `model/main.go`: include both models in normal and fast migrations.
- Create `service/intelligent_routing/policy_document.go`: canonical document parsing, validation, checksum, and structured validation errors.
- Create `service/intelligent_routing/policy_document_test.go`: deterministic validation and checksum tests.
- Create `service/intelligent_routing/policy_control.go`: draft, publish, rollback, rollout update, and immutable snapshot orchestration.
- Create `service/intelligent_routing/policy_control_test.go`: service transaction, immutability, and conflict tests.
- Create `service/intelligent_routing/rollout.go`: deterministic group matching and stable bucket resolution.
- Create `service/intelligent_routing/rollout_test.go`: rollout resolution behavior tests.
- Create `dto/intelligent_routing.go`: explicit administrator request and response DTOs.
- Create `controller/intelligent_routing.go`: root administrator policy and rollout handlers.
- Create `controller/intelligent_routing_test.go`: handler status, DTO, conflict, and audit tests.
- Modify `controller/audit.go`: register stable intelligent-routing audit templates.
- Modify `router/api-router.go`: register the root-only route group.
- Modify `controller/relay.go`: replace the global-only enable decision with the immutable rollout snapshot while preserving legacy behavior when no durable rollout exists.
- Modify `controller/intelligent_routing_shadow_test.go`: cover scoped shadow/live activation in the relay flow.
- Modify `docs/intelligent-routing-shadow-rollout.md`: document durable policy and rollout administration.

---

### Task 1: Durable Policy and Rollout Models

**Files:**
- Create: `model/intelligent_routing_policy.go`
- Create: `model/intelligent_routing_policy_test.go`
- Modify: `model/main.go`

**Interfaces:**
- Produces: `IntelligentRoutingPolicy`, `IntelligentRoutingRollout`, `CreateIntelligentRoutingDraft`, `UpdateIntelligentRoutingDraft`, `ListIntelligentRoutingPolicies`, `GetIntelligentRoutingPolicy`, `GetActiveIntelligentRoutingPolicy`, `PublishIntelligentRoutingPolicy`, `RollbackIntelligentRoutingPolicy`, `GetIntelligentRoutingRollout`, `UpdateIntelligentRoutingRollout`.
- Consumes: global `model.DB`, `lockForUpdate(tx)`, GORM transactions.

- [ ] **Step 1: Write failing migration and draft repository tests**

Create a SQLite fixture that assigns `model.DB`, migrates the two new models, creates a draft, fetches it, and rejects updating a non-draft row. Use exact assertions:

```go
require.NoError(t, DB.AutoMigrate(&IntelligentRoutingPolicy{}, &IntelligentRoutingRollout{}))
draft, err := CreateIntelligentRoutingDraft(IntelligentRoutingPolicy{Status: IntelligentRoutingPolicyDraft, Config: `{"enabled":false}`, Checksum: "sum", CreatedBy: 11})
require.NoError(t, err)
assert.Equal(t, IntelligentRoutingPolicyDraft, draft.Status)
stored, err := GetIntelligentRoutingPolicy(draft.Id)
require.NoError(t, err)
assert.Equal(t, draft.Id, stored.Id)
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `go test ./model -run 'TestIntelligentRoutingPolicy' -count=1`

Expected: FAIL because the policy and rollout types and repository functions do not exist.

- [ ] **Step 3: Implement portable models and draft operations**

Define statuses as string constants and use portable fields:

```go
type IntelligentRoutingPolicy struct {
    Id            int64      `json:"id" gorm:"primaryKey"`
    Version       int        `json:"version" gorm:"index"`
    Status        string     `json:"status" gorm:"type:varchar(16);index"`
    Config        string     `json:"config" gorm:"type:text"`
    Checksum      string     `json:"checksum" gorm:"type:varchar(64)"`
    SourceVersion int        `json:"source_version"`
    ChangeNote    string     `json:"change_note" gorm:"type:varchar(500)"`
    CreatedBy     int        `json:"created_by"`
    PublishedBy   int        `json:"published_by"`
    PublishedAt   *time.Time `json:"published_at"`
    CreatedAt     time.Time  `json:"created_at"`
    UpdatedAt     time.Time  `json:"updated_at"`
}

type IntelligentRoutingRollout struct {
    Id             int64      `json:"id" gorm:"primaryKey"`
    Revision       int64      `json:"revision"`
    PolicyVersion  int        `json:"policy_version"`
    Enabled        bool       `json:"enabled"`
    Mode           string     `json:"mode" gorm:"type:varchar(16)"`
    TrafficPercent int        `json:"traffic_percent"`
    UserGroups     string     `json:"user_groups" gorm:"type:text"`
    TokenGroups    string     `json:"token_groups" gorm:"type:text"`
    UpdatedBy      int        `json:"updated_by"`
    StartedAt      *time.Time `json:"started_at"`
    EndedAt        *time.Time `json:"ended_at"`
    CreatedAt      time.Time  `json:"created_at"`
    UpdatedAt      time.Time  `json:"updated_at"`
}
```

Use GORM `Create`, `First`, `Order`, `Limit`, and conditional `Updates`; return named sentinel errors for not found, immutable policy, and revision conflict.

- [ ] **Step 4: Add transactional publication, rollback, and rollout conflict tests**

Assert publication assigns version 1, archives an existing active row when version 2 is published, rollback of version 1 creates active version 3 with `SourceVersion == 1`, and rollout update with the wrong revision returns `ErrIntelligentRoutingRevisionConflict` without changing the stored row.

- [ ] **Step 5: Implement transactional publication and rollout updates**

Inside `DB.Transaction`, lock the current active row and latest version query through `lockForUpdate(tx)`, calculate the next version, archive the active row, then update the selected draft. Implement rollback by copying configuration and checksum into a new active row. Implement rollout compare-and-swap with:

```go
result := tx.Model(&IntelligentRoutingRollout{}).
    Where("id = ? AND revision = ?", current.Id, expectedRevision).
    Updates(map[string]any{"revision": expectedRevision + 1, /* normalized fields */})
if result.Error != nil { return result.Error }
if result.RowsAffected != 1 { return ErrIntelligentRoutingRevisionConflict }
```

- [ ] **Step 6: Register both tables in normal and fast migrations**

Add `&IntelligentRoutingPolicy{}` and `&IntelligentRoutingRollout{}` to the existing `AutoMigrate` lists in `model/main.go`; do not add dialect-specific SQL.

- [ ] **Step 7: Run model tests**

Run: `go test ./model -run 'TestIntelligentRoutingPolicy|TestIntelligentRoutingRollout' -count=1`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add model/intelligent_routing_policy.go model/intelligent_routing_policy_test.go model/main.go
git commit -m "feat: persist intelligent routing policies"
```

### Task 2: Policy Document Validation and Canonical Checksum

**Files:**
- Create: `service/intelligent_routing/policy_document.go`
- Create: `service/intelligent_routing/policy_document_test.go`
- Modify: `setting/intelligent_routing_setting/config.go`
- Modify: `setting/intelligent_routing_setting/config_test.go`

**Interfaces:**
- Consumes: `intelligent_routing_setting.Config`, `intelligent_routing_setting.Normalize`, billing model configuration accessors.
- Produces: `ValidationIssue`, `ValidatedPolicy`, `ValidatePolicyDocument(raw string) (ValidatedPolicy, []ValidationIssue)`, `CanonicalPolicyJSON(config Config) (string, error)`.

- [ ] **Step 1: Write failing table tests for valid and invalid documents**

Cover exact field codes for malformed JSON, oversized JSON, duplicate models, negative prices, excessive attempts, excessive durations, unknown capabilities, and a live-capable document with no models. Assert semantically identical JSON produces the same checksum.

```go
assert.Equal(t, ValidationIssue{Code: "max_attempts.out_of_range", Field: "max_attempts"}, issues[0])
assert.Equal(t, first.Checksum, second.Checksum)
```

- [ ] **Step 2: Run validation tests and verify they fail**

Run: `go test ./service/intelligent_routing ./setting/intelligent_routing_setting -run 'TestValidatePolicyDocument|TestNormalizeRejectsExcessive' -count=1`

Expected: FAIL because structured validation and upper bounds are absent.

- [ ] **Step 3: Add explicit configuration ceilings**

Add constants for maximum policy bytes, models, attempts, endpoints per model, duration budgets, context limit, price, and cost multiplier. Extend normalization to reject values above those ceilings while preserving current defaults.

- [ ] **Step 4: Implement canonicalization and structured validation**

Parse with `common.UnmarshalJsonStr`, normalize, sort copied model policies by model name, sort copied capability slices, marshal with `common.Marshal`, and hash canonical bytes with SHA-256. Map normalization failures to stable field-specific `ValidationIssue` values; do not expose raw parser internals.

- [ ] **Step 5: Run focused tests**

Run: `go test ./service/intelligent_routing ./setting/intelligent_routing_setting -run 'TestValidatePolicyDocument|TestCanonicalPolicy|TestNormalize' -count=1`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add service/intelligent_routing/policy_document.go service/intelligent_routing/policy_document_test.go setting/intelligent_routing_setting/config.go setting/intelligent_routing_setting/config_test.go
git commit -m "feat: validate intelligent routing policies"
```

### Task 3: Policy Control Service and Immutable Runtime Snapshot

**Files:**
- Create: `service/intelligent_routing/policy_control.go`
- Create: `service/intelligent_routing/policy_control_test.go`

**Interfaces:**
- Consumes: Task 1 repository functions and Task 2 `ValidatePolicyDocument`.
- Produces: `PolicyRepository` interface, `PolicyControl`, `RuntimePolicySnapshot`, `NewPolicyControl`, `CreateDraft`, `UpdateDraft`, `Publish`, `Rollback`, `UpdateRollout`, `RefreshSnapshot`, `Snapshot`.

- [ ] **Step 1: Write failing service tests with a fake repository**

Verify invalid drafts never reach the repository, publication requires a non-empty trimmed change note, rollback refreshes the snapshot, and a repository revision conflict is preserved as a service conflict.

```go
control := NewPolicyControl(repo)
_, issues, err := control.CreateDraft(ctx, `{"max_attempts":999}`, 7)
require.NoError(t, err)
require.NotEmpty(t, issues)
assert.Zero(t, repo.createCalls)
```

- [ ] **Step 2: Run the service tests and verify they fail**

Run: `go test ./service/intelligent_routing -run 'TestPolicyControl' -count=1`

Expected: FAIL because `PolicyControl` is undefined.

- [ ] **Step 3: Implement the repository interface and service methods**

Keep database structs out of request-path code. Store the runtime snapshot in `atomic.Pointer[RuntimePolicySnapshot]`; build a fully validated snapshot before swapping it. Return a deep copy from `Snapshot` so callers cannot mutate shared maps or slices.

- [ ] **Step 4: Add stale snapshot tests**

Verify a failed refresh leaves the last valid snapshot unchanged and that a disabled rollout produces a valid disabled snapshot rather than a nil pointer.

- [ ] **Step 5: Implement refresh failure behavior**

Load rollout and referenced published policy, validate checksum and document, construct the new snapshot, then atomically store it. Return the loading error without changing the old snapshot.

- [ ] **Step 6: Run focused tests**

Run: `go test ./service/intelligent_routing -run 'TestPolicyControl|TestRuntimePolicySnapshot' -count=1`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add service/intelligent_routing/policy_control.go service/intelligent_routing/policy_control_test.go
git commit -m "feat: control intelligent routing policy lifecycle"
```

### Task 4: Deterministic Rollout Resolution

**Files:**
- Create: `service/intelligent_routing/rollout.go`
- Create: `service/intelligent_routing/rollout_test.go`

**Interfaces:**
- Consumes: `RuntimePolicySnapshot` from Task 3.
- Produces: `RolloutSubject`, `RolloutDecision`, `ResolveRollout(snapshot RuntimePolicySnapshot, subject RolloutSubject) RolloutDecision`.

- [ ] **Step 1: Write failing deterministic-resolution tests**

Test disabled rollout, nonmatching user group, nonmatching token group, 0%, 100%, stable repeated bucket, changed policy version, and shadow/live mode preservation.

```go
first := ResolveRollout(snapshot, RolloutSubject{AccountID: 42, TokenID: 9, UserGroup: "default", TokenGroup: "auto"})
second := ResolveRollout(snapshot, RolloutSubject{AccountID: 42, TokenID: 9, UserGroup: "default", TokenGroup: "auto"})
assert.Equal(t, first.Bucket, second.Bucket)
assert.Equal(t, first.Selected, second.Selected)
```

- [ ] **Step 2: Run rollout tests and verify they fail**

Run: `go test ./service/intelligent_routing -run 'TestResolveRollout' -count=1`

Expected: FAIL because rollout resolution is undefined.

- [ ] **Step 3: Implement allowlist matching and stable bucketing**

Use HMAC-SHA256 with a deployment salt injected into the snapshot and the exact tuple `policyVersion/accountID/tokenID`. Convert the first eight digest bytes with `binary.BigEndian.Uint64`, then calculate `bucket := int(value % 100)`. Empty allowlists match all subjects; non-empty lists require exact normalized group membership.

- [ ] **Step 4: Run focused tests**

Run: `go test ./service/intelligent_routing -run 'TestResolveRollout' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add service/intelligent_routing/rollout.go service/intelligent_routing/rollout_test.go
git commit -m "feat: resolve intelligent routing rollouts"
```

### Task 5: Administrator Policy and Rollout API

**Files:**
- Create: `dto/intelligent_routing.go`
- Create: `controller/intelligent_routing.go`
- Create: `controller/intelligent_routing_test.go`
- Modify: `controller/audit.go`
- Modify: `router/api-router.go`

**Interfaces:**
- Consumes: `PolicyControl` from Task 3 and repository pagination.
- Produces: root-only policy list/get/create/update/validate/publish/rollback and rollout get/update HTTP endpoints.

- [ ] **Step 1: Define explicit DTO contracts**

Create request DTOs with typed fields and response DTOs that exclude GORM internals. Use:

```go
type IntelligentRoutingPublishRequest struct {
    ChangeNote string `json:"change_note"`
}

type IntelligentRoutingRolloutUpdateRequest struct {
    Revision       int64    `json:"revision"`
    PolicyVersion  int      `json:"policy_version"`
    Enabled        bool     `json:"enabled"`
    Mode           string   `json:"mode"`
    TrafficPercent int      `json:"traffic_percent"`
    UserGroups     []string `json:"user_groups"`
    TokenGroups    []string `json:"token_groups"`
}

type IntelligentRoutingValidationIssue struct {
    Code    string `json:"code"`
    Field   string `json:"field"`
    Message string `json:"message"`
}
```

- [ ] **Step 2: Write failing router and controller tests**

Assert unauthenticated and non-root requests are rejected, valid draft creation returns 201, invalid policy returns structured issues with 400, stale rollout revision returns 409, publish returns the assigned version, rollback returns a new version, and each mutation records the expected audit action.

- [ ] **Step 3: Run controller tests and verify they fail**

Run: `go test ./controller ./router -run 'TestIntelligentRoutingAdmin|TestIntelligentRoutingRoutes' -count=1`

Expected: FAIL because routes and handlers are absent.

- [ ] **Step 4: Implement handlers and status mapping**

Decode bodies through `common.DecodeJson`, enforce page size and ID bounds, map validation failures to 400, missing records to 404, stale revisions to 409, and dependency failures to 503. Return the repository error only to server logs; client responses use stable messages.

- [ ] **Step 5: Register audit actions and root-only routes**

Add the policy and rollout audit templates to `auditContentTemplates`. Register:

```go
intelligentRoutingRoute := apiRouter.Group("/intelligent-routing")
intelligentRoutingRoute.Use(middleware.RootAuth())
{
    intelligentRoutingRoute.GET("/policies", controller.ListIntelligentRoutingPolicies)
    intelligentRoutingRoute.GET("/policies/:id", controller.GetIntelligentRoutingPolicy)
    intelligentRoutingRoute.POST("/policies", controller.CreateIntelligentRoutingPolicy)
    intelligentRoutingRoute.PUT("/policies/:id", controller.UpdateIntelligentRoutingPolicy)
    intelligentRoutingRoute.POST("/policies/:id/validate", controller.ValidateIntelligentRoutingPolicy)
    intelligentRoutingRoute.POST("/policies/:id/publish", controller.PublishIntelligentRoutingPolicy)
    intelligentRoutingRoute.POST("/policies/:version/rollback", controller.RollbackIntelligentRoutingPolicy)
    intelligentRoutingRoute.GET("/rollout", controller.GetIntelligentRoutingRollout)
    intelligentRoutingRoute.PUT("/rollout", controller.UpdateIntelligentRoutingRollout)
}
```

- [ ] **Step 6: Run controller and router tests**

Run: `go test ./controller ./router -run 'TestIntelligentRoutingAdmin|TestIntelligentRoutingRoutes' -count=1`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add dto/intelligent_routing.go controller/intelligent_routing.go controller/intelligent_routing_test.go controller/audit.go router/api-router.go
git commit -m "feat: expose intelligent routing policy admin api"
```

### Task 6: Request-Path Rollout Integration

**Files:**
- Modify: `controller/relay.go`
- Modify: `controller/intelligent_routing_shadow_test.go`
- Modify: `relay/common/relay_info.go`
- Modify: `service/log_info_generate.go`
- Modify: `service/intelligent_routing_audit_test.go`

**Interfaces:**
- Consumes: `PolicyControl.Snapshot`, `ResolveRollout`, existing planner and execution path.
- Produces: scoped durable rollout activation with `PolicyVersion`, `RolloutRevision`, `RolloutMode`, and `RolloutBucket` in administrator-only audit.

- [ ] **Step 1: Write failing relay integration tests**

Add cases proving: disabled rollout uses the legacy selector; excluded group uses the legacy selector; selected shadow rollout plans but does not switch execution; selected live rollout switches execution; the same account/token stays in the same bucket; audit contains policy version and rollout revision.

- [ ] **Step 2: Run focused relay tests and verify they fail**

Run: `go test ./controller ./service -run 'Test.*IntelligentRout.*Rollout|TestGenerateTextOtherInfoAddsAdminOnlyIntelligentRoutingAudit' -count=1`

Expected: FAIL because relay execution does not consult durable rollout state.

- [ ] **Step 3: Add rollout metadata to relay state**

Extend `RelayInfo` with integer policy version, rollout revision, bucket, and bounded mode fields. Extend `appendIntelligentRoutingAdminInfo` to include these fields only under `admin_info.intelligent_routing`.

- [ ] **Step 4: Resolve rollout once before planning**

Build `RolloutSubject` from authenticated account ID, token ID, user group, and token group already present in request context. Load one immutable snapshot and resolve it once. Use its validated config for planning; do not reread the database or global config during retries.

When no durable rollout exists, preserve the current global-setting behavior for backward compatibility. When a durable rollout exists but does not select the subject, use the existing selector without shadow planning.

- [ ] **Step 5: Run focused integration tests**

Run: `go test ./controller ./service -run 'Test.*IntelligentRout.*Rollout|TestGenerateTextOtherInfoAddsAdminOnlyIntelligentRoutingAudit' -count=1`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add controller/relay.go controller/intelligent_routing_shadow_test.go relay/common/relay_info.go service/log_info_generate.go service/intelligent_routing_audit_test.go
git commit -m "feat: apply scoped intelligent routing rollouts"
```

### Task 7: Startup Refresh, Polling, and Documentation

**Files:**
- Create: `service/intelligent_routing/policy_refresh.go`
- Create: `service/intelligent_routing/policy_refresh_test.go`
- Modify: `model/main.go`
- Modify: `docs/intelligent-routing-shadow-rollout.md`

**Interfaces:**
- Consumes: `PolicyControl.RefreshSnapshot`.
- Produces: `StartPolicyRefresh(ctx context.Context, control *PolicyControl, interval time.Duration)` and startup initialization after migrations.

- [ ] **Step 1: Write failing refresh-loop tests**

Use a fake clock or explicitly driven refresh channel rather than sleeps. Assert startup performs one refresh, a changed rollout revision replaces the snapshot, a failed refresh retains the prior snapshot, and cancellation stops further repository calls.

- [ ] **Step 2: Run refresh tests and verify they fail**

Run: `go test ./service/intelligent_routing -run 'TestPolicyRefresh' -count=1`

Expected: FAIL because the refresh coordinator is absent.

- [ ] **Step 3: Implement bounded periodic refresh**

Provide a coordinator whose production entry point uses a ticker and whose test entry point accepts a receive-only trigger channel. Log refresh failures through existing logging, rate-limited by state transition; never clear a valid snapshot on failure.

- [ ] **Step 4: Initialize after database migration**

After the policy tables are migrated and database initialization succeeds, load the current snapshot and start the refresh coordinator. A missing rollout is a valid disabled state. Do not make application startup fail merely because no policy has been created.

- [ ] **Step 5: Update operations documentation**

Document draft creation, validation, publication, rollout revision conflicts, scoped shadow/live rollout, rollback, compatibility with the legacy global setting, and the administrator API examples using bounded non-secret fixtures.

- [ ] **Step 6: Run focused tests**

Run: `go test ./service/intelligent_routing ./model -run 'TestPolicyRefresh|TestIntelligentRoutingPolicy|TestIntelligentRoutingRollout' -count=1`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add service/intelligent_routing/policy_refresh.go service/intelligent_routing/policy_refresh_test.go model/main.go docs/intelligent-routing-shadow-rollout.md
git commit -m "feat: refresh intelligent routing policy snapshots"
```

### Task 8: Phase Verification and Rollback Artifacts

**Files:**
- Create: `verification-intelligent-routing-policy-control/MODIFIED_FILE`
- Create: `verification-intelligent-routing-policy-control/DIFF_FILE`
- Create: `verification-intelligent-routing-policy-control/VERIFICATION.txt`
- Create: `verification-intelligent-routing-policy-control/ROLLBACK.sh`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified phase completion evidence and a tested rollback copy while leaving the working source changed.

- [ ] **Step 1: Run focused policy-control tests**

Run:

```powershell
$env:GOCACHE="$PWD\.gocache"
go test ./setting/intelligent_routing_setting ./service/intelligent_routing ./model ./controller ./service ./router -count=1
```

Expected: all listed packages PASS.

- [ ] **Step 2: Run full backend verification**

Run:

```powershell
go test ./... -count=1
go vet ./service/intelligent_routing ./controller ./model ./router
Push-Location relaykit
$env:GOWORK="off"
go build ./...
Pop-Location
git diff --check
```

Expected: tests PASS, vet and builds exit 0 with no errors, and diff check exits 0.

- [ ] **Step 3: Create and test the verification artifacts**

Preserve the original hash, copy the representative modified `service/intelligent_routing/policy_control.go`, save the exact Git diff, write the literal commands, inputs, outputs, and exit statuses into `VERIFICATION.txt`, and make `ROLLBACK.sh` executable. Run rollback against a separate copy and verify its SHA-256 matches the baseline while `MODIFIED_FILE` remains changed.

- [ ] **Step 4: Reopen every artifact and verify recorded evidence**

Run:

```powershell
Get-Content verification-intelligent-routing-policy-control\VERIFICATION.txt -Raw
Get-Content verification-intelligent-routing-policy-control\DIFF_FILE -Raw | Select-Object -First 1
Get-Content verification-intelligent-routing-policy-control\ROLLBACK.sh -Raw
Get-FileHash verification-intelligent-routing-policy-control\MODIFIED_FILE
```

Expected: all four artifacts open successfully and the verification record matches the latest commands.

- [ ] **Step 5: Commit phase completion**

```bash
git add verification-intelligent-routing-policy-control
git commit -m "test: verify intelligent routing policy control"
```

## Subsequent Plans

After this plan passes, create separate implementation plans for:

1. Redis-backed shared health, quality, stickiness, manual isolation, and safe dependency degradation.
2. Actual-cost telemetry, overview/metrics APIs, durable routing events, alerting, simulation, and bounded replay.

These plans depend on the immutable policy snapshot and administrator API conventions established here.
