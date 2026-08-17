# Intelligent Routing Shadow Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-safe increment of cost-optimized intelligent routing: deterministic request features, capability filtering, expected-cost route planning, and shadow-mode audit output without changing live request execution.

**Architecture:** A focused `service/intelligent_routing` package produces immutable route plans from normalized request features and an injected candidate catalog. `controller/relay.go` invokes it after request validation and token estimation, records the shadow plan on `RelayInfo`, and leaves the existing channel-selection and retry path unchanged. Later plans can consume the same route plan for live cross-model execution.

**Tech Stack:** Go 1.22+, Gin, existing model/channel cache, existing ratio settings, testify `require`/`assert`.

**Spec:** `docs/superpowers/specs/2026-08-17-cost-optimized-intelligent-routing-design.md`

## Global Constraints

- Keep `relaykit/` independently buildable and do not import root-module packages from it.
- Use `common.Marshal`, `common.Unmarshal`, `common.UnmarshalJsonStr`, or `common.DecodeJson` for JSON operations.
- Preserve SQLite, MySQL 5.7.8+, and PostgreSQL 9.6 compatibility.
- Use checked quota conversion helpers for every value that can become a charge; surface clamps through the existing audit path.
- Preserve the requested model as `RelayInfo.OriginModelName`; shadow routing must not alter live execution.
- New tests use `require` for setup/fatal assertions and `assert` for value assertions.
- Do not modify protected project identity, attribution, package paths, or branding.

---

### Task 1: Versioned routing configuration

**Files:**
- Create: `setting/intelligent_routing_setting/config.go`
- Create: `setting/intelligent_routing_setting/config_test.go`
- Modify: `setting/operation_setting.go`

**Interfaces:**
- Produces: `intelligent_routing_setting.Config`, `Get() Config`, `Update(Config) error`, `Enabled() bool`.
- Consumes: existing option registration pattern in `setting/operation_setting.go`.

- [ ] **Step 1: Write failing configuration tests**

Cover exact normalization: disabled defaults, policy version `1`, four attempts, two endpoints per model, 30-second non-stream budget, 12-second stream-first-byte budget, 2.5 cost multiplier, and task thresholds from the spec. Assert rejection of negative budgets, thresholds outside `[0,1]`, duplicate model entries, and tiers outside `0..3`.

```go
func TestNormalizeConfigAppliesSafeDefaults(t *testing.T) {
    got, err := Normalize(Config{Enabled: true})
    require.NoError(t, err)
    assert.Equal(t, 1, got.PolicyVersion)
    assert.Equal(t, 4, got.MaxAttempts)
    assert.Equal(t, 2, got.MaxEndpointsPerModel)
    assert.Equal(t, 30*time.Second, got.NonStreamBudget)
    assert.InDelta(t, 0.98, got.QualityThresholds[TaskTool], 0.0001)
}
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `go test ./setting/intelligent_routing_setting -run TestNormalizeConfig -count=1`

Expected: FAIL because the package and `Normalize` do not exist.

- [ ] **Step 3: Implement immutable configuration snapshots**

Define `TaskType`, `ModelPolicy`, and `Config`. Store the normalized configuration in `atomic.Pointer[Config]`; `Get` returns a value copy. `Update` normalizes a copy before publishing it. Use explicit code defaults rather than GORM boolean tags.

```go
type ModelPolicy struct {
    Model        string
    Tier         int
    InputPrice   float64
    OutputPrice  float64
    ContextLimit int
    Capabilities []string
}

type Config struct {
    Enabled              bool
    ShadowOnly           bool
    PolicyVersion        int
    MaxAttempts          int
    MaxEndpointsPerModel int
    NonStreamBudget      time.Duration
    StreamFirstByteBudget time.Duration
    MaxCostMultiplier    float64
    QualityThresholds    map[TaskType]float64
    Models               []ModelPolicy
}
```

- [ ] **Step 4: Register the setting and rerun tests**

Register a single serialized option named `IntelligentRoutingConfig`; decode it through `common.UnmarshalJsonStr`, call `Update`, and serialize snapshots with `common.Marshal`.

Run: `go test ./setting/intelligent_routing_setting ./setting -count=1`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add setting/intelligent_routing_setting setting/operation_setting.go
git commit -m "feat: add intelligent routing configuration"
```

### Task 2: Deterministic request feature extraction

**Files:**
- Create: `service/intelligent_routing/features.go`
- Create: `service/intelligent_routing/features_test.go`

**Interfaces:**
- Consumes: `dto.Request`, `types.RelayFormat`, estimated prompt tokens, request path, stream flag.
- Produces: `ExtractFeatures(Input) Features`, `DeriveRequirements(Features) Requirements`.

- [ ] **Step 1: Write table tests for observable request categories**

Use explicit OpenAI requests for short translation, summary, tool call, strict response format, long context, and code generation. Assert task type, required capabilities, token band, and minimum tier. Do not assert private keyword lists.

```go
func TestExtractFeaturesRequiresTools(t *testing.T) {
    req := &dto.GeneralOpenAIRequest{
        Model: "client-model",
        Messages: []dto.Message{{Role: "user", Content: "check the weather"}},
        Tools: []dto.Tool{{Type: "function"}},
    }
    got := ExtractFeatures(Input{Request: req, PromptTokens: 24})
    assert.Equal(t, TaskTool, got.Task)
    assert.True(t, got.HasTools)
    assert.GreaterOrEqual(t, got.MinimumTier, 2)
}
```

- [ ] **Step 2: Verify the tests fail**

Run: `go test ./service/intelligent_routing -run 'TestExtractFeatures|TestDeriveRequirements' -count=1`

Expected: FAIL because feature extraction is undefined.

- [ ] **Step 3: Implement direct type-switch extraction**

Implement one top-level type switch over supported request DTOs. Classify hard protocol features first; use normalized text hints only for translation, summary, extraction, code, math, and general tasks. Return general task for ambiguous inputs. Keep helpers only for stable concepts such as combined request text and capability derivation.

```go
type Features struct {
    Task                 TaskType
    PromptTokens         int
    MaxOutputTokens      int
    ContextUtilization   float64
    HasTools             bool
    RequiresJSONSchema   bool
    HasImage             bool
    IsStream             bool
    MinimumTier          int
}

type Requirements struct {
    Capabilities map[Capability]bool
    MinimumTier  int
    ContextNeeded int
}
```

- [ ] **Step 4: Run focused and package tests**

Run: `go test ./service/intelligent_routing -count=1`

Expected: PASS with deterministic results on every table row.

- [ ] **Step 5: Commit**

```powershell
git add service/intelligent_routing/features.go service/intelligent_routing/features_test.go
git commit -m "feat: extract intelligent routing features"
```

### Task 3: Candidate catalog adapter

**Files:**
- Create: `service/intelligent_routing/catalog.go`
- Create: `service/intelligent_routing/catalog_test.go`
- Modify: `model/channel_cache.go`

**Interfaces:**
- Consumes: normalized routing config and a read-only snapshot returned by `model.ListEnabledChannelsForRouting(group, requestPath string) []*model.Channel`.
- Produces: `Catalog.Build(group, requestPath string) []Candidate`.

- [ ] **Step 1: Write failing catalog tests**

Build channel fixtures that cover enabled/disabled status, group membership, model mapping, Advanced Custom path support, configured model tier, and missing price. Assert disabled, incompatible, and unpriced nodes are absent.

```go
func TestCatalogExcludesUnpricedAndDisabledCandidates(t *testing.T) {
    catalog := NewCatalog(config, fakeChannels)
    got := catalog.Build("default", "/v1/chat/completions")
    require.Len(t, got, 1)
    assert.Equal(t, "cheap-model", got[0].Model)
    assert.Equal(t, 7, got[0].ChannelID)
}
```

- [ ] **Step 2: Verify failure**

Run: `go test ./service/intelligent_routing -run TestCatalog -count=1`

Expected: FAIL because the catalog and channel snapshot API do not exist.

- [ ] **Step 3: Add a read-only channel-cache snapshot**

Under the existing channel cache read lock, return cloned enabled channels that match the group and request path. Do not expose internal cache maps and do not change existing random selection.

```go
func ListEnabledChannelsForRouting(group, requestPath string) []*Channel
```

- [ ] **Step 4: Implement catalog normalization**

Expand configured model policies into candidate nodes only where a channel serves the model directly or through existing normalized-name matching. Copy values into the candidate so a later cache refresh cannot mutate an active plan.

```go
type Candidate struct {
    Model           string
    ChannelID       int
    Tier            int
    InputPrice      float64
    OutputPrice     float64
    ContextLimit    int
    Capabilities    map[Capability]bool
    ResponseTimeMS  int
}
```

- [ ] **Step 5: Run model and routing tests**

Run: `go test ./model ./service/intelligent_routing -count=1`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add model/channel_cache.go service/intelligent_routing/catalog.go service/intelligent_routing/catalog_test.go
git commit -m "feat: build intelligent routing candidate catalog"
```

### Task 4: Constrained expected-cost planner

**Files:**
- Create: `service/intelligent_routing/planner.go`
- Create: `service/intelligent_routing/planner_test.go`

**Interfaces:**
- Consumes: `PlanInput{RequestedModel, Features, Requirements, Candidates, PolicyVersion}`.
- Produces: `Plan(PlanInput) (RoutePlan, error)` with ordered immutable `RouteNode` values.

- [ ] **Step 1: Write exact planner contract tests**

Cover capability rejection, context rejection at 70% utilization, task quality thresholds, cheapest-qualified selection, no-qualified fallback to highest predicted success, same-model endpoint grouping, maximum two endpoints per model, four total nodes, and reserved highest-success final node.

```go
func TestPlanChoosesCheapestCandidateMeetingQualityThreshold(t *testing.T) {
    got, err := Plan(PlanInput{
        RequestedModel: "client-model",
        Features: Features{Task: TaskGeneral, PromptTokens: 100, MaxOutputTokens: 50},
        Candidates: []Candidate{
            {Model: "cheap", ChannelID: 1, InputPrice: 1, OutputPrice: 2, PredictedSuccess: .92},
            {Model: "premium", ChannelID: 2, InputPrice: 8, OutputPrice: 16, PredictedSuccess: .99},
        },
        QualityThreshold: .90,
    })
    require.NoError(t, err)
    assert.Equal(t, "cheap", got.Nodes[0].Model)
    assert.Equal(t, "premium", got.Nodes[len(got.Nodes)-1].Model)
}
```

- [ ] **Step 2: Verify planner tests fail**

Run: `go test ./service/intelligent_routing -run TestPlan -count=1`

Expected: FAIL because `Plan` is undefined.

- [ ] **Step 3: Implement threshold filtering and cost calculation**

Use decimal arithmetic for price products. The planner's estimates remain decimals until rendered for audit; no estimated quota is cast to `int`. Calculate input, predicted output, cache, and retry-risk components independently.

```go
type RouteNode struct {
    Model            string
    ChannelID        int
    Tier             int
    PredictedSuccess float64
    ExpectedCost     decimal.Decimal
    ReasonCodes      []string
}

type RoutePlan struct {
    RequestedModel string
    PolicyVersion int
    Nodes         []RouteNode
    MaxAttempts   int
    MaxCostMultiplier float64
}
```

- [ ] **Step 4: Implement stable lexicographic ordering**

Sort by health tier, expected total cost, response time, failure rate, and channel ID. Group at most two endpoints for the selected model before moving to the next qualified model. Deduplicate `(model, channel)` and preserve the highest-success candidate for the final slot.

- [ ] **Step 5: Run routing tests with the race detector**

Run: `go test -race ./service/intelligent_routing -count=1`

Expected: PASS and no race report.

- [ ] **Step 6: Commit**

```powershell
git add service/intelligent_routing/planner.go service/intelligent_routing/planner_test.go
git commit -m "feat: plan constrained low cost routes"
```

### Task 5: Shadow-plan integration in text relay

**Files:**
- Modify: `relay/common/relay_info.go`
- Modify: `controller/relay.go`
- Create: `controller/intelligent_routing_shadow_test.go`

**Interfaces:**
- Consumes: validated `dto.Request`, prompt-token estimate, current group, request path, and routing config.
- Produces: `RelayInfo.IntelligentRoutePlan *intelligent_routing.RoutePlan`; live selected channel and `OriginModelName` remain unchanged.

- [ ] **Step 1: Write failing controller tests**

Build a Gin context with a reusable request body and a configured candidate catalog. Assert shadow mode produces a plan after validation, leaves `OriginModelName` unchanged, leaves current channel context unchanged, and silently records a typed planning error when no candidate is eligible.

```go
func TestBuildShadowRoutePlanDoesNotChangeLiveModel(t *testing.T) {
    info := &relaycommon.RelayInfo{OriginModelName: "client-model", Request: request}
    err := buildShadowRoutePlan(ctx, info, 120)
    require.NoError(t, err)
    require.NotNil(t, info.IntelligentRoutePlan)
    assert.Equal(t, "client-model", info.OriginModelName)
    assert.Equal(t, originalChannelID, common.GetContextKeyInt(ctx, constant.ContextKeyChannelId))
}
```

- [ ] **Step 2: Verify failure**

Run: `go test ./controller -run TestBuildShadowRoutePlan -count=1`

Expected: FAIL because the integration function and RelayInfo field do not exist.

- [ ] **Step 3: Add the shadow plan to RelayInfo**

Add the pointer field and a string error field used only for administrative diagnostics. Do not place routing types in `relaykit`.

- [ ] **Step 4: Build the plan after token estimation**

Invoke `buildShadowRoutePlan` after `SetEstimatePromptTokens` and before pre-consume. Guard it with `Enabled && ShadowOnly`. Planning errors log a request-correlated warning and do not affect live relay behavior.

- [ ] **Step 5: Prove live relay behavior is unchanged**

Run: `go test ./controller ./middleware ./relay/... -count=1`

Expected: PASS, including existing channel retry and response model tests.

- [ ] **Step 6: Commit**

```powershell
git add relay/common/relay_info.go controller/relay.go controller/intelligent_routing_shadow_test.go
git commit -m "feat: add shadow intelligent route planning"
```

### Task 6: Administrative audit payload and metrics

**Files:**
- Modify: `service/log_info_generate.go`
- Create: `service/intelligent_routing_audit_test.go`
- Create: `service/intelligent_routing/metrics.go`
- Create: `service/intelligent_routing/metrics_test.go`

**Interfaces:**
- Consumes: `RelayInfo.IntelligentRoutePlan` and the actual successful channel/model metadata.
- Produces: `other.admin_info.intelligent_routing` and aggregate `Metrics.Observe(Observation)`.

- [ ] **Step 1: Write failing admin-only audit tests**

Assert exact keys: `policy_version`, `requested_model`, `shadow`, `candidates`, `predicted_success`, `expected_cost`, and `reason_codes`. Assert the payload is nested under `admin_info`, alongside rather than replacing `quota_saturation`.

- [ ] **Step 2: Verify audit tests fail**

Run: `go test ./service -run TestIntelligentRoutingAudit -count=1`

Expected: FAIL because no routing audit is attached.

- [ ] **Step 3: Attach a bounded audit payload**

Serialize at most four nodes and at most eight reason codes per node. Reuse the existing `admin_info` map and never expose candidate details through non-admin log views.

- [ ] **Step 4: Add deterministic metric aggregation**

Implement counters for planned requests, no-route requests, candidate tier distribution, expected saving, and planning latency. Do not use sleeps or timing assertions; inject elapsed duration into `Observe` tests.

- [ ] **Step 5: Run service and routing tests**

Run: `go test ./service ./service/intelligent_routing -count=1`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add service/log_info_generate.go service/intelligent_routing_audit_test.go service/intelligent_routing/metrics.go service/intelligent_routing/metrics_test.go
git commit -m "feat: audit shadow routing decisions"
```

### Task 7: Full verification and rollout documentation

**Files:**
- Create: `docs/intelligent-routing-shadow-rollout.md`
- Modify: `.env.example`

**Interfaces:**
- Consumes: completed shadow planner and configuration.
- Produces: operator instructions for disabled, shadow, and rollback states.

- [ ] **Step 1: Document exact rollout controls**

Document the serialized setting, default-disabled behavior, shadow metrics, candidate configuration example, log query fields, and rollback action (`Enabled=false`). State that this phase never changes the live execution model.

- [ ] **Step 2: Run formatting and focused tests**

Run: `gofmt -w setting/intelligent_routing_setting service/intelligent_routing controller/intelligent_routing_shadow_test.go service/intelligent_routing_audit_test.go`

Run: `go test ./setting/intelligent_routing_setting ./service/intelligent_routing ./model ./controller ./service ./middleware -count=1`

Expected: PASS.

- [ ] **Step 3: Run repository-wide verification**

Run: `go test ./... -count=1`

Expected: PASS.

- [ ] **Step 4: Verify relaykit independence**

Run from `relaykit/`: `$env:GOWORK='off'; go build ./...`

Expected: exit status 0.

- [ ] **Step 5: Inspect the final diff and commit**

Run: `git diff --check`

Expected: no output, exit status 0.

```powershell
git add .env.example docs/intelligent-routing-shadow-rollout.md
git commit -m "docs: add intelligent routing shadow rollout"
```

## Follow-up implementation plans

The shadow core is independently deployable and measurable. After its observation data is validated, create separate plans for:

1. Live same-model price-aware endpoint selection and circuit breaking.
2. Live cross-model execution with body rewriting, actual-model billing, response normalization, and bounded fallback.
3. Learned quality prediction, calibration, session stickiness, semantic judging, and progressive model onboarding.

