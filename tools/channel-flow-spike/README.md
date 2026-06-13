# Channel Flow Redis Phase 0 Spike

This spike validates the Redis backend shape for channel-level flow control
before productionizing it in `service/channel_flow.go`.

It intentionally does not use Lua. The experiment uses:

- one `running` ZSET, scored by lease expiry timestamp;
- one `waiting` ZSET, scored by Redis `INCR` sequence;
- `WATCH` / `MULTI` on `running` and `waiting`;
- release as `ZREM running <request_id>` only;
- waiter self-promotion by polling and promoting itself when it is queue head.

Run example:

```bash
go run ./tools/channel-flow-spike \
  -redis redis://localhost:6379/0 \
  -concurrency 1000 \
  -max-inflight 60 \
  -max-queue 240 \
  -queue-timeout 10s
```

The output is a JSON summary with conflict rate, p50/p95/p99 acquire latency,
peak running/queued counts, and the `max_inflight` invariant result.

Production Redis backend work should only proceed if this spike stays within the
target SLO for the expected deployment concurrency. If `tx_conflicts` or p99 are
too high, benchmark a Lua version or redesign the queue before wiring Redis into
the live relay path.

