# Asset Review Hardening And Available Models Design

## Goal

Make public asset readiness accurately describe partial model availability while
closing the confirmed lease, retry, provider-result, and probe correctness gaps
reported on PR #670.

## Public API

Every canonical `Asset` response adds:

```json
{
  "available_models": ["seedance-2.0-fast"]
}
```

`available_models` is always present and is sorted and deduplicated. It contains
only models in the authenticated request scope for which all of the following
are true at response time:

- the readiness row is `Active`;
- the row matches the current target generation, channel, and binding scope;
- the current target is eligible for the authenticated scope; and
- an exact provider binding is `Active` and has a non-empty upstream asset ID.

The aggregate `status` keeps its existing meaning. It becomes `Active` only
when every required model is available. Therefore an asset may return
`status: "Processing"` together with a non-empty `available_models` list.
Source-terminal assets return an empty list. The response does not expose
channels, credentials, binding scopes, target generations, or upstream IDs.

## Reconciliation And Creation

The controller resolves the authenticated model scope before a direct URL or
multipart upload performs durable source writes. This prevents invalid scope
or specific-channel input from creating an asset whose public ID is never
returned. Completion of an existing signed upload keeps the durable source and
returns its public asset response even if readiness reconciliation encounters
an internal transient failure; readiness remains recoverable through later GET
reconciliation.

GET reconciliation remains intentional because it detects configuration drift
and enrolls newly required models. The write path stays idempotent and does not
remove this behavior.

## Lease And Provider Write Safety

- Each readiness row uses a fresh database timestamp when it is claimed and
  processed; a batch-start timestamp is used only for the initial due-row
  snapshot.
- Before an external provider write, the binding lease is based on a fresh DB
  timestamp and the provider deadline is strictly shorter than the remaining
  lease.
- Binding activation always fences on owner and expected lease expiry in both
  synchronous and worker paths.
- A successful provider result is retried into the binding while the fenced
  lease remains valid. If the first activation CAS loses a race, the current
  binding is re-read: an identical stored result is reused, while a conflicting
  owner/result is never overwritten.
- The implementation records a stable materialization operation key before the
  provider call and sends it to provider adapters that support an idempotency
  header. Local correctness does not assume that an upstream honors the header;
  lease fencing and result recovery remain required.

Exactly-once behavior cannot be guaranteed across an arbitrarily long database
outage unless the provider honors idempotency or exposes compensation. The
implementation must prevent duplicates for supported provider idempotency and
for local lease/CAS races, and must retain a recoverable binding state for
transient database failures instead of immediately starting another upload.

## Retry And Rotation

- HTTP 408 is retryable timeout.
- Numeric and date-form `Retry-After` values are capped before conversion to a
  duration and before scheduling.
- TechMobi `Processing` responses with a valid asset URL persist that URL and
  transition to provider polling rather than upload again.
- Exhausting the retry window advances to the next eligible candidate. If no
  candidate remains, the target becomes unavailable and readiness becomes
  terminal `Failed`; it never republishes the last candidate as a new
  generation merely to reset attempts.
- Target initialization rechecks eligibility after claiming the selection
  lease. If another caller already published an eligible target, the lease is
  released without incrementing generation.

## Probe Contract

The coverage probe exits zero only for `SUCCESS`, `completed`, or `succeeded`.
Failed, cancelled, expired, or unknown terminal task states retain their public
JSON output and exit non-zero. PowerShell dictionary member syntax is unchanged
because it is valid under the supported StrictMode behavior.

## Testing

Regression tests must first reproduce and then prove:

- partial readiness returns the exact sorted `available_models` subset;
- stale batch time cannot issue an expired lease to a later row;
- provider success followed by an activation retry does not call CreateAsset a
  second time;
- the final retryable candidate becomes unavailable after its window;
- concurrent target initialization cannot republish an eligible target;
- 408 and extreme Retry-After values remain bounded and retryable;
- TechMobi Processing plus asset URL enters refresh flow; and
- the probe returns non-zero for a failed video task.

Targeted controller, service, model, middleware, OpenAPI, PowerShell parser and
mock-probe tests are required, followed by `go build ./...` and `go vet` for the
changed Go packages.

## Rollout

Router and any process running the asset readiness worker must deploy together.
Keep strict coverage disabled during mixed-version rollout, allow migrations and
workers to converge, validate partial `available_models` in staging, then enable
strict coverage.
