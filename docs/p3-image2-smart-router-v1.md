# P3 Image2 Smart Router v1 — development handoff

Status: development complete, not released. This document describes local code
only; it does not authorize channel, model-group, pricing, or production
configuration changes.

Rebuilt baseline: `d3e58361d9b5705462b097b708586aed816bc28b` (Dashboard on the
final P2 tree; P2 ancestor `7243d4f27e45893677fbe9d0105951b2bfaa9b44`, P1
ancestor `24fa0a872d4a3f2a67d6bf6e07e104c5c8063ef2`). The historical P3
commits `8f83e89c`, `75b4d596`, `c584aabc`, `362b913f`, and `91872cfe` were
audited for net behavior and selectively ported. The older integrated
candidate `80b78874da1ca955470d690e49fa96b964553089` was not merged, and no
historical acceptance result carries over.

## Existing capability check

- One public model can already bind to many enabled channels: the channel cache
  indexes `group -> model -> []channel IDs` in `model/channel_cache.go`, and
  `model.GetRandomSatisfiedChannel*` selects an eligible one.
- There was no resolution-aware selector. The new `model.GetSatisfiedChannels`
  deliberately exposes the full eligible set to the capability router.
- This belongs in the built-in relay, not a plugin or a separate service: the
  relay owns the replayable request body, billing session, response-written
  evidence, and `RelayInfo` needed for safe failover.
- Existing reusable safety controls are `service.EvaluateSafeFailover`, the
  exhaustive exclusion set in `service.RetryParam`, and the relay's request ID
  / billing lifecycle. It already stops on response started, customer cancel,
  content safety, acceptance evidence, and skip-retry errors.
- P3 adds an Image2-specific replay allowlist. Only 429, explicit 5xx,
  transport failures, and channel-local failures that have not reached the
  upstream may continue. Deterministic 4xx responses do not switch channels.
  For Image2, a 5xx or transport failure arriving at or after the image guard
  is blocked unless the error contains explicit non-acceptance evidence such
  as `not accepted`, `task not created`, or `not billed`.

## Architecture

Each channel may opt in through its existing channel `setting` JSON:

```json
{
  "image2_capability": {
    "enabled": true,
    "operations": ["generations", "edits"],
    "resolutions": ["1024", "2048", "uhd"],
    "qualities": ["standard", "high"],
    "max_n": 4,
    "route_priority": 20,
    "edits_accepted": true
  }
}
```

`route_priority` provides the desired ordering without source code channel IDs
or cost ordering. Operators can declare Web/Codex/Adobe priorities as 10/20/30
for 1024, 20/30 for 2048, and 30 for UHD using their capabilities. A candidate
is excluded before an upstream attempt when operation, edit acceptance,
resolution, quality, or quantity is incompatible. Missing capability metadata
is safely excluded while the feature is enabled.

The isolated capability profiles used by the development proof are:

| profile | operations | resolutions | qualities | max `n` | edits | priority |
|---|---|---|---|---:|---|---:|
| Web | generations | 1024 | standard | 1 | not accepted | 10 |
| Codex | generations, edits | 1024, 2048 | standard, high | 4 | accepted in the proof profile | 20 |
| Adobe | generations | 1024, 2048, uhd | standard, high | 4 | not accepted until separately verified | 30 |

These are test metadata profiles only; they do not name or modify production
channels. The candidate-chain proof checks 1024/2048/UHD generation,
standard/high quality filtering, edit acceptance, quantity limits, and an
isolated `503 -> 503 -> 200` walk through Web, Codex, then Adobe. Explicit
`SAFE_FAILOVER_MAX_ATTEMPTS=0` is required for the exhaustive three-candidate
case; the bounded default remains one cross-channel retry.

The `IMAGE2_SMART_ROUTING_ENABLED` environment switch defaults to `false`. In
that state the original selector is untouched. When enabled for `gpt-image-2`
image generation/edit requests, capability ordering becomes the candidate
chain and the existing safe-failover logic makes each compatible channel
eligible once at most.

`SAFE_FAILOVER_MAX_ATTEMPTS` defaults to one cross-channel retry when omitted.
An explicit `0` retains the opt-in exhaustive behavior (each eligible channel
at most once); a positive value is a hard cross-channel retry limit.

The integration changes only the synchronous image relay path. Seedance task
submission, its Ctyun non-replay guard, and all files under
`relay/channel/task/doubao/` remain unchanged from the rebuilt baseline.

## Logging and billing relationship

The relay logs the normalized request shape, selected chain, and every
exclusion reason as `image2 smart routing`. The normal `use_channel` chain and
existing error log `admin_info.use_channel` continue to provide per-attempt
channel history. Billing remains attached to the public model and existing
`RelayInfo` billing session; this change does not select by cost or alter any
price data.

Image2 replay decisions classify failures before applying the late-generation
guard: deterministic HTTP 4xx (except 429 capacity), 429 capacity, explicit
5xx, transport, and channel-local failures are kept separate. A 5xx or
transport error arriving at or after the image guard is not replayed unless
the provider response explicitly proves that the request was rejected before
dispatch (for example `task not created`, `not billed`, or `before dispatch`).
This conservative rule prevents a late ambiguous error from charging twice.

## Known rollout requirements

No existing channel has been configured by this change. Before any isolated
acceptance deployment, each intended test channel needs explicit capability
metadata, and Adobe edits must remain `edits_accepted: false` until accepted.
For Adobe or any other upstream that has not passed edits acceptance, omit
`"edits"` from `operations` and keep `edits_accepted: false`; add both only
after edits acceptance passes. The switch must remain off until the rebuilt
commit receives new independent acceptance; no prior P3 verdict is inherited.

## Historical validation reference

The validation bullets below belong to the historical source candidate and are
not a verdict for this rebuilt commit. The new rebuild must be re-run against
its own exact parent and recorded by the implementing handoff:

- scoped Go race tests, vet, build, and frontend checks;
- the Image2 capability, replay, late-guard, attempt-boundary, and Redis
  isolation cases;
- P1/P2, Dashboard, and Seedance diff checks and regression tests.

Any full-repository failures must be compared with the exact parent and must
not be reported as a P3 pass.

The P3 tests cover 1024/2048/UHD selection, generations versus edits, quality
and quantity filtering, zero calls to incompatible candidates, duplicate
channel elimination, isolated `503 -> 503 -> 200`, deterministic 4xx stops,
accepted/unsafe replay stops through the P3 wrapper and shared stage guards,
administrator-pinned channels, the disabled-switch legacy path, failure-class
boundaries, the exact late-guard boundary, and one/zero/exhaustive retry caps.
`service/image2_redis_isolation_test.go` is opt-in and accepts only a
loopback Redis address; it verifies hash fields, HSET field updates, EXPIRE,
TTL preservation, and expiry against a disposable local Redis instance.
