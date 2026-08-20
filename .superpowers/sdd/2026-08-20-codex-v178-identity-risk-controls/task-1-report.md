# Task 1 Report: Persist and Manage the System-Owned Channel Seed

## Implementation Summary

- Added hidden `Channel.CodexFingerprintSeed string` storage with `json:"-" gorm:"type:varchar(36);default:''"`.
- Added `model.EnsureCodexFingerprintSeed(channelID int) (string, error)` using UUID validation and a database-portable compare-and-set update on the existing seed value.
- Added `model.BackfillCodexFingerprintSeeds() error` and called it after both normal and SQLite migration paths.
- Minted system-owned seeds for newly inserted enabled Codex channels, while keeping non-Codex and disabled Codex channels empty.
- Preserved seeds across channel updates and re-enable flows, and cleared copied channel seeds before insert so the copy receives a fresh seed.
- Added `RelayInfo.ChannelMeta.CodexFingerprintSeed` and populated it from selected channel state through the distributor Gin context.

## Files Changed

- `model/channel.go`
- `model/main.go`
- `controller/channel.go`
- `relay/common/relay_info.go`
- `middleware/distributor.go`
- `model/channel_codex_fingerprint_seed_test.go`
- `controller/channel_codex_fingerprint_seed_test.go`

## RED Evidence

### Model RED

Command:

```text
go test ./model -run 'Test(EnsureCodexFingerprintSeed|NonCodexAndOff)' -count=1
```

Result: expected build failure before production code existed.

```text
model\channel_codex_fingerprint_seed_test.go:54:3: unknown field CodexFingerprintSeed in struct literal of type Channel
model\channel_codex_fingerprint_seed_test.go:72:16: undefined: EnsureCodexFingerprintSeed
model\channel_codex_fingerprint_seed_test.go:132:36: stored.CodexFingerprintSeed undefined (type Channel has no field or method CodexFingerprintSeed)
FAIL    github.com/QuantumNous/new-api/model [build failed]
```

### Controller RED

Command:

```text
go test ./controller -run 'TestCodexSeed' -count=1
```

Result: expected behavioral failure after the model API existed but controller lifecycle was not wired.

```text
--- FAIL: TestCodexSeedLifecycleThroughCreateUpdateCopy
    channel_codex_fingerprint_seed_test.go:103:
        Error: Should NOT be empty, but was
--- FAIL: TestCodexSeedCannotBeSuppliedOrSerialized
    channel_codex_fingerprint_seed_test.go:145:
        Error: Should NOT be empty, but was
FAIL    github.com/QuantumNous/new-api/controller
```

## GREEN Evidence

### Model GREEN

Command:

```text
go test ./model -run 'Test(EnsureCodexFingerprintSeed|NonCodexAndOff)' -count=1
```

Result:

```text
ok      github.com/QuantumNous/new-api/model      0.937s
```

### Controller GREEN

Command:

```text
go test ./controller -run 'TestCodexSeed' -count=1
```

Result:

```text
ok      github.com/QuantumNous/new-api/controller 0.940s
```

### Required Targeted Package Verification

Command:

```text
go test ./model ./controller ./middleware -run 'Codex.*Seed|FingerprintSeed' -count=1
```

Result:

```text
ok      github.com/QuantumNous/new-api/model      1.007s
ok      github.com/QuantumNous/new-api/controller 1.486s
ok      github.com/QuantumNous/new-api/middleware 0.648s [no tests to run]
```

### Diff Check

Command:

```text
git diff --check
```

Result: exit 0, no whitespace errors.

### Post-Commit Check

Command:

```text
git show --check --stat HEAD
```

Result: exit 0, no whitespace errors in commit `72e1d0c7912a80829f4b0c365d9fcc35a6610742`.

## Broad Verification Attempt

Command:

```text
go test ./model ./controller ./middleware -count=1
```

Result: produced no output for several minutes and was interrupted.

Split follow-up:

```text
go test ./model -count=1
```

Result: produced no output for more than one minute and was interrupted.

```text
go test ./middleware -count=1
```

Result: failed outside Task 1:

```text
--- FAIL: TestAssetReferenceSeedanceProxyMaterializationBypassesSourceURLRewriteBranch
    distributor_byteplus_asset_test.go:1061:
        expected: 200
        actual  : 503
        Messages: {"error":{"code":"asset_channel_unavailable","message":"asset channel unavailable (request id: )","type":"new_api_error"}}
FAIL    github.com/QuantumNous/new-api/middleware
```

## Self-Review

- Scope is limited to the requested production files and two Task 1 seed lifecycle test files.
- The seed field is hidden from JSON via `json:"-"`; controller leakage test verifies both request-supplied seed rejection and marshal absence.
- The model resolver uses UUID validation and compare-and-set on the current stored value, avoiding dialect-specific SQL functions.
- Startup backfill uses the same resolver to repair empty or invalid enabled Codex channel seeds.
- Relay propagation is in-process only through Gin context and `RelayInfo.ChannelMeta`; `RelayInfo.ToString` does not print the seed.
- No new dependency was added; `github.com/google/uuid` already exists in `go.mod`.

## Concerns

- Broad package verification could not complete cleanly within the task window: the combined package run and full model package run hung without output, and the full middleware package has an unrelated asset materialization failure.
- The hidden relay context key is a string literal in the owned middleware/relay files to avoid editing `constant/context_key.go`, which was outside Task 1 ownership.

## Commit

```text
72e1d0c7912a80829f4b0c365d9fcc35a6610742 Own Codex convergence identity at the upstream channel
```

# Fix Round 1

## Implementation Summary

- Centralized seed initialization into model enable paths:
  - `UpdateChannelStatus` now ensures a seed after a successful transition to enabled for Codex channels.
  - `EnableChannelByTag` now ensures seeds for enabled Codex channels under the tag before ability updates and cache publish.
- Added `json:"-"` to `RelayInfo.ChannelMeta.CodexFingerprintSeed`.
- Added regression coverage for tag re-enable, status/automatic re-enable, and JSON/string leakage.
- Did not address the deferred minor context-key issue in this round.

## Files Changed

- `model/channel.go`
- `model/channel_codex_fingerprint_seed_test.go`
- `relay/common/relay_info.go`
- `relay/common/relay_info_test.go`

## RED Evidence

### Model Enable Path RED

Command:

```text
go test ./model -run 'Test(EnableChannelByTagMintsSeed|UpdateChannelStatusMintsSeed)' -count=1
```

Result:

```text
--- FAIL: TestEnableChannelByTagMintsSeedForLegacyDisabledCodexChannel (0.11s)
    channel_codex_fingerprint_seed_test.go:166:
        Error: Should NOT be empty, but was
--- FAIL: TestUpdateChannelStatusMintsSeedForLegacyAutoDisabledCodexChannel (0.09s)
    channel_codex_fingerprint_seed_test.go:178:
        Error: Should NOT be empty, but was
FAIL    github.com/QuantumNous/new-api/model 0.660s
```

### Relay Leakage RED

Command:

```text
go test ./relay/common -run TestCodexFingerprintSeedDoesNotLeakThroughJSONOrString -count=1
```

Result:

```text
--- FAIL: TestCodexFingerprintSeedDoesNotLeakThroughJSONOrString (0.00s)
    relay_info_test.go:98:
        Error: "{\"ChannelType\":112,\"ChannelId\":42,\"ChannelIsMultiKey\":false,\"ChannelMultiKeyIndex\":0,\"CodexFingerprintSeed\":\"11111111-1111-4111-8111-111111111111\",...}" should not contain "CodexFingerprintSeed"
FAIL    github.com/QuantumNous/new-api/relay/common 0.305s
```

## GREEN Evidence

### Model Enable Path GREEN

Command:

```text
go test ./model -run 'Test(EnableChannelByTagMintsSeed|UpdateChannelStatusMintsSeed)' -count=1
```

Result:

```text
ok      github.com/QuantumNous/new-api/model      0.750s
```

### Relay Leakage GREEN

Command:

```text
go test ./relay/common -run TestCodexFingerprintSeedDoesNotLeakThroughJSONOrString -count=1
```

Result:

```text
ok      github.com/QuantumNous/new-api/relay/common       0.318s
```

### Covering Model Seed Tests

Command:

```text
go test ./model -run 'Test(EnsureCodexFingerprintSeed|NonCodexAndOff|EnableChannelByTagMintsSeed|UpdateChannelStatusMintsSeed)' -count=1
```

Result:

```text
ok      github.com/QuantumNous/new-api/model      1.140s
```

### Relay Common Coverage

Command:

```text
go test ./relay/common -run 'TestCodexFingerprintSeedDoesNotLeakThroughJSONOrString|TestRelayInfo' -count=1
```

Result:

```text
ok      github.com/QuantumNous/new-api/relay/common       0.340s
```

### Required Focused Task 1 Verification

Command:

```text
go test ./model ./controller ./middleware -run 'Codex.*Seed|FingerprintSeed' -count=1
```

Result:

```text
ok      github.com/QuantumNous/new-api/model      2.070s
ok      github.com/QuantumNous/new-api/controller 1.116s
ok      github.com/QuantumNous/new-api/middleware 0.613s [no tests to run]
```

### Diff Check

Command:

```text
git diff --check
```

Result: exit 0, no whitespace errors.

## Self-Review

- The fix stays within the reviewed findings and does not touch the deferred context-key concern.
- Both service-driven automatic re-enable and direct status re-enable route through `model.UpdateChannelStatus`, so the model-level seed initialization covers `service.EnableChannel`.
- `EnableChannelByTag` handles bulk tag enable by querying the enabled Codex channel IDs and reusing the same guarded resolver.
- The seed remains absent from `Channel` JSON and is now also absent from `ChannelMeta` / `RelayInfo` JSON; `ToString()` still does not print it.

## Concerns

- The broad-suite concerns from the initial report still apply and were not re-expanded in this fix round.
