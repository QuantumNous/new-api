# kids_mode Coverage Matrix

Every hard constraint that kids_mode enforces, with the layer that owns it and
the test file/function that covers it. **CI fails if any listed test function
disappears** — enforced by `scripts/check-kids-coverage-matrix.sh` via
`go test -list` on every PR. See `.github/workflows/airbotix-internal.yml`.

Last updated: 2026-06-13  
Tracks: DR-12 | References: DR-27, DR-28, DR-29, DR-30, DR-31  
Primary references: DeepRouter PRD §6.4-pre; `AIRBOTIX.md` internal/kids row

---

## DR-12 Layer Map

PRD §6.4-pre requires kids_mode hard constraints to stay covered across
Tenant Resolver, Protocol Adapter, Policy Middleware, and Provider Pool. This
matrix is the safety gate for that requirement: removing a listed test function
must break CI.

| PRD Layer | Owning File(s) | Matrix Section(s) | Owning Test File |
|---|---|---|---|
| Tenant Resolver | `model/user.go`, `middleware/policy.go` | Tenant Resolver Input Contract; Middleware Wiring | `model/user_airbotix_test.go`, `middleware/policy_test.go` |
| Policy Middleware | `internal/policy/profile.go`, `middleware/policy.go` | Policy Decision Routing; Middleware Wiring | `internal/policy/profile_test.go`, `middleware/policy_test.go` |
| Protocol Adapter | `internal/kids/kids.go`, `relay/airbotix_policy.go` | Model Whitelist; Metadata Stripping; Zero-Data-Retention; Child-Safe System Prompt Injection; Max Tokens Hard Cap | `internal/kids/kids_test.go`, `relay/airbotix_policy_test.go` |
| Provider Pool | `controller/model.go`, `controller/internal_catalog.go` | Model Whitelist | `controller/model_list_test.go`, `controller/internal_catalog_test.go` |

---

## Hard Constraints

### 0. Tenant Resolver Input Contract

The tenant resolver must preserve the `users.kids_mode` and `users.policy_profile`
inputs that downstream policy decisions depend on. Losing these fields makes the
rest of the safety gate unreachable.

| Layer | Owning File | Test File | Test Function(s) |
|---|---|---|---|
| Tenant Resolver — User schema | `model/user.go` | `model/user_airbotix_test.go` | `TestUser_AirbotixFieldsPresent`, `TestUser_AirbotixFieldDefaults`, `TestUser_AirbotixFieldsRoundTrip` |

### 1. Model Whitelist

Block requests for non-whitelisted models when `KidsMode=true` or
`EnforceModelWhitelist=true`. Allowed models: `gpt-4o`, `gpt-4o-mini`,
`gpt-image-2`, `gpt-image-1`, `claude-3-5-haiku-*`, `claude-3-5-sonnet-*`,
`flux-schnell`, `flux-1.1-pro`.

| Layer | Owning File | Test File | Test Function(s) |
|---|---|---|---|
| Core helper | `internal/kids/kids.go` | `internal/kids/kids_test.go` | `TestIsModelEligible` |
| Policy Middleware — Decision engine | `internal/policy/profile.go` | `internal/policy/profile_test.go` | `TestDecisionFor_KidsModeForcesEverything` |
| Protocol Adapter — universal gate | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestCheckAirbotixModelWhitelist_*` (4 cases) |
| Protocol Adapter — OpenAI shape | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicy_KidsModeBlocksDisallowedModel` |
| Protocol Adapter — Claude shape | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToClaude_KidsModeRejectsDisallowed` |
| Protocol Adapter — Responses shape | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToResponses_KidsModeRejectsDisallowed` |
| Protocol Adapter — Gemini shape | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToGemini_KidsModeRejectsDisallowedModel` |
| Provider Pool — `/v1/models` kids filter | `controller/model.go` | `controller/model_list_test.go` | `TestListModelsKidsModeFiltersCatalog`, `TestListModelsKidsModeLookupErrorFailsClosed`, `TestListModelsAnthropicKidsModeEmptyCatalog` |
| Provider Pool — internal router catalog pre-filter | `controller/internal_catalog.go` | `controller/internal_catalog_test.go` | `TestKidsModeCatalogPreFilter` |

---

### 2. Metadata Stripping

Remove `user`, `safety_identifier`, and `metadata.{user_id,kid_profile_id,
family_id,kid_id}` fields from all requests under `StripIdentifying=true`.

| Layer | Owning File | Test File | Test Function(s) |
|---|---|---|---|
| Core helper | `internal/kids/kids.go` | `internal/kids/kids_test.go` | `TestStripIdentifyingMetadata`, `TestStripIdentifyingMetadata_DropsEmptyMetadata` |
| Relay — OpenAI shape | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicy_KidsModeAllowedModelMutates` |
| Relay — Claude shape | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToClaude_KidsModeReplacesSystemAndClearsMetadata` |
| Relay — Responses shape | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToResponses_KidsModeMutates` |

> Note: Gemini has no user/metadata fields to strip; the row is intentionally absent.

---

### 3. Zero-Data-Retention (ZDR)

Force `store: false` on OpenAI-family channels (`openai`, `azure`,
`azure-openai`) only. Non-OpenAI providers ignore or reject the field.

| Layer | Owning File | Test File | Test Function(s) |
|---|---|---|---|
| Core helper | `internal/kids/kids.go` | `internal/kids/kids_test.go` | `TestEnforceZeroDataRetention_OpenAI`, `TestEnforceZeroDataRetention_NonOpenAI` |
| Relay — OpenAI shape | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicy_KidsModeAllowedModelMutates` (store=false) |
| Relay — OpenAI shape (skip) | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicy_KidsModeNonOpenAIChannelSkipsZDR` |
| Relay — Responses shape | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToResponses_KidsModeMutates` (store=false) |
| Relay — Responses shape (skip) | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToResponses_NonOpenAISkipsZDR` |

---

### 4. Child-Safe System Prompt Injection

Inject the child-safe system prompt. `KidsMode=true` → hard replace any
existing system message. `kid-safe` profile alone → soft fill (only if empty).

| Layer | Owning File | Test File | Test Function(s) |
|---|---|---|---|
| Core helper | `internal/kids/kids.go` | `internal/kids/kids_test.go` | `TestChildSafeSystemPrompt_Nonempty` |
| Policy Decision | `internal/policy/profile.go` | `internal/policy/profile_test.go` | `TestDecisionFor_KidsModeForcesEverything`, `TestDecisionFor_KidSafeProfile` |
| Relay — OpenAI (hard replace) | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicy_KidsModeReplacesExistingSystemPrompt` |
| Relay — OpenAI (prepend) | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicy_KidsModeAllowedModelMutates` |
| Relay — OpenAI (soft) | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicy_KidSafeProfileSoftPrepend` |
| Relay — Claude (hard replace) | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToClaude_KidsModeReplacesSystemAndClearsMetadata` |
| Relay — Claude (soft) | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToClaude_KidSafeSoftFillEmpty` |
| Relay — Responses (hard) | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToResponses_KidsModeMutates` |
| Relay — Gemini (hard replace) | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToGemini_KidsModeReplacesSystemInstructions` |
| Relay — Gemini (soft) | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToGemini_KidSafeFillsWhenNil` |

---

### 5. Max Tokens Hard Cap

Global ceiling of 2048 tokens applied to every request shape, for every tenant,
regardless of policy profile. Prevents single-request upstream token exhaustion.

| Layer | Owning File | Test File | Test Function(s) |
|---|---|---|---|
| `clampUint` helper | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestClampUint_Nil`, `TestClampUint_BelowCeiling`, `TestClampUint_AtCeiling`, `TestClampUint_AboveCeiling` |
| Relay — OpenAI shape | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicy_ClampsMaxTokens` |
| Relay — Claude shape | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToClaude_ClampsMaxTokens` |
| Relay — Responses shape | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToResponses_ClampsMaxOutputTokens` |
| Relay — Gemini shape | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToGemini_ClampsMaxOutputTokens` |

---

### 6. Policy Decision Routing

`policy.DecisionFor(kidsMode, profile)` must cascade correctly: `kids_mode=true`
overrides profile and forces all constraints on; passthrough disables all.

| Layer | Owning File | Test File | Test Function(s) |
|---|---|---|---|
| Decision engine | `internal/policy/profile.go` | `internal/policy/profile_test.go` | `TestDecisionFor_KidsModeForcesEverything`, `TestDecisionFor_KidSafeProfile`, `TestDecisionFor_DefaultsToPassthrough`, `TestDecisionFor_AdultProfile`, `TestDecisionFor_UnknownProfileFallsBack` |

---

### 7. Middleware Wiring

`middleware.AirbotixPolicy()` must resolve the per-tenant decision from DB and
stash it in gin context before any relay handler runs. Must not block traffic on
DB error (defensive pass-through).

| Layer | Owning File | Test File | Test Function(s) |
|---|---|---|---|
| Middleware | `middleware/policy.go` | `middleware/policy_test.go` | `TestAirbotixPolicy_ZeroUserIdPassesThrough`, `TestAirbotixPolicy_DBErrorFallsThrough` |

---

## Gaps / Future Work

| Item | Status | Ticket |
|---|---|---|
| HTTP-level integration test (httptest mock provider, full relay stack) | Planned — Phase 2.5 | — |
| ZDR equivalent for Anthropic provider (no `store: false` in Anthropic API) | Accepted gap — metadata strip + prompt control is sufficient for Phase 1 | DR-31 |
| `/v1/models` fail-closed when **middleware** hits a DB error | When `AirbotixPolicy` middleware runs but DB fails, it writes a passthrough decision (`KidsMode=false`) to context. The catalog endpoint reads that decision and skips filtering — still fail-open in this path. Fix requires adding an `Indeterminate` state to `policy.Decision` so the catalog can distinguish "not kids" from "unknown". Accepted for Phase 1; middleware DB errors are rare and covered by service-level DB health checks. | — |

---

## CI Enforcement

The workflow `.github/workflows/airbotix-internal.yml` runs on every PR that
touches `internal/**`, `relay/**`, `middleware/**`, `controller/**`,
`docs/kids-coverage-matrix.md`, or `scripts/check-kids-coverage-matrix.sh`.

```bash
# Core helpers
go test ./internal/... -count=1 -race -timeout 60s

# Tenant resolver schema
go test ./model/ -run 'TestUser_Airbotix' -count=1 -timeout 60s

# Relay layer (all constraints incl. max_tokens cap + matrix Go test)
go test ./relay/ -run 'TestApplyAirbotixPolicy|TestClampUint|TestCheckAirbotixModelWhitelist|TestKidsModeCoverageMatrix' -count=1 -race -timeout 60s

# Middleware layer
go test ./middleware/ -run 'TestAirbotixPolicy|TestInternalToken|TestResolveAutoModel' -count=1 -race -timeout 60s

# Catalog endpoint
go test ./controller/ -run 'TestKidsMode' -count=1 -race -timeout 60s

# Matrix enforcement via go test -list (catches deletions that broad -run regexes miss)
bash scripts/check-kids-coverage-matrix.sh
```
