# Intelligent Routing Rollout and Operations

## Runtime contract

Intelligent routing is disabled by default and runs only for OpenAI-compatible Chat Completions and Responses text endpoints. Image, audio, embedding, rerank, realtime, Claude-native, Gemini-native, and task endpoints keep their existing routing and billing behavior.

The client-facing model remains the model selected in the request. Live routing rewrites only the upstream execution request, normalizes the returned `model` field to the requested identifier, and bills against the successful execution model. It never automatically falls back to the requested model unless that model is independently present in the eligible candidate plan.

Routing details remain backend-only under `other.admin_info.intelligent_routing`; ordinary user log views remove `admin_info`.

## Configuration

Configure the registered `intelligent_routing_setting` object through the system options API or administrator settings storage:

- `enabled`: enables planning.
- `shadow_only`: when `true`, records plans without changing execution; when `false`, executes the plan.
- `policy_version`: positive version stored with every decision.
- `max_attempts`: total upstream attempts, default `4`.
- `max_endpoints_per_model`: endpoint attempts per model, default `2`.
- `non_stream_budget`: Go duration in nanoseconds, default `30000000000`.
- `stream_first_byte_budget`: Go duration in nanoseconds, default `12000000000`.
- `max_cost_multiplier`: cumulative expected-cost ceiling relative to the first node, default `2.5`.
- `quality_thresholds`: task-to-probability map.
- `models`: candidate model policies.

Example:

```json
{
  "enabled": true,
  "shadow_only": true,
  "policy_version": 1,
  "max_attempts": 4,
  "max_endpoints_per_model": 2,
  "non_stream_budget": 30000000000,
  "stream_first_byte_budget": 12000000000,
  "max_cost_multiplier": 2.5,
  "quality_thresholds": {
    "translation": 0.88,
    "summary": 0.88,
    "general": 0.90,
    "code": 0.93,
    "extraction": 0.94,
    "reasoning": 0.95,
    "json_schema": 0.97,
    "tool": 0.98
  },
  "models": [
    {
      "model": "deepseek/deepseek-chat",
      "tier": 1,
      "input_price": 0.28,
      "output_price": 0.42,
      "context_limit": 65536,
      "capabilities": ["tools", "json_schema"]
    }
  ]
}
```

Routing prices use one consistent per-million-token unit and control candidate ordering. Configure the same execution models in the existing model-price/model-ratio billing settings; settlement uses those billing settings for the actual successful execution model.

## Selection and fallback

The router performs deterministic task classification, capability and 70%-context filtering, task-specific quality filtering, and expected-cost ordering. Cold-start quality priors are `0.88`, `0.92`, `0.96`, and `0.99` for tiers L0 through L3. After 30 model/task observations, beta-smoothed observed quality replaces the prior.

Endpoint health uses a rolling 60-second window:

- fewer than 20 observations: `PROBATION`;
- at least 99% success: `HEALTHY`;
- 95% through below 99% success: `DEGRADED`;
- below 95% success: `OPEN` and excluded until the rolling window expires.

The execution sequence permits no more than four attempts, two endpoints per model, the configured elapsed-time budget, and 2.5 times the first candidate's expected cost. Reaching the time or cost limit skips directly to at most one remaining highest-success final candidate.

Non-streaming responses are validated before client commitment for non-empty output, truncation, JSON output, declared tool names, and JSON tool arguments. A validation failure moves to the next route node. Streaming requests retry only before response commitment.

## Session stickiness

Clients may send `X-Session-ID`; otherwise the backend derives an account-scoped fingerprint from the first user message. A successful route is preferred for 30 minutes when the task is unchanged, the endpoint is not degraded/open, and its expected cost is no more than 1.15 times the cheapest qualified route. Two consecutive response-validation failures invalidate the sticky route.

The session identifier and fingerprint are not returned to clients.

## Audit

Administrator routing audit contains:

- policy version, requested model, execution model, shadow/live state;
- ordered candidate models, channels, quality probabilities, costs, and reason codes;
- every attempted node, outcome, bounded failure reason, and latency;
- final attempt index and planning error when present.

The ordinary consume log continues to hold actual prompt/completion tokens and charged quota. Quota saturation remains under the adjacent `admin_info.quota_saturation` marker.

## Rollout

1. Configure candidate and billing prices with `enabled=false`.
2. Enable `shadow_only=true` and inspect candidate eligibility, savings, and no-route errors.
3. Set `shadow_only=false` for a controlled group after shadow results pass.
4. Monitor first-route success, multiple attempts, final failures, latency, actual charged quota, and quality-validation failures.
5. Increase `policy_version` for every policy change.

## Rollback

Set `intelligent_routing_setting.enabled=false`. The existing channel selector resumes immediately without a restart or frontend change. Historical routing audit retains its policy version.

## Verification

```powershell
$env:GOCACHE="$PWD\.gocache"
go test -race ./service/intelligent_routing -count=1
go test ./setting/intelligent_routing_setting ./service/intelligent_routing ./model ./controller ./service ./middleware ./relay/channel/openai -count=1
go test ./... -count=1
Push-Location relaykit
$env:GOWORK="off"
go build ./...
Pop-Location
git diff --check
```
