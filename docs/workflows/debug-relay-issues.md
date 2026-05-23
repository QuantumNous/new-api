# How to debug relay issues

Triage guide for problems on the `/v1/*` endpoints. Use this when a client reports an error or hang. Covers the most common 8 categories, in rough order of frequency.

Each section: **symptom** → **first 3 things to check** → **where to fix**.

For deeper architecture context see [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §"The mental model" and §"Two-layer routing".

## Tools you'll use

```bash
# Tail server logs
docker compose logs -f new-api

# Pull a specific tenant's recent log rows
docker compose exec postgres psql -U root -d new-api -c \
  "select created_at, type, model_name, channel, content from logs where user_id=42 order by id desc limit 20;"

# See active channel selection state (in-memory cache snapshot)
curl -s http://localhost:3000/api/log/channel_affinity_usage_cache | jq .

# Smart-router health
curl -s http://localhost:8001/health | jq .

# Replay a request with curl
TOKEN=sk-<token>
curl -i -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]}'
```

Always check the response header **`X-DeepRouter-Routed-Model`** — for `deeprouter-auto` requests, it tells you which model smart-router actually picked. If missing on a `deeprouter-auto` request, smart-router was unreachable and the gateway fell back to the default model.

## 1. `401 unauthorized` / `403 forbidden`

**First 3 checks**:
1. Token expired or disabled? `select status, expired_time from tokens where key = '<token-prefix>%';` — status=2 means disabled.
2. Token tenant matches the model's allowed groups? Token's user's `group` must intersect with channel's `groups` (CSV) for the requested model.
3. Quota exhausted? `select quota, used_quota from users where id=<token.user_id>;` — quota=0 means out.

**Fix locations**:
- `middleware/auth.go:TokenAuth` — token validation
- `model/ability.go` — group/model/channel lookup
- `service/quota.go` — quota check

## 2. `400 model_not_eligible_for_kids_mode`

**Symptom**: kids_mode tenant gets 400 with this error code.

**Likely cause**: the requested model isn't in `internal/kids/EligibleModels`. By design — see [`internal/kids/README.md`](../../internal/kids/README.md).

**Fix**:
- Wrong: edit the whitelist hastily. Each addition is a kids-safety decision.
- Right: confirm with product that the model is appropriate; if yes, add it via a PR (review required); if no, use a different model.

## 3. `404 no available channel`

**Symptom**: model exists in admin UI but request says no channel found.

**First 3 checks**:
1. Is the channel enabled? `select id, name, status from channels where models like '%<model>%';` — status must be 1 (enabled).
2. Is the tenant's group in the channel's `groups`? Both `users.group` and `channels.groups` (CSV) must match.
3. Did the channel auto-disable? Look for `status=3` (auto-disabled by failed health check). Re-enable manually after fixing root cause.

**Fix locations**:
- Admin UI → Channels → check status/groups
- `model/channel_cache.go:GetRandomSatisfiedChannel` — selection algorithm
- `model/ability.go` — denormalized lookup table; if you just changed channel models/groups, the in-memory cache may be up to `SYNC_FREQUENCY` (60s) seconds stale

## 4. `429 rate limit` from upstream

**Symptom**: relay returns 429 with the upstream's rate-limit message.

**First 3 checks**:
1. Is the channel's per-minute budget set? If yes, was it hit? `select channel_info from channels where id=<id>;` and look for `rpm_budget`.
2. How many channels exist for this model? `select count(*) from abilities where model='<model>';` — if 1, you have no failover.
3. Are other tenants hammering the same key? Look at recent `logs` filtered by `channel`.

**Fix locations**:
- Admin UI → Channel → add more keys to the channel (multi-key mode)
- Multi-key channels: `model/channel.go:GetNextEnabledKey` rotates through keys; one rate-limited key auto-skips for the current minute
- For long-term: spread traffic across more provider accounts

## 5. `5xx` from upstream provider

**Symptom**: relay forwards a 502/503 from the upstream.

**First 3 checks**:
1. Is it the upstream's outage? Check the provider's status page directly.
2. Is the channel's `key` valid? Test it via the admin UI's "Test channel" button.
3. Does retry / fallback work? Try the request 3 times. If it intermittently succeeds, this is a flaky provider — increase retry count or add another channel.

**Fix locations**:
- Channel test: `controller/channel-test.go`
- Retry logic: search `RetryEnabled` in `service/` — usually configurable via admin UI / `setting/operation_setting/`
- Cross-model fallback for `deeprouter-auto` requests: defined by `smart-router`'s `fallback_chain`

## 6. Request hangs (timeout or never returns)

**Symptom**: client waits indefinitely; eventually hits its own timeout.

**First 3 checks**:
1. Streaming? Provider's first chunk took > `STREAMING_TIMEOUT` (default 120s)? Tunable via env var.
2. Smart-router stuck? `curl http://localhost:8001/health` — should respond in < 10ms. If it doesn't, restart the smart-router container.
3. Postgres slow? `docker compose exec postgres psql -U root -d new-api -c "select pid, query, state, wait_event from pg_stat_activity where state != 'idle';"`. Look for long-running queries.

**Fix locations**:
- Streaming timeout: `STREAMING_TIMEOUT` env var on `new-api` service
- Smart-router: `middleware/smart_router.go` uses `internal/smart_router_client/Default()` with a 100ms HTTP timeout; if smart-router itself hangs (rare), `(nil, nil)` should still come back from the circuit breaker after 5 failures
- DB locks: usually self-resolving; if persistent, check long-running transactions

## 7. Quota deducted but request failed

**Symptom**: user reports "I was charged but got an error".

**First 3 checks**:
1. Was the request 5xx after the pre-consume? Pre-consume deducts at the start; final settlement happens at the end. A bug or crash between them can leave the deduct without a refund.
2. Look at the `logs` row for this request — it should have a `type=ERROR` row with details.
3. Is the model's pricing right? Check `setting/ratio/model_ratio.go` for the model.

**Fix locations**:
- Pre-consume / settlement: `service/quota.go`
- Refund-on-failure: see PLAN.md Phase 4 task — currently the system bills on success only when settlement runs; pre-consume failures are refunded automatically

## 8. Streaming chunks malformed / client parser breaks

**Symptom**: client SDK reports JSON parse error on a streaming chunk.

**First 3 checks**:
1. Which provider/channel? Look at `X-DeepRouter-Routed-Channel-Id` (if exposed) or in `logs.channel`.
2. Does the same request without `stream:true` work? If yes, the bug is in the streaming parser of that adapter.
3. Is `stream_options.include_usage` set? Some providers don't support it and emit malformed last chunk.

**Fix locations**:
- Provider's streaming parser: `relay/channel/<provider>/relay-<provider>.go` look for `processStream` / `parseSSE` function
- The adapter should emit OpenAI-shape chunks (`{"choices":[{"delta":{...}}]}`) regardless of the upstream's native format — see [`relay/channel/README.md`](../../relay/channel/README.md) §"Common pitfalls"

## A useful pattern: replay against the dev compose

When a production user reports a weird error, capture the request body and replay locally:

```bash
# Local dev with the same model + same channel (configure the channel in admin UI)
TOKEN=sk-localtoken

# Save the exact request body from production logs (sanitize PII first)
cat > /tmp/req.json <<EOF
{"model":"...","messages":[...]}
EOF

curl -i -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/req.json

# Run with -i to see the response headers (X-DeepRouter-Routed-Model is gold)
```

Then turn on debug logging:

```bash
docker compose exec new-api sh -c 'export DEBUG=true; <restart>'
# Or set DEBUG=true in the compose env and recreate
```

## When to escalate

- Repeated same error → file a workflow update with the recipe.
- Suspected upstream-provider bug → reproduce with their official client (e.g. `openai` Python SDK pointed at their endpoint directly, NOT through DeepRouter). If still broken, it's their bug — escalate to them.
- Performance regression after a deploy → `git log --oneline upstream/main..HEAD` to find recent commits; bisect the dev compose against them.
- Security incident (leaked key, suspicious traffic) → see [`../adr/0004-channel-key-plaintext.md`](../adr/0004-channel-key-plaintext.md) for the leak-response posture; rotate any compromised channel keys immediately.

## What this guide does NOT cover

- Database schema corruption / restore — see [`../DEPLOYMENT.md`](../DEPLOYMENT.md) §"Restore drill"
- AWS infrastructure issues (instance unreachable, IAM, EBS) — AWS console + CloudWatch
- Smart-router internal bugs — see `../../../smart-router/CLAUDE.md` and `../../../smart-router/internal/*/README.md`
- Admin UI bugs — different debugging stack (browser devtools, Rsbuild source maps)
