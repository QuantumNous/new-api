# Follow-up TODOs

Outstanding work tracked from past planning / review cycles. Each item links back to the PR or plan that surfaced it.

---

## Redis pubsub config sync — follow-ups

Source: PR #16 (merged 2026-05-15), plan at `docs/superpowers/plans/2026-05-15-redis-pubsub-config-sync.md`.

The feature shipped with full unit-test coverage + production verification. These items were intentionally deferred from the PR scope.

### Functional gaps

- [ ] **`controller/console_migrate.go:100` direct option delete bypasses publish.** `model.DB.Where("key IN ?", oldKeys).Delete(&model.Option{})` deletes rows without going through `model.UpdateOption`, so peers don't get a pubsub notification. One-shot admin migration → 60s polling fallback covers, but worth wiring properly.
  - Fix: add `common.PublishConfigChanged(ctx, common.ConfigScopeOptions)` after the delete, or refactor to go through `UpdateOption`.

- [ ] **`UpdateChannelStatus` multi-key partial-state edge case bypasses both DB save and publish.** Pre-existing bug not introduced by PR #16: when `IsMultiKey` is true and the aggregate `channel.Status` is unchanged but `MultiKeyStatusList` changed, the `if channel.Status == status { return false }` short-circuit (around `model/channel.go:734`) skips both `SaveWithoutKey` and `publishChannelsChanged`. Peers stay out of sync until the 60s tick.
  - Fix: in the multi-key branch (`model/channel.go:738-747`), detect whether `handlerMultiKeyUpdate` mutated `MultiKeyStatusList` and force a save+publish even when the aggregate status didn't move.

### Robustness / latency

- [ ] **Wrap `PublishConfigChanged` calls in a 500ms timeout context.** Both `model/option.go:227` and `model/channel.go:27` use `context.Background()`. If Redis is reachable-but-slow, the admin save endpoint stalls until the go-redis default timeout. Low blast radius (admin-only), but worth tightening.
  - Fix: `ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond); defer cancel(); common.PublishConfigChanged(ctx, ...)`
  - Apply to both call sites consistently.

- [ ] **Pre-existing `DB.FirstOrCreate` / `DB.Save` error swallowing in `model.UpdateOption`** (`model/option.go:215, 217`). Save errors are silently ignored — a successful-looking admin save can fail while peers correctly stay on the old value. Made more visible by pubsub (peers now reload faster and notice divergence sooner).
  - Fix: check `.Error` and return it from `UpdateOption`.

### Test hygiene

- [ ] **Tighten UUID parse assertion in `common/replica_id_test.go::TestReplicaID_LooksLikeUUID`.** Currently checks `len(id) == 36`; would accept any 36-char string. Use `uuid.Parse(id)` and assert `parsed.Version() == 4`.

- [ ] **Replace `time.Sleep(100 * time.Millisecond)` in pubsub tests with `sub.Receive` synchronization.** `common/redis_pubsub_test.go:89, 120`. The sleep races against go-redis SUBSCRIBE registration; flaky on slow CI. Use the `sub.Receive(ctx)` ack pattern already demonstrated at line 35.

- [ ] **Add concurrent-safety test for `GetReplicaID`.** `sync.Once` is correct today, but no test exercises concurrent first-call. A regression that swaps `sync.Once` for a plain bool flag would not be caught.
  - Fix: add `TestReplicaID_ConcurrentSafe` firing N goroutines and asserting all return the same value.

### Cosmetics

- [ ] **Switch `encoding/json` in `common/redis_pubsub.go` to package-local `Marshal` / `Unmarshal` wrappers.** The file is in `common/` where the wrappers themselves live, so direct usage is technically permitted — but using the wrappers would keep CLAUDE.md Rule 1 audits clean by grep without false positives.

- [ ] **Doc comment on `SubscribeConfigChanged` about handler latency.** Handler runs synchronously inside the receive loop. go-redis subscriber buffer is 100 messages with a 60s send timeout — a slow handler could drop messages on burst.
  - Fix: one-line godoc: `// Handler is invoked inline on the receive goroutine; it must complete quickly to avoid dropping messages during bursts.`

- [ ] **Clean-shutdown pattern for self-filter test.** `common/redis_pubsub_test.go::TestSubscribeConfigChanged_FiltersSelfMessages` races `defer cancel()` against `cleanup()`, producing a benign `redis: discarding bad PubSub connection` log on teardown. Cosmetic; refactor to explicit `<-done` ordering before cleanup.

---

## How to use this file

- Pick an item, file a PR, mark it `- [x]` in the same PR.
- If something stays here for >3 months, either schedule it or delete it (dead TODOs are noise).
- New items should follow the same shape: title in bold + the source PR/plan + the concrete fix.
