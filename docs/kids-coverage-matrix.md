# kids_mode Coverage Matrix

Every hard constraint that kids_mode enforces, with the layer that owns it and
the test file/function that covers it. **CI fails if any row in the Relay column
loses coverage** — see `.github/workflows/airbotix-internal.yml`.

Last updated: 2026-06-12  
Tracks: DR-12 | References: DRS-27, DRS-28, DRS-29, DRS-30, DRS-31

---

## Hard Constraints

### 1. Model Whitelist

Block requests for non-whitelisted models when `KidsMode=true` or
`EnforceModelWhitelist=true`. Allowed models: `gpt-4o`, `gpt-4o-mini`,
`gpt-image-2`, `gpt-image-1`, `claude-3-5-haiku-*`, `claude-3-5-sonnet-*`,
`flux-schnell`, `flux-1.1-pro`.

| Layer | Owning File | Test File | Test Function(s) |
|---|---|---|---|
| Core helper | `internal/kids/kids.go` | `internal/kids/kids_test.go` | `TestIsModelEligible` |
| Policy Decision | `internal/policy/profile.go` | `internal/policy/profile_test.go` | `TestDecisionFor_KidsModeForcesEverything` |
| Relay — universal gate | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestCheckAirbotixModelWhitelist_*` (4 cases) |
| Relay — OpenAI shape | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicy_KidsModeBlocksDisallowedModel` |
| Relay — Claude shape | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToClaude_KidsModeRejectsDisallowed` |
| Relay — Responses shape | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToResponses_KidsModeRejectsDisallowed` |
| Relay — Gemini shape | `relay/airbotix_policy.go` | `relay/airbotix_policy_test.go` | `TestApplyAirbotixPolicyToGemini_KidsModeRejectsDisallowedModel` |
| Catalog endpoint | `controller/model.go` | `controller/internal_catalog_test.go` | `TestKidsModeCatalogPreFilter` |

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
| ZDR equivalent for Anthropic provider (no `store: false` in Anthropic API) | Accepted gap — metadata strip + prompt control is sufficient for Phase 1 | DRS-31 |

---

## CI Enforcement

The workflow `.github/workflows/airbotix-internal.yml` runs these commands on
every PR that touches `internal/**`, `middleware/policy.go`,
`relay/airbotix_policy.go`, or `docs/kids-coverage-matrix.md`:

```bash
# Core helpers
go test ./internal/... -count=1 -race -timeout 60s

# Relay layer (all constraints incl. max_tokens cap) + matrix enforcement
# TestKidsModeCoverageMatrix fails CI if a function listed in this file doesn't exist.
go test ./relay/ -run 'TestApplyAirbotixPolicy|TestClampUint|TestCheckAirbotixModelWhitelist|TestKidsModeCoverageMatrix' -count=1 -race -timeout 60s

# Middleware layer
go test ./middleware/ -run 'TestAirbotixPolicy|TestInternalToken|TestResolveAutoModel' -count=1 -race -timeout 60s

# Catalog endpoint
go test ./controller/ -run 'TestKidsMode' -count=1 -race -timeout 60s
```
