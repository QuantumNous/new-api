# ModelAPI Seedance 2.5 Billing Design

## Goal

Reuse the existing asynchronous task billing hooks so `doubao-seedance-2-5-260628` is precharged before submission and corrected from the upstream task-price snapshot immediately after a successful submit response.

The public model name and `/v1/videos` contract remain unchanged. Billing must account for both pricing dimensions documented by the upstream: video-input presence and output resolution.

## Official pricing contract

Source checked on 2026-08-11: <https://api.modelapi.co/v1/models/doubao-seedance-2-5-260628/api-doc>

| Video input | Resolution | Price formula |
| --- | --- | --- |
| No | `480p` | `$0.140 * duration` |
| No | `720p` | `$0.314 * duration` |
| Yes | `480p` | `$0.084 * total_video_duration` |
| Yes | `720p` | `$0.188 * total_video_duration` |

The documented request defaults are `duration=5` and `resolution=720p`; supported duration is 4 through 30 seconds. A successful `POST /v1/tasks` response may include `usage.estimated_usd` as either a number or `null`. The pricing note says actual billing uses the task pricing snapshot and may include valid operational or user discounts.

The ModelAPI document does not define how it derives `total_video_duration` when media duration is omitted. Flatkey therefore must not claim that a locally calculated video-input amount is exact.

## Selected design

Use the existing three-stage task billing seam:

1. `EstimateBilling` calculates a safe request-time reservation expressed as a multiplier over a `$0.14` base `ModelPrice`.
2. `DoResponse` persists a valid, positive, finite `usage.estimated_usd` inside private task submission data.
3. `AdjustBillingOnSubmit` converts the upstream dollar estimate back into billing units and lets the existing relay settlement path reconcile the reservation immediately.

The default model price is `$0.14`. This is a calculation base, not a claim that every request costs `$0.14`.

One `OtherRatios` entry represents the complete billable-unit multiplier:

```text
billable_units = estimated_usd / model_price
quota = model_price * billable_units * group_ratio * quota_per_unit
```

Using one complete multiplier avoids compounding or rounding drift across separate duration, resolution, and video-input ratios.

## Request-time reservation

For requests without video input, the amount is fully determined from public request fields:

```text
480p: 0.140 * resolved_duration
720p: 0.314 * resolved_duration
```

Missing duration resolves to 5. Missing resolution resolves to `720p`.

For requests with video input, Flatkey cannot reliably inspect arbitrary remote media or reproduce the upstream definition of `total_video_duration`. The fallback reservation uses the maximum supported request duration, 30 seconds, at the matching video-input rate:

```text
480p: 0.084 * 30
720p: 0.188 * 30
```

This is a bounded reservation fallback, not an asserted final price. A non-null upstream `estimated_usd` replaces it during submit settlement. If the upstream returns `null`, the reservation remains in place rather than guessing a lower amount or making the task free.

## Submit-response correction

`modelAPISubmitResponse` gains a typed usage object. `DoResponse` accepts `estimated_usd` only when it is positive and finite. It persists only the status and normalized numeric estimate required for billing; the public response remains the Flatkey task object and does not expose supplier billing metadata.

`AdjustBillingOnSubmit` reads the private submission snapshot and returns a replacement `OtherRatios` map when all of the following are true:

- task data is valid JSON;
- `estimated_usd` exists and is positive and finite;
- fixed-price billing is active;
- `ModelPrice` is positive and finite.

Otherwise it returns no adjustment, preserving the request-time reservation.

## Fail-closed price configuration

This channel must use fixed-price billing. A channel-specific `ValidateTaskPriceData` rejects ratio fallback, zero or negative model prices, and non-finite values. This prevents an administrator setting or permissive unset-ratio mode from silently producing free or nonsensical video jobs.

The existing group-ratio, wallet, and subscription paths remain authoritative. The adapter supplies only billable units; it does not bypass `PreConsumeBilling`, `SettleBilling`, subscription weighting, refunds, or persisted `TaskBillingContext` snapshots.

## Alternatives considered

### Four synthetic public model names

Rejected because callers must continue using one official model name. Encoding price tiers into model aliases would leak billing implementation into routing and make fallback between Seedance channels unsafe.

### Billing-expression tiers

Rejected for this channel because the upstream already returns a per-task price snapshot and the public request does not contain a trustworthy `total_video_duration`. A new expression and metadata pipeline would duplicate the existing task billing hooks without improving accuracy.

### Local media probing

Rejected because fetching customer-controlled media during preflight expands SSRF, latency, bandwidth, and timeout risk. It still would not guarantee parity with the upstream's duration calculation.

## Multi-node behavior

No process-local state is introduced. Request parsing remains scoped to the Gin request context; the reservation and corrected billing values flow through the existing billing session and are persisted in the task billing snapshot. Every router instance performs the same deterministic calculation from the request and submit response.

## Error and privacy behavior

- Invalid or missing pricing configuration fails before upstream submission.
- Invalid or null `estimated_usd` does not fail an otherwise valid task; it retains the reservation.
- Upstream supplier names, hosts, internal task IDs, raw responses, and private asset URLs remain absent from public responses.
- No new client-visible endpoint or response field is introduced.

## Test contract

Tests must cover:

- default `5s/720p` no-video reservation;
- explicit duration for no-video `480p` and `720p` requests;
- video-input fallback reservations for `480p` and `720p`;
- resolution and video-input detection through the shared Seedance request parser;
- valid `usage.estimated_usd` persistence and submit-time correction;
- `null`, missing, zero, negative, malformed, and non-finite estimate fallback behavior;
- fixed-price validation, including ratio fallback and invalid model prices;
- the default `$0.14` model-price entry;
- group-ratio preservation and the existing wallet/subscription settlement paths;
- no public response or persisted public task data leakage.

## Deployment impact

`Router deploy: required` because the change affects `/v1/videos` relay precharge and settlement. `newapi-console` also needs the same backend build so pricing configuration and model metadata stay consistent across the production split. `newapi-web`, Terraform, Cloudflare, and the decommissioned legacy service are not involved.
