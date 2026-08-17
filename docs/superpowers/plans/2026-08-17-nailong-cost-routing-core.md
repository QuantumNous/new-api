# Nailong Cost Routing Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in, deterministic cross-model cost router to New API that preserves requested, actual, and upstream model identities through authorization, channel selection, billing, retries, responses, and audit logs.

**Architecture:** A focused `service/cost_router` package evaluates enabled database-backed rules before `middleware.Distribute` selects a channel. The selected actual model flows through the existing New API relay and billing pipeline, while explicit context and `RelayInfo` fields retain the requested model. API-key defaults and per-request overrides determine whether routing is strict or cost optimized.

**Tech Stack:** Go 1.22+, Gin, GORM v2, testify, React 19, TypeScript, Bun, SQLite/MySQL/PostgreSQL-compatible migrations

**Spec:** `docs/superpowers/specs/2026-08-17-nailong-cost-routing-design.md`

## Global Constraints

- Preserve support for SQLite, MySQL 5.7.8+, and PostgreSQL 9.6+.
- Use `common.Marshal`, `common.Unmarshal`, and `common.UnmarshalJsonStr` for JSON operations.
- Preserve New API and QuantumNous attribution and licensing information.
- Cross-model routing is opt-in; the default mode is exactly `strict`.
- Authorize both the requested and actual models before contacting an upstream provider.
- Bill from the actual model's immutable request-time price snapshot.
- Never store full prompts, authorization headers, or upstream secrets in routing records.
- Never change models after the first response byte has been emitted.
- Keep `relaykit/` independently buildable and do not add root-module dependencies to it.
- New backend tests use `testify/require` and `testify/assert`.

## Scope Boundary

This plan delivers the routing-core vertical slice: rule persistence, deterministic selection, API-key preference, middleware integration, model identity propagation, billing correctness, fallback, response disclosure, backend management APIs, and focused user controls. Invitation registration, complete brand redesign, dynamic channel health scoring, dashboards, alerting, and production deployment automation remain separate implementation plans because each can be reviewed and released independently.

## File Structure

- `model/routing_rule.go`: persistent rule and routing-decision records plus validated JSON accessors.
- `model/token.go`: API-key routing defaults.
- `model/main.go`: cross-database migration registration.
- `service/cost_router/types.go`: public routing request, result, mode, rule, and capability types.
- `service/cost_router/router.go`: deterministic rule matching and cheapest-capable-model selection.
- `service/cost_router/store.go`: database rule loader behind an interface suitable for tests and future caching.
- `middleware/cost_router.go`: request preference parsing, authorization, model rewrite, and routing context setup.
- `constant/context_key.go`: strongly named routing context keys.
- `relay/common/relay_info.go`: requested/actual/routing identity snapshot used by billing, retry, and logging.
- `service/log_info_generate.go`: routing audit fields in consume logs.
- `controller/relay.go`: two-stage actual-model then requested-model fallback.
- `controller/routing_rule.go`: administrator rule CRUD and dry-run endpoint.
- `router/api-router.go`: management API registration.
- `controller/token.go`: read and write API-key routing defaults.
- `web/src/pages/Token/index.jsx` and token form components discovered in Task 9: opt-in controls and disclosure.

---

### Task 1: Persist Validated Routing Rules and Decisions

**Files:**
- Create: `model/routing_rule.go`
- Create: `model/routing_rule_test.go`
- Modify: `model/main.go`

**Interfaces:**
- Produces: `model.RoutingRule`, `model.RoutingDecision`, `model.ListEnabledRoutingRules() ([]RoutingRule, error)`, `(*RoutingRule).ReplacementModels() ([]RoutingReplacement, error)`.
- Consumes: `common.Marshal`, `common.UnmarshalJsonStr`, `model.DB`.

- [ ] **Step 1: Write failing model and migration tests**

```go
func TestRoutingRuleReplacementModelsRejectsInvalidCost(t *testing.T) {
    raw := `[{"model":"deepseek-v3","priority":100,"input_cost":-1,"output_cost":2}]`
    rule := RoutingRule{ReplacementModelsJSON: raw}

    _, err := rule.ReplacementModels()

    require.ErrorContains(t, err, "input_cost must be non-negative")
}

func TestRoutingDecisionAutoMigrate(t *testing.T) {
    db := newTestDB(t)
    require.NoError(t, db.AutoMigrate(&RoutingRule{}, &RoutingDecision{}))
    require.True(t, db.Migrator().HasTable(&RoutingRule{}))
    require.True(t, db.Migrator().HasTable(&RoutingDecision{}))
}
```

- [ ] **Step 2: Run the tests and verify the missing types fail compilation**

Run: `go test ./model -run 'TestRouting(RuleReplacementModelsRejectsInvalidCost|DecisionAutoMigrate)' -count=1`

Expected: FAIL because `RoutingRule` and `RoutingDecision` are undefined.

- [ ] **Step 3: Implement the models and strict JSON validation**

```go
type RoutingReplacement struct {
    Model      string  `json:"model"`
    Priority   int     `json:"priority"`
    InputCost  float64 `json:"input_cost"`
    OutputCost float64 `json:"output_cost"`
}

type RoutingRule struct {
    Id                      int    `json:"id"`
    Name                    string `json:"name" gorm:"size:128;not null"`
    Status                  int    `json:"status" gorm:"index"`
    Priority                int    `json:"priority" gorm:"index"`
    RequestedModelPattern   string `json:"requested_model_pattern" gorm:"size:191;not null;index"`
    ReplacementModelsJSON   string `json:"replacement_models_json" gorm:"type:text;not null"`
    EndpointsJSON           string `json:"endpoints_json" gorm:"type:text"`
    CapabilitiesJSON        string `json:"capabilities_json" gorm:"type:text"`
    MaxContextTokens        int    `json:"max_context_tokens"`
    MaxEstimatedCost        float64 `json:"max_estimated_cost"`
    FallbackToRequested     bool   `json:"fallback_to_requested"`
    UserGroupsJSON          string `json:"user_groups_json" gorm:"type:text"`
    EffectiveFrom           int64  `json:"effective_from" gorm:"bigint"`
    EffectiveUntil          int64  `json:"effective_until" gorm:"bigint"`
    CreatedAt               int64  `json:"created_at" gorm:"bigint"`
    UpdatedAt               int64  `json:"updated_at" gorm:"bigint"`
}

type RoutingDecision struct {
    Id                    int     `json:"id"`
    RequestId             string  `json:"request_id" gorm:"size:64;index"`
    UserId                int     `json:"user_id" gorm:"index"`
    TokenId               int     `json:"token_id" gorm:"index"`
    RequestedModel        string  `json:"requested_model" gorm:"size:191;index"`
    ActualModel           string  `json:"actual_model" gorm:"size:191;index"`
    RoutingMode           string  `json:"routing_mode" gorm:"size:32"`
    RuleId                int     `json:"rule_id" gorm:"index"`
    DecisionReason        string  `json:"decision_reason" gorm:"size:255"`
    FallbackModel         string  `json:"fallback_model" gorm:"size:191"`
    FallbackTriggered     bool    `json:"fallback_triggered"`
    EstimatedOriginalCost float64 `json:"estimated_original_cost"`
    EstimatedActualCost   float64 `json:"estimated_actual_cost"`
    ActualCost            float64 `json:"actual_cost"`
    ChannelId             int     `json:"channel_id" gorm:"index"`
    RequestFeaturesJSON   string  `json:"request_features_json" gorm:"type:text"`
    CreatedAt             int64   `json:"created_at" gorm:"bigint;index"`
}
```

Validate empty model names, duplicate candidates, NaN/Inf values, negative prices, invalid JSON, invalid effective windows, and replacement lists larger than 32. Add both models to normal and fast migration lists in `model/main.go`.

- [ ] **Step 4: Run model tests and migration smoke tests**

Run: `go test ./model -run 'TestRouting' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit the persistence boundary**

```bash
git add model/routing_rule.go model/routing_rule_test.go model/main.go
git commit -m "feat: persist cost routing rules"
```

### Task 2: Build the Deterministic Cost Router

**Files:**
- Create: `service/cost_router/types.go`
- Create: `service/cost_router/store.go`
- Create: `service/cost_router/router.go`
- Create: `service/cost_router/router_test.go`

**Interfaces:**
- Produces: `costrouter.Mode`, `costrouter.Request`, `costrouter.Result`, `costrouter.Router`, `costrouter.New(store RuleStore) *Router`, `(*Router).Route(context.Context, Request) (Result, error)`.
- Consumes: `model.RoutingRule`, `model.ListEnabledRoutingRules`.

- [ ] **Step 1: Write failing table-driven routing tests**

```go
func TestRouterSelectsCheapestCapableReplacement(t *testing.T) {
    router := New(staticStore{rules: []Rule{{
        ID: 7, RequestedModelPattern: "gpt-*", Endpoints: []string{"chat.completions"},
        Replacements: []Replacement{
            {Model: "cheap-text", InputCost: 0.1, OutputCost: 0.2, Capabilities: CapabilityText},
            {Model: "vision-model", InputCost: 0.2, OutputCost: 0.4, Capabilities: CapabilityText | CapabilityVision},
        },
    }}})

    got, err := router.Route(context.Background(), Request{
        Mode: ModeOptimizeCost, RequestedModel: "gpt-5-mini", Endpoint: "chat.completions",
        RequiredCapabilities: CapabilityText, PromptTokens: 1000, EstimatedOutputTokens: 500,
        AuthorizedModels: map[string]bool{"gpt-5-mini": true, "cheap-text": true, "vision-model": true},
        AvailableModels: map[string]bool{"cheap-text": true, "vision-model": true},
    })

    require.NoError(t, err)
    assert.Equal(t, "cheap-text", got.ActualModel)
    assert.Equal(t, 7, got.RuleID)
    assert.True(t, got.Substituted)
}
```

Add cases for strict mode, unmatched rules, unauthorized actual models, missing capabilities, insufficient context, unavailable models, cost ceiling, time windows, user groups, stable priority ordering, and fallback to the requested model when no replacement qualifies.

- [ ] **Step 2: Run the router test and verify it fails**

Run: `go test ./service/cost_router -run TestRouter -count=1`

Expected: FAIL because the package does not exist.

- [ ] **Step 3: Implement focused public types and selection logic**

```go
type Mode string

const (
    ModeStrict       Mode = "strict"
    ModeOptimizeCost Mode = "optimize_cost"
)

type Request struct {
    Mode                  Mode
    RequestedModel        string
    Endpoint              string
    UserGroup             string
    RequiredCapabilities  Capability
    ContextTokens         int
    PromptTokens          int
    EstimatedOutputTokens int
    MaxCost               float64
    AuthorizedModels      map[string]bool
    AvailableModels       map[string]bool
    Now                   time.Time
}

type Result struct {
    RequestedModel        string
    ActualModel           string
    Mode                  Mode
    RuleID                int
    Reason                string
    FallbackModel         string
    Substituted           bool
    EstimatedOriginalCost float64
    EstimatedActualCost   float64
}
```

Use `path.Match` only after rejecting malformed patterns and patterns containing path separators. Sort candidates by estimated cost ascending, replacement priority descending, and model name ascending so decisions remain deterministic.

- [ ] **Step 4: Run router tests and package tests**

Run: `go test ./service/cost_router -count=1`

Expected: PASS.

- [ ] **Step 5: Commit the routing engine**

```bash
git add service/cost_router
git commit -m "feat: add deterministic cost router"
```

### Task 3: Add API-Key Routing Defaults to Authentication Context

**Files:**
- Modify: `model/token.go`
- Modify: `constant/context_key.go`
- Modify: `middleware/auth.go`
- Modify: `controller/token.go`
- Test: `controller/token_test.go`
- Test: `middleware/auth_test.go`

**Interfaces:**
- Produces context keys `ContextKeyTokenRoutingMode`, `ContextKeyTokenRoutingMaxCost`, `ContextKeyTokenRoutingFallback`.
- Consumes `costrouter.ModeStrict` and `costrouter.ModeOptimizeCost` only in controller validation; the model stores strings to avoid package cycles.

- [ ] **Step 1: Write failing token validation and auth-context tests**

```go
func TestUpdateTokenRejectsUnknownRoutingMode(t *testing.T) {
    token := model.Token{RoutingMode: "hidden_swap"}
    err := validateTokenRouting(&token)
    require.ErrorContains(t, err, "routing_mode must be strict or optimize_cost")
}

func TestTokenAuthPublishesRoutingDefaults(t *testing.T) {
    c := authenticatedTokenContext(t, model.Token{
        RoutingMode: "optimize_cost", RoutingMaxCost: 0.02, RoutingFallback: true,
    })
    assert.Equal(t, "optimize_cost", common.GetContextKeyString(c, constant.ContextKeyTokenRoutingMode))
    assert.InDelta(t, 0.02, common.GetContextKeyFloat64(c, constant.ContextKeyTokenRoutingMaxCost), 0.000001)
    assert.True(t, common.GetContextKeyBool(c, constant.ContextKeyTokenRoutingFallback))
}
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `go test ./controller ./middleware -run 'Test(UpdateTokenRejectsUnknownRoutingMode|TokenAuthPublishesRoutingDefaults)' -count=1`

Expected: FAIL because routing fields and context keys are absent.

- [ ] **Step 3: Add fields, validation, serialization, and authentication context**

```go
RoutingMode     string  `json:"routing_mode" gorm:"size:32"`
RoutingMaxCost  float64 `json:"routing_max_cost"`
RoutingFallback bool    `json:"routing_fallback"`
```

Normalize an empty mode to `strict`; reject non-finite or negative maximum cost; require explicit disclosure acceptance in the existing token update request before accepting `optimize_cost`. Ensure token list and update responses expose these non-secret settings.

- [ ] **Step 4: Run token and middleware test suites**

Run: `go test ./controller ./middleware -run 'Token|Routing' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit API-key defaults**

```bash
git add model/token.go constant/context_key.go middleware/auth.go controller/token.go controller/token_test.go middleware/auth_test.go
git commit -m "feat: add token cost routing preferences"
```

### Task 4: Route Before Channel Distribution Without Losing the Requested Model

**Files:**
- Create: `middleware/cost_router.go`
- Create: `middleware/cost_router_test.go`
- Modify: `middleware/distributor.go`
- Modify: `router/relay-router.go`
- Modify: `constant/context_key.go`

**Interfaces:**
- Produces: `middleware.CostRoute() gin.HandlerFunc` and routing context keys for requested model, actual model, mode, rule ID, reason, fallback model, and estimated saving.
- Consumes: `costrouter.Router.Route`, authenticated token routing defaults, reusable request body storage.

- [ ] **Step 1: Write middleware tests for strict and optimized requests**

```go
func TestCostRouteRewritesModelAndPreservesRequestedModel(t *testing.T) {
    c, recorder := routingContext(t, `{"model":"gpt-5-mini","messages":[{"role":"user","content":"hi"}]}`)
    setTokenRouting(c, "optimize_cost", 0, true)
    handler := CostRouteWithRouter(fakeRouter{result: costrouter.Result{
        RequestedModel: "gpt-5-mini", ActualModel: "deepseek-v3", Mode: costrouter.ModeOptimizeCost,
        RuleID: 9, Reason: "lowest_estimated_cost", FallbackModel: "gpt-5-mini", Substituted: true,
    }})

    handler(c)

    require.False(t, c.IsAborted())
    assert.Equal(t, "gpt-5-mini", common.GetContextKeyString(c, constant.ContextKeyRequestedModel))
    assert.Equal(t, "deepseek-v3", common.GetContextKeyString(c, constant.ContextKeyActualModel))
    assert.Contains(t, reusableBodyString(t, c), `"model":"deepseek-v3"`)
    assert.Equal(t, http.StatusOK, recorder.Code)
}
```

Add tests for default strict mode, valid request-header override, invalid mode, invalid maximum cost, token restrictions, missing model, multipart requests that cannot be safely rewritten, and preservation of explicit request fields.

- [ ] **Step 2: Run the middleware tests and verify failure**

Run: `go test ./middleware -run TestCostRoute -count=1`

Expected: FAIL because `CostRoute` is undefined.

- [ ] **Step 3: Implement request parsing and safe rewrite**

Register middleware in this order for supported JSON relay routes:

```go
relayV1Router.Use(middleware.TokenAuth())
relayV1Router.Use(middleware.ModelRequestRateLimit())
relayV1Router.Use(middleware.CostRoute())
httpRouter.Use(middleware.Distribute())
```

Do not run cross-model replacement for realtime WebSocket, multipart image/audio/video, task-fetch, or endpoints without a safely parsed model in this first slice. Those paths remain strict and gain coverage in later compatibility work. Refactor `Distribute` so token model-limit validation is callable for both requested and actual model names.

- [ ] **Step 4: Run middleware and relay-router tests**

Run: `go test ./middleware ./router -run 'CostRoute|Distribute' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit middleware integration**

```bash
git add middleware/cost_router.go middleware/cost_router_test.go middleware/distributor.go router/relay-router.go constant/context_key.go
git commit -m "feat: route optimized models before distribution"
```

### Task 5: Preserve Three Model Identities Through Relay, Pricing, and Logs

**Files:**
- Modify: `relay/common/relay_info.go`
- Modify: `relay/common/relay_info_test.go`
- Modify: `relay/helper/model_mapped.go`
- Modify: `service/log_info_generate.go`
- Modify: `service/log_info_generate_test.go`
- Modify: `service/token_counter.go`

**Interfaces:**
- Produces `RelayInfo.RequestedModelName`, `RelayInfo.ActualModelName`, `RelayInfo.RoutingMode`, `RelayInfo.RoutingRuleID`, `RelayInfo.RoutingReason`, and `RelayInfo.RoutingFallbackModel`.
- Consumes routing context from Task 4.

- [ ] **Step 1: Write failing relay identity and audit-log tests**

```go
func TestGenRelayInfoSeparatesRequestedActualAndUpstreamModels(t *testing.T) {
    c := relayContext(t)
    common.SetContextKey(c, constant.ContextKeyRequestedModel, "gpt-5-mini")
    common.SetContextKey(c, constant.ContextKeyActualModel, "deepseek-v3")
    common.SetContextKey(c, constant.ContextKeyOriginalModel, "deepseek-v3")

    info, err := GenRelayInfo(c, types.RelayFormatOpenAI, requestFor("deepseek-v3"), nil)

    require.NoError(t, err)
    assert.Equal(t, "gpt-5-mini", info.RequestedModelName)
    assert.Equal(t, "deepseek-v3", info.ActualModelName)
    assert.Equal(t, "deepseek-v3", info.OriginModelName)
}
```

Verify `GenerateTextOtherInfo` emits user-visible `requested_model`, `actual_model`, `routing_mode`, `routing_rule_id`, and `estimated_saving`, while upstream attempt details remain under `admin_info` where appropriate.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `go test ./relay/common ./service -run 'ModelIdentit|RoutingAudit' -count=1`

Expected: FAIL because new `RelayInfo` fields are missing.

- [ ] **Step 3: Implement identity propagation and pricing invariants**

Initialize routing fields in `GenRelayInfo`. Keep `OriginModelName` equal to `ActualModelName` so existing `ModelPriceHelper`, token estimation, channel retry, and settlement naturally use the actual model. `InitChannelMeta` begins with the actual model and existing channel mapping remains solely responsible for `UpstreamModelName`.

Add this log shape:

```go
if relayInfo.RoutingMode == "optimize_cost" {
    other["requested_model"] = relayInfo.RequestedModelName
    other["actual_model"] = relayInfo.ActualModelName
    other["routing_mode"] = relayInfo.RoutingMode
    other["routing_rule_id"] = relayInfo.RoutingRuleID
    other["estimated_saving"] = relayInfo.EstimatedSaving
}
```

- [ ] **Step 4: Run relay, price, billing, and log tests**

Run: `go test ./relay/common ./relay/helper ./service -run 'RelayInfo|Price|Billing|Log|Routing' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit model identity propagation**

```bash
git add relay/common/relay_info.go relay/common/relay_info_test.go relay/helper/model_mapped.go service/log_info_generate.go service/log_info_generate_test.go service/token_counter.go
git commit -m "feat: preserve routed model identities"
```

### Task 6: Add Bounded Original-Model Fallback With Correct Billing Lifecycle

**Files:**
- Modify: `controller/relay.go`
- Create: `controller/relay_cost_routing_test.go`
- Modify: `service/billing_session.go`
- Modify: `service/billing_session_test.go`
- Modify: `model/routing_rule.go`

**Interfaces:**
- Produces one bounded fallback stage from actual model to requested model before first response output.
- Consumes `RelayInfo` routing fields, existing `BillingSettler.Refund`, `SetupContextForSelectedChannel`, and `CacheGetRandomSatisfiedChannel`.

- [ ] **Step 1: Write failing fallback and billing tests**

```go
func TestRelayFallsBackToRequestedModelBeforeFirstByte(t *testing.T) {
    harness := newRelayHarness(t).
        WithRoute("gpt-5-mini", "deepseek-v3").
        WithUpstreamFailure("deepseek-v3", http.StatusServiceUnavailable).
        WithUpstreamSuccess("gpt-5-mini", usage(100, 20))

    response := harness.DoRequest()

    require.Equal(t, http.StatusOK, response.StatusCode)
    assert.Equal(t, []string{"deepseek-v3", "gpt-5-mini"}, harness.AttemptedModels())
    assert.Equal(t, 1, harness.InitialBillingRefunds())
    assert.Equal(t, 1, harness.FallbackBillingSettlements())
}
```

Add cases proving no fallback after first byte, no fallback in strict mode, no fallback when disabled, only one cross-model fallback, actual attempted cost retained for administrator audit, and insufficient quota for the requested-model fallback returns an error without a second upstream call.

- [ ] **Step 2: Run focused controller and billing tests and verify failure**

Run: `go test ./controller ./service -run 'TestRelayFallsBack|TestBillingSessionRoutingFallback' -count=1`

Expected: FAIL because the relay loop only retries one model.

- [ ] **Step 3: Refactor relay attempts into two explicit stages**

```go
attemptModels := []string{relayInfo.ActualModelName}
if relayInfo.RoutingMode == "optimize_cost" && relayInfo.AllowRoutingFallback &&
    relayInfo.RequestedModelName != relayInfo.ActualModelName {
    attemptModels = append(attemptModels, relayInfo.RequestedModelName)
}
```

Each model stage owns its own channel retries and billing session. Before entering stage two, verify no response has been emitted, refund or settle stage one, reset request body and request model, rebuild `RelayInfo` pricing state, then pre-consume the requested model. Persist a `RoutingDecision` after completion with `FallbackTriggered`, final channel, estimated costs, and non-content request features.

- [ ] **Step 4: Run controller, service, and relay test suites**

Run: `go test ./controller ./service ./relay/... -run 'Relay|Billing|Routing' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit bounded fallback**

```bash
git add controller/relay.go controller/relay_cost_routing_test.go service/billing_session.go service/billing_session_test.go model/routing_rule.go
git commit -m "feat: fall back routed requests safely"
```

### Task 7: Disclose Routing in Headers and Compatible Response Extensions

**Files:**
- Create: `service/routing_response.go`
- Create: `service/routing_response_test.go`
- Modify: `controller/relay.go`
- Modify: `relay/compatible_handler.go`
- Modify: `relay/responses_handler.go`

**Interfaces:**
- Produces `service.SetRoutingResponseHeaders(*gin.Context, *relaycommon.RelayInfo)` and `service.RoutingResponseMetadata(*relaycommon.RelayInfo) map[string]any`.
- Consumes routing identity from Task 5.

- [ ] **Step 1: Write failing disclosure tests**

```go
func TestSetRoutingResponseHeadersDisclosesSubstitution(t *testing.T) {
    c, recorder := testContext(t)
    info := &relaycommon.RelayInfo{
        RequestedModelName: "gpt-5-mini", ActualModelName: "deepseek-v3",
        RoutingMode: "optimize_cost", RoutingRuleID: 9, EstimatedSaving: 0.0062,
    }

    SetRoutingResponseHeaders(c, info)

    assert.Equal(t, "deepseek-v3", recorder.Header().Get("X-Nailong-Actual-Model"))
    assert.Equal(t, "9", recorder.Header().Get("X-Nailong-Routing-Rule"))
    assert.Equal(t, "0.006200", recorder.Header().Get("X-Nailong-Estimated-Saving"))
}
```

Add tests that strict requests emit no routing headers and that estimated saving is clamped to zero when non-finite or negative.

- [ ] **Step 2: Run disclosure tests and verify failure**

Run: `go test ./service -run TestSetRoutingResponseHeaders -count=1`

Expected: FAIL because response helpers are undefined.

- [ ] **Step 3: Implement headers before upstream body forwarding**

Set headers after the route decision and before any handler can write response bytes. Add the `routing` object only on response formats whose DTO extension is backward compatible; do not rewrite opaque pass-through JSON or SSE chunks in this task. Document that SDKs can always read the response headers and activity API.

- [ ] **Step 4: Run response and relay tests**

Run: `go test ./service ./controller ./relay/... -run 'RoutingResponse|Compatible|Responses|Relay' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit response disclosure**

```bash
git add service/routing_response.go service/routing_response_test.go controller/relay.go relay/compatible_handler.go relay/responses_handler.go
git commit -m "feat: disclose optimized routing results"
```

### Task 8: Add Administrator Rule CRUD and Dry-Run APIs

**Files:**
- Create: `controller/routing_rule.go`
- Create: `controller/routing_rule_test.go`
- Modify: `router/api-router.go`
- Modify: `controller/channel_authz.go`
- Modify: `i18n/en.yaml`
- Modify: `i18n/zh.yaml`

**Interfaces:**
- Produces endpoints `GET /api/routing-rules`, `POST /api/routing-rules`, `PUT /api/routing-rules/:id`, `DELETE /api/routing-rules/:id`, and `POST /api/routing-rules/dry-run`.
- Consumes `model.RoutingRule`, `costrouter.Router.Route`, existing administrator authentication and audit conventions.

- [ ] **Step 1: Write failing authorization, validation, and dry-run tests**

```go
func TestRoutingRuleDryRunReturnsDeterministicDecision(t *testing.T) {
    router := adminRouter(t)
    seedRoutingRule(t, ruleFor("gpt-*", "deepseek-v3"))

    response := performAdminJSON(t, router, http.MethodPost, "/api/routing-rules/dry-run", map[string]any{
        "requested_model": "gpt-5-mini", "endpoint": "chat.completions",
        "prompt_tokens": 1000, "estimated_output_tokens": 200,
    })

    require.Equal(t, http.StatusOK, response.Code)
    assert.JSONEq(t, `{"success":true,"data":{"requested_model":"gpt-5-mini","actual_model":"deepseek-v3","rule_id":1,"substituted":true}}`, response.Body.String())
}
```

Add tests for non-admin denial, invalid patterns, invalid JSON fields, empty candidates, duplicate models, invalid costs, missing rule, audit logging, and deterministic list ordering.

- [ ] **Step 2: Run controller tests and verify failure**

Run: `go test ./controller -run TestRoutingRule -count=1`

Expected: FAIL because endpoints and handlers do not exist.

- [ ] **Step 3: Implement CRUD, validation, and dry-run handlers**

Follow existing controller response envelopes and admin audit middleware. Return sanitized rule structures; never return channel keys or unrelated provider configuration. A dry run uses supplied non-content features and current availability but never calls an upstream model or creates a billing session.

- [ ] **Step 4: Run controller and router tests**

Run: `go test ./controller ./router -run 'RoutingRule|AdminAudit' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit management APIs**

```bash
git add controller/routing_rule.go controller/routing_rule_test.go router/api-router.go controller/channel_authz.go i18n/en.yaml i18n/zh.yaml
git commit -m "feat: manage cost routing rules"
```

### Task 9: Add Focused User Routing Controls

**Files:**
- Modify: `web/src/features/keys/types.ts`
- Modify: `web/src/features/keys/lib/api-key-form.ts`
- Modify: `web/src/features/keys/components/api-keys-mutate-drawer.tsx`
- Test: `web/src/features/keys/lib/__tests__/api-key-form.test.ts`
- Test: `web/src/features/keys/components/__tests__/api-keys-mutate-drawer.test.tsx`
- Modify: `web/src/i18n/locales/en.json`
- Modify: `web/src/i18n/locales/zh.json`
- Modify: all other locale files through the project `i18n-translate` workflow

**Interfaces:**
- Produces API-key fields `routing_mode`, `routing_max_cost`, `routing_fallback`, and `routing_disclosure_accepted` in existing token create/update requests.
- Consumes token API changes from Task 3.

- [ ] **Step 1: Extend the failing schema and drawer interaction tests**

Add a schema test to `web/src/features/keys/lib/__tests__/api-key-form.test.ts` that rejects `optimize_cost` until disclosure is accepted. Add a drawer test to `web/src/features/keys/components/__tests__/api-keys-mutate-drawer.test.tsx` that selects cost optimization, enters `0.02`, enables fallback, accepts disclosure, and asserts the submitted payload below.

Expected payload:

```json
{
  "routing_mode": "optimize_cost",
  "routing_max_cost": 0.02,
  "routing_fallback": true,
  "routing_disclosure_accepted": true
}
```

- [ ] **Step 2: Run the focused frontend tests and verify failure**

Run: `cd web; bun test src/features/keys/lib/__tests__/api-key-form.test.ts src/features/keys/components/__tests__/api-keys-mutate-drawer.test.tsx`

Expected: FAIL because routing controls are not rendered.

- [ ] **Step 3: Implement typed form fields and accessible controls**

Extend the Zod schema, `ApiKey` types, defaults, edit hydration, and payload transform with `routing_mode`, `routing_max_cost`, `routing_fallback`, and `routing_disclosure_accepted`. Use the existing drawer component system. Default to strict mode. Display this exact Chinese disclosure beside the opt-in control: `开启后，实际执行模型可能与所选模型不同；系统会显示实际模型，并按实际模型计算额度。` Do not hide or pre-check acceptance.

- [ ] **Step 4: Complete all locale files with the i18n workflow**

Use the `i18n-translate` skill to add natural translations for every new literal key to `en`, `zh`, `zh-TW`, `fr`, `ja`, `ru`, and `vi`, then run `cd web; bun run i18n:sync` and verify it reports no missing keys.

- [ ] **Step 5: Run frontend tests, typecheck, lint, and build**

Run: `cd web; bun test src/features/keys/lib/__tests__/api-key-form.test.ts src/features/keys/components/__tests__/api-keys-mutate-drawer.test.tsx; bun run typecheck; bun run lint; bun run build`

Expected: all commands PASS with no missing translation keys.

- [ ] **Step 6: Commit user controls**

```bash
git add web/src
git commit -m "feat: add token cost optimization controls"
```

### Task 10: Verify the Core Slice and Document Its Operational Contract

**Files:**
- Create: `docs/nailong-cost-routing.md`
- Modify: `.env.example`
- Modify: `docker-compose.yml`

**Interfaces:**
- Documents administrator rule configuration, API-key opt-in, request overrides, response headers, fallback limits, privacy behavior, and rollback.
- Consumes all earlier tasks.

- [ ] **Step 1: Add a black-box compatibility test script or Go test using two local stub upstreams**

Cover strict routing, optimized substitution, unavailable replacement fallback, response disclosure, exact billing model, and disabled-rule behavior without contacting paid providers.

- [ ] **Step 2: Run full backend verification**

Run: `go test ./...`

Expected: PASS.

- [ ] **Step 3: Verify independent relaykit build**

Run: `cd relaykit; $env:GOWORK='off'; go build ./...`

Expected: PASS.

- [ ] **Step 4: Run frontend verification**

Run: `cd web; bun run i18n:sync; bun run build`

Expected: PASS.

- [ ] **Step 5: Run database migration smoke tests**

Run the repository's SQLite migration tests locally and the existing MySQL/PostgreSQL migration jobs in CI. Expected: both new tables and token columns migrate without dialect-specific SQL or repeated schema alterations.

- [ ] **Step 6: Write operator documentation and rollback steps**

Document that setting every token to `strict` and disabling all routing rules immediately restores baseline model behavior without removing tables. Document response headers, audit locations, maximum retry stages, and the fact that prompts are not persisted by the router.

- [ ] **Step 7: Commit verification and documentation**

```bash
git add docs/nailong-cost-routing.md .env.example docker-compose.yml
git commit -m "docs: add cost routing operations guide"
```

## Completion Gate

Before declaring this plan complete:

- Every task commit exists and `git status --short` is clean.
- `go test ./...` passes.
- `relaykit` builds with `GOWORK=off`.
- Frontend i18n synchronization and production build pass.
- A strict-mode request is byte-for-byte compatible at the API contract level with the upstream New API baseline, excluding nondeterministic identifiers and timestamps.
- An optimized request can be traced from requested model through actual model and upstream mapping to final billing and response disclosure.
- No test or log fixture contains real API keys or full user prompts.
