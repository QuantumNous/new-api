# Channel 106 TokenSpace Asset Materialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a TokenSpace Action-API materializer to the existing provider-neutral Flatkey asset library so channel 106 can use its pre-created internal AIGC group without exposing upstream state to customers.

**Architecture:** Extend the channel-configured `AssetMaterializer` descriptor registry introduced by PR #753 with a `tokenspace_material` provider. The provider signs the existing GCS source, calls TokenSpace `CreateAsset` and `GetAsset`, persists the private binding through the existing lease/CAS flow, and reuses the existing Seedance rewrite map; the administrator form only gains the additional provider choice.

**Tech Stack:** Go 1.22+, `net/http`, GORM-backed existing asset bindings, `httptest`, React 19, TypeScript, Zod, Bun/Vitest.

## Global Constraints

- Work on the existing clean linked worktree and branch for PR #753: `E:\workspace\new-api-worktrees\channel-156-asset-materialization`, branch `feat/channel-156-asset-materialization`.
- Fetch and merge the latest `origin/main` before implementation; preserve PR #753's generic materializer commits and the committed design/plan documents.
- Reuse `dto.ChannelOtherSettings.AssetMaterialization`; do not add a database column, table, public API field, or second secret.
- Provider key is exactly `tokenspace_material`; binding scope prefix is exactly `tokenspace-material:v1:`.
- The API key, group ID, account credentials, signed URLs, and upstream asset IDs must not appear in source, fixtures, reports, commits, or logs. The publicly documented API origin may appear only in design or transient operations commands; it must not be hard-coded into production code or tests.
- The application runtime never creates, lists, updates, or deletes TokenSpace groups. Operations owns one pre-created AIGC group.
- Only Image and Video are eligible in this change; Audio fails before an upstream call.
- All JSON marshal/unmarshal calls use `common.Marshal` / `common.Unmarshal`.
- Production is multi-node: reuse the existing database uniqueness, binding scope, lease ownership, CAS activation, and retry schedule; do not add process-local coordination.
- Existing BytePlus, legacy TechMobi, `seedance_proxy`, source-URL, ordinary HTTPS media, billing, task polling, and result delivery behavior remain unchanged.
- Follow red-green TDD: every production behavior is preceded by a focused failing test that fails for the intended missing behavior.
- Commits follow the repository Lore Commit Protocol.

---

### Task 1: Implement the TokenSpace provider contract and binding descriptor

**Files:**
- Create: `service/tokenspace_material_asset.go`
- Create: `service/tokenspace_material_asset_test.go`
- Modify: `service/asset_binding.go`
- Modify: `service/asset_binding_test.go`

**Interfaces:**
- Consumes: `AssetMaterializer`, `AssetMaterializeInput`, `AssetMaterializeResult`, `assetMaterializationChannelConfig`, `AssetMaterializeFailure`, `normalizedGatewayOrigin`, and existing binding lease/CAS functions.
- Produces: `tokenSpaceMaterialAssetBindingMaterializer`, provider key `tokenspace_material`, credential-scoped binding prefix `tokenspace-material:v1:`, and Action-based `CreateAsset` / `GetAsset` behavior.

- [ ] **Step 1: Write failing descriptor and scope tests**

Add literal-behavior tests to `service/asset_binding_test.go`:

```go
func TestAssetMaterializerForChannelSelectsTokenSpaceMaterial(t *testing.T) {
    channel := channelWithAssetMaterializationSettings(t, constant.ChannelTypeTechMobiVideo, dto.AssetMaterializationSettings{
        Provider:       "tokenspace_material",
        GatewayBaseURL: "https://materials.example.invalid",
        GroupID:        "group-internal",
    })

    materializer, err := assetMaterializerForChannel(channel)

    require.NoError(t, err)
    require.IsType(t, tokenSpaceMaterialAssetBindingMaterializer{}, materializer)
}

func TestAssetBindingScopeForTokenSpaceMaterialIsCredentialScopedAndModelIndependent(t *testing.T) {
    channel := channelWithAssetMaterializationSettings(t, constant.ChannelTypeTechMobiVideo, dto.AssetMaterializationSettings{
        Provider:       "tokenspace_material",
        GatewayBaseURL: "https://materials.example.invalid/path/",
        GroupID:        "group-internal",
    })

    first, err := assetBindingScopeForChannel(channel, AssetMaterializeOptions{Model: "model-a", APIKey: "key-a"})
    require.NoError(t, err)
    same, err := assetBindingScopeForChannel(channel, AssetMaterializeOptions{Model: "model-b", APIKey: "key-a"})
    require.NoError(t, err)
    otherKey, err := assetBindingScopeForChannel(channel, AssetMaterializeOptions{Model: "model-a", APIKey: "key-b"})
    require.NoError(t, err)

    require.Equal(t, first, same)
    require.NotEqual(t, first, otherKey)
    require.True(t, strings.HasPrefix(first, "tokenspace-material:v1:"))
}
```

The tests must also prove that changing `group_id` or normalized origin changes the scope, changing only `channel.Type` does not, unknown explicit providers fail closed, and empty provider settings retain legacy type fallback.

- [ ] **Step 2: Run the focused tests and verify the expected red failure**

Run:

```powershell
go test ./service -run 'Test(AssetMaterializerForChannelSelectsTokenSpaceMaterial|AssetBindingScopeForTokenSpaceMaterial)' -count=1
```

Expected: compile or assertion failure because the TokenSpace provider type, key, and descriptor do not exist.

- [ ] **Step 3: Write failing HTTP contract and status tests**

Use `httptest.NewTLSServer` and inject its client through a provider-local HTTP client factory. The handler must decode the real request and assert literal behavior, not mock calls:

```go
switch r.URL.Query().Get("Action") {
case "CreateAsset":
    require.Equal(t, http.MethodPost, r.Method)
    require.Equal(t, "/api/material", r.URL.Path)
    require.Equal(t, "Bearer key-test", r.Header.Get("Authorization"))
    var body tokenSpaceMaterialCreateRequest
    require.NoError(t, common.DecodeJson(r.Body, &body))
    require.Equal(t, "group-internal", body.GroupID)
    require.Equal(t, "https://signed.example/source", body.URL)
    require.Equal(t, "Image", body.AssetType)
    _, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"request-create"},"Result":{"Id":"asset-created"}}`)
case "GetAsset":
    var body tokenSpaceMaterialGetRequest
    require.NoError(t, common.DecodeJson(r.Body, &body))
    require.Equal(t, "asset-created", body.ID)
    _, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"request-get"},"Result":{"Id":"asset-created","GroupId":"group-internal","Status":"Active"}}`)
default:
    t.Fatalf("unexpected Action %q", r.URL.Query().Get("Action"))
}
```

Add separate tests for:

- Create returns `Result.Id` and provider-local `Processing` even without a status.
- Get maps `Active`, `Pending`, `Processing`, and `Failed` exactly.
- HTTP 200 with `Result.Error.Code` is treated as a business failure and never as success.
- HTTP 401/403/422 are definitive, 429 honors bounded `Retry-After`, 5xx is retryable, context timeout is timeout, malformed/oversized JSON is a protocol failure.
- Missing asset ID or unknown status fails closed.
- Image and Video normalize successfully; Audio is definitive and produces no HTTP request.
- Errors and returned values never contain the Bearer token, signed source URL, group ID, or response message.

- [ ] **Step 4: Run the provider tests and verify the expected red failure**

Run:

```powershell
go test ./service -run 'TestTokenSpaceMaterialAsset' -count=1
```

Expected: compile failure because `tokenSpaceMaterialAssetBindingMaterializer` and its request/response types do not exist.

- [ ] **Step 5: Implement the minimal provider and descriptor**

Add these production shapes to `service/tokenspace_material_asset.go`:

```go
const tokenSpaceMaterialAssetPath = "/api/material"

type tokenSpaceMaterialAssetBindingMaterializer struct {
    config assetMaterializationChannelConfig
}

type tokenSpaceMaterialCreateRequest struct {
    GroupID   string `json:"GroupId"`
    URL       string `json:"URL"`
    Name      string `json:"Name"`
    AssetType string `json:"AssetType"`
}

type tokenSpaceMaterialGetRequest struct {
    ID string `json:"Id"`
}

type tokenSpaceMaterialResponse struct {
    ResponseMetadata struct {
        RequestID string `json:"RequestId"`
    } `json:"ResponseMetadata"`
    Result struct {
        ID      string `json:"Id"`
        GroupID string `json:"GroupId"`
        Status  string `json:"Status"`
        Error   struct {
            Code    string `json:"Code"`
            Message string `json:"Message"`
        } `json:"Error"`
    } `json:"Result"`
}
```

Implement:

```go
func (tokenSpaceMaterialAssetBindingMaterializer) CreateAsset(context.Context, AssetMaterializeInput) (AssetMaterializeResult, error)
func (tokenSpaceMaterialAssetBindingMaterializer) GetAsset(context.Context, AssetMaterializeInput, string) (AssetMaterializeResult, error)
func tokenSpaceMaterialConfig(*model.Channel) (assetMaterializationChannelConfig, bool)
func tokenSpaceMaterialNormalizeType(string) (string, error)
func tokenSpaceMaterialNormalizeStatus(string) (string, bool)
func tokenSpaceMaterialBindingScope(string, string, string) string
```

Build both Action URLs with `url.URL` / query values so the exact path remains `/api/material` and only the `Action` query is added. Use the channel's existing proxy-aware HTTP client factory, `common.Marshal`/`common.Unmarshal`, a 1 MiB response limit, Bearer authorization, and `Idempotency-Key` on Create when present. Create returns `Processing`; Get accepts both `Pending` and `Processing` as `model.AssetStatusProcessing`.

Register the descriptor in `service/asset_binding.go`:

```go
const (
    assetMaterializationProviderTokenSpaceMaterial = "tokenspace_material"
    tokenSpaceMaterialBindingScopePrefix           = "tokenspace-material:v1:"
)

assetMaterializationProviderTokenSpaceMaterial: {
    MaterializerFactory: func(config assetMaterializationChannelConfig) AssetMaterializer {
        return tokenSpaceMaterialAssetBindingMaterializer{config: config}
    },
    BindingScope: func(config assetMaterializationChannelConfig, options AssetMaterializeOptions) (string, error) {
        scope := tokenSpaceMaterialBindingScope(config.GatewayOrigin, config.GroupID, options.APIKey)
        if scope == "" {
            return "", ErrAssetBindingUnavailable
        }
        return scope, nil
    },
    ValidateConfig:   validateSeedanceProxyAssetMaterializationConfig,
    CredentialScoped: true,
},
```

Do not add group CRUD or provider-specific database state.

- [ ] **Step 6: Run focused red-to-green verification**

Run:

```powershell
go test ./service -run 'Test(TokenSpaceMaterialAsset|AssetMaterializerForChannelSelectsTokenSpaceMaterial|AssetBindingScopeForTokenSpaceMaterial|SeedanceProxyAsset)' -count=1 -timeout=5m
```

Expected: PASS. Existing Seedance Proxy coverage must stay green.

- [ ] **Step 7: Commit Task 1 using Lore trailers**

```powershell
git add service/asset_binding.go service/asset_binding_test.go service/tokenspace_material_asset.go service/tokenspace_material_asset_test.go
git commit -m 'Let configured channels materialize through TokenSpace' -m 'Implement the Action-based create and status contract behind the existing private binding lifecycle.' -m 'Constraint: one operations-managed group and one existing channel credential.' -m 'Rejected: branch on the configured hostname | provider identity must be explicit and stable.' -m 'Confidence: high' -m 'Scope-risk: moderate' -m 'Directive: preserve HTTP-200 business-error handling and credential-scoped bindings.' -m 'Tested: focused TokenSpace, descriptor, scope, and Seedance Proxy service tests' -m 'Not-tested: administrator form and live upstream'
```

### Task 2: Enable TokenSpace readiness and administrator configuration

**Files:**
- Modify: `service/asset_reference.go`
- Modify: `service/asset_reference_test.go`
- Modify: `service/asset_model_target_test.go`
- Modify: `web/default/src/features/channels/lib/channel-form.ts`
- Modify: `web/default/src/features/channels/lib/channel-form.test.ts`
- Modify: `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx`
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`
- Modify: `web/default/src/i18n/locales/es.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/pt.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/vi.json`

**Interfaces:**
- Consumes: Task 1 provider key and descriptor, existing `channelCanConsumeAssetType`, `ResolveAssetCandidatesForChannel`, channel form normalization/serialization, and the existing three admin-only capability fields.
- Produces: Image/Video readiness for valid `tokenspace_material` channels and a selectable administrator form option that round-trips the same `asset_materialization` JSON.

- [ ] **Step 1: Write failing readiness tests**

Add tests proving a valid explicit TokenSpace provider:

```go
require.True(t, channelCanConsumeAssetType(channel, "Image"))
require.True(t, channelCanConsumeAssetType(channel, "Video"))
require.False(t, channelCanConsumeAssetType(channel, "Audio"))
```

Add one model-target test showing a channel whose legacy type is TechMobi becomes eligible through explicit TokenSpace provider configuration, while incomplete configuration and an unknown provider remain ineligible. Retain assertions for BytePlus, TechMobi, and Seedance Proxy compatibility.

- [ ] **Step 2: Run readiness tests and verify red**

Run:

```powershell
go test ./service -run 'Test(TokenSpaceMaterial.*AssetType|AssetModelTarget.*TokenSpace)' -count=1
```

Expected: assertions fail because `channelCanConsumeAssetType` recognizes only `seedance_proxy` for explicit providers.

- [ ] **Step 3: Implement descriptor-backed Image/Video eligibility**

Make the explicit-provider branch accept exactly the two registered providers that implement this Seedance asset contract:

```go
switch config.Provider {
case assetMaterializationProviderSeedanceProxy, assetMaterializationProviderTokenSpaceMaterial:
    return assetType == "Image" || assetType == "Video"
default:
    return false
}
```

Do not change legacy type behavior or add Audio.

- [ ] **Step 4: Write failing administrator form tests**

Add a round-trip test using literal input:

```ts
const payload = toPayload({
  ...baseChannelValues,
  asset_materialization_provider: 'tokenspace_material',
  asset_materialization_gateway_base_url: 'https://materials.example.invalid',
  asset_materialization_group_id: 'group-internal',
})

expect(JSON.parse(payload.settings)).toMatchObject({
  asset_materialization: {
    provider: 'tokenspace_material',
    gateway_base_url: 'https://materials.example.invalid',
    group_id: 'group-internal',
  },
})
```

Also prove TokenSpace requires an absolute HTTPS URL and non-empty group, while unknown saved provider values remain preserved during unrelated edits and are not silently converted to TokenSpace.

- [ ] **Step 5: Run the form test and verify red**

Run from `web/default`:

```powershell
bun test --run src/features/channels/lib/channel-form.test.ts
```

Expected: the TokenSpace provider fails known-provider validation or cannot be selected because only `seedance_proxy` is registered.

- [ ] **Step 6: Implement the administrator option and all eight translations**

Change the known provider list:

```ts
const ASSET_MATERIALIZATION_PROVIDERS = [
  'seedance_proxy',
  'tokenspace_material',
] as const
```

Apply the existing HTTPS/group validation to both known providers. Add this item in both the `Select.items` array and rendered `SelectItem` list:

```tsx
{
  value: 'tokenspace_material',
  label: t('TokenSpace material'),
}
```

Add `TokenSpace material` to all eight locale JSON files with real translations where the term is not a brand literal. Preserve all unrelated settings during parse/serialize.

- [ ] **Step 7: Run Task 2 verification**

Run:

```powershell
go test ./service -run 'Test(TokenSpaceMaterial.*AssetType|AssetModelTarget.*TokenSpace|AssetReference|SeedanceProxy)' -count=1 -timeout=5m
bun test --run src/features/channels/lib/channel-form.test.ts
bun run typecheck
bun run i18n:sync
```

Expected: PASS. Inspect `src/i18n/locales/_reports/*.untranslated.json` and confirm the new key is not reported.

- [ ] **Step 8: Commit Task 2 using Lore trailers**

```powershell
git add service/asset_reference.go service/asset_reference_test.go service/asset_model_target_test.go web/default/src/features/channels web/default/src/i18n/locales
git commit -m 'Make TokenSpace bindings selectable for existing assets' -m 'Enable Image and Video readiness and let administrators persist the provider, origin, and pre-created group.' -m 'Constraint: customers remain on the provider-neutral Flatkey asset contract.' -m 'Rejected: expose group selection to customers | the group is an operations resource.' -m 'Confidence: high' -m 'Scope-risk: moderate' -m 'Directive: keep Audio and unknown explicit providers fail-closed.' -m 'Tested: service readiness tests, channel form tests, typecheck, and i18n sync' -m 'Not-tested: live upstream and staging browser workflow'
```

### Task 3: Verify the integrated branch and prepare PR #753 for staging

**Files:**
- Create: `docs/superpowers/verification/2026-08-20-channel-106-tokenspace-asset-materialization.md`
- Modify: `docs/superpowers/specs/2026-08-20-channel-106-tokenspace-asset-materialization-design.md` only if implementation decisions materially differ.

**Interfaces:**
- Consumes: completed Task 1 and Task 2 commits plus the existing PR #753 materializer implementation.
- Produces: fresh automated evidence, a secret-safe operational handoff, a read-only confirmation of the pre-created AIGC group, and an updated GitHub PR.

- [ ] **Step 1: Run targeted backend regression tests**

```powershell
go test ./dto ./service ./middleware ./relay/channel/task/doubao ./relay/channel/task/techmobi ./relay/channel/task/byteplus -count=1 -timeout=10m
```

If the full service package hits its known parallel SQLite timeout without a changed-test assertion failure, rerun the exact changed test groups with `-run` and record both outputs; do not claim the full package passed.

- [ ] **Step 2: Run build and frontend verification**

```powershell
go build ./...
bun test --run src/features/channels/lib/channel-form.test.ts
bun run typecheck
bun run build
bun run i18n:sync
git diff --check origin/main...HEAD
```

Run Bun commands from `web/default`. Confirm zero new untranslated keys.

- [ ] **Step 3: Verify provider selection and mutation resistance**

Temporarily mutate one assertion-relevant production branch at a time without committing:

1. Change TokenSpace `Pending` mapping to unknown and confirm a status test fails.
2. Remove HTTP-200 `Result.Error` handling and confirm a business-error test fails.
3. Restore production code after each check and rerun the focused tests green.

This proves the tests catch the intended breaks rather than only compiling.

- [ ] **Step 4: Run impact, change-scope, and secret checks**

Run GitNexus `impact` before every changed existing symbol and `detect-changes --scope compare --base-ref origin/main --repo new-api` before the final commit. If the sibling-worktree index remains stale/incompatible, record the exact limitation and use `git diff --name-only origin/main...HEAD`, `git diff --check`, targeted tests, and `go build` as the authoritative fallback.

Search only the branch diff for secret-like values and production identifiers:

```powershell
git diff origin/main...HEAD | rg -n 'sk-|shulex123|api\.tokenspace\.net\.cn|group-[0-9]|asset-[0-9]|X-Tos-|X-Goog-'
```

Expected: no live credential, production group ID, signed URL, or created asset ID. A provider brand/key or documentation-only public API origin must be reviewed manually rather than blindly rejected.

- [ ] **Step 5: Confirm the pre-created group read-only**

Using the supplied TokenSpace API credential only from transient process input, call:

```http
POST https://api.tokenspace.net.cn/api/material?Action=ListAssetGroups
Authorization: Bearer <transient credential>
Content-Type: application/json
```

with:

```json
{
  "Filter": {"GroupType": "AIGC"},
  "PageNumber": 1,
  "PageSize": 100,
  "SortBy": "CreateTime",
  "SortOrder": "Desc",
  "ProjectName": "default"
}
```

Record only whether a suitable dedicated group exists and whether the API call succeeded. Do not record the token, group ID, response body, or upstream host in the verification document. Do not create, update, or delete a group during this task.

- [ ] **Step 6: Write verification evidence**

The report must include commands, exit codes, pass/fail counts, mutation-test evidence, the read-only group existence result, known gaps, deployment advice, and a statement that no production secret was retained. It must explicitly say production channel 106 has not been mutated yet and needs an external-production approval after the code is deployed.

- [ ] **Step 7: Commit the verification document**

```powershell
git add docs/superpowers/verification/2026-08-20-channel-106-tokenspace-asset-materialization.md docs/superpowers/specs/2026-08-20-channel-106-tokenspace-asset-materialization-design.md
git commit -m 'Record TokenSpace asset integration evidence' -m 'Capture automated, mutation, scope, and read-only group checks before staging rollout.' -m 'Constraint: no live credential or upstream identifier may enter repository artifacts.' -m 'Rejected: configure production channel 106 before deployment | external production mutation requires a separate approval.' -m 'Confidence: high' -m 'Scope-risk: narrow' -m 'Directive: stage and verify bindings before enabling the production provider setting.' -m 'Tested: commands recorded in the verification report' -m 'Not-tested: production channel activation and end-to-end generation'
```

- [ ] **Step 8: Push the existing feature branch and update PR #753**

Push `feat/channel-156-asset-materialization` to `SolveaCX/new-api`, update PR #753's description with the TokenSpace evidence and risks, wait for available checks, address actionable review comments, and merge only when required checks and the final code review are clean. Do not deploy or configure production channel 106 in this plan.

## Self-review

- Spec coverage: Task 1 covers provider registration, credential-scoped identity, Action APIs, statuses, errors, retries, secret safety, and binding reuse. Task 2 covers readiness, Image/Video-only eligibility, administrator persistence, and all eight locales. Task 3 covers regression/build verification, mutation proof, read-only group confirmation, secret scanning, and GitHub handoff.
- Placeholder scan: all function names, provider keys, prefixes, endpoints, fields, commands, and expected outcomes are explicit; no implementation placeholder remains.
- Type consistency: both tasks use the existing `assetMaterializationChannelConfig`, `AssetMaterializer`, `AssetMaterializeInput`, `AssetMaterializeResult`, and `dto.AssetMaterializationSettings` contracts without introducing a second configuration model.
- Scope check: production configuration is deliberately excluded because it is an external-production mutation requiring separate approval after deployment.
