# Unlimited Managed Upstream Candidate Pool

## Goal

Enroll every currently supported managed upstream group that passes the existing
source, freshness, balance, multiplier, health, model-vendor, exclusion, and
price checks. A failed request skips the failed route and tries the next
eligible route, but one request may attempt no more than five distinct channels.

## Decision

`candidate_limit` controls candidate-pool admission and is independent from
`request_attempt_limit`, which controls per-request failover.

- `candidate_limit = 0` means no admission limit.
- `candidate_limit > 0` keeps the existing per-model candidate limit.
- `candidate_limit < 0` is invalid and normalizes to the default value of `5`.
- `request_attempt_limit` remains constrained to `1..5`; production remains `5`.
- Existing sort order, cross-source preference, health rules, model exclusions,
  shadow admission, quarantine behavior, and the 90-second failover budget stay
  unchanged.

Production will set `candidate_limit=0` only after the compatible image is
deployed. This separates a large managed pool from the bounded work performed
by an individual request.

## Alternatives

1. Raise the fixed candidate limit to a larger number such as 20.
   This is simple but creates another arbitrary ceiling and does not represent
   the requested "all supported groups" behavior.
2. Detach overflow routes from orchestration.
   This avoids a code change but loses health reconciliation, ranking, and
   automatic recovery for those routes.
3. Use `0` as unlimited while retaining the independent five-attempt request
   cap.
   This is the selected approach because it is explicit, backward compatible
   for existing positive values, and preserves bounded request behavior.

## Backend Changes

### Setting normalization

Update `normalizeUpstreamOrchestrationSetting` so zero is preserved as the
unlimited sentinel. Negative values normalize to `5`. Positive values are
accepted without the old hard maximum of `5`.

### Candidate selection

Keep deterministic sorting before selection. When the limit is zero, return all
sorted candidates and preserve each candidate's full eligible model subset.
When the limit is positive, retain the current per-model selection algorithm.

### Probe scheduling

The probe query must omit the SQL `LIMIT` clause when `candidate_limit=0`.
Applying `LIMIT 0` would incorrectly suppress all probes. Positive limits keep
the existing bounded query.

### Request failover

No failover-loop behavior changes are required. The existing
`request_attempt_limit` remains `5`, so attributable failures move to the next
route until success, terminal response state, the five-channel cap, or the
90-second budget is reached. Unknown writes remain fail-closed and are never
retried.

## Operational Flow

1. Deploy the compatible image with the default `candidate_limit=5`.
2. Set production `candidate_limit=0` and keep `request_attempt_limit=5`.
3. Synchronize all three authenticated upstream snapshots.
4. Enroll every newly eligible group as a disabled channel pair and shadow
   managed routes.
5. Probe each protocol route; promote only routes that meet the existing shadow
   success threshold.
6. Verify that unsupported, unhealthy, stale, over-price, or explicitly
   excluded groups remain absent from the active pool.

## Error Handling

- Invalid negative candidate limits fall back to `5`.
- Empty or invalid model sets remain ineligible.
- Failed or error monitor states remain excluded.
- Attribution-safe request failures advance to the next candidate.
- Unknown-write outcomes stop failover.
- Candidate-pool size never overrides the five-attempt request cap.

## Tests

Use strict RED/GREEN tests for:

1. Setting normalization preserves zero and accepts a positive value above five.
2. Unlimited selection returns all sorted eligible candidates.
3. Positive candidate limits retain existing per-model behavior.
4. Probe loading with zero does not emit `LIMIT 0` and returns all due routes.
5. Existing request failover tests still prove at most five distinct attempts.

Run the focused upstream orchestration suite, the request failover suite, and
the affected package tests. The production-base service package currently has
unrelated App Plugin runtime-metadata test failures when run outside its matrix
runner; record those separately rather than treating them as regressions.
