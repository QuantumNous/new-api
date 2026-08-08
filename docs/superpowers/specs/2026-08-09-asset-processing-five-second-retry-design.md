# Asset Processing Five-Second Retry Design

## Goal

Reduce the time between an upstream asset becoming usable and Flatkey exposing
that model in `available_models` by checking retryable upstream `Processing`
results every five seconds.

## Behavior

- `upstream_processing` readiness failures use a fixed five-second retry delay
  for every attempt within the existing five-minute target-generation window.
- An explicit upstream `Retry-After` value continues to take precedence when it
  is longer than five seconds.
- Throttling, timeouts, network failures, and other retryable error classes keep
  the existing `5s, 15s, 30s, 60s` backoff schedule.
- Target rotation, leases, idempotency keys, public asset status, and
  `available_models` semantics remain unchanged.

## Data Flow

1. An asset materializer returns the `upstream_processing` error class.
2. The readiness worker selects a five-second delay for that class.
3. The database row is released into `RetryWaiting` with `next_retry_at` set to
   five seconds later.
4. A router worker claims the row after it becomes due and retries with the same
   idempotency key.
5. Once the upstream accepts the asset as ready, the existing activation path
   marks the model readiness row `Active`.

## Error Handling

The change is intentionally limited to `upstream_processing`. It does not make
429 or infrastructure failures retry more aggressively. Existing lease fencing,
attempt counting, the five-minute generation window, and candidate rotation
continue to bound repeated provider calls.

## Verification

- Add a regression test proving repeated `upstream_processing` attempts schedule
  five seconds each.
- Preserve tests proving non-processing failures retain progressive backoff.
- Preserve tests proving a longer upstream `Retry-After` is respected.
- Run the focused readiness-worker tests, service package build, and diff checks.

## Non-Goals

- Adding an upstream asset-status endpoint.
- Changing public asset status or `available_models` response contracts.
- Changing video task polling or terminal-task timing.
- Changing retry behavior for channels that return a completed asset directly.
