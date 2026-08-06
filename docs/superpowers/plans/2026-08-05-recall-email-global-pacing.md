# Recall Email Global Pacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce one globally shared Recall SMTP-attempt start every `ceil(3,600,000 / email_hourly_limit)` milliseconds while preserving the hourly hard cap.

**Architecture:** A singleton database pacing cursor is reserved inside the existing Recall SMTP admission transaction. The worker treats the returned next slot as backpressure, and the scheduler uses it only to wake efficiently before rechecking the database gate.

**Tech Stack:** Go 1.22+, GORM v2, SQLite/MySQL/PostgreSQL, testify

---

## File Structure

- `model/db_time.go`: fail-closed cross-database millisecond time helper.
- `model/db_time_test.go`: dialect and live-clock coverage.
- `model/recall_email_quota.go`: pacing state, status, reservation, and SMTP admission integration.
- `model/recall_email_quota_test.go`: interval, dynamic-limit, hour-boundary, rollback, and concurrency tests.
- `model/main.go`: full and fast migration registration.
- `service/recall_email.go`: pre-lease pacing backpressure and retry-time handling.
- `service/recall_email_test.go`: batch and regression coverage.
- `service/recall_scheduler.go`: database-advertised pacing wake-up.
- `service/recall_scheduler_test.go`: pure delay-selection tests.
- `service/recall_campaign_test.go`: test schema registration.

### Task 1: Lock the model behavior with failing tests

**Files:**
- Modify: `model/db_time_test.go`
- Modify: `model/recall_email_quota_test.go`

- [ ] **Step 1: Add millisecond database-clock tests**

```go
func TestDBTimestampMillisQueryUsesActiveDialect(t *testing.T) {
    require.Contains(t, dbTimestampMillisQueryForDialect("postgres"), "clock_timestamp()")
    require.Contains(t, dbTimestampMillisQueryForDialect("sqlite"), "julianday('now')")
    require.Contains(t, dbTimestampMillisQueryForDialect("mysql"), "CURRENT_TIMESTAMP(3)")
}
```
- [ ] **Step 2: Add interval, dynamic-limit, and no-catch-up tests**

```go
func TestRecallEmailPacingSpacesReservationsAtConfiguredInterval(t *testing.T) {
    // 90/hour: T succeeds, T+39s waits, T+40s succeeds.
    // 180/hour: T succeeds, T+19s waits, T+20s succeeds.
}

func TestRecallEmailPacingUsesUpdatedLimitWithoutBurst(t *testing.T) {
    // Raising 90 -> 180 recalculates from the last actual start.
    // Lowering 180 -> 90 immediately requires the longer interval.
    // A long idle period admits one claim, not accumulated catch-up claims.
}
```

- [ ] **Step 3: Add concurrency and hour-boundary tests**

```go
func TestRecallEmailPacingRejectsConcurrentSameSlotClaims(t *testing.T) {
    // Start 24 independent message admissions at one fixed DB millisecond.
    // Exactly one transaction returns Reserved=true.
}

func TestRecallEmailPacingContinuesAcrossHourlyBoundary(t *testing.T) {
    // A send just before the hour prevents an immediate send after reset.
}
```

- [ ] **Step 4: Run the tests and verify RED**

```powershell
go test ./model -run "Test(DBTimestampMillis|RecallEmailPacing)" -count=1
```

Expected: compile or assertion failures because the millisecond clock and pacing state do not exist.

### Task 2: Implement the database cursor and atomic admission

**Files:**
- Modify: `model/db_time.go`
- Modify: `model/recall_email_quota.go`
- Modify: `model/main.go`
- Modify: `model/recall_email_quota_test.go`

- [ ] **Step 1: Add a fail-closed millisecond DB clock**

```go
func GetDBTimestampMillisWithContext(ctx context.Context) (int64, error) {
    if ctx == nil || DB == nil {
        return 0, fmt.Errorf("database is not initialized")
    }
    return getDBTimestampMillis(DB.WithContext(ctx))
}
```

- [ ] **Step 2: Add the singleton pacing model and interval calculation**

```go
type RecallEmailPacingState struct {
    Scope               string `gorm:"primaryKey;size:64"`
    LastStartedAtMillis int64  `gorm:"not null;default:0"`
    UpdatedAt           int64  `gorm:"autoUpdateTime:milli"`
}

func recallEmailPacingIntervalMillis(limit int) int64 {
    return (int64(time.Hour/time.Millisecond) + int64(limit) - 1) / int64(limit)
}
```

- [ ] **Step 3: Add the atomic conditional reservation**

```go
result := db.Model(&RecallEmailPacingState{}).
    Where("scope = ? AND (last_started_at_millis = 0 OR last_started_at_millis <= ?)", scope, nowMillis-interval).
    Update("last_started_at_millis", nowMillis)
reserved := result.RowsAffected == 1
```

Reload the state and calculate `NextAllowedAtMillis` from the current limit.

- [ ] **Step 4: Integrate pacing into the existing SMTP transaction**

```go
nowMillis, err := recallEmailPacingNowMillis(tx)
pacing, paced, err := reserveRecallEmailPacing(tx, limit, nowMillis)
if !paced {
    attempt.Pacing = pacing
    return errRecallEmailPacingWait
}
quota, reserved, err := reserveRecallEmailQuotaAt(tx, limit, nowMillis/1000)
```

Keep the existing lease verification, suppression check, hourly quota, and `leased -> sending` CAS in the same transaction so every sentinel rolls back all provisional reservations.

- [ ] **Step 5: Register both migration paths and test schemas**

```go
&RecallEmailPacingState{},
```

Add the model beside `RecallEmailQuotaWindow` in full migration, fast migration, and Recall test AutoMigrate calls.

- [ ] **Step 6: Run model tests and verify GREEN**

```powershell
go test ./model -run "Test(DBTimestampMillis|RecallEmailPacing|BeginRecallEmailSMTPAttempt|ReserveRecallEmailQuota|RecallEmailQuotaStatus)" -count=1
```

Expected: PASS, including exactly one concurrent pacing winner.

### Task 3: Integrate worker backpressure and scheduler wake-up

**Files:**
- Modify: `service/recall_email.go`
- Modify: `service/recall_email_test.go`
- Modify: `service/recall_scheduler.go`
- Create: `service/recall_scheduler_test.go`

- [ ] **Step 1: Add failing worker tests**

```go
func TestRecallEmailRunBatchSendsAtMostOneMessagePerPacingSlot(t *testing.T) {
    // Seed three due messages at 180/hour; one batch enters SMTP once.
}

func TestRecallEmailRunBatchReturnsPacingWaitBeforeLeasing(t *testing.T) {
    // A future global next slot leaves all due-message leases unchanged.
}
```

- [ ] **Step 2: Add failing scheduler delay tests**

```go
func TestRecallMaintenanceDelayUsesEarlierPacingWakeup(t *testing.T) {
    require.Equal(t, 20*time.Second, recallMaintenanceDelay(30, 120_000, 100_000))
}

func TestRecallMaintenanceDelayKeepsShorterGeneralTick(t *testing.T) {
    require.Equal(t, 5*time.Second, recallMaintenanceDelay(5, 120_000, 100_000))
}
```

- [ ] **Step 3: Verify service tests are RED**

```powershell
go test ./service -run "TestRecallEmailRunBatch(SendsAtMostOneMessagePerPacingSlot|ReturnsPacingWaitBeforeLeasing)|TestRecallMaintenanceDelay" -count=1
```

Expected: FAIL because the worker only knows hourly exhaustion and the scheduler has a fixed ticker.

- [ ] **Step 4: Return precise pacing backpressure before leasing**

```go
pacing, err := model.GetRecallEmailPacingStatusWithContext(ctx, campaignSetting.EmailHourlyLimit)
if err != nil {
    return 0, err
}
if !pacing.Allowed {
    return 0, newRecallEmailPacingWaitError(pacing.NextAllowedAtMillis)
}
```

On a post-lease race, use the pacing next time instead of the hourly reset and release remaining leases safely.

- [ ] **Step 5: Replace the fixed scheduler ticker with a recomputed timer**

```go
func recallMaintenanceDelay(tickSeconds int, pacingAtMillis int64, nowMillis int64) time.Duration {
    delay := time.Duration(tickSeconds) * time.Second
    if pacingAtMillis > nowMillis {
        pacingDelay := time.Duration(pacingAtMillis-nowMillis) * time.Millisecond
        if pacingDelay < delay {
            delay = pacingDelay
        }
    }
    return delay
}
```

The timer only controls wake-up; `RunBatch` must still win the database CAS.

- [ ] **Step 6: Run service tests and verify GREEN**

```powershell
go test ./service -run "TestRecallEmail|TestRecallMaintenance" -count=1
```

Expected: PASS, including suppression, retry, quota, and uncertain-outcome regressions.

### Task 4: Verify and review the complete change

**Files:**
- Review all files changed by Tasks 1-3.

- [ ] **Step 1: Format and inspect scope**

```powershell
gofmt -w model/db_time.go model/db_time_test.go model/recall_email_quota.go model/recall_email_quota_test.go model/main.go service/recall_email.go service/recall_email_test.go service/recall_scheduler.go service/recall_scheduler_test.go service/recall_campaign_test.go
git diff --check
git diff --stat
```

Expected: no formatting or whitespace errors and no unrelated files.

- [ ] **Step 2: Run targeted and package tests**

```powershell
go test ./model -run "Test(DBTimestampMillis|RecallEmailPacing|BeginRecallEmailSMTPAttempt|ReserveRecallEmailQuota|RecallEmailQuotaStatus)" -count=1
go test ./service -run "TestRecallEmail|TestRecallMaintenance" -count=1
go test ./setting/operation_setting -count=1
go test ./model ./service ./setting/operation_setting -count=1
```

Expected: all commands exit 0.

- [ ] **Step 3: Run static validation**

```powershell
go vet ./model ./service ./setting/operation_setting
go build ./...
```

Expected: both commands exit 0.

- [ ] **Step 4: Run scope analysis and independent review**

Run `gitnexus detect-changes --scope compare --base-ref main` if the repository index is available. If the index remains unavailable, record that gap and use `git diff --name-only origin/main...HEAD`, exact caller searches, and an independent code-review agent.

- [ ] **Step 5: Commit with the Lore protocol**

```text
Pace Recall SMTP attempts across every active instance

Constraint: Recall runs on multiple Cloud Run instances and the existing hourly counter permits bursts.
Rejected: Process-local ticker as the admission boundary | It cannot coordinate replicas or survive restarts.
Confidence: high
Scope-risk: moderate
Directive: Keep pacing reservation atomic with the exact message lease and leased-to-sending transition.
Tested: targeted model/service tests, related package suites, go vet, and go build.
Not-tested: live MySQL/PostgreSQL integration unless CI supplies those databases.
```
