# Task 3 Report: Grok Subscription Media Preflight

## Status

DONE

## Changes

- Created `relay/channel/groksubscription/media_preflight.go`
  - Added `EnsureMediaCredential(ctx, channelID, requirePaid)` returning only channel ID and access token.
  - Uses DB-time lease ownership through `model.AcquireGrokRefreshLease` / `ReleaseGrokRefreshLease`.
  - Refreshes credentials before paid writes when expiry is inside `MediaCredentialExpirySafetyWindow`.
  - Waits and reloads for losing lease owners with a bounded wait.
  - Probes billing only when paid evidence is missing, stale, or invalid.
  - Preserves old billing snapshots on probe failure and maps admin status to `eligible`, `ineligible`, or `unavailable`.

- Updated `model/ability.go`
  - Added exact Grok media model list:
    - `grok-imagine-image-2.0`
    - `grok-imagine-video-1.5`
    - `grok-imagine-video`
  - Added `SyncGrokMediaAbilities(channelID, eligible)` to add/remove only those rows while preserving text and unrelated configured abilities.
  - Uses channel group, status, priority, weight, and tag for inserted rows.
  - Invalidates local channel cache and publishes the existing channel config-change notification after successful sync.

- Updated `controller/grok_auth.go`
  - PKCE completion, refresh-token import, and manual refresh success handlers now run post-auth billing status refresh after credential persistence.
  - Handlers remain HTTP success/auth active when billing probe is unavailable.
  - Responses expose only non-secret `billing_status`.

## TDD Evidence

RED:

- `go test ./relay/channel/groksubscription -run 'TestEnsureMediaCredential|TestMediaPreflight' -count=1`
  - Failed on missing `MediaCredentialExpirySafetyWindow`, `SetMediaPreflightHooksForTest`, `MediaPreflightHooks`, `EnsureMediaCredential`, `MediaCredential`, and `model.GrokMediaAbilityModels`.
- `go test ./model -run 'TestSyncGrokMediaAbilities' -count=1`
  - Failed on missing `SyncGrokMediaAbilities` and `GrokMediaAbilityModels`.
- `go test ./controller -run 'TestGrok.*Billing|TestGrok.*Ability' -count=1`
  - Failed because refresh handler did not return `billing_status`.

GREEN:

- `go test ./relay/channel/groksubscription -run 'TestEnsureMediaCredential|TestMediaPreflight' -count=1` -> pass.
- `go test ./model -run 'TestSyncGrokMediaAbilities' -count=1` -> pass.
- `go test ./controller -run 'TestGrok.*Billing|TestGrok.*Ability' -count=1` -> pass.

## Required Verification

- `go test ./relay/channel/groksubscription -count=1` -> pass.
- `go test ./model -run 'TestGrok|TestSyncGrokMediaAbilities' -count=1` -> pass.
- `go test ./controller -run 'TestGrok' -count=1` -> pass.
- `git diff --check` -> pass.

## Self-Review

- Scope stayed within shared preflight, exact Ability synchronization, and admin OAuth integration.
- No image/video adapters were added.
- The adapter-facing credential result contains no refresh token, billing snapshot, or other secrets.
- Probe failure preserves old billing observation and does not set `needs_reauth`.
- Refresh failure still may mark `needs_reauth` for genuine refresh failures.
- Admin responses expose status buckets only and do not include raw probe errors.

## Concerns

- The bounded losing-worker wait currently returns `ErrRefreshConflict` after the configured local wait expires. This is intentional for bounded behavior, but adapter retry policy should treat it as retryable.
- Controller post-auth billing probes use the same injected HTTP doer as token exchange in tests and production integration. Existing tests were adjusted where they assumed every doer call was a token request.

## Fix Round 1: Persisted Evidence Gate

### Finding

- `SaveGrokBillingObservation` can return `wrote=false` when the caller no longer owns the lease or the observation lost to newer persisted evidence. The previous preflight path evaluated the unsaved local observation and could sync media abilities from evidence that was never persisted.

### RED Evidence

- Added `TestEnsureMediaCredentialDoesNotSyncAbilitiesFromUnsavedProbe`.
- Added `TestEnsureMediaCredentialLosingWorkerWaitsAndReloadsPersistedEvidence`.
- `go test ./relay/channel/groksubscription -run 'TestEnsureMediaCredentialDoesNotSyncAbilitiesFromUnsavedProbe|TestEnsureMediaCredentialLosingWorkerWaitsAndReloadsPersistedEvidence' -count=1` failed as expected:
  - `TestEnsureMediaCredentialDoesNotSyncAbilitiesFromUnsavedProbe` expected `ErrRefreshConflict`, got nil.

### Fix

- `ensureMediaCredentialWithLease` now checks the `wrote` result.
- When `wrote=false`, it reloads `GrokChannelState` and syncs abilities only from persisted eligible/ineligible evidence.
- If persisted evidence is missing, stale, or invalid after a rejected write, it returns `ErrRefreshConflict` without syncing abilities from the unsaved probe result.

### GREEN Evidence

- `go test ./relay/channel/groksubscription -run 'TestEnsureMediaCredentialDoesNotSyncAbilitiesFromUnsavedProbe|TestEnsureMediaCredentialLosingWorkerWaitsAndReloadsPersistedEvidence' -count=1` -> pass.
- `go test ./relay/channel/groksubscription -run 'TestEnsureMediaCredential|TestMediaPreflight' -count=1` -> pass.
- `go test ./model -run 'TestGrok|TestSyncGrokMediaAbilities' -count=1` -> pass.
- `go test ./controller -run 'TestGrok' -count=1` -> pass.
- `git diff --check` -> pass.

### Self-Review

- Only `media_preflight.go`, `media_preflight_test.go`, and this report were changed.
- Ability sync after `wrote=false` is now driven only by reloaded persisted evidence.
- Losing worker behavior remains DB-lease-based, bounded, and reloads current state without a process-local correctness lock.
- Probe failure behavior is unchanged and still preserves old state/auth.
