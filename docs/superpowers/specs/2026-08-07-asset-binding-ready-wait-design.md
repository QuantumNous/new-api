# Asset Binding Ready Wait Design

## Goal

When a video task references a channel asset binding that is still `Processing`, keep the task queued, poll again, and submit the video immediately after the binding becomes `Active`. Fail only when the binding explicitly fails or remains unready for five minutes from task creation.

## Architecture

The worker remains non-blocking. An `asset_not_ready` result releases the current preparation lease and atomically moves the task back to `preparing_assets`. The existing `preparation_lease_expires_at` column stores the next eligible check time. `GetQueuedAssetPreparationTasks` selects only rows whose check time has arrived, so all application nodes share the same database-backed schedule and the existing lease CAS prevents duplicate work.

## Data Flow

1. Claim a due `preparing_assets` task with the existing preparation lease.
2. Resolve the selected channel and materialize or refresh its asset binding.
3. If the binding is `Active`, continue through the existing provider submission path immediately.
4. If the result is `asset_not_ready` and `now < created_at + 300`, atomically clear the lease owner, restore `preparing_assets`, and set the next check to `now + 1`.
5. If the binding explicitly fails, or the five-minute deadline has elapsed, use the existing failure and single-refund path.

## Concurrency and Failure Handling

Requeue uses the same owner and exact lease-expiry generation fence as the existing success/failure transitions. A stale worker cannot requeue a task owned by another node or a newer lease generation. No in-memory timer, new table, or long-running worker wait is introduced.

## Tests

- A future-due `preparing_assets` task is not returned by the queue query.
- Only the current lease owner/generation can requeue, and the requeued task becomes claimable at the scheduled time.
- `asset_not_ready` before five minutes stays queued and does not refund.
- A later check that sees `Active` follows the existing submit path.
- `asset_not_ready` at the five-minute deadline follows the existing failure/refund path.

