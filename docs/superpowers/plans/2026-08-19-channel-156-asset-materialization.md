# Channel 156 Asset Materialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect channel-configured Seedance Proxy asset materialization to the existing Flatkey asset library so channel 156 can consume `asset://ast_...` references without exposing upstream groups or IDs.

**Architecture:** Add an admin-only `asset_materialization` object to `ChannelOtherSettings`, resolve materializers from the complete channel with explicit-provider precedence and legacy type fallback, and implement a small HTTPS Gateway client for create/status operations. Reuse the existing asset binding leases, GCS signed-source callback, readiness worker, and rewrite map; generalize only the lookup/scope seams needed to keep provider identity independent from channel type.

**Tech Stack:** Go, GORM, `common.Marshal`/`common.Unmarshal`, `httptest`, React/TypeScript, Zod, React Hook Form, Vitest.

---

### Task 1: Add channel capability settings and channel-aware materializer resolution

**Files:**
- Modify: `dto/channel_settings.go`
- Test: `dto/channel_settings_test.go`
- Modify: `service/asset_binding.go`
- Modify: `service/asset_model_target.go`
- Modify: `service/asset_model_worker.go`
- Test: `service/asset_binding_test.go`
- Test: `service/asset_model_target_test.go`

- [ ] **Step 1: Write failing settings and resolver tests**

Add tests that unmarshal a nested `asset_materialization` object with `common.Unmarshal`, reject non-HTTPS or incomplete Seedance Proxy settings, select an explicit provider even when the channel type has no legacy registration, fail closed for an unknown explicit provider, and retain BytePlus/TechMobi fallback when the provider is empty. Add a scope test showing the Seedance scope changes for a different key/group/gateway but not for a model-name or channel-type-only change.

- [ ] **Step 2: Run the focused tests and verify the expected red failures**

Run:

```powershell
go test ./dto ./service -run 'Test(ChannelOtherSettings|AssetMaterializer|AssetBindingScope|AssetModelTarget)' -count=1
```

Expected: failures mention the missing nested setting type, channel-aware resolver, or provider scope behavior; no production implementation is present yet.

- [ ] **Step 3: Implement the minimal settings and resolver seams**

Define:

```go
type AssetMaterializationSettings struct {
    Provider       string `json:"provider,omitempty"`
    GatewayBaseURL string `json:"gateway_base_url,omitempty"`
    GroupID        string `json:"group_id,omitempty"`
}
```

Add `AssetMaterialization AssetMaterializationSettings` to `dto.ChannelOtherSettings`. Implement one resolver that accepts `*model.Channel`, reads `channel.GetOtherSettings()`, returns the explicit provider materializer after validating HTTPS URL/group, and otherwise falls back to the existing type registry. Register legacy materializers in the fallback registry and Seedance Proxy by provider key. Replace every direct `assetMaterializerForChannel(channel.Type)` and `assetBindingScope(channel.Type, ...)` call in the binding, target, and worker paths with the channel-aware resolver/scope helper. Use a normalized URL origin plus group ID plus API-key digest for `seedance-proxy:v1:<sha256(...)>`; never persist or log the key.

- [ ] **Step 4: Run the focused tests and regression tests**

Run:

```powershell
go test ./dto ./service -run 'Test(ChannelOtherSettings|AssetMaterializer|AssetBindingScope|AssetModelTarget|AssetModelWorker)' -count=1
```

Expected: PASS, including existing BytePlus/TechMobi tests.

- [ ] **Step 5: Commit the resolver/settings slice**

```powershell
git add dto service
git commit -m 'Select asset materializers from channel capabilities' -m 'Keep legacy type fallback while making provider configuration and binding scopes channel-aware.' -m 'Constraint: no channel ID or secret may determine provider identity.' -m 'Rejected: a second binding table | existing leases and uniqueness already provide the coordination boundary.' -m 'Confidence: medium' -m 'Scope-risk: broad' -m 'Directive: preserve explicit-provider fail-closed behavior.' -m 'Tested: focused dto and service Go tests' -m 'Not-tested: Gateway HTTP client and UI'
```

### Task 2: Implement the Seedance Proxy asset Gateway client and materializer

**Files:**
- Create: `service/seedance_proxy_asset.go`
- Create: `service/seedance_proxy_asset_test.go`
- Modify: `service/asset_binding.go` (provider-local empty-status handling only if needed)

- [ ] **Step 1: Write failing HTTP contract tests**

Use an `httptest.Server` and a test channel whose `OtherSettings.AssetMaterialization` contains the server URL and group. Assert `POST /api/seedance/proxy/assets` sends JSON `GroupId`, signed HTTPS `URL`, `AssetType`, and opaque `Name`, uses `Authorization: Bearer <channel key>`, and does not send Audio. Assert `GET /api/seedance/proxy/assets/<id>` maps `Processing`, `Active`, and `Failed`; bounded malformed/oversized bodies and 429/5xx/timeout errors map to the existing materialization error taxonomy and bounded `Retry-After`.

- [ ] **Step 2: Run the provider tests to verify red**

```powershell
go test ./service -run 'TestSeedanceProxyAsset' -count=1
```

Expected: compilation or assertion failures because the provider client does not exist.

- [ ] **Step 3: Implement the minimal client/materializer**

Validate absolute HTTPS gateway URLs without userinfo/query/fragment, trim one trailing slash, limit response bodies, and construct only the two documented paths. Call `input.SignSource` for a short-lived GCS URL and keep it in memory. Normalize only Image/Video, return a definitive unsupported-media error for Audio, map empty create status to provider-local `Processing`, and retain the upstream ID/group in `AssetMaterializeResult`. Do not implement group CRUD or expose upstream values in returned API errors.

- [ ] **Step 4: Run provider and binding recovery tests**

```powershell
go test ./service -run 'TestSeedanceProxyAsset|Test(AssetBinding|AssetModelWorker)' -count=1
```

Expected: PASS; a create response with an empty status is persisted as `Processing` and later status polling reuses the same upstream ID without a second create.

- [ ] **Step 5: Commit the provider slice**

```powershell
git add service
git commit -m 'Materialize assets through the Seedance Proxy gateway' -m 'Upload signed GCS sources into the configured shared group and poll the returned asset ID.' -m 'Constraint: only Image and Video are supported and upstream group management stays internal.' -m 'Rejected: direct signed-URL video submission | the upstream contract requires an active asset ID.' -m 'Confidence: medium' -m 'Scope-risk: moderate' -m 'Directive: keep response bodies and credentials out of logs.' -m 'Tested: httptest provider and binding recovery tests' -m 'Not-tested: distributor and adaptor integration'
```

### Task 3: Generalize readiness/rewrite selection and rewrite Doubao media references

**Files:**
- Modify: `service/asset_reference.go`
- Modify: `middleware/distributor.go`
- Modify: `relay/channel/task/doubao/adaptor.go`
- Test: `service/asset_reference_test.go`
- Test: `middleware/distributor_byteplus_asset_test.go`
- Test: `relay/channel/task/doubao/adaptor_test.go`

- [ ] **Step 1: Write failing integration tests**

Add a channel with an explicit Seedance Proxy provider and verify a recoverable Flatkey Image/Video asset is eligible, materializes under the configured scope, and produces a complete rewrite map while Audio remains ineligible. Add adaptor tests for exact `asset://ast_...` replacement in image/video fields, multiple content items, ordinary HTTPS pass-through, malformed/missing-map rejection, and no accidental replacement of text or unrelated strings. Add a regression test proving legacy BytePlus, TechMobi, and source-URL channels retain their current behavior.

- [ ] **Step 2: Run the integration tests to verify red**

```powershell
go test ./service ./middleware ./relay/channel/task/doubao -run 'Test(SeedanceProxy|AssetReference|Doubao.*Asset)' -count=1
```

Expected: channel eligibility or adaptor assertions fail because lookup and rewrite selection still branch on TechMobi/BytePlus type.

- [ ] **Step 3: Implement channel-aware readiness and rewrite selection**

Use the same resolver/scope helper in `AssetReferenceSet` readiness, selected-key scope lookup, target options, and middleware refresh. Keep source-URL handling separate. Make the selected channel’s generalized rewrite map available under the existing asset rewrite context key, then update the Doubao adaptor’s pure body builder to replace only exact media URL values with the map values before marshaling. Preserve ordinary URLs and keep the existing BytePlus lease extension path untouched for its legacy map.

- [ ] **Step 4: Run focused integration and regression tests**

```powershell
go test ./service ./middleware ./relay/channel/task/doubao -run 'Test(SeedanceProxy|AssetReference|Doubao.*Asset|TechMobi|BytePlus)' -count=1
```

Expected: PASS with no customer-visible upstream ID/group/host in errors or response bodies.

- [ ] **Step 5: Commit the flow slice**

```powershell
git add service middleware relay/channel/task/doubao
git commit -m 'Rewrite Flatkey asset references for configured channels' -m 'Carry the existing private binding map into channel 156 video requests while preserving legacy paths.' -m 'Constraint: rewrite only exact media URI values after an Active binding exists.' -m 'Rejected: expose upstream asset IDs to clients | breaks the provider-neutral asset contract.' -m 'Confidence: medium' -m 'Scope-risk: broad' -m 'Directive: keep source URL and legacy BytePlus compatibility paths intact.' -m 'Tested: service middleware and Doubao adaptor tests' -m 'Not-tested: administrator form'
```

### Task 4: Add administrator-only channel form fields and round-trip tests

**Files:**
- Modify: `web/default/src/features/channels/types.ts`
- Modify: `web/default/src/features/channels/lib/channel-form.ts`
- Test: `web/default/src/features/channels/lib/channel-form.test.ts`
- Modify: `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx`
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`
- Modify: `web/default/src/i18n/locales/es.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/pt.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/vi.json`

- [ ] **Step 1: Write failing form tests**

Add round-trip tests that parse existing `settings` JSON, preserve unrelated keys, serialize `asset_materialization` only when provider is selected, require an HTTPS URL and non-empty group for `seedance_proxy`, and clear the nested object when the provider is emptied. Assert the fields are absent from customer-facing asset/video types.

- [ ] **Step 2: Run the form tests to verify red**

```powershell
pnpm --dir web/default test --run src/features/channels/lib/channel-form.test.ts
```

Expected: type/schema/serialization assertions fail because the fields and validation are absent.

- [ ] **Step 3: Implement the admin form slice**

Add typed fields with defaults, parse/merge the nested object without dropping unrelated `settings`, validate absolute HTTPS URLs and group IDs in Zod, and render the section inside the existing administrator channel drawer. Do not add controls to customer asset pages or public request schemas. Add the same labels/descriptions to all eight locale JSON files.

- [ ] **Step 4: Run frontend tests and typecheck**

```powershell
pnpm --dir web/default test --run src/features/channels/lib/channel-form.test.ts
pnpm --dir web/default typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit the admin UI slice**

```powershell
git add web/default/src/features/channels web/default/src/i18n/locales
git commit -m 'Expose channel asset gateway settings to administrators' -m 'Round-trip the internal provider, gateway, and shared group fields without changing customer asset APIs.' -m 'Constraint: upstream groups remain an operations-only configuration detail.' -m 'Rejected: customer-facing group selector | violates the shared-group contract.' -m 'Confidence: high' -m 'Scope-risk: moderate' -m 'Directive: preserve unrelated channel settings during edits.' -m 'Tested: channel form tests and frontend typecheck' -m 'Not-tested: production browser workflow'
```

### Task 5: Full verification and handoff evidence

**Files:**
- Modify: `docs/superpowers/specs/2026-08-18-channel-156-asset-materialization-design.md` only if implementation decisions materially differ.
- Create: `docs/superpowers/verification/2026-08-19-channel-156-asset-materialization.md`

- [ ] **Step 1: Run targeted Go and frontend verification**

```powershell
go test ./dto ./service ./middleware ./relay/channel/task/doubao -count=1
pnpm --dir web/default test --run src/features/channels/lib/channel-form.test.ts
pnpm --dir web/default typecheck
git diff --check
```

- [ ] **Step 2: Run repository impact checks**

Run GitNexus `impact` for the resolver, materializer, middleware refresh, and Doubao body builder symbols. Run `detect_changes()` against `origin/main`; record the known stale-index/path limitation if it recurs and use `git diff --name-only origin/main...HEAD` as the authoritative scope check.

- [ ] **Step 3: Write evidence and inspect secrets**

Record test commands/results, changed files, and known gaps. Run a bounded search over the diff for `sk-`, signed URL query parameters, gateway credentials, upstream group IDs, or upstream asset IDs; ensure no user-provided key appears in source, tests, commits, logs, or the report.

- [ ] **Step 4: Commit verification evidence**

```powershell
git add docs/superpowers/verification/2026-08-19-channel-156-asset-materialization.md
git commit -m 'Document channel 156 asset integration verification' -m 'Capture targeted test evidence and scope checks before staging configuration.' -m 'Constraint: the external key is not retained in repository artifacts.' -m 'Rejected: claiming live staging success without configured gateway access.' -m 'Confidence: high' -m 'Scope-risk: narrow' -m 'Directive: configure the pre-created group only after staging promotion.' -m 'Tested: recorded targeted Go/frontend checks' -m 'Not-tested: live staging acceptance until credentials are rotated and configured'
```

## Self-review

- Spec coverage: Tasks 1–3 cover provider settings, explicit resolution, binding scope, GCS signing, status polling, retries, readiness, and Doubao rewriting; Task 4 covers the admin-only surface; Task 5 covers verification and secret hygiene.
- Placeholder scan: no implementation step is left as TBD; each code slice names exact files, behavior, and commands.
- Type consistency: all tasks use `AssetMaterializationSettings`, `AssetMaterializeOptions`, the existing `AssetMaterializer` interface, and the existing `asset_rewrite_map` context key consistently.
