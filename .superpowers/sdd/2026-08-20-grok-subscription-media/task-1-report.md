# Task 1 Report: Grok paid-billing observation state

## Implementation

- Added `GrokChannelState.BillingObservedAt int64` as the non-secret monotonic freshness clock for paid-billing observations.
- Added `GrokBillingObservation` and `SaveGrokBillingObservation(channelID int, leaseOwner string, observation GrokBillingObservation) (bool, error)`.
- The billing observation write uses one conditional GORM `UPDATE` requiring:
  - matching `channel_id`
  - exact `refresh_lease_owner`
  - strictly newer `billing_observed_at`
- Failed conditional writes return `false, nil` and do not update `QuotaSnapshot`, `BillingPlan`, `TierRaw`, `BillingObservedAt`, or `UpdatedAt`.
- Changed `upsertGrokChannelState` conflict handling from `UpdateAll` to an explicit auth/lease/refresh assignment list so auth-state upserts preserve billing snapshot fields.
- Migration visibility is covered through the existing `orderedMigrationModels()` registration for `GrokChannelState`; adding the field to that registered model makes it visible to AutoMigrate. No `model/main.go` edit was required.

## Files

- `model/grok_channel_state.go`
  - Added `BillingObservedAt`.
  - Added observation DTO and conditional save API.
  - Made auth-state upsert conflict updates explicit.
- `model/grok_channel_state_test.go`
  - Added monotonic lease-owned observation tests.
  - Added invalid input coverage.
  - Added auth-state preservation test for `BillingObservedAt` and snapshot fields.
  - Added migration column visibility check.
  - Extended non-secret field whitelist for the new freshness clock.

## Self-Review

- Scope stayed inside the model layer as requested; no controller files were touched.
- `billing_observed_at` is the only freshness clock used by the conditional write.
- The conditional write is not read-modify-write and is compatible with SQLite/MySQL/PostgreSQL through GORM predicates and updates.
- The write requires the exact lease owner and a strictly newer observed timestamp.
- The state remains non-secret; the new field is a timestamp and the secret-field guard was updated explicitly.
- Existing auth-state upserts now preserve prior billing observation fields instead of zeroing them.
- `GrokAuthStateView` was not expanded because the brief made console projection optional and Task 3 owns controller/auth-state response integration.

## TDD RED

Command:

```powershell
go test ./model -run 'TestGrokBillingObservation|TestGrokAuthState.*BillingObservedAt' -count=1
```

Relevant output:

```text
# github.com/QuantumNous/new-api/model [github.com/QuantumNous/new-api/model.test]
model\grok_channel_state_test.go:82:16: undefined: SaveGrokBillingObservation
model\grok_channel_state_test.go:82:58: undefined: GrokBillingObservation
model\grok_channel_state_test.go:93:42: got.BillingObservedAt undefined (type *GrokChannelState has no field or method BillingObservedAt)
model\grok_channel_state_test.go:102:16: undefined: GrokBillingObservation
model\grok_channel_state_test.go:108:17: undefined: GrokBillingObservation
model\grok_channel_state_test.go:118:17: undefined: GrokBillingObservation
model\grok_channel_state_test.go:128:17: undefined: GrokBillingObservation
model\grok_channel_state_test.go:137:18: undefined: SaveGrokBillingObservation
model\grok_channel_state_test.go:143:44: got.BillingObservedAt undefined (type *GrokChannelState has no field or method BillingObservedAt)
model\grok_channel_state_test.go:165:18: undefined: SaveGrokBillingObservation
model\grok_channel_state_test.go:165:18: too many errors
FAIL    github.com/QuantumNous/new-api/model [build failed]
FAIL
```

## GREEN / Verification

Command:

```powershell
go test ./model -run 'TestGrokBillingObservation|TestGrokAuthState.*BillingObservedAt' -count=1
```

Output:

```text
ok      github.com/QuantumNous/new-api/model     0.469s
```

Command:

```powershell
go test ./model -run 'TestGrok' -count=1
```

Output:

```text
ok      github.com/QuantumNous/new-api/model     0.476s
```

Command:

```powershell
git diff --check
```

Output: no output, exit code 0.

## Long-Suite Limitation

Command:

```powershell
go test ./model -count=1
```

Result: stopped after a bounded wait of about three minutes with no output, per parent instruction not to let an unrelated long model package run block the scoped task. Focused package evidence above passed.

## Notes

- GitNexus is unavailable in this worktree per task brief; impact evidence used `rg` and package tests.
- Live MySQL and PostgreSQL engines were not run locally; SQL shape uses GORM-compatible `WHERE` predicates and `Updates` only.

## Fix Round 1

### Review Items Addressed

- Fixed the conditional billing observation predicate so legacy rows with `billing_observed_at IS NULL` can accept their first strictly newer observation.
- Added `gorm:"not null;default:0"` to `BillingObservedAt` so newly migrated/current schemas guarantee a non-null zero freshness clock.
- Updated the `UpsertGrokChannelState` comment to state that the path updates auth/lease/refresh state only; billing snapshots are owned by `SaveGrokBillingObservation`.
- Amended the Lore `Tested:` trailer to name completed focused tests only.

### Fix Round 1 RED

Command:

```powershell
gofmt -w model\grok_channel_state_test.go; go test ./model -run 'TestGrokBillingObservationAcceptsLegacyNullObservedAt' -count=1
```

Relevant output:

```text
--- FAIL: TestGrokBillingObservationAcceptsLegacyNullObservedAt (0.00s)
    grok_channel_state_test.go:170:
            Error Trace:    E:/workspace/new-api-worktrees/grok-subscription-media/model/grok_channel_state_test.go:170
            Error:          Should be true
            Test:           TestGrokBillingObservationAcceptsLegacyNullObservedAt
FAIL
FAIL	github.com/QuantumNous/new-api/model	0.483s
FAIL
```

### Intermediate Test Setup Correction

After adding `gorm:"not null;default:0"`, the first GREEN attempt showed the test was trying to create a NULL value through the current migrated schema rather than a legacy nullable schema. The regression was corrected to create the legacy nullable table shape directly.

Command:

```powershell
gofmt -w model\grok_channel_state.go model\grok_channel_state_test.go; go test ./model -run 'TestGrokBillingObservationAcceptsLegacyNullObservedAt' -count=1
```

Relevant output:

```text
2026/08/20 19:11:51 E:/workspace/new-api-worktrees/grok-subscription-media/model/grok_channel_state_test.go:161 constraint failed: NOT NULL constraint failed: grok_channel_states.billing_observed_at (1299)
[0.000ms] [rows:0] UPDATE `grok_channel_states` SET `billing_observed_at`=NULL,`updated_at`=1787224311 WHERE channel_id = 115
--- FAIL: TestGrokBillingObservationAcceptsLegacyNullObservedAt (0.02s)
    grok_channel_state_test.go:159:
            Error Trace:    E:/workspace/new-api-worktrees/grok-subscription-media/model/grok_channel_state_test.go:159
            Error:          Received unexpected error:
                            constraint failed: NOT NULL constraint failed: grok_channel_states.billing_observed_at (1299)
            Test:           TestGrokBillingObservationAcceptsLegacyNullObservedAt
FAIL
FAIL	github.com/QuantumNous/new-api/model	0.536s
FAIL
```

### Fix Round 1 GREEN / Verification

Command:

```powershell
gofmt -w model\grok_channel_state.go model\grok_channel_state_test.go; go test ./model -run 'TestGrokBillingObservationAcceptsLegacyNullObservedAt' -count=1
```

Output:

```text
ok  	github.com/QuantumNous/new-api/model	0.519s
```

Command:

```powershell
go test ./model -run 'TestGrokBillingObservation|TestGrokAuthState.*BillingObservedAt|TestGrokChannelState|TestUpsertGrokChannelState|TestGetGrokChannelState|TestDeleteGrokChannelState|TestAcquireRefreshLease|TestGrokTablesRegisteredForMigration' -count=1
```

Output:

```text
ok  	github.com/QuantumNous/new-api/model	0.596s
```

Command:

```powershell
git diff --check
```

Output: no output, exit code 0.

### Fix Round 1 Self-Review

- The save path remains one conditional GORM `UPDATE`.
- The predicate still requires exact lease owner and a strictly newer observed time.
- The predicate is cross-DB SQL: `IS NULL OR < ?` works on SQLite, MySQL 5.7.8+, and PostgreSQL 9.6+.
- Failed stale and wrong-owner writes still preserve all billing snapshot fields.
- No controller or secret-bearing state was touched.
