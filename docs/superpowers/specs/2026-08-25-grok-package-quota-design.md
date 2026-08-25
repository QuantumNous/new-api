# Grok Subscription Package Quota Design

## Goal

Expose the same useful Grok Build billing facts that Grok2API exposes in Flatkey's existing Grok Subscription channel account-status dialog: plan/tier, monthly credits, on-demand credits, prepaid balance, weekly usage percentage, and billing-period boundaries.

## Scope and invariants

- Flatkey remains the system of record for the persisted, non-secret Grok account projection.
- The existing channel-scoped refresh lease, monotonic billing observation write, stale-evidence checks, and media eligibility decision remain unchanged.
- Billing refreshes are read-only GET requests to the Grok CLI billing and user endpoints. They never issue a model/media generation request.
- Access/refresh tokens, raw upstream bodies, lease fields, and channel keys remain private and are never returned by the account-status API or frontend.
- Existing snapshots remain readable; newly added fields are optional and older rows continue to render safely.

## Data flow

1. A Grok refresh loads the channel credential under the existing lease.
2. `ProbeBilling` reads the monthly billing response and the `format=credits` response, then performs a best-effort subscription-tier lookup only when billing responses contain no plan/tier signal.
3. The parser accepts Grok2API's wrapper shapes (`config`, `{\"val\": ...}`), camelCase and snake_case aliases, and extracts only whitelisted scalar billing fields.
4. Derived values are calculated deterministically:
   - monthly credits: `limit = monthlyLimit`, `used = used` (fallback `includedUsed`/`totalUsed`), `remaining = max(limit-used, 0)`;
   - on-demand credits: `limit = onDemandCap`, `used = onDemandUsed`; if the upstream omits used and provides a positive usage percentage, infer `used = limit * percent / 100`;
   - prepaid-only accounts expose `prepaidBalance` as remaining;
   - a weekly usage period exposes `used = creditUsagePercent`, `limit = 100`, `remaining = 100-used`, and its reset boundary;
   - a missing percentage falls back to `used / limit * 100` for the applicable credit pool.
5. The sanitized snapshot is conditionally persisted through `SaveGrokBillingObservationAt` and projected by the existing status handler.
6. The frontend dialog renders the observed plan, monthly/on-demand/prepaid values, weekly percentage, and reset dates without exposing raw snapshot JSON.

## API shape

`GrokAccountStatusView` keeps its current top-level fields. Each quota window gains optional numeric and period fields (`limit`, `used`, `remaining`, `unit`, `period_start`, `period_end`, `reset_at`, `on_demand_*`, `prepaid_balance`) while retaining `status_code`, `usage_percent`, `used_percent`, and `monthly_limit_cents` for backward compatibility. The server projection reads only the versioned sanitized snapshot and omits corrupt/unknown snapshots.

## Error handling and compatibility

- Successful responses with malformed numeric values fail the probe and leave the prior persisted observation intact.
- Non-2xx billing windows retain their status code for fail-closed media eligibility; unauthorized/forbidden responses never become paid evidence.
- Explicit free plans and free JWT tiers remain ineligible even if a usage percentage is present.
- `creditUsagePercent` alone never proves paid access; positive plan/tier or a positive credit limit is required.
- Optional tier lookup failures do not discard an otherwise valid billing snapshot.
- No new database table or migration is required; the versioned JSON snapshot is extended with optional fields.

## Verification

- Go unit tests cover Grok2API-shaped parsing, derived formulas, aliases, zero/negative/overflow/malformed values, free/paid classification, and projection compatibility.
- Controller tests confirm only the whitelisted fields appear in JSON.
- Frontend tests cover formatting of monthly, weekly, on-demand, prepaid, and reset states.
- Run targeted Grok/model/controller tests, frontend typecheck/tests, and a full build before commit.
