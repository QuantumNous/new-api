# BytePlus Seedance Global Overseas Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the global Seedance model prices and BytePlus scenario tiers match BytePlus overseas pricing, including the `seedance2.0-pro` public alias.

**Architecture:** Store official global baselines in `defaultModelRatio`. Keep scenario selection BytePlus-local by normalizing exact Pro aliases to the existing `seedance-2.0` pricing key, and store official prices as integer tenths so the derived ratios settle without one-quota float truncation.

**Tech Stack:** Go 1.22+, NewAPI ratio settings, asynchronous task billing, Gin tests.

---

### Task 1: Lock the global and scenario price contracts with failing tests

**Files:**
- Create: `setting/ratio_setting/seedance_ratio_test.go`
- Modify: `relay/channel/task/byteplus/adaptor_test.go`
- Modify: `relay/relay_task_billing_test.go`
- Modify: `service/task_billing_test.go`
- Modify: `web/default/src/features/channels/constants.test.ts`

- [ ] **Step 1: Add the global default-ratio test**

```go
func TestSeedanceGlobalDefaultRatiosMatchBytePlusOverseasPricing(t *testing.T) {
    tests := []struct {
        model string
        ratio float64
    }{
        {model: "seedance-2.0", ratio: 3.5},
        {model: "seedance2.0-pro", ratio: 3.5},
        {model: "Seedance2.0-pro", ratio: 3.5},
        {model: "seedance-2.0-fast", ratio: 2.8},
        {model: "seedance-2.0-mini", ratio: 1.75},
    }
    for _, tt := range tests {
        if got := defaultModelRatio[tt.model]; got != tt.ratio {
            t.Fatalf("%s ratio = %v, want %v", tt.model, got, tt.ratio)
        }
    }
}
```

- [ ] **Step 2: Update BytePlus adapter expectations**

Add canonical `seedance2.0-pro` to the expected model list. Replace the old
scenario ratios with `43/70`, `77/70`, `47/70`, `40/70`, `24/70`, `33/56`, and
`21/35`. Add explicit canonical and legacy Pro cases, plus
`seedance2.0-pro-max` as a non-matching boundary case.

- [ ] **Step 3: Update the relay billing contract**

Configure raw ratios `3.5`, `2.8`, and `1.75`; add both Pro spellings; assert
base/tier quotas `875000/537500`, `700000/412500`, and `437500/262500`.
Add a Pro group-ratio case proving `GroupRatio` scales the official baseline
and tier price.

- [ ] **Step 4: Update completion settlement expectations**

Use `ModelRatio = 3.5`, `video_input = 43.0 / 70.0`, and `actualQuota = 2150`
for a 1000-token Seedance 2.0 video-input task.

- [ ] **Step 5: Add default console channel-config coverage**

Assert that BytePlus channel type `107` advertises `seedance2.0-pro` in the
default console supported models and hints, and does not advertise the legacy
case alias `Seedance2.0-pro`.

- [ ] **Step 6: Run the tests and verify RED**

Run:

```powershell
go test ./setting/ratio_setting -run '^TestSeedanceGlobalDefaultRatiosMatchBytePlusOverseasPricing$' -count=1 -v
go test ./relay/channel/task/byteplus -run '^(TestIdentityAndModelList|TestEstimateBillingUsesPublicModelPricingAcrossEndpointMappings)$' -count=1 -v
go test ./relay -run '^TestBytePlusModelRatiosApplyTierRatios$' -count=1 -v
go test ./service -run '^TestSettle_NonPerCallSeedance_UsesTotalTokensAndScenarioRatio$' -count=1 -v
cd web/default; bun test src/features/channels/constants.test.ts
```

Expected: the ratio and alias tests fail because the defaults, canonical model,
exact official tiers, and default console model list are not implemented yet.

### Task 2: Implement the minimal global and BytePlus pricing changes

**Files:**
- Modify: `setting/ratio_setting/model_ratio.go`
- Modify: `relay/channel/task/byteplus/constants.go`
- Modify: `web/default/src/features/channels/lib/channel-type-config.ts`

- [ ] **Step 1: Add global default ratios**

Add these entries to `defaultModelRatio`:

```go
"seedance-2.0":      3.5,  // $7 / 1M tokens
"seedance2.0-pro":   3.5,  // $7 / 1M tokens
"Seedance2.0-pro":   3.5,  // $7 / 1M tokens; legacy alias
"seedance-2.0-fast": 2.8,  // $5.6 / 1M tokens
"seedance-2.0-mini": 1.75, // $3.5 / 1M tokens
```

- [ ] **Step 2: Add the canonical public model and exact alias resolution**

Add `seedance2.0-pro` to `ModelList`. Add an exact alias map:

```go
var pricingModelAliases = map[string]string{
    "seedance2.0-pro": "seedance-2.0",
    "Seedance2.0-pro": "seedance-2.0",
}
```

Resolve through this map after trimming whitespace and before looking up the
scenario table.

- [ ] **Step 3: Replace approximate scenario units**

Use `70/43/77/47/40/24` for Seedance 2.0, `56/33` for Fast, and `35/21` for
Mini. Keep Doubao's separate table unchanged.

- [ ] **Step 4: Update default console BytePlus defaults**

Add `seedance2.0-pro` to the default console BytePlus supported model list and
model hint string. Do not add `Seedance2.0-pro`; it remains a compatibility-only
billing alias.

- [ ] **Step 5: Run the targeted tests and verify GREEN**

Run the commands from Task 1. Expected: all pass.

### Task 3: Correct the active pricing documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-07-31-byteplus-seedance-tiered-billing-design.md`
- Modify: `docs/superpowers/specs/2026-08-06-byteplus-seedance-global-overseas-pricing-design.md`
- Modify: `docs/superpowers/plans/2026-08-06-byteplus-seedance-global-overseas-pricing.md`

- [ ] **Step 1: Replace the obsolete low-price contract**

Document the global raw ratios, official overseas prices, exact scenario units,
Pro alias mapping, GroupRatio-only customer adjustments, and persisted-setting
rollout requirement. Record that production rollout must delete any Seedance
`GroupModelRatio` overrides, or set them to the expected `GroupRatio` value if
they cannot be deleted immediately, and that both router/backend and the default
console need deployment.

- [ ] **Step 2: Check for stale active values**

Run:

```powershell
rg -n '0\.391|0\.3145|0\.1955|28/46|51/46|31/46|26/46|16/46|22/37|14/23|\$0\.782|\$0\.629' relay/channel/task/byteplus relay/relay_task_billing_test.go service/task_billing_test.go docs/superpowers/specs/2026-07-31-byteplus-seedance-tiered-billing-design.md docs/superpowers/specs/2026-08-06-byteplus-seedance-global-overseas-pricing-design.md
```

Expected: no obsolete BytePlus pricing-contract matches.

### Task 4: Verify, review, and prepare the PR

**Files:**
- Verify all modified files.

- [ ] **Step 1: Format and validate the diff**

```powershell
gofmt -w setting/ratio_setting/seedance_ratio_test.go setting/ratio_setting/model_ratio.go relay/channel/task/byteplus/constants.go relay/channel/task/byteplus/adaptor_test.go relay/relay_task_billing_test.go service/task_billing_test.go
git diff --check
```

- [ ] **Step 2: Run affected regression suites**

```powershell
go test ./setting/ratio_setting ./relay/channel/task/byteplus ./relay/channel/task/doubao -count=1
go test ./relay -count=1
go test ./service -count=1
go test ./relay/channel/task/... -count=1
cd web/default; bun test src/features/channels/constants.test.ts
go build ./...
```

- [ ] **Step 3: Review affected scope**

Run `gitnexus detect-changes` if the repository index is available; otherwise
record the analyzer failure and use `git diff --stat`, `git diff`, and an
independent code-review subagent.

- [ ] **Step 4: Commit with Lore trailers, push, and create the PR**

The PR body must include problem, official evidence, root cause, design, impact,
risk, validation, persisted-production-config rollout, `Router/backend deploy:
required`, `web/default console deploy: required`, and the production reminder
to remove Seedance `ModelPrice` and `TASK_PRICE_PATCH` entries for every exact
Seedance name in the `ModelRatio` contract, delete Seedance `GroupModelRatio`
overrides or set them to the expected `GroupRatio` value, and verify one real
token-settled task.
