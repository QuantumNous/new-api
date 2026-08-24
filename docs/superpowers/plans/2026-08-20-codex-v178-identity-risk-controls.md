# Codex v0.1.178 Identity Risk Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the verified Sub2 v0.1.178 Codex subscription identity controls into Flatkey, default new Codex channels to `full`, and close the confirmed metadata, header, replica, and database-clone identity leaks.

**Architecture:** Keep the existing channel-level `off/device/session/full` contract, but move identity ownership to a hidden per-channel seed plus a deployment namespace. Resolve one canonical Codex client identity for inference and credential paths, finalize every outbound request after channel overrides, and persist the last valid official stable client version through the existing option store. All changes are additive and compatible with SQLite, MySQL, and PostgreSQL.

**Tech Stack:** Go, Gin, GORM, SQLite/MySQL/PostgreSQL, `github.com/google/uuid`, React/TypeScript, TanStack Form/Query, Bun/Vitest, existing Flatkey option/cache/task infrastructure.

## Global Constraints

- Copy only Sub2 v0.1.178 identity behavior from commits `6793d5ac8`, `bb6c3b4f6`, and `a34123959`; do not add account pools, account scheduling, weights, sticky routing, concurrency slots, 429/529 failover, quota auto-pause, WebSocket prewarming, model governance, inbound-client gates, refresh-lock redesign, Claude identity, or TLS fingerprinting.
- New Codex channels default to `full`; existing channels keep their explicit stored mode, and existing missing/invalid modes remain `off`.
- The seed is system-owned, stored in `channels.codex_fingerprint_seed`, excluded from JSON and logs, preserved across edit/refresh/disable/re-enable, regenerated on channel copy, and never created for non-Codex channels.
- Stable identifiers depend on the channel seed and `CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE`, never downstream `UserId`, `TokenId`, access tokens, refresh tokens, or client/admin supplied `openai_device_id`.
- All replicas in one deployment use the same namespace; independent production/staging/cloned deployments use different namespaces. Production `full` requests fail before upstream when it is absent; local/test use the explicit value `local`.
- `full` mode rebuilds supported `client_metadata`, drops unknown/environment/tool/trace fields, rejects invalid or unsafe metadata before upstream, and applies the same identity policy to typed, raw, passthrough, compact, and image paths without injecting unsupported body fields.
- Final request identity normalization runs after channel header overrides. Cookie, trace, locale, timeout, opaque beta, turn-state, attestation, and unknown `x-codex-*` values are not forwarded, while unrelated server-owned transport headers are preserved.
- Keep Flatkey's existing exact Codex route switch; add regression coverage but no second endpoint/request-class routing layer.
- Add log/error redaction only where a marker test proves a leak. Do not introduce a speculative global sanitizer.
- From the `forever94yu/sub2api` fork, copy only the new-create `full` default. Do not copy deterministic full-mode turn/time values, unconditional cache-key rewrites, or legacy edit defaulting.
- Canonical version precedence is manual admin version, then last synced stable official version, then the built-in fallback; versions below `0.144.0`, prereleases, invalid shapes, control characters, and oversized values are rejected.
- Inference sends canonical `User-Agent`, `originator`, and `version`; OAuth credential-face requests omit `version`; model-manifest `client_version` keeps its caller contract while its `Version` header validates or falls back.
- Official version synchronization runs every six hours on the master/console lane, persists only newer stable official versions, and preserves the last valid value on lookup failure.
- Use existing helpers and dependencies; add no new dependency. Use `common.Marshal`/`common.Unmarshal` rather than direct `encoding/json` calls where project conventions require them.
- All new console copy must exist in every locale under `web/default/src/i18n/locales`.
- Router and console deployment are required; public website deployment is not required.

---

### Task 1: Persist and Manage the System-Owned Channel Seed

**Files:**
- Modify: `model/channel.go`
- Modify: `model/main.go`
- Modify: `controller/channel.go`
- Modify: `relay/common/relay_info.go`
- Modify: `middleware/distributor.go`
- Create: `model/channel_codex_fingerprint_seed_test.go`
- Create: `controller/channel_codex_fingerprint_seed_test.go`

**Interfaces:**
- Produces: `Channel.CodexFingerprintSeed string` with `json:"-" gorm:"type:varchar(36);default:''"`.
- Produces: `model.EnsureCodexFingerprintSeed(channelID int) (string, error)` for eager initialization and guarded legacy repair.
- Produces: `model.BackfillCodexFingerprintSeeds() error` using database-portable compare-and-set updates.
- Produces: `RelayInfo.ChannelMeta.CodexFingerprintSeed string` for trusted in-process relay use only.

- [ ] **Step 1: Write the failing model lifecycle tests**

```go
func TestEnsureCodexFingerprintSeedCreatePreserveAndRepair(t *testing.T) {
    // Create one enabled Codex channel without a seed, call Ensure twice,
    // assert the first result is a non-nil UUID, the second is identical,
    // and replacing the stored value with invalid text repairs it once.
}

func TestEnsureCodexFingerprintSeedConcurrentCompareAndSet(t *testing.T) {
    // Run concurrent Ensure calls against the same channel and assert every
    // caller observes the one persisted UUID. Run with SQLite in the test and
    // keep the update SQL free of dialect-specific functions.
}

func TestNonCodexAndOffChannelsDoNotMintSeed(t *testing.T) {
    // A non-Codex channel and an off Codex channel retain an empty column.
}
```

- [ ] **Step 2: Run the seed tests and verify RED**

Run: `go test ./model -run 'Test(EnsureCodexFingerprintSeed|NonCodexAndOff)' -count=1`

Expected: FAIL because the column and resolver do not exist.

- [ ] **Step 3: Add the hidden column and portable seed resolver**

```go
type Channel struct {
    // existing fields
    CodexFingerprintSeed string `json:"-" gorm:"type:varchar(36);default:''"`
}

func EnsureCodexFingerprintSeed(channelID int) (string, error) {
    // Read type/mode/seed, return a valid existing UUID, otherwise generate
    // uuid.NewString(), then UPDATE ... WHERE id = ? AND
    // (codex_fingerprint_seed = '' OR codex_fingerprint_seed = invalidValue).
    // Re-read after a lost compare-and-set race.
}
```

Add the field to the existing `Channel` AutoMigrate path. Call the idempotent backfill from the existing database initialization flow after migration, and publish channel-cache invalidation only when a seed is actually persisted.

- [ ] **Step 4: Write the failing controller lifecycle and leakage tests**

```go
func TestCodexSeedLifecycleThroughCreateUpdateCopy(t *testing.T) {
    // Enabled create mints; credential/mode edits preserve; off then on
    // preserves; CopyChannel creates a different seed.
}

func TestCodexSeedCannotBeSuppliedOrSerialized(t *testing.T) {
    // Send codex_fingerprint_seed in JSON, assert it is ignored, and marshal
    // the stored channel to assert the seed string is absent.
}
```

- [ ] **Step 5: Run the controller tests and verify RED**

Run: `go test ./controller -run 'TestCodexSeed' -count=1`

Expected: FAIL because create/update/copy do not own the seed lifecycle.

- [ ] **Step 6: Wire lifecycle and relay cache propagation**

Create or enable an eligible Codex channel with `EnsureCodexFingerprintSeed`; preserve the column on generic channel updates and OAuth credential refreshes; clear it before saving a copied channel so the copy mints a fresh value. Populate `ChannelMeta.CodexFingerprintSeed` only from the database/cache model, never request JSON.

- [ ] **Step 7: Run targeted tests and commit**

Run: `go test ./model ./controller ./middleware -run 'Codex.*Seed|FingerprintSeed' -count=1`

Commit:

```text
Own Codex convergence identity at the upstream channel

Constraint: Seed lifecycle must work on SQLite, MySQL, and PostgreSQL.
Rejected: Downstream user/token-derived seeds | They split one subscription into multiple upstream devices.
Confidence: high
Scope-risk: moderate
Directive: Never expose codex_fingerprint_seed through API DTOs, settings JSON, or logs.
Tested: Targeted model, controller, and middleware seed lifecycle tests.
```

### Task 2: Derive Coherent IDs and Rebuild Full-Mode Metadata

**Files:**
- Modify: `relay/channel/codex/fingerprint.go`
- Modify: `relay/channel/codex/fingerprint_test.go`
- Modify: `relay/channel/codex/adaptor.go`
- Create: `relay/channel/codex/fingerprint_hardening_test.go`
- Modify: `relay/channel/codex/oauth_key.go`

**Interfaces:**
- Consumes: `RelayInfo.ChannelMeta.CodexFingerprintSeed` from Task 1.
- Produces: `ResolveCodexFingerprint(info *RelayInfo, originalSession string, now time.Time) (*CodexFingerprint, error)`.
- Produces: `SanitizeCodexRequestBody(raw []byte, fingerprint *CodexFingerprint, mode string) ([]byte, error)`.

- [ ] **Step 1: Replace the old seed and UUID expectations with failing tests**

```go
func TestFingerprintIgnoresDownstreamUserAndToken(t *testing.T) {
    // Same channel seed + namespace, different UserId/TokenId => identical
    // installation/session/window/thread IDs.
}

func TestFingerprintNamespaceSeparatesDatabaseClones(t *testing.T) {
    // Same database seed under namespace prod-a vs prod-b => different stable IDs.
}

func TestFingerprintTurnUsesUUIDv7AndOneTimestamp(t *testing.T) {
    // uuid.Parse(turnID).Version() == 7 and header/body timestamps equal now.UnixMilli().
}
```

- [ ] **Step 2: Run the identity tests and verify RED**

Run: `$env:CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE='local'; go test ./relay/channel/codex -run 'TestFingerprint(Ignores|Namespace|Turn)' -count=1`

Expected: FAIL because the existing derivation includes user/token IDs and creates UUIDv4 turns.

- [ ] **Step 3: Implement seed plus namespace derivation**

```go
type CodexFingerprint struct {
    InstallationID string
    SessionID      string
    ThreadID       string
    TurnID         string
    WindowID       string
    StartedAtMS    int64
}

func stableCodexID(seed, deploymentNamespace, label string) string {
    // Derive a UUIDv4-shaped value from a cryptographic digest of fixed
    // Flatkey namespace + deployment namespace + random channel seed + label.
}
```

Use `uuid.NewV7()` for the turn ID and capture `now.UnixMilli()` once. `full` keeps `thread_id == session_id`; `session` derives thread identity from the original client session. Return a pre-send error for missing/invalid seed and for missing production namespace in `full` mode.

- [ ] **Step 4: Write failing metadata, prompt-cache, OAuth-key, and raw/typed parity tests**

```go
func TestFullMetadataDropsKnownAndUnknownOriginalFields(t *testing.T) {
    // Input contains cwd, workspace, git, os, arch, terminal, plugin, skill,
    // mcp, trace, and mystery. Output contains only trusted converged fields.
}

func TestPromptCacheKeyOnlyRewritesSessionDefault(t *testing.T) {
    // prompt_cache_key == original metadata.session_id is rewritten;
    // a custom cache key is preserved.
}

func TestInvalidFullMetadataFailsClosed(t *testing.T) {
    // Malformed JSON, scalar metadata, excessive nesting/size => error and no bytes to send.
}

func TestOAuthKeyIgnoresOpenAIDeviceID(t *testing.T) {
    // An openai_device_id property in stored/admin JSON does not influence output IDs.
}
```

- [ ] **Step 5: Run the hardening tests and verify RED**

Run: `$env:CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE='local'; go test ./relay/channel/codex -run 'Test(FullMetadata|PromptCache|InvalidFull|OAuthKey)' -count=1`

Expected: FAIL because full mode currently preserves original metadata fields and unsafe fallback paths.

- [ ] **Step 6: Rebuild metadata and align supported typed/raw/compact/image semantics**

Decode with `common.Unmarshal`, enforce a bounded object shape, capture the original `client_metadata.session_id`, replace the entire metadata object with trusted IDs, and guardedly rewrite the root cache key only when it equals that captured original session. The raw and typed converters must call the same sanitizer. Compact and image requests must no longer skip staged header identity, but do not inject body fields those endpoints do not already support. Clear staged identity before every retry-channel resolution.

- [ ] **Step 7: Prove whether existing log/error paths leak request identity**

Place unique markers in metadata, access/refresh token fixtures, and seed fixtures, then capture the existing relay log/error outputs. If a marker is observed, add the smallest call-site redaction and retain the failing-then-passing regression test. If no marker is observed, record the negative evidence in the task report and make no production logging change.

- [ ] **Step 8: Run targeted tests and commit**

Run: `$env:CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE='local'; go test ./relay/channel/codex -count=1`

Commit with the Lore intent `Make Codex request identity internally self-consistent` and trailers covering namespace, UUIDv7, fail-closed metadata, and the exact test command.

### Task 3: Finalize Every Outbound Request After Header Overrides

**Files:**
- Modify: `relay/channel/adapter.go`
- Modify: `relay/channel/api_request.go`
- Modify: `relay/channel/api_request_test.go`
- Modify: `relay/channel/codex/adaptor.go`
- Create: `relay/channel/codex/request_policy.go`
- Create: `relay/channel/codex/request_policy_test.go`
- Modify: `relay/relay_handler.go`
- Modify: `relay/responses_handler.go`
- Modify: `relay/image_handler.go`

**Interfaces:**
- Produces: optional adapter interface `FinalizeRequest(c *gin.Context, req *http.Request, info *RelayInfo) error` called after `processHeaderOverride`.
- Produces: `FinalizeCodexRequest(req *http.Request, info *RelayInfo) error` for relay requests already classified by the existing adaptor mode/path switch.

- [ ] **Step 1: Write failing finalization-order and allowlist tests**

```go
func TestFinalizeRequestRunsAfterHeaderOverride(t *testing.T) {
    // Override UA/version/originator/Cookie/x-codex-attestation; final request
    // contains the trusted identity and none of the disallowed headers.
}

func TestCodexHeaderAllowlistDropsIdentitySideChannels(t *testing.T) {
    // Drop Cookie, traceparent, tracestate, baggage, locale, timeout,
    // opaque beta values, turn-state, attestation, and unknown x-codex-*.
}

func TestExistingCodexRouteSwitchRejectsSuffixSmuggling(t *testing.T) {
    // Existing adaptor URL resolution accepts known modes only and never
    // appends caller-controlled response/compact path suffixes.
}
```

- [ ] **Step 2: Run policy tests and verify RED**

Run: `$env:CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE='local'; go test ./relay/channel/... ./relay -run 'Test(FinalizeRequest|CodexHeader|CodexEndpoint)' -count=1`

Expected: finalization-order and header-policy tests FAIL because overrides currently run last. The existing route-switch regression should already PASS.

- [ ] **Step 3: Add the post-override finalizer hook**

```go
type RequestFinalizer interface {
    FinalizeRequest(c *gin.Context, req *http.Request, info *common.RelayInfo) error
}

// In every request builder:
applyHeaderOverrideToRequest(req, headerOverride)
if finalizer, ok := adaptor.(RequestFinalizer); ok {
    if err := finalizer.FinalizeRequest(c, req, info); err != nil { return nil, err }
}
```

Apply it to normal, stream, raw/passthrough, compact, image, and retry request construction. Do not duplicate finalization in individual handlers when the shared builder covers the path.

- [ ] **Step 4: Implement the post-override header policy**

Delete the known client-origin identity side-channel headers, preserve unrelated server-owned transport headers, then restore server-trusted authorization/account, media/accept, required beta, canonical identity, and staged fingerprint headers. Reuse the existing adaptor relay mode and exact URL switch; do not add a parallel request-class/path router.

- [ ] **Step 5: Add cross-path integration tests**

```go
func TestCodexPolicyCoversTypedRawCompactImageAndPassthrough(t *testing.T) {
    // Table-test request builders; each receives canonical headers and cannot
    // forward the marker values placed in disallowed headers/metadata.
}

func TestRetryClearsPriorChannelFingerprint(t *testing.T) {
    // Stage channel A, retry on B, assert no A installation/session/turn value remains.
}
```

- [ ] **Step 6: Run request-policy suites and commit**

Run: `$env:CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE='local'; go test ./relay/channel/... ./relay -run 'Codex|Finalize|Fingerprint' -count=1`

Commit with the Lore intent `Close Codex identity side channels at the final egress boundary` and trailers documenting post-override enforcement and preservation of the existing exact path switch.

### Task 4: Resolve One Canonical Codex Client Identity

**Files:**
- Create: `service/codex_identity.go`
- Create: `service/codex_identity_test.go`
- Modify: `relay/channel/codex/adaptor.go`
- Modify: `service/codex_oauth.go`
- Modify: `service/codex_credential_refresh.go`
- Modify: `service/codex_models.go`
- Modify: `service/codex_wham_usage.go`
- Modify: `service/codex_reset_credit.go`
- Modify: Codex admin channel-test/probe call sites found with `rg -n 'codex|chatgpt.com|auth.openai.com' controller service relay --glob '*.go'`

**Interfaces:**
- Produces: `type CodexClientIdentity struct { UserAgent, Originator, Version string }`.
- Produces: `ResolveCodexClientIdentity() CodexClientIdentity`.
- Produces: `ApplyCodexInferenceIdentity(http.Header, CodexClientIdentity)`.
- Produces: `ApplyCodexCredentialIdentity(http.Header, CodexClientIdentity)`.
- Produces: `NormalizeCodexClientVersion(string) (string, bool)` with floor `0.144.0`.

- [ ] **Step 1: Write failing normalization and precedence tests**

```go
func TestCodexVersionPrecedenceAndFloor(t *testing.T) {
    // manual > synced > fallback; 0.143.9, prerelease, control chars, and
    // oversized values fall back; 0.144.0 and newer stable versions pass.
}

func TestCodexUserAgentVersionIsRebuilt(t *testing.T) {
    // A configured official-family UA keeps safe suffixes but replaces its
    // embedded version with the effective version; incompatible UA falls back
    // to the canonical Codex TUI identity and paired originator.
}
```

- [ ] **Step 2: Run identity tests and verify RED**

Run: `go test ./service -run 'TestCodex(Version|UserAgent)' -count=1`

Expected: FAIL because no shared resolver exists.

- [ ] **Step 3: Implement the canonical resolver and emergency toggle**

Use option keys `CodexClientUserAgent`, `CodexClientVersion`, `CodexSyncedClientVersion`, `CodexSyncedClientVersionAt`, `CodexAutoSyncClientVersion`, and `CodexEnforceClientIdentity`. Defaults: auto-sync `true`, enforcement `true`, built-in version at least `0.144.0`. Preserve the existing behavior only when the enforcement toggle is false.

- [ ] **Step 4: Write failing request-shape tests**

```go
func TestInferenceIdentityIncludesVersion(t *testing.T) {}
func TestCredentialIdentityOmitsVersion(t *testing.T) {}
func TestModelsHeaderUsesValidCallerOrCanonicalFallback(t *testing.T) {}
func TestUsageResetAndProbeUseCanonicalIdentity(t *testing.T) {}
```

Each test uses `httptest.Server` to capture outbound headers and asserts that a marker override cannot produce a half-matched UA/originator/version tuple.

- [ ] **Step 5: Run request-shape tests and verify RED**

Run: `go test ./service ./relay/channel/codex ./controller -run 'Test(Inference|Credential|Models|UsageReset).*Identity|CanonicalIdentity' -count=1`

Expected: FAIL because the call sites use independent hard-coded or missing identity headers.

- [ ] **Step 6: Adopt the resolver across inference and credential paths**

Inference applies all three fields after overrides. OAuth exchange/refresh applies only UA plus originator. Models retains the caller's `client_version` query but validates the `Version` header. Usage, reset-credit, and admin probes reuse the resolver. Remove superseded hard-coded Codex UA/version constants only after all references migrate.

- [ ] **Step 7: Run targeted tests and commit**

Run: `go test ./service ./relay/channel/codex ./controller -run 'Codex|Identity|OAuth|Models|Usage|Reset' -count=1`

Commit with the Lore intent `Present one coherent Codex client identity on every subscription path` and trailers documenting the floor and credential-face omission.

### Task 5: Persist and Synchronize the Latest Stable Official Version

**Files:**
- Modify: `service/codex_models.go`
- Create: `service/codex_version_sync.go`
- Create: `service/codex_version_sync_test.go`
- Modify: `model/option.go`
- Modify: `setting/operation_setting/operation_setting.go` or the existing nearest Codex/global option module
- Modify: `main.go`

**Interfaces:**
- Produces: `SyncLatestStableCodexVersion(ctx context.Context) error`.
- Produces: `StartCodexVersionSyncTask()` with a six-hour ticker and immediate safe refresh.
- Consumes: existing master/console predicate used by `StartCodexCredentialAutoRefreshTask`.

- [ ] **Step 1: Write failing stable-release and stale-on-error tests**

```go
func TestSyncCodexVersionAcceptsOnlyNewerStableOfficialRelease(t *testing.T) {
    // Valid rust-v0.200.0 persists; draft/prerelease/invalid/older releases do not.
}

func TestSyncCodexVersionPreservesStoredValueOnFailure(t *testing.T) {
    // HTTP error, malformed JSON, or invalid tag leaves the prior option intact.
}

func TestManualCodexVersionStillWinsAfterSync(t *testing.T) {
    // Persist a newer sync while manual is set; effective resolver returns manual.
}
```

- [ ] **Step 2: Run sync tests and verify RED**

Run: `go test ./service -run 'TestSyncCodex|TestManualCodex' -count=1`

Expected: FAIL because the current lookup is in-memory and accepts the release display name without persisted stable validation.

- [ ] **Step 3: Reuse and harden the existing official release lookup**

Parse official GitHub release metadata, require non-draft/non-prerelease stable `rust-vX.Y.Z` or normalized equivalent, compare semantic versions, and update the two persisted option values only after complete validation. A failed sync logs source/status only and never credentials or seed values.

- [ ] **Step 4: Add the master-only six-hour task**

```go
func StartCodexVersionSyncTask() {
    if !isMasterOrConsoleTaskLane() { return }
    // run immediate guarded sync, then ticker := time.NewTicker(6 * time.Hour)
}
```

Start it beside the credential refresh task in `main.go`. Honor `CodexAutoSyncClientVersion=false`. Use existing option cache invalidation so router replicas observe persisted updates.

- [ ] **Step 5: Run task/option tests and commit**

Run: `go test ./service ./model ./setting/... -run 'Codex.*Version|Option' -count=1`

Commit with the Lore intent `Keep Codex outbound identity on a persisted stable client version` and trailers documenting master-only execution and stale-on-error behavior.

### Task 6: Default New Codex Channels to Full and Add Admin Controls

**Files:**
- Modify: `controller/channel.go`
- Modify: `web/default/src/features/channels/lib/channel-form.ts`
- Modify: `web/default/src/features/channels/lib/channel-form.test.ts`
- Modify: `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx`
- Create: `web/default/src/features/system-settings/integrations/codex-identity-settings-section.tsx`
- Modify: `web/default/src/features/system-settings/integrations/section-registry.tsx`
- Modify: `web/default/src/features/system-settings/types.ts`
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/es.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/pt.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/vi.json`
- Modify: `web/default/src/i18n/locales/zh.json`

**Interfaces:**
- Consumes: option keys and defaults from Task 4/5.
- Produces: server-enforced new-Codex default `codex_fingerprint_mode=full`.
- Produces: an authenticated console settings card for UA, manual version, auto-sync, read-only synced version/time, and enforcement toggle.

- [ ] **Step 1: Write failing backend and form-default tests**

```go
func TestAddCodexChannelDefaultsFingerprintModeToFull(t *testing.T) {
    // Omitted mode on new Codex create persists full; an explicit supported
    // value is honored; non-Codex channels are unchanged.
}
```

```ts
it('defaults a new Codex channel to full but preserves existing missing/off mode', () => {
  expect(buildNewChannelValues(CODEX).codex_fingerprint_mode).toBe('full')
  expect(buildEditChannelValues({ type: CODEX }).codex_fingerprint_mode).toBe('off')
})
```

- [ ] **Step 2: Run default tests and verify RED**

Run: `go test ./controller -run 'TestAddCodexChannelDefaults' -count=1`

Run: `cd web/default; bun test src/features/channels/lib/channel-form.test.ts`

Expected: FAIL because the current new-channel default is `off`.

- [ ] **Step 3: Implement backend and frontend new-channel defaulting**

Apply `full` only on create when the channel type is Codex and the mode was omitted. Do not retrofit existing records and do not use the frontend default as the security boundary. Ensure serialization persists `full` instead of dropping it as if it were `off`.

- [ ] **Step 4: Write the settings-card tests**

```ts
it('saves editable Codex identity options and renders synced fields read-only', async () => {
  // Render with option fixtures, update UA/manual/toggles, assert option API
  // payloads, and assert synced version/time controls cannot be edited.
})
```

- [ ] **Step 5: Implement the settings card and all locale keys**

Use the existing `useSystemOptions` and `useUpdateOption` hooks. Explain the `0.144.0` floor, the six-hour sync, the enforcement kill switch, and the required deployment namespace without ever displaying a channel seed.

- [ ] **Step 6: Run UI, i18n, and backend tests and commit**

Run: `go test ./controller -run 'Codex.*Fingerprint|AddCodex' -count=1`

Run: `cd web/default; bun test src/features/channels/lib/channel-form.test.ts src/features/system-settings/integrations/codex-identity-settings-section.test.tsx src/i18n/config.test.ts`

Run: `cd web/default; bun run lint`

Commit with the Lore intent `Make full Codex convergence the safe default for new channels` and trailers documenting preservation of existing channel modes and all-locale UI coverage.

### Task 7: Prove Cross-Path Zero-Original Behavior and Regression Safety

**Files:**
- Create: `relay/channel/codex/identity_egress_integration_test.go`
- Create: `service/codex_identity_integration_test.go`
- Modify: existing failing regression tests only where behavior intentionally changed
- Modify: `docs/superpowers/specs/2026-08-20-codex-v178-identity-risk-controls-design.md` only if implementation evidence requires a clarified deployment note

**Interfaces:**
- Consumes: all prior task interfaces.
- Produces: no new production API; this task is the final behavioral proof.

- [ ] **Step 1: Add a captured-upstream matrix test**

```go
func TestCodexEgressZeroOriginalMatrix(t *testing.T) {
    // Table rows: responses, chat compatibility, raw passthrough, compact,
    // image, models, OAuth refresh, usage, reset-credit, admin probe.
    // Seed input with unique marker values in every forbidden body/header
    // field; capture supported body and header surfaces and assert zero marker
    // occurrences. Do not require body fields on endpoints that reject them.
}
```

- [ ] **Step 2: Add restart/replica/clone assertions**

```go
func TestCodexIdentityStableAcrossRestartAndReplicaButRotatesAcrossCloneNamespace(t *testing.T) {
    // Same DB seed + namespace survives new resolver instances and concurrent
    // replicas; changing only namespace changes stable IDs.
}
```

- [ ] **Step 3: Run the new integration tests and fix only demonstrated gaps**

Run: `$env:CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE='local'; go test ./relay/channel/codex ./service -run 'TestCodex(Egress|IdentityStable)' -count=1`

Expected: PASS after Tasks 1-6. If RED, patch the owning helper rather than adding path-specific bypasses, then rerun until green.

- [ ] **Step 4: Run the full backend verification**

Run: `$env:CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE='local'; go test ./... -count=1`

Run: `go vet ./...`

Expected: PASS with no seed/credential values in output.

- [ ] **Step 5: Run the full console verification**

Run: `cd web/default; bun install --frozen-lockfile`

Run: `cd web/default; bun test`

Run: `cd web/default; bun run lint`

Run: `cd web/default; bun run build`

Expected: all tests/lint/build pass and generated i18n reports contain no missing Codex identity keys.

- [ ] **Step 6: Inspect the final diff for secrets and scope drift**

Run: `git diff --check $(git merge-base origin/main HEAD)..HEAD`

Run: `git diff $(git merge-base origin/main HEAD)..HEAD | rg -n 'codex_fingerprint_seed|access_token|refresh_token|openai_device_id|account pool|sticky|cooldown|failover'`

Expected: seed/token strings appear only in hidden schema, redaction, lifecycle, and tests; no excluded scheduling/failover implementation appears.

- [ ] **Step 7: Commit final integration proof**

Commit:

```text
Prove Codex identity convergence across every subscription egress path

Constraint: Verification must cover router, console, replicas, retries, and database clones.
Rejected: Per-path smoke checks only | They cannot prove zero-original identity leakage.
Confidence: high
Scope-risk: broad
Directive: Keep the captured-upstream marker matrix current when adding a Codex subscription endpoint.
Tested: Full Go test/vet plus console test/lint/build suites.
```

## Deployment Acceptance Checklist

- [ ] Set the same stable `CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE` on every router and console replica in one deployment.
- [ ] Use a different namespace for staging, production, and every database clone.
- [ ] Deploy console first so the additive column, backfill, options, and sync task exist; then deploy routers.
- [ ] Verify one test subscription through two downstream users and two downstream tokens; upstream installation/session IDs must remain identical.
- [ ] Verify OAuth refresh, model fetch, usage, reset-credit, compact, image, and normal responses after restart and across two replicas.
- [ ] Confirm existing channels with missing mode remain `off`; only newly created Codex channels default to `full`.
- [ ] Keep the enforcement kill switch enabled unless an upstream compatibility incident requires temporary rollback.
