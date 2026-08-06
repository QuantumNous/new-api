# Recall Email Global Pacing Design

**Date:** 2026-08-05
**Status:** Approved for implementation

## Goal

Send Recall Activity email attempts at an even, configuration-derived pace while preserving the existing shared hourly hard limit.

The configured interval is:

```text
ceil(3,600,000 milliseconds / email_hourly_limit)
```

This gives exactly 40 seconds at 90/hour and 20 seconds at 180/hour.

## Constraints

- Production has multiple Cloud Run instances. A process-local mutex, ticker, token bucket, or sleep cannot be the correctness boundary.
- SMTP admission must remain atomic with the exact Recall message lease and the `leased -> sending` transition.
- Persistent suppression, lease loss, and message CAS loss must not consume a pacing slot or hourly quota.
- SMTP attempts consume their slot once the message enters `sending`, regardless of accepted, retryable, permanent, or uncertain outcome.
- SQLite, MySQL 5.7.8+, and PostgreSQL 9.6+ must all work.
- The pacing state must not reset at the UTC hour boundary.
- Changing `email_hourly_limit` affects the next admission. Increasing it must not create catch-up bursts; decreasing it must immediately require the longer interval.

## Considered Approaches

### 1. Database singleton pacing cursor — selected

Persist the last globally admitted SMTP-attempt start and atomically advance it inside the existing admission transaction. This coordinates all instances and survives restarts.

### 2. Put pacing on each hourly quota row

This minimizes schema additions, but resetting the row at the hour boundary permits two adjacent sends on opposite sides of the boundary. It also mixes a hard hourly count with continuous pacing.

### 3. Process-local ticker or sleep

This is simple but multiplies the effective rate by the number of active instances and loses state on restart. It is not safe for production.

## Data Model

Add a singleton row in `recall_email_pacing_states`:

```go
type RecallEmailPacingState struct {
    Scope               string `gorm:"primaryKey;size:64"`
    LastStartedAtMillis int64  `gorm:"not null;default:0"`
    UpdatedAt           int64  `gorm:"autoUpdateTime:milli"`
}
```

The initial scope is `activity_email`. `LastStartedAtMillis` records the most recent committed transition into the SMTP attempt boundary. The next effective admission time is recalculated from the current limit:

```text
last_started_at_ms + ceil(3,600,000 / current_limit)
```

The cursor is set to the current database time on success. It is never incremented from an old scheduled value, so downtime or a higher limit cannot accumulate missed slots and release them as a burst.

## Database Time

Add a fail-closed millisecond database clock for each supported dialect:

- PostgreSQL: epoch milliseconds from `clock_timestamp()`.
- SQLite: epoch milliseconds from `julianday('now')`.
- MySQL: epoch milliseconds from `CURRENT_TIMESTAMP(3)` and `UNIX_TIMESTAMP`.

Application time is not used for the distributed admission decision.

## Atomic Admission Flow

`BeginRecallEmailSMTPAttemptWithContext` remains the only production admission boundary. Its transaction performs these operations in order:

1. Serialize SQLite writers and verify the exact message lease epoch.
2. Lock the recipient and apply persistent suppression.
3. Read database time and try the global pacing conditional update.
4. Reserve the existing hourly quota window.
5. Transition the message from `leased` to `sending` with its state event.
6. Commit all three reservations together.

The pacing update uses a conditional update equivalent to:

```sql
UPDATE recall_email_pacing_states
SET last_started_at_millis = :now
WHERE scope = :scope
  AND (
    last_started_at_millis = 0
    OR last_started_at_millis <= :now_minus_current_interval
  )
```

`RowsAffected == 1` is the single-winner signal. A pacing wait, hourly exhaustion, or message CAS loss returns through a transaction sentinel so all provisional updates roll back.

## Worker and Scheduler Behavior

Before leasing messages, `RecallEmailWorker.RunBatch` reads both the hourly quota status and the pacing status. If the next pacing slot is in the future, it returns backpressure without touching message leases.

A race can still occur after leasing. If another instance wins the slot, the current message is restored or deferred to the returned next-admission time and remaining batch leases are released.

The scheduler may use the database-provided next-admission time to choose an earlier wake-up than the general maintenance tick. That timer is only a wake-up optimization; every wake-up must re-enter the database gate. This permits 20-second pacing when `TickSeconds` is 30 without relying on the local timer for correctness.

## Dynamic Configuration

The current `email_hourly_limit` is read before each admission. The cursor stores the last actual admission time, not the interval that was active at that time.

- 90/hour at time T allows the next attempt at T+40s.
- If the limit becomes 180/hour, the same cursor permits the next attempt at T+20s.
- If a send occurs at T+20s and the limit becomes 90/hour, the next attempt is T+60s.
- If the service was idle for ten minutes, only one attempt is admitted at wake-up; the next one is based on the new actual admission time.

## API and UI Scope

This change reuses the existing `email_hourly_limit` option and its admin endpoint. No UI field or public configuration key is added. Internal pacing status includes the precise next-admission timestamp needed by the worker and scheduler.

## Failure Handling

- Database time or pacing-state errors fail closed and send no email.
- Missing pacing state is created with a cross-database conflict-safe insert.
- Persistent suppression and lease loss occur before slot reservation.
- Hourly quota exhaustion rolls back a provisional pacing reservation and waits until the hour reset.
- SMTP transport failure does not refund a committed pacing slot.
- Uncertain SMTP outcomes remain terminal and are not automatically retried.

## Migration and Rollout

Register `RecallEmailPacingState` in both full and fast AutoMigrate paths. During a rolling production deployment, older instances do not know the new gate, so Recall sending should be disabled until every console instance is on the new revision, then re-enabled.

The router request path does not use this table or worker.

## Verification

- 90/hour spaces admissions by 40 seconds.
- 180/hour spaces admissions by 20 seconds.
- Concurrent claims at one timestamp produce exactly one winner.
- An hourly window reset does not bypass pacing.
- Increasing and decreasing the limit affect the next admission without catch-up.
- Lease loss, suppression, quota exhaustion, and message CAS loss do not leave a pacing cursor advance behind.
- A batch sends at most one SMTP attempt per pacing slot.
- Scheduler wake-up honors a pacing timestamp earlier than the normal maintenance tick.
- Existing Recall quota, retry, uncertain-outcome, and suppression tests remain green.
- The model, service, and operation-setting packages pass their complete test suites.
