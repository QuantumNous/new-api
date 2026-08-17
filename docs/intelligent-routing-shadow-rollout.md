# Intelligent Routing Shadow Rollout

## Purpose

The shadow phase computes a cost-optimized route plan for eligible text requests while preserving the existing live channel selection, retry behavior, requested model, response, and billing path.

## Configuration

The router is disabled by default. Configure it through versioned system options using the `intelligent_routing_setting.*` prefix:

- `enabled`: enables route-plan generation.
- `shadow_only`: must remain `true` during this phase.
- `policy_version`: positive integer stored with every decision.
- `max_attempts`: default `4`.
- `max_endpoints_per_model`: default `2`.
- `non_stream_budget`: nanoseconds, default `30000000000`.
- `stream_first_byte_budget`: nanoseconds, default `12000000000`.
- `max_cost_multiplier`: default `2.5`.
- `quality_thresholds`: JSON map keyed by task type.
- `models`: JSON array of model policies containing model, tier, input/output price, context limit, and capabilities.

Example model policies:

```json
[{"model":"deepseek/deepseek-chat","tier":1,"input_price":0.28,"output_price":0.42,"context_limit":65536,"capabilities":["tools","json_schema"]}]
```

Prices use the same per-million-token unit for every configured candidate.

## Rollout

1. Configure candidates while `enabled=false`.
2. Set `shadow_only=true`, increment `policy_version`, then enable routing.
3. Inspect `other.admin_info.intelligent_routing` in administrator logs.
4. Compare planned tiers, expected cost, planning errors, and existing successful execution.
5. Keep live cross-model routing disabled until shadow observations satisfy the design targets.

The audit contains at most four candidates and eight reason codes per candidate. It remains under `admin_info`, which is removed from non-administrator log views.

## Rollback

Set `intelligent_routing_setting.enabled=false`. Existing live channel selection does not require a process restart or client configuration change. Keep the policy version and audit data for later analysis.

## Verification

```powershell
$env:GOCACHE="$PWD\.gocache"
go test ./setting/intelligent_routing_setting ./service/intelligent_routing ./model ./controller ./service ./middleware -count=1
go test ./... -count=1
Push-Location relaykit
$env:GOWORK="off"
go build ./...
Pop-Location
git diff --check
```
